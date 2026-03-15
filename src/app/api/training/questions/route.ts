import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getRandomActiveQuestions, countActiveQuestions } from '@/lib/database'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')

  if (!category || !['scenario', 'readback', 'jumbled', 'pronunciation'].includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  const count = await countActiveQuestions(category)
  if (count === 0) {
    return NextResponse.json({ error: 'No questions available for this category' }, { status: 404 })
  }

  const questions = await getRandomActiveQuestions(category, 10)

  return NextResponse.json({ questions, total: count })
}
