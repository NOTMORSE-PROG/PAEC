'use client'

import { clsx } from 'clsx'

interface ExerciseProgressProps {
  current: number
  total: number
  completedSteps?: number[]
}

export default function ExerciseProgress({
  current,
  total,
  completedSteps = [],
}: ExerciseProgressProps) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, index) => {
        const stepNumber = index + 1
        const isCompleted = completedSteps.includes(stepNumber) || index < current
        const isCurrent = index === current

        return (
          <div
            key={index}
            className={clsx(
              'flex-1 h-2 rounded-full transition-all duration-300',
              isCompleted
                ? 'bg-green-500'
                : isCurrent
                ? 'bg-primary-500'
                : 'bg-gray-200'
            )}
          />
        )
      })}
    </div>
  )
}

interface ExerciseProgressDotsProps {
  current: number
  total: number
}

export function ExerciseProgressDots({ current, total }: ExerciseProgressDotsProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, index) => (
        <div
          key={index}
          className={clsx(
            'w-2 h-2 rounded-full transition-all duration-300',
            index < current
              ? 'bg-green-500'
              : index === current
              ? 'bg-primary-500 w-8'
              : 'bg-gray-300'
          )}
        />
      ))}
    </div>
  )
}
