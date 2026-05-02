import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getRandomActiveQuestions, countActiveQuestions, createTrainingSession } from '@/lib/database'
import {
  buildJumbledDistractorPool,
  pickDistractorsForQuestion,
  distractorCount,
} from '@/lib/jumbledDistractors'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { category } = body

  if (!category || !['scenario', 'readback', 'jumbled', 'pronunciation'].includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  const count = await countActiveQuestions(category)
  if (count === 0) {
    return NextResponse.json({ error: 'No questions available for this category yet.' }, { status: 404 })
  }

  const questions = await getRandomActiveQuestions(category, 10)
  const questionIds = questions.map(q => q.id)

  const sessionId = await createTrainingSession(session.user.id, category, questionIds)

  let payload = questions.map(q => ({
    id: q.id,
    category: q.category,
    question_data: q.question_data,
    difficulty: q.difficulty,
  }))

  if (category === 'jumbled') {
    const pool = await buildJumbledDistractorPool()
    payload = payload.map(q => {
      const data = q.question_data as Record<string, unknown>
      const correctOrder = (data.correctOrder as string[] | undefined) ?? []
      const distractors = pickDistractorsForQuestion(
        correctOrder,
        pool,
        distractorCount(correctOrder.length),
      )
      return {
        ...q,
        question_data: { ...data, distractors },
      }
    })
  }

  return NextResponse.json({ sessionId, questions: payload })
}
