'use client'

import Link from 'next/link'
import {
  Radio,
  Target,
  BookOpen,
  Headphones,
  BarChart3,
  TrendingUp,
  Clock,
  Award,
  ChevronRight,
  ArrowUpRight,
  Calendar,
  CheckCircle,
  AlertTriangle
} from 'lucide-react'

export default function DashboardPage() {
  const trainingModules = [
    {
      id: 'scenario',
      title: 'Scenario Simulation',
      description: 'Practice ATC clearances in realistic scenarios',
      icon: Radio,
      color: 'from-blue-500 to-cyan-500',
      progress: 68,
      exercises: 45,
      lastScore: 92,
    },
    {
      id: 'readback',
      title: 'Readback Correction',
      description: 'Identify and correct pilot readback errors',
      icon: Target,
      color: 'from-indigo-500 to-purple-500',
      progress: 42,
      exercises: 28,
      lastScore: 78,
    },
    {
      id: 'jumbled',
      title: 'Jumbled Clearance',
      description: 'Arrange words into correct phraseology',
      icon: BookOpen,
      color: 'from-violet-500 to-pink-500',
      progress: 55,
      exercises: 35,
      lastScore: 85,
    },
    {
      id: 'pronunciation',
      title: 'Pronunciation Drill',
      description: 'Master ICAO standard pronunciation',
      icon: Headphones,
      color: 'from-emerald-500 to-teal-500',
      progress: 31,
      exercises: 22,
      lastScore: 88,
    },
  ]

  const recentActivity = [
    {
      id: 1,
      type: 'Scenario Simulation',
      score: 92,
      time: '2 hours ago',
      status: 'completed',
    },
    {
      id: 2,
      type: 'Readback Correction',
      score: 78,
      time: '5 hours ago',
      status: 'completed',
    },
    {
      id: 3,
      type: 'Jumbled Clearance',
      score: 85,
      time: 'Yesterday',
      status: 'completed',
    },
    {
      id: 4,
      type: 'Analysis: APP/DEP',
      score: null,
      time: 'Yesterday',
      status: 'analyzed',
    },
  ]

  const stats = [
    {
      label: 'Total Exercises',
      value: '156',
      change: '+12 this week',
      changeType: 'positive',
      icon: BookOpen,
    },
    {
      label: 'Average Score',
      value: '87%',
      change: '+5% from last week',
      changeType: 'positive',
      icon: TrendingUp,
    },
    {
      label: 'Time Spent',
      value: '24h 35m',
      change: 'This month',
      changeType: 'neutral',
      icon: Clock,
    },
    {
      label: 'Achievements',
      value: '8/15',
      change: '3 in progress',
      changeType: 'neutral',
      icon: Award,
    },
  ]

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Welcome back, Juan!
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

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="stat-card">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                <stat.icon className="w-5 h-5 text-primary-600" />
              </div>
              {stat.changeType === 'positive' && (
                <span className="badge-success text-xs">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Up
                </span>
              )}
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</div>
            <div className="text-sm text-gray-500">{stat.label}</div>
            <div className={`text-xs mt-2 ${
              stat.changeType === 'positive' ? 'text-green-600' : 'text-gray-500'
            }`}>
              {stat.change}
            </div>
          </div>
        ))}
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
          {trainingModules.map((module) => (
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
                  <span className="text-gray-500">Progress</span>
                  <span className="font-medium text-primary-600">{module.progress}%</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${module.progress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
                  <span>{module.exercises} exercises</span>
                  <span>Last: {module.lastScore}%</span>
                </div>
              </div>
            </Link>
          ))}
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

          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  activity.status === 'completed' ? 'bg-green-100' : 'bg-blue-100'
                }`}>
                  {activity.status === 'completed' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{activity.type}</p>
                  <p className="text-sm text-gray-500">{activity.time}</p>
                </div>
                {activity.score !== null && (
                  <div className="text-right">
                    <p className={`text-lg font-bold ${
                      activity.score >= 80 ? 'text-green-600' : activity.score >= 60 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {activity.score}%
                    </p>
                    <p className="text-xs text-gray-500">Score</p>
                  </div>
                )}
              </div>
            ))}
          </div>
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
          <div className="card p-6 bg-gradient-to-br from-primary-500 to-primary-700 text-white">
            <h3 className="font-semibold mb-2">Performance Insight</h3>
            <p className="text-sm text-primary-100 mb-4">
              Your readback correction accuracy has improved by 15% this week.
            </p>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-300" />
              <span className="text-sm font-medium text-green-300">Great progress!</span>
            </div>
          </div>

          {/* Upcoming Session */}
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
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2 text-gray-600">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                Number readback accuracy
              </li>
              <li className="flex items-center gap-2 text-gray-600">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                Call sign pronunciation
              </li>
              <li className="flex items-center gap-2 text-gray-600">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                Clearance sequencing
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
