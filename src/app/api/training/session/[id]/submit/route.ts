import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  getTrainingSession,
  getTrainingQuestionById,
  submitTrainingSession,
  TrainingQuestion,
} from '@/lib/database'

// ─── Scoring helpers ─────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[m][n]
}

/** Lowercase, strip punctuation, collapse whitespace */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Extract meaningful tokens (length > 1, skip filler words) */
const FILLER = new Set(['a', 'an', 'the', 'to', 'and', 'or', 'of', 'in', 'on', 'at', 'is', 'for'])
function tokens(s: string): string[] {
  return normalize(s).split(' ').filter(w => w.length > 1 && !FILLER.has(w))
}

/**
 * Hybrid score: 70% token overlap + 30% character-level similarity.
 * Token overlap checks how many key tokens from the correct answer appear
 * anywhere in the user's answer (fuzzy: levenshtein ≤ 2 counts as a hit).
 */
function hybridScore(userRaw: string, correctRaw: string): number {
  if (!userRaw.trim()) return 0
  const user = normalize(userRaw)
  const correct = normalize(correctRaw)

  // Token overlap
  const correctTokens = tokens(correct)
  const userTokens = tokens(user)
  if (correctTokens.length === 0) return 100

  let hits = 0
  for (const ct of correctTokens) {
    // exact substring match or fuzzy per-token match
    if (user.includes(ct)) { hits++; continue }
    if (userTokens.some(ut => levenshtein(ut, ct) <= Math.max(1, Math.floor(ct.length * 0.25)))) hits++
  }
  const tokenScore = hits / correctTokens.length

  // Character-level similarity
  const dist = levenshtein(user, correct)
  const maxLen = Math.max(user.length, correct.length)
  const charScore = maxLen === 0 ? 1 : Math.max(0, 1 - dist / maxLen)

  return Math.round((tokenScore * 0.7 + charScore * 0.3) * 100)
}

// ─── Scenario element detection ───────────────────────────────────────────────

export interface ElementDetail { name: string; value: string; found: boolean }

const SPOKEN_TO_DIGIT: Record<string, string> = {
  zero:'0', one:'1', wun:'1', two:'2', too:'2', three:'3', tree:'3',
  four:'4', fower:'4', five:'5', fife:'5', six:'6', seven:'7',
  eight:'8', ait:'8', nine:'9', niner:'9',
}
function normalizeNums(s: string): string {
  return s.split(/\s+/).map(w => SPOKEN_TO_DIGIT[w] ?? w).join(' ')
}

function computeScenarioElements(
  data: Record<string, unknown>,
  answer: string
): { score: number; elements: ElementDetail[] } {
  const clearance = normalize(String(data.atcClearance ?? ''))
  const callSign = normalize(String(data.callSign ?? ''))
  const userAnswer = normalize(answer)
  if (!userAnswer.trim()) return { score: 0, elements: [] }

  const userNums = normalizeNums(userAnswer)
  const clearanceNums = normalizeNums(clearance)
  const elements: ElementDetail[] = []

  // 1. Callsign always required
  const csFound = callSign.length > 0 && userAnswer.includes(callSign)
  elements.push({ name: 'callSign', value: String(data.callSign ?? ''), found: csFound })

  // 2. Altitude / flight level
  const altMatch = clearanceNums.match(/(?:fl\s*|flight level\s*)(\d+)|(\d+)\s*feet/i)
    ?? clearance.match(/(?:fl\s*|flight level\s*)(\d+)/i)
  if (altMatch) {
    const altNum = (altMatch[1] ?? altMatch[2] ?? '').replace(/\s/g, '')
    if (altNum) {
      const altLabel = altMatch[1] ? `FL${altNum}` : `${altNum} feet`
      elements.push({ name: 'altitude', value: altLabel, found: userNums.replace(/\s/g, '').includes(altNum) })
    }
  }

  // 3. Heading
  const hdgMatch = clearanceNums.match(/heading\s+(\d+)/)
  if (hdgMatch) {
    const hdgNum = hdgMatch[1]
    elements.push({ name: 'heading', value: hdgNum, found: userNums.replace(/\s/g, '').includes(hdgNum) })
  }

  // 4. Squawk code
  const sqwkMatch = clearanceNums.match(/squawk\s*(\d{4})/)
  if (sqwkMatch) {
    const sqwk = sqwkMatch[1]
    const sqwkPattern = sqwk.split('').join(' ?')
    elements.push({ name: 'squawk', value: sqwk, found: new RegExp(sqwkPattern).test(userNums.replace(/\s/g, '')) })
  }

  // 5. Route / destination keyword
  const routeMatch = clearance.match(/cleared\s+to\s+(\w+)|via\s+(\w+)|direct\s+(\w+)/)
  if (routeMatch) {
    const dest = (routeMatch[1] ?? routeMatch[2] ?? routeMatch[3] ?? '').toLowerCase()
    if (dest.length > 2) elements.push({ name: 'route', value: dest, found: userAnswer.includes(dest) })
  }

  if (elements.length === 0) {
    const fallback = hybridScore(answer, String(data.correctResponse ?? ''))
    return { score: fallback, elements: [] }
  }
  const matched = elements.filter(e => e.found).length
  return { score: Math.round((matched / elements.length) * 100), elements }
}

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

    case 'scenario':
      return computeScenarioElements(data, String(answer ?? '')).score

    case 'readback': {
      const correctReadback = String(data.correctReadback ?? '')
      const incorrectReadback = String(data.incorrectReadback ?? '')
      const userAnswer = String(answer ?? '')

      // If the user submitted the pre-filled incorrect readback unchanged, score is 0
      if (incorrectReadback.trim() && normalize(userAnswer) === normalize(incorrectReadback)) {
        return 0
      }

      const base = hybridScore(userAnswer, correctReadback)
      // Penalty: if the known error phrases are still present, student didn't fix them
      const errors = (data.errors as Array<{ wrong: string }> | undefined) ?? []
      if (errors.length > 0) {
        const userNorm = normalize(userAnswer)
        const unfixed = errors.filter(e => {
          const wrongNorm = normalize(e.wrong ?? '')
          return wrongNorm.length > 1 && userNorm.includes(wrongNorm)
        }).length
        if (unfixed > 0) {
          const penaltyFactor = Math.max(0.3, 1 - unfixed * 0.35)
          return Math.round(base * penaltyFactor)
        }
      }
      return base
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
  const answers: Record<string, unknown> = body.answers ?? {}

  // Fetch all questions and score server-side
  const questionIds = trainingSession.question_ids as string[]
  const questions = await Promise.all(questionIds.map(id => getTrainingQuestionById(id)))
  const validQuestions = questions.filter(Boolean) as TrainingQuestion[]

  const questionScores: Record<string, number> = {}
  const elementResults: Record<string, ElementDetail[]> = {}
  for (const q of validQuestions) {
    if (q.category === 'scenario') {
      const { score, elements } = computeScenarioElements(
        q.question_data as Record<string, unknown>,
        String(answers[q.id] ?? '')
      )
      questionScores[q.id] = score
      elementResults[q.id] = elements
    } else {
      questionScores[q.id] = scoreQuestion(q, answers[q.id])
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
