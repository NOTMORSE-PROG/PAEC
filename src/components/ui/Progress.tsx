'use client'

import { forwardRef } from 'react'
import { clsx } from 'clsx'

interface ProgressProps {
  value: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'success' | 'warning' | 'error'
  showLabel?: boolean
  label?: string
  className?: string
}

const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      value,
      max = 100,
      size = 'md',
      variant = 'primary',
      showLabel = false,
      label,
      className,
    },
    ref
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

    const sizes = {
      sm: 'h-1.5',
      md: 'h-2',
      lg: 'h-3',
    }

    const variants = {
      primary: 'from-primary-500 to-primary-400',
      success: 'from-green-500 to-green-400',
      warning: 'from-amber-500 to-amber-400',
      error: 'from-red-500 to-red-400',
    }

    return (
      <div ref={ref} className={clsx('w-full', className)}>
        {(showLabel || label) && (
          <div className="flex items-center justify-between text-sm mb-2">
            {label && <span className="text-gray-600">{label}</span>}
            {showLabel && (
              <span className="font-medium text-primary-600">
                {Math.round(percentage)}%
              </span>
            )}
          </div>
        )}
        <div
          className={clsx(
            'bg-gray-100 rounded-full overflow-hidden',
            sizes[size]
          )}
        >
          <div
            className={clsx(
              'h-full bg-gradient-to-r rounded-full transition-all duration-500 ease-out',
              variants[variant]
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    )
  }
)

Progress.displayName = 'Progress'

export default Progress
