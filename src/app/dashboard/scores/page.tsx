'use client'

import { useState } from 'react'
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  Target,
  Award,
  ChevronRight,
  Filter,
  Download,
  Radio,
  BookOpen,
  Headphones,
  BarChart3,
  CheckCircle,
  XCircle,
  Minus
} from 'lucide-react'
import PerformanceChart from '@/components/dashboard/PerformanceChart'

type TimeFilter = '7d' | '30d' | '90d' | 'all'
type ModuleFilter = 'all' | 'scenario' | 'readback' | 'jumbled' | 'pronunciation'

interface SessionResult {
  id: number
  module: string
  moduleIcon: any
  score: number
  date: string
  duration: string
  exercises: number
  improvement: number | null
}

export default function ScoresPage() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('30d')
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('all')

  const overallStats = {
    averageScore: 87,
    totalExercises: 156,
    totalTime: '24h 35m',
    streakDays: 12,
    improvement: 5.2,
  }

  const moduleStats = [
    {
      id: 'scenario',
      name: 'Scenario Simulation',
      icon: Radio,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50',
      avgScore: 92,
      exercises: 45,
      bestScore: 100,
      improvement: 8,
    },
    {
      id: 'readback',
      name: 'Readback Correction',
      icon: Target,
      color: 'from-indigo-500 to-purple-500',
      bgColor: 'bg-indigo-50',
      avgScore: 78,
      exercises: 28,
      bestScore: 95,
      improvement: -2,
    },
    {
      id: 'jumbled',
      name: 'Jumbled Clearance',
      icon: BookOpen,
      color: 'from-violet-500 to-pink-500',
      bgColor: 'bg-violet-50',
      avgScore: 85,
      exercises: 35,
      bestScore: 98,
      improvement: 12,
    },
    {
      id: 'pronunciation',
      name: 'Pronunciation Drill',
      icon: Headphones,
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'bg-emerald-50',
      avgScore: 88,
      exercises: 48,
      bestScore: 100,
      improvement: 3,
    },
  ]

  const recentSessions: SessionResult[] = [
    {
      id: 1,
      module: 'Scenario Simulation',
      moduleIcon: Radio,
      score: 92,
      date: 'Today, 2:30 PM',
      duration: '15 min',
      exercises: 5,
      improvement: 4,
    },
    {
      id: 2,
      module: 'Readback Correction',
      moduleIcon: Target,
      score: 78,
      date: 'Today, 10:15 AM',
      duration: '12 min',
      exercises: 4,
      improvement: -3,
    },
    {
      id: 3,
      module: 'Jumbled Clearance',
      moduleIcon: BookOpen,
      score: 85,
      date: 'Yesterday, 4:45 PM',
      duration: '18 min',
      exercises: 6,
      improvement: 5,
    },
    {
      id: 4,
      module: 'Pronunciation Drill',
      moduleIcon: Headphones,
      score: 95,
      date: 'Yesterday, 11:20 AM',
      duration: '10 min',
      exercises: 8,
      improvement: 7,
    },
    {
      id: 5,
      module: 'Scenario Simulation',
      moduleIcon: Radio,
      score: 88,
      date: 'Dec 18, 3:00 PM',
      duration: '20 min',
      exercises: 7,
      improvement: null,
    },
    {
      id: 6,
      module: 'Readback Correction',
      moduleIcon: Target,
      score: 81,
      date: 'Dec 18, 10:00 AM',
      duration: '14 min',
      exercises: 5,
      improvement: 2,
    },
  ]

  const commonErrors = [
    { type: 'Missing call sign in readback', count: 12, trend: 'down' },
    { type: 'Number transposition', count: 8, trend: 'down' },
    { type: 'Incomplete altitude readback', count: 6, trend: 'up' },
    { type: 'Wrong phraseology sequence', count: 5, trend: 'same' },
    { type: 'Pronunciation errors (NINER)', count: 4, trend: 'down' },
  ]

  const achievements = [
    { name: 'Perfect Score', description: 'Score 100% on any exercise', earned: true, date: 'Dec 15' },
    { name: '10-Day Streak', description: 'Practice for 10 consecutive days', earned: true, date: 'Dec 18' },
    { name: 'Scenario Master', description: 'Complete 50 scenario exercises', earned: false, progress: 45 },
    { name: 'Quick Learner', description: 'Improve score by 20% in a week', earned: true, date: 'Dec 10' },
  ]

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-amber-600'
    return 'text-red-600'
  }

  const getScoreBg = (score: number) => {
    if (score >= 90) return 'bg-green-100'
    if (score >= 70) return 'bg-amber-100'
    return 'bg-red-100'
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            Score Dashboard
          </h1>
          <p className="text-gray-600">
            Track your performance and progress across all training modules.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          {(['7d', '30d', '90d', 'all'] as TimeFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                timeFilter === filter
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {filter === '7d' ? '7 Days' : filter === '30d' ? '30 Days' : filter === '90d' ? '90 Days' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="stat-card col-span-1">
          <div className="flex items-center justify-between mb-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
              <TrendingUp className="w-3 h-3" />
              +{overallStats.improvement}%
            </span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{overallStats.averageScore}%</div>
          <div className="text-sm text-gray-500">Average Score</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <Target className="w-5 h-5 text-primary-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{overallStats.totalExercises}</div>
          <div className="text-sm text-gray-500">Total Exercises</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{overallStats.totalTime}</div>
          <div className="text-sm text-gray-500">Time Invested</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-5 h-5 text-violet-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{overallStats.streakDays}</div>
          <div className="text-sm text-gray-500">Day Streak</div>
        </div>

        <div className="stat-card bg-gradient-to-br from-primary-500 to-primary-700 text-white">
          <div className="flex items-center justify-between mb-2">
            <Award className="w-5 h-5 text-primary-200" />
          </div>
          <div className="text-3xl font-bold">8/15</div>
          <div className="text-sm text-primary-200">Achievements</div>
        </div>
      </div>

      {/* Module Performance */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Module Performance</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {moduleStats.map((module) => (
            <div key={module.id} className="card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 bg-gradient-to-br ${module.color} rounded-xl flex items-center justify-center`}>
                  <module.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 text-sm truncate">{module.name}</h3>
                  <p className="text-xs text-gray-500">{module.exercises} exercises</p>
                </div>
              </div>

              <div className="flex items-end justify-between mb-3">
                <div>
                  <div className={`text-2xl font-bold ${getScoreColor(module.avgScore)}`}>
                    {module.avgScore}%
                  </div>
                  <div className="text-xs text-gray-500">Average Score</div>
                </div>
                <div className={`flex items-center gap-1 text-xs font-medium ${
                  module.improvement > 0 ? 'text-green-600' : module.improvement < 0 ? 'text-red-600' : 'text-gray-500'
                }`}>
                  {module.improvement > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : module.improvement < 0 ? (
                    <TrendingDown className="w-3 h-3" />
                  ) : (
                    <Minus className="w-3 h-3" />
                  )}
                  {module.improvement > 0 ? '+' : ''}{module.improvement}%
                </div>
              </div>

              <div className="text-xs text-gray-500">
                Best: <span className="font-medium text-gray-900">{module.bestScore}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Sessions */}
        <div className="lg:col-span-2 card">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Sessions</h2>
              <button className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                View All
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {recentSessions.map((session) => (
              <div key={session.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getScoreBg(session.score)}`}>
                    <session.moduleIcon className={`w-5 h-5 ${getScoreColor(session.score)}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-gray-900 text-sm">{session.module}</h4>
                      <span className={`text-lg font-bold ${getScoreColor(session.score)}`}>
                        {session.score}%
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{session.date}</span>
                      <span>{session.duration}</span>
                      <span>{session.exercises} exercises</span>
                      {session.improvement !== null && (
                        <span className={`flex items-center gap-1 ${
                          session.improvement > 0 ? 'text-green-600' : session.improvement < 0 ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          {session.improvement > 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : session.improvement < 0 ? (
                            <TrendingDown className="w-3 h-3" />
                          ) : null}
                          {session.improvement > 0 ? '+' : ''}{session.improvement}%
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Side Column */}
        <div className="space-y-6">
          {/* Common Errors */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Common Errors</h3>
            <div className="space-y-3">
              {commonErrors.map((error, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                      {index + 1}
                    </span>
                    <span className="text-sm text-gray-700 truncate">{error.type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{error.count}</span>
                    {error.trend === 'down' && <TrendingDown className="w-4 h-4 text-green-500" />}
                    {error.trend === 'up' && <TrendingUp className="w-4 h-4 text-red-500" />}
                    {error.trend === 'same' && <Minus className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Achievements */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Recent Achievements</h3>
            <div className="space-y-3">
              {achievements.map((achievement, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-xl border ${
                    achievement.earned
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      achievement.earned ? 'bg-amber-100' : 'bg-gray-200'
                    }`}>
                      {achievement.earned ? (
                        <Award className="w-4 h-4 text-amber-600" />
                      ) : (
                        <Award className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className={`text-sm font-medium ${
                        achievement.earned ? 'text-amber-900' : 'text-gray-700'
                      }`}>
                        {achievement.name}
                      </h4>
                      <p className={`text-xs ${
                        achievement.earned ? 'text-amber-700' : 'text-gray-500'
                      }`}>
                        {achievement.description}
                      </p>
                      {achievement.earned && achievement.date && (
                        <p className="text-xs text-amber-600 mt-1">Earned {achievement.date}</p>
                      )}
                      {!achievement.earned && achievement.progress && (
                        <div className="mt-2">
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-500 rounded-full"
                              style={{ width: `${(achievement.progress / 50) * 100}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{achievement.progress}/50</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Performance Chart */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Performance Over Time</h2>
        <PerformanceChart />
      </div>
    </div>
  )
}
