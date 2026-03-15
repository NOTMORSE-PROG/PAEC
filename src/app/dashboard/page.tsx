'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  Radio,
  Target,
  BookOpen,
  Headphones,
  BarChart3,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  ArrowUpRight,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react'

interface CategorySummary {
  category: string
  bestScore: number | null
  count: number
  activeQuestions: number
}

interface RecentSession {
  id: string
  category: string
  score: number | null
  completed_at: string | null
  created_at: string
}

interface DashData {
  userName: string | null
  summary: CategorySummary[]
  recentSessions: RecentSession[]
  areasToImprove: { category: string; bestScore: number | null }[]
  weeklyTrend: { delta: number; thisWeekCount: number } | null
}

const MODULES = [
  {
    id: 'scenario',
    title: 'Scenario Simulation',
    description: 'Practice ATC clearances in realistic scenarios',
    icon: Radio,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'readback',
    title: 'Readback Correction',
    description: 'Identify and correct pilot readback errors',
    icon: Target,
    color: 'from-indigo-500 to-purple-500',
  },
  {
    id: 'jumbled',
    title: 'Jumbled Clearance',
    description: 'Arrange words into correct phraseology',
    icon: BookOpen,
    color: 'from-violet-500 to-pink-500',
  },
  {
    id: 'pronunciation',
    title: 'Pronunciation Drill',
    description: 'Master ICAO standard pronunciation',
    icon: Headphones,
    color: 'from-emerald-500 to-teal-500',
  },
]

const CATEGORY_LABELS: Record<string, string> = {
  scenario: 'Scenario Simulation',
  readback: 'Readback Correction',
  jumbled: 'Jumbled Clearance',
  pronunciation: 'Pronunciation Drill',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 3_600_000) {
    const m = Math.max(1, Math.round(diff / 60_000))
    return `${m} min ago`
  }
  if (diff < 86_400_000) {
    const h = Math.round(diff / 3_600_000)
    return `${h} hour${h !== 1 ? 's' : ''} ago`
  }
  if (diff < 172_800_000) return 'Yesterday'
  return new Date(dateStr).toLocaleDateString()
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [dashData, setDashData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d: DashData) => setDashData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const firstName = session?.user?.name?.split(' ')[0] ?? 'Pilot'
  const getSummary = (id: string) => dashData?.summary.find((s) => s.category === id)
  const totalSessions = dashData?.summary.reduce((s, c) => s + c.count, 0) ?? 0

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Welcome back, {firstName}!
          </h1>
          <p className="text-gray-600 mt-1">
            Continue your aviation communication training journey.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/training" className="btn-primary">
            Start Training
            <ArrowUpRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </div>

      {/* Training Modules */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Training Modules</h2>
          <Link href="/dashboard/training" className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1">
            View All
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {MODULES.map((module) => {
            const stats = getSummary(module.id)
            const bestScore = stats?.bestScore ?? null
            const sessions = stats?.count ?? 0
            const barWidth = bestScore !== null ? bestScore : 0

            return (
              <Link
                key={module.id}
                href={`/dashboard/training/${module.id}`}
                className="card-interactive p-6 group"
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${module.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <module.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{module.title}</h3>
                <p className="text-sm text-gray-500 mb-4">{module.description}</p>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Best Score</span>
                    {loading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                    ) : (
                      <span className="font-medium text-primary-600">
                        {bestScore !== null ? `${bestScore}%` : '—'}
                      </span>
                    )}
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: loading ? '0%' : `${barWidth}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
                    {loading ? (
                      <span className="text-gray-300">Loading…</span>
                    ) : (
                      <>
                        <span>{sessions} session{sessions !== 1 ? 's' : ''}</span>
                        <span>{bestScore !== null ? `Best: ${bestScore}%` : 'No sessions yet'}</span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            <Link href="/dashboard/scores" className="text-sm font-medium text-primary-600 hover:text-primary-700">
              View All
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : !dashData?.recentSessions.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <CheckCircle className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No activity yet — start a training session!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {dashData.recentSessions.map((session) => {
                const dateStr = session.completed_at ?? session.created_at
                return (
                  <div
                    key={session.id}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-100">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">
                        {CATEGORY_LABELS[session.category] ?? session.category}
                      </p>
                      <p className="text-sm text-gray-500">{timeAgo(dateStr)}</p>
                    </div>
                    {session.score !== null && (
                      <div className="text-right">
                        <p className={`text-lg font-bold ${
                          session.score >= 80 ? 'text-green-600' : session.score >= 60 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {session.score}%
                        </p>
                        <p className="text-xs text-gray-500">Score</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick Actions & Insights */}
        <div className="space-y-6">
          {/* Analysis Quick Access */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Corpus Analysis</h3>
            <p className="text-sm text-gray-500 mb-4">
              Analyze aviation communication patterns from three corpus categories.
            </p>
            <div className="space-y-2 mb-4">
              {['APP/DEP', 'GND', 'RAMP'].map((corpus) => (
                <div key={corpus} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">{corpus}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              ))}
            </div>
            <Link href="/dashboard/analysis" className="btn-secondary w-full text-sm">
              Open Analysis Mode
              <BarChart3 className="w-4 h-4 ml-2" />
            </Link>
          </div>

          {/* Performance Insight */}
          {!loading && dashData?.weeklyTrend !== null && (
            <div className="card p-6 bg-gradient-to-br from-primary-500 to-primary-700 text-white">
              <h3 className="font-semibold mb-2">Performance Insight</h3>
              <p className="text-sm text-primary-100 mb-4">
                {dashData!.weeklyTrend!.delta > 0
                  ? `Your average score improved by ${dashData!.weeklyTrend!.delta}% this week.`
                  : dashData!.weeklyTrend!.delta < 0
                  ? `Your average score dipped by ${Math.abs(dashData!.weeklyTrend!.delta)}% vs. last week — keep practising.`
                  : `${dashData!.weeklyTrend!.thisWeekCount} session${dashData!.weeklyTrend!.thisWeekCount !== 1 ? 's' : ''} completed this week.`}
              </p>
              <div className="flex items-center gap-2">
                {dashData!.weeklyTrend!.delta >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-300" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-amber-300" />
                )}
                <span className={`text-sm font-medium ${dashData!.weeklyTrend!.delta >= 0 ? 'text-green-300' : 'text-amber-300'}`}>
                  {dashData!.weeklyTrend!.delta > 0 ? 'Great progress!' : dashData!.weeklyTrend!.delta < 0 ? 'Keep at it!' : 'Stay consistent!'}
                </span>
              </div>
            </div>
          )}

          {/* Areas to Improve */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Areas to Improve</h3>
                <p className="text-xs text-gray-500">Based on recent training</p>
              </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-4 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : dashData?.areasToImprove.length ? (
              <ul className="space-y-2 text-sm">
                {dashData.areasToImprove.map((area) => (
                  <li key={area.category} className="flex items-center justify-between text-gray-600">
                    <span className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                      {CATEGORY_LABELS[area.category] ?? area.category}
                    </span>
                    {area.bestScore !== null && (
                      <span className="text-xs text-amber-600 font-medium">{area.bestScore}%</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : totalSessions > 0 ? (
              <p className="text-sm text-green-600 font-medium">Strong performance across all modules — keep it up!</p>
            ) : (
              <p className="text-sm text-gray-400">Complete a training session to see your weak areas.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
