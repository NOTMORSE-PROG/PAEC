'use client'

import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { clsx } from 'clsx'

interface StatCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  change?: {
    value: number
    label?: string
  }
  variant?: 'default' | 'primary' | 'gradient'
  className?: string
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  change,
  variant = 'default',
  className,
}: StatCardProps) {
  const variants = {
    default: 'bg-white border border-gray-100',
    primary: 'bg-primary-50 border border-primary-100',
    gradient: 'bg-gradient-to-br from-primary-500 to-primary-700 text-white',
  }

  const getTrendIcon = () => {
    if (!change) return null
    if (change.value > 0) return TrendingUp
    if (change.value < 0) return TrendingDown
    return Minus
  }

  const getTrendColor = () => {
    if (!change) return ''
    if (variant === 'gradient') {
      return change.value >= 0 ? 'text-green-300' : 'text-red-300'
    }
    return change.value >= 0 ? 'text-green-600' : 'text-red-600'
  }

  const TrendIcon = getTrendIcon()

  return (
    <div
      className={clsx(
        'p-6 rounded-2xl shadow-soft',
        variants[variant],
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        {Icon && (
          <div
            className={clsx(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              variant === 'gradient' ? 'bg-white/20' : 'bg-primary-100'
            )}
          >
            <Icon
              className={clsx(
                'w-5 h-5',
                variant === 'gradient' ? 'text-white' : 'text-primary-600'
              )}
            />
          </div>
        )}
        {change && TrendIcon && (
          <div
            className={clsx(
              'flex items-center gap-1 text-xs font-medium',
              getTrendColor()
            )}
          >
            <TrendIcon className="w-3 h-3" />
            {change.value > 0 ? '+' : ''}
            {change.value}%
          </div>
        )}
      </div>

      <div
        className={clsx(
          'text-2xl font-bold mb-1',
          variant === 'gradient' ? 'text-white' : 'text-gray-900'
        )}
      >
        {value}
      </div>

      <div
        className={clsx(
          'text-sm',
          variant === 'gradient' ? 'text-primary-200' : 'text-gray-500'
        )}
      >
        {label}
      </div>

      {change?.label && (
        <div
          className={clsx(
            'text-xs mt-2',
            variant === 'gradient' ? 'text-primary-200' : 'text-gray-500'
          )}
        >
          {change.label}
        </div>
      )}
    </div>
  )
}
