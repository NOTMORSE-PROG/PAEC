'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Radio,
  Target,
  BookOpen,
  Headphones,
  ArrowRight,
  TrendingUp,
  Star,
  Lock,
  Loader2,
  Lightbulb,
  ChevronDown,
} from 'lucide-react'

const MODULES = [
  {
    id: 'scenario',
    title: 'Scenario-Based Simulation',
    description: 'Practice responding to ATC clearances in realistic flight scenarios. Validate your phraseology against ICAO standards.',
    icon: Radio,
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-50',
    features: ['Real flight scenarios', 'ICAO phraseology validation', 'Instant feedback', 'Multiple difficulty levels'],
    difficulty: 'Intermediate',
    difficultyColor: 'bg-amber-100 text-amber-700',
  },
  {
    id: 'readback',
    title: 'Readback/Hearback Correction',
    description: 'Identify and correct errors in pilot readbacks to ATC instructions. Practice detecting number mismatches and missing elements.',
    icon: Target,
    color: 'from-indigo-500 to-purple-500',
    bgColor: 'bg-indigo-50',
    features: ['Error detection training', 'Number accuracy focus', 'Terminology validation', 'Correction templates'],
    difficulty: 'Advanced',
    difficultyColor: 'bg-red-100 text-red-700',
  },
  {
    id: 'jumbled',
    title: 'Jumbled Clearance',
    description: 'Arrange mixed-order clearance words and numbers into correct standard phraseology sequence.',
    icon: BookOpen,
    color: 'from-violet-500 to-pink-500',
    bgColor: 'bg-violet-50',
    features: ['Click-to-arrange interface', 'Sequence validation', 'Real-time hints', 'Standard phrase structures'],
    difficulty: 'Beginner',
    difficultyColor: 'bg-green-100 text-green-700',
  },
  {
    id: 'pronunciation',
    title: 'Radiotelephony Pronunciation Drill',
    description: 'Master ICAO standard pronunciation for numbers, letters, and aviation terminology.',
    icon: Headphones,
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-50',
    features: ['Audio pronunciation guides', 'Multiple choice format', 'NATO phonetic alphabet', 'Number pronunciation'],
    difficulty: 'Beginner',
    difficultyColor: 'bg-green-100 text-green-700',
  },
]

interface RecentSession {
  id: string
  score: number | null
  question_ids: string[] | null
  completed_at: string | null
  category: string
}

