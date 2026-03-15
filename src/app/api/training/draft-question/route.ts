import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { saveDraftQuestion } from '@/lib/database'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { category, question_data, source_meta } = body

  if (!category || !question_data) {
    return NextResponse.json({ error: 'Missing category or question_data' }, { status: 400 })
  }

  if (!['scenario', 'readback', 'jumbled', 'pronunciation'].includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  const id = await saveDraftQuestion(category, question_data, source_meta, session.user.id)

  return NextResponse.json({ id }, { status: 201 })
}
