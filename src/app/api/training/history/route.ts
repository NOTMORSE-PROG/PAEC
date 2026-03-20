import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUserTrainingSessions, getUserBestScore, getUserSessionCount, countActiveQuestions } from '@/lib/database'
const CATEGORIES = ['scenario', 'readback', 'jumbled', 'pronunciation', 'ground'] as const

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')

  if (category) {
    const sessions = await getUserTrainingSessions(session.user.id, category, 10)
    const bestScore = await getUserBestScore(session.user.id, category)
    const count = await getUserSessionCount(session.user.id, category)
    const activeQuestions = await countActiveQuestions(category)
    return NextResponse.json({ sessions, bestScore, count, activeQuestions })
  }

  // Return summary for all categories
  const summary = await Promise.all(
    CATEGORIES.map(async (cat) => ({
      category: cat,
      bestScore: await getUserBestScore(session.user.id, cat),
      count: await getUserSessionCount(session.user.id, cat),
      activeQuestions: await countActiveQuestions(cat),
      recentSessions: await getUserTrainingSessions(session.user.id, cat, 3),
    }))
  )

  return NextResponse.json({ summary })
}
