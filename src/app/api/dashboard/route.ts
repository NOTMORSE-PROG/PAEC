import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  getUserBestScore,
  getUserSessionCount,
  getUserTrainingSessions,
  countActiveQuestions,
} from '@/lib/database'

const CATEGORIES = ['scenario', 'readback', 'jumbled', 'pronunciation'] as const
type Category = (typeof CATEGORIES)[number]

function weekBounds(offsetWeeks = 0) {
  const now = new Date()
  const day = now.getDay() // 0=Sun … 6=Sat
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7) - offsetWeeks * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 7)
  return { start: monday, end: sunday }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  // a) Per-category summary
  const summary = await Promise.all(
    CATEGORIES.map(async (cat) => ({
      category: cat as Category,
      bestScore: await getUserBestScore(userId, cat),
      count: await getUserSessionCount(userId, cat),
      activeQuestions: await countActiveQuestions(cat),
    }))
  )

  // b) Recent activity — last 5 completed sessions across all categories
  const recentSessions = await getUserTrainingSessions(userId, undefined, 5)

  // c) Areas to improve — weakest categories (with at least 1 session)
  const categoriesWithSessions = summary
    .filter((s) => s.count > 0)
    .sort((a, b) => (a.bestScore ?? 0) - (b.bestScore ?? 0))
  const areasToImprove = categoriesWithSessions
    .filter((s) => (s.bestScore ?? 100) < 80)
    .slice(0, 3)
    .map((s) => ({ category: s.category, bestScore: s.bestScore }))

  // d) Weekly trend — compare this week vs last week avg score
  const last20 = await getUserTrainingSessions(userId, undefined, 20)
  const thisWeek = weekBounds(0)
  const lastWeek = weekBounds(1)

  const thisWeekSessions = last20.filter((s) => {
    const d = new Date(s.completed_at ?? s.started_at)
    return d >= thisWeek.start && d < thisWeek.end
  })
  const lastWeekSessions = last20.filter((s) => {
    const d = new Date(s.completed_at ?? s.started_at)
    return d >= lastWeek.start && d < lastWeek.end
  })

  let weeklyTrend: { delta: number; thisWeekCount: number } | null = null
  if (thisWeekSessions.length > 0) {
    const avg = (arr: typeof last20) =>
      Math.round(arr.reduce((s, x) => s + (x.score ?? 0), 0) / arr.length)
    const thisAvg = avg(thisWeekSessions)
    const lastAvg = lastWeekSessions.length > 0 ? avg(lastWeekSessions) : null
    weeklyTrend = {
      delta: lastAvg !== null ? thisAvg - lastAvg : 0,
      thisWeekCount: thisWeekSessions.length,
    }
  }

  return NextResponse.json({
    userName: session.user.name ?? null,
    summary,
    recentSessions,
    areasToImprove,
    weeklyTrend,
  })
}
