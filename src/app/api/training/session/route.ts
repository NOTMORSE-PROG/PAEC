import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getRandomActiveQuestions, countActiveQuestions, createTrainingSession } from '@/lib/database'

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

  return NextResponse.json({
    sessionId,
    questions: questions.map(q => ({
      id: q.id,
      category: q.category,
      question_data: q.question_data,
      difficulty: q.difficulty,
    })),
  })
}
