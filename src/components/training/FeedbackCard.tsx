'use client'

import { CheckCircle, XCircle, AlertTriangle, Lightbulb } from 'lucide-react'
import { clsx } from 'clsx'

interface FeedbackCardProps {
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  score?: number
  message?: string
  corrections?: string[]
  suggestion?: string
  tip?: string
}

export default function FeedbackCard({
  type,
  title,
  score,
  message,
  corrections,
  suggestion,
  tip,
}: FeedbackCardProps) {
  const styles = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      iconBg: 'bg-green-100',
      icon: CheckCircle,
      iconColor: 'text-green-600',
      titleColor: 'text-green-800',
      textColor: 'text-green-700',
      scoreColor: 'text-green-600',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      iconBg: 'bg-red-100',
      icon: XCircle,
      iconColor: 'text-red-600',
      titleColor: 'text-red-800',
      textColor: 'text-red-700',
      scoreColor: 'text-red-600',
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      iconBg: 'bg-amber-100',
      icon: AlertTriangle,
      iconColor: 'text-amber-600',
      titleColor: 'text-amber-800',
      textColor: 'text-amber-700',
      scoreColor: 'text-amber-600',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      iconBg: 'bg-blue-100',
      icon: Lightbulb,
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-800',
      textColor: 'text-blue-700',
      scoreColor: 'text-blue-600',
    },
  }

  const style = styles[type]
  const Icon = style.icon

  return (
    <div className={clsx('p-6 rounded-xl border', style.bg, style.border)}>
      <div className="flex items-start gap-4">
        <div
          className={clsx(
            'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
            style.iconBg
          )}
        >
          <Icon className={clsx('w-6 h-6', style.iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className={clsx('font-semibold', style.titleColor)}>{title}</h4>
            {score !== undefined && (
              <span className={clsx('text-2xl font-bold', style.scoreColor)}>
                {score}%
              </span>
            )}
          </div>

          {message && (
            <p className={clsx('text-sm mb-4', style.textColor)}>{message}</p>
          )}

          {corrections && corrections.length > 0 && (
            <div className="mb-4">
              <p className={clsx('text-sm font-medium mb-2', style.titleColor)}>
                Corrections needed:
              </p>
              <ul className="space-y-1">
                {corrections.map((correction, index) => (
                  <li
                    key={index}
                    className={clsx('text-sm flex items-center gap-2', style.textColor)}
                  >
                    <span
                      className={clsx(
                        'w-1.5 h-1.5 rounded-full',
                        type === 'error' ? 'bg-red-500' : 'bg-amber-500'
                      )}
                    />
                    {correction}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {suggestion && (
            <div className="p-4 bg-white rounded-xl border border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-1">
                Suggested Response:
              </p>
              <p className="text-gray-900">{suggestion}</p>
            </div>
          )}

          {tip && (
            <div className="mt-4 flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">{tip}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
