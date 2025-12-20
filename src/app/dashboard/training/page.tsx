'use client'

import Link from 'next/link'
import {
  Radio,
  Target,
  BookOpen,
  Headphones,
  ArrowRight,
  Clock,
  Trophy,
  TrendingUp,
  Star
} from 'lucide-react'

export default function TrainingPage() {
  const modules = [
    {
      id: 'scenario',
      title: 'Scenario-Based Simulation',
      description: 'Practice responding to ATC clearances in realistic flight scenarios. Validate your phraseology against ICAO standards.',
      icon: Radio,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50',
      stats: {
        completed: 45,
        total: 60,
        avgScore: 92,
        bestScore: 100,
        timeSpent: '8h 30m',
      },
      features: [
        'Real flight scenarios',
        'ICAO phraseology validation',
        'Instant feedback',
        'Multiple difficulty levels',
      ],
      difficulty: 'Intermediate',
    },
    {
      id: 'readback',
      title: 'Readback/Hearback Correction',
      description: 'Identify and correct errors in pilot readbacks to ATC instructions. Practice detecting number mismatches and missing elements.',
      icon: Target,
      color: 'from-indigo-500 to-purple-500',
      bgColor: 'bg-indigo-50',
      stats: {
        completed: 28,
        total: 50,
        avgScore: 78,
        bestScore: 95,
        timeSpent: '5h 15m',
      },
      features: [
        'Error detection training',
        'Number accuracy focus',
        'Terminology validation',
        'Correction templates',
      ],
      difficulty: 'Advanced',
    },
    {
      id: 'jumbled',
      title: 'Jumbled Clearance',
      description: 'Arrange mixed-order clearance words and numbers into correct standard phraseology sequence.',
      icon: BookOpen,
      color: 'from-violet-500 to-pink-500',
      bgColor: 'bg-violet-50',
      stats: {
        completed: 35,
        total: 45,
        avgScore: 85,
        bestScore: 98,
        timeSpent: '4h 45m',
      },
      features: [
        'Drag-and-drop interface',
        'Sequence validation',
        'Real-time hints',
        'Standard phrase structures',
      ],
      difficulty: 'Beginner',
    },
    {
      id: 'pronunciation',
      title: 'Radiotelephony Pronunciation Drill',
      description: 'Master ICAO standard pronunciation for numbers, letters, and aviation terminology.',
      icon: Headphones,
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'bg-emerald-50',
      stats: {
        completed: 22,
        total: 40,
        avgScore: 88,
        bestScore: 100,
        timeSpent: '3h 20m',
      },
      features: [
        'Audio pronunciation guides',
        'Multiple choice format',
        'NATO phonetic alphabet',
        'Number pronunciation',
      ],
      difficulty: 'Beginner',
    },
  ]

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner':
        return 'bg-green-100 text-green-700'
      case 'Intermediate':
        return 'bg-amber-100 text-amber-700'
      case 'Advanced':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Training Mode
        </h1>
        <p className="text-gray-600">
          Select a training module to practice your aviation communication skills.
        </p>
      </div>

      {/* Overall Progress */}
      <div className="card p-6 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">Overall Training Progress</h2>
            <p className="text-primary-100 text-sm">
              You&apos;ve completed 130 of 195 total exercises across all modules.
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold">67%</div>
              <div className="text-xs text-primary-200">Complete</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">86%</div>
              <div className="text-xs text-primary-200">Avg Score</div>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: '67%' }}></div>
          </div>
        </div>
      </div>

      {/* Training Modules Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {modules.map((module) => (
          <div key={module.id} className="card overflow-hidden">
            {/* Module Header */}
            <div className={`${module.bgColor} p-6 border-b border-gray-100`}>
              <div className="flex items-start justify-between mb-4">
                <div className={`w-14 h-14 bg-gradient-to-br ${module.color} rounded-2xl flex items-center justify-center shadow-lg`}>
                  <module.icon className="w-7 h-7 text-white" />
                </div>
                <span className={`badge ${getDifficultyColor(module.difficulty)}`}>
                  {module.difficulty}
                </span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{module.title}</h3>
              <p className="text-gray-600 text-sm">{module.description}</p>
            </div>

            {/* Module Stats */}
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <div className="text-lg font-bold text-gray-900">
                    {module.stats.completed}/{module.stats.total}
                  </div>
                  <div className="text-xs text-gray-500">Completed</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <div className="text-lg font-bold text-primary-600">
                    {module.stats.avgScore}%
                  </div>
                  <div className="text-xs text-gray-500">Avg Score</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <div className="text-lg font-bold text-gray-900">
                    {module.stats.timeSpent}
                  </div>
                  <div className="text-xs text-gray-500">Time Spent</div>
                </div>
              </div>

              {/* Features */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">What you&apos;ll practice:</h4>
                <div className="grid grid-cols-2 gap-2">
                  {module.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                      <Star className="w-3 h-3 text-amber-500" />
                      {feature}
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-medium text-primary-600">
                    {Math.round((module.stats.completed / module.stats.total) * 100)}%
                  </span>
                </div>
                <div className="progress-bar h-2.5">
                  <div
                    className="progress-fill"
                    style={{ width: `${(module.stats.completed / module.stats.total) * 100}%` }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Link
                  href={`/dashboard/training/${module.id}`}
                  className="btn-primary flex-1"
                >
                  Start Training
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
                <button className="btn-secondary px-4">
                  <Trophy className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tips Section */}
      <div className="card p-6 bg-gradient-to-br from-gray-50 to-white">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary-600" />
          Training Tips
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              title: 'Practice Regularly',
              description: 'Consistent short sessions are more effective than long irregular ones.',
            },
            {
              title: 'Review Mistakes',
              description: 'Pay attention to feedback and learn from incorrect responses.',
            },
            {
              title: 'Challenge Yourself',
              description: 'Gradually increase difficulty as your skills improve.',
            },
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