interface CategorySummary {
  category: string
  bestScore: number | null
  count: number
  activeQuestions: number
  recentSessions?: RecentSession[]
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function scoreBadgeClass(score: number | null): string {
  if (score === null) return 'bg-gray-100 text-gray-500'
  if (score >= 80) return 'bg-green-100 text-green-700'
  if (score >= 60) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

export default function TrainingPage() {
  const [summary, setSummary] = useState<CategorySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [openHistory, setOpenHistory] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/training/history')
      .then(r => r.json())
      .then(d => { if (d.summary) setSummary(d.summary) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const getStats = (moduleId: string) => summary.find(s => s.category === moduleId)

  const totalSessions = summary.reduce((s, c) => s + c.count, 0)
  const avgScore = summary.filter(c => c.bestScore !== null).length > 0
    ? Math.round(summary.filter(c => c.bestScore !== null).reduce((s, c) => s + (c.bestScore ?? 0), 0) / summary.filter(c => c.bestScore !== null).length)
    : null

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Training Mode</h1>
        <p className="text-gray-600">Select a training module to practice your aviation communication skills.</p>
      </div>

      {/* Overall Progress */}
      <div className="card p-6 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">Overall Training Progress</h2>
            <p className="text-primary-100 text-sm">
              {loading ? 'Loading your progress...' : totalSessions > 0 ? `${totalSessions} session${totalSessions !== 1 ? 's' : ''} completed across all modules` : 'Start your first training session below.'}
            </p>
          </div>
          {!loading && totalSessions > 0 && (
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold">{totalSessions}</div>
                <div className="text-xs text-primary-200">Sessions</div>
              </div>
              {avgScore !== null && (
                <div className="text-center">
                  <div className="text-3xl font-bold">{avgScore}%</div>
                  <div className="text-xs text-primary-200">Best Avg</div>
                </div>
              )}
            </div>
          )}
          {loading && (
            <Loader2 className="w-6 h-6 animate-spin text-primary-200" />
          )}
        </div>
      </div>

      {/* Recommendation Banner */}
      {!loading && summary.length > 0 && (() => {
        const untried = summary.find(c => c.count === 0 && c.activeQuestions >= 10)
        const lowest = summary
          .filter(c => c.count > 0 && c.bestScore !== null)
          .sort((a, b) => (a.bestScore ?? 0) - (b.bestScore ?? 0))[0]
        const allGood = summary.filter(c => c.count > 0).every(c => (c.bestScore ?? 0) >= 80)
        const mod = untried
          ? MODULES.find(m => m.id === untried.category)
          : lowest && (lowest.bestScore ?? 100) < 70
          ? MODULES.find(m => m.id === lowest.category)
          : null
        const msg = untried
          ? `You haven't tried ${mod?.title ?? untried.category} yet — give it a go!`
          : lowest && (lowest.bestScore ?? 100) < 70
          ? `${mod?.title ?? lowest.category} needs improvement — your best is ${lowest.bestScore}%.`
          : allGood
          ? 'Great work across all categories — keep the streak going!'
          : null
        if (!msg) return null
        return (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-teal-50 border border-teal-200">
            <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center shrink-0">
              <Lightbulb className="w-5 h-5 text-teal-600" />
            </div>
            <p className="text-sm text-teal-800 flex-1">{msg}</p>
            {mod && (
              <Link href={`/dashboard/training/${mod.id}`} className="shrink-0 text-xs font-semibold text-teal-700 hover:text-teal-900 border border-teal-300 rounded-lg px-3 py-1.5 hover:bg-teal-100 transition-colors">
                Start {mod.title.split(' ')[0]}
              </Link>
            )}
          </div>
        )
      })()}

      {/* Training Modules Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {MODULES.map((module) => {
          const stats = getStats(module.id)
          const hasQuestions = !loading && stats !== undefined ? stats.activeQuestions >= 10 : null
          const comingSoon = hasQuestions === false

          return (
            <div key={module.id} className="card overflow-hidden">
              {/* Module Header */}
              <div className={`${module.bgColor} p-6 border-b border-gray-100`}>
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-14 h-14 bg-gradient-to-br ${module.color} rounded-2xl flex items-center justify-center shadow-lg`}>
                    <module.icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex items-center gap-2">
                    {comingSoon && (
                      <span className="badge bg-gray-100 text-gray-500 flex items-center gap-1">
                        <Lock className="w-3 h-3" />Coming Soon
                      </span>
                    )}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{module.title}</h3>
                <p className="text-gray-600 text-sm">{module.description}</p>
              </div>

              {/* Module Stats */}
              <div className="p-6">
                {/* Real stats */}
                {loading ? (
                  <div className="flex items-center justify-center py-4 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : stats && stats.count > 0 ? (
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="text-center p-3 bg-gray-50 rounded-xl">
                      <div className={`text-lg font-bold ${stats.bestScore !== null ? (stats.bestScore >= 80 ? 'text-green-600' : stats.bestScore >= 60 ? 'text-amber-600' : 'text-red-600') : 'text-gray-400'}`}>
                        {stats.bestScore !== null ? `${stats.bestScore}%` : '—'}
                      </div>
                      <div className="text-xs text-gray-500">Best Score</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-xl">
                      <div className="text-lg font-bold text-gray-900">{stats.count}</div>
                      <div className="text-xs text-gray-500">Sessions</div>
                    </div>
                  </div>
                ) : (
                  <div className="mb-6 p-3 bg-gray-50 rounded-xl text-center">
                    <p className="text-sm text-gray-500">No sessions yet</p>
                  </div>
                )}

                {/* Recent sessions per module — collapsible */}
                {!loading && stats && (stats.recentSessions ?? []).length > 0 && (() => {
                  const sessions = stats.recentSessions ?? []
                  const latest = sessions[0]
                  const rest = sessions.slice(1, 3)
                  const isOpen = openHistory === module.id
                  return (
                    <div className="mb-6 rounded-xl border border-gray-200 overflow-hidden">
                      {/* Latest session — always visible, acts as toggle */}
                      <button
                        onClick={() => setOpenHistory(isOpen ? null : module.id)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${module.color}`} />
                          <div className="text-left">
                            <p className="text-xs font-semibold text-gray-700">Last Session</p>
                            <p className="text-xs text-gray-400">{formatDate(latest.completed_at)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${scoreBadgeClass(latest.score)}`}>
                            {latest.score !== null ? `${latest.score}%` : '—'}
                          </span>
                          {rest.length > 0 && (
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                      </button>

                      {/* Older sessions — shown on expand */}
                      {isOpen && rest.length > 0 && (
                        <ul className="divide-y divide-gray-100 border-t border-gray-200 bg-white">
                          {rest.map(s => (
                            <li key={s.id} className="flex items-center justify-between px-4 py-2.5">
                              <span className="text-xs text-gray-500">{formatDate(s.completed_at)}</span>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${scoreBadgeClass(s.score)}`}>
                                {s.score !== null ? `${s.score}%` : '—'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })()}

                {/* Features */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">What you&apos;ll practise:</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {module.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                        <Star className="w-3 h-3 text-amber-500" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Button */}
                {comingSoon ? (
                  <button disabled className="btn-secondary w-full opacity-50 cursor-not-allowed flex items-center justify-center gap-2">
                    <Lock className="w-4 h-4" />
                    No questions yet
                  </button>
                ) : (
                  <Link href={`/dashboard/training/${module.id}`} className="btn-primary w-full flex items-center justify-center">
                    {stats && stats.count > 0 ? 'Continue Training' : 'Start Training'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Tips Section */}
      <div className="card p-6 bg-gradient-to-br from-gray-50 to-white">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary-600" />
          Training Tips
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { title: 'Practice Regularly', description: 'Consistent short sessions are more effective than long irregular ones.' },
            { title: 'Review Mistakes', description: 'Pay attention to feedback and learn from incorrect responses.' },
            { title: 'Challenge Yourself', description: 'Gradually increase difficulty as your skills improve.' },
          ].map((tip, index) => (
            <div key={index} className="p-4 bg-white rounded-xl border border-gray-100">
              <h4 className="font-medium text-gray-900 mb-1">{tip.title}</h4>
              <p className="text-sm text-gray-500">{tip.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
