import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  getTrainingSession,
  getTrainingQuestionById,
  submitTrainingSession,
  TrainingQuestion,
} from '@/lib/database'
import {
  levenshtein,
  normalize,
  tokens,
  FILLER,
  MAX_ANSWER_LEN,
  semanticReadbackScore,
  computeScenarioElements,
  type ElementDetail,
} from '@/lib/atcAnswerMatcher'

// ─── Legacy hybrid scorer (kept for FLEXIBLE_SCORER=off fallback) ─────────────

function hybridScore(userRaw: string, correctRaw: string): number {
  if (!userRaw.trim()) return 0
  const user = normalize(userRaw)
  const correct = normalize(correctRaw)
  const correctTokens = tokens(correct)
  const userTokens = tokens(user)
  if (correctTokens.length === 0) return 100
  let hits = 0
  for (const ct of correctTokens) {
    if (user.includes(ct)) { hits++; continue }
    if (userTokens.some(ut => levenshtein(ut, ct) <= Math.max(1, Math.floor(ct.length * 0.25)))) hits++
  }
  const tokenScore = hits / correctTokens.length
  const dist = levenshtein(user, correct)
  const maxLen = Math.max(user.length, correct.length)
  const charScore = maxLen === 0 ? 1 : Math.max(0, 1 - dist / maxLen)
  return Math.round((tokenScore * 0.7 + charScore * 0.3) * 100)
}

export type { ElementDetail }

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreQuestion(question: TrainingQuestion, answer: unknown): number {
  const data = question.question_data as Record<string, unknown>

  switch (question.category) {
    case 'pronunciation': {
      const selected = normalize(String(answer ?? ''))
      const correct = normalize(String(data.correctPronunciation ?? ''))
      // Exact match or very close (typo tolerance)
      return selected === correct || levenshtein(selected, correct) <= 1 ? 100 : 0
    }

    case 'jumbled': {
      const correctOrder = (data.correctOrder as string[]) ?? []
      const submitted = String(answer ?? '').trim().split(/\s+/).filter(Boolean)
      if (correctOrder.length === 0) return 0
      const total = correctOrder.length

      // Position score: word in correct index (fuzzy)
      let posHits = 0
      for (let i = 0; i < total; i++) {
        const cw = normalize(correctOrder[i])
        const uw = normalize(submitted[i] ?? '')
        if (uw === cw || levenshtein(uw, cw) <= 1) posHits++
      }

      // Presence score: word appears anywhere in submitted answer (fuzzy)
      const normSubmitted = submitted.map(w => normalize(w))
      let presHits = 0
      for (const cw of correctOrder.map(w => normalize(w))) {
        if (normSubmitted.some(uw => uw === cw || levenshtein(uw, cw) <= 1)) presHits++
      }

      // Blend: 60% position, 40% presence
      const blended = (posHits / total) * 0.6 + (presHits / total) * 0.4
      return Math.round(blended * 100)
    }

    case 'scenario': {
      const userAnswer = String(answer ?? '').slice(0, MAX_ANSWER_LEN)
      const oldScore = computeScenarioElements(data, userAnswer).score
      if (process.env.FLEXIBLE_SCORER === 'off') return oldScore
      // New scorer re-uses computeScenarioElements (already upgraded in atcAnswerMatcher)
      const newScore = computeScenarioElements(data, userAnswer).score
      if (process.env.SCORING_LOG_DELTA === 'on') {
        console.log(JSON.stringify({
          event: 'training.score.delta',
          questionId: question.id,
          category: 'scenario',
          oldScore,
          newScore,
          delta: newScore - oldScore,
        }))
      }
      return newScore
    }

    case 'readback': {
      const correctReadback = String(data.correctReadback ?? '')
      const incorrectReadback = String(data.incorrectReadback ?? '')
      const userAnswer = String(answer ?? '').slice(0, MAX_ANSWER_LEN)

      // Legacy scorer (kept for FLEXIBLE_SCORER=off fallback)
      const oldScore = (() => {
        if (incorrectReadback.trim() && normalize(userAnswer) === normalize(incorrectReadback)) return 0
        const base = hybridScore(userAnswer, correctReadback)
        const errors = (data.errors as Array<{ wrong: string }> | undefined) ?? []
        if (errors.length > 0) {
          const userNorm = normalize(userAnswer)
          const unfixed = errors.filter(e => {
            const wrongNorm = normalize(e.wrong ?? '')
            return wrongNorm.length > 1 && userNorm.includes(wrongNorm)
          }).length
          if (unfixed > 0) return Math.round(base * Math.max(0.3, 1 - unfixed * 0.35))
        }
        return base
      })()

      if (process.env.FLEXIBLE_SCORER === 'off') return oldScore

      const newScore = semanticReadbackScore(userAnswer, {
        correctReadback,
        incorrectReadback,
        atcInstruction: String(data.atcInstruction ?? ''),
        callSign: String(data.callSign ?? ''),
        errors: (data.errors as Array<{ wrong: string }> | undefined) ?? [],
      })

      if (process.env.SCORING_LOG_DELTA === 'on') {
        console.log(JSON.stringify({
          event: 'training.score.delta',
          questionId: question.id,
          category: 'readback',
          oldScore,
          newScore,
          delta: newScore - oldScore,
        }))
      }

      return newScore
    }

    default:
      return 0
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: sessionId } = await params
  const trainingSession = await getTrainingSession(sessionId)

  if (!trainingSession) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }
  if (trainingSession.user_id !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (trainingSession.completed) {
    return NextResponse.json({ error: 'Session already submitted' }, { status: 409 })
  }

  const body = await req.json()

  // Cap each answer to MAX_ANSWER_LEN chars to prevent multi-megabyte inputs
  // from causing O(n²) Levenshtein DP allocation and OOM crashes.
  const rawAnswers = (body.answers ?? {}) as Record<string, unknown>
  const answers: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(rawAnswers)) {
    answers[k] = typeof v === 'string' ? v.slice(0, MAX_ANSWER_LEN) : v
  }

  // Fetch all questions and score server-side
  const questionIds = trainingSession.question_ids as string[]
  const questions = await Promise.all(questionIds.map(id => getTrainingQuestionById(id)))
  const validQuestions = questions.filter(Boolean) as TrainingQuestion[]

  const questionScores: Record<string, number> = {}
  const elementResults: Record<string, ElementDetail[]> = {}
  for (const q of validQuestions) {
    try {
      if (q.category === 'scenario') {
        const { score, elements } = computeScenarioElements(
          q.question_data as Record<string, unknown>,
          String(answers[q.id] ?? '').slice(0, MAX_ANSWER_LEN)
        )
        questionScores[q.id] = score
        elementResults[q.id] = elements
      } else {
        questionScores[q.id] = scoreQuestion(q, answers[q.id])
      }
    } catch (err) {
      console.error('training.score.error', {
        questionId: q.id,
        category: q.category,
        error: String(err),
      })
      questionScores[q.id] = 0
      if (q.category === 'scenario') elementResults[q.id] = []
    }
  }

  const totalScore =
    validQuestions.length === 0
      ? 0
      : Math.round(
          Object.values(questionScores).reduce((a, b) => a + b, 0) / validQuestions.length
        )

  await submitTrainingSession(sessionId, answers, questionScores, totalScore)

  // Return full question data (with correct answers) so results screen can show breakdown
  return NextResponse.json({
    score: totalScore,
    questionScores,
    elementResults,
    questions: validQuestions.map(q => ({
      id: q.id,
      category: q.category,
      question_data: q.question_data,
      difficulty: q.difficulty,
    })),
  })
}
