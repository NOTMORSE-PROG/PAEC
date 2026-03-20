'use client'

import { History } from 'lucide-react'

export interface SessionRow {
  id: string
  score: number | null
  question_ids: string[] | null
  completed_at: string | null
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

interface Props {
  sessions: SessionRow[]
  loading: boolean
}

export default function SessionHistory({ sessions, loading }: Props) {
  if (loading || sessions.length === 0) return null

  const visible = sessions.slice(0, 5)

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-700">Recent Sessions</h3>
      </div>
      <ul className="divide-y divide-gray-100">
        {visible.map((s) => {
          const qCount = s.question_ids?.length ?? 0
          return (
            <li key={s.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
              <span className="text-sm text-gray-500">{formatDate(s.completed_at)}</span>
              <div className="flex items-center gap-3">
                {qCount > 0 && (
                  <span className="text-xs text-gray-400">{qCount} questions</span>
                )}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${scoreBadgeClass(s.score)}`}>
                  {s.score !== null ? `${s.score}%` : '—'}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
