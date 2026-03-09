'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Mail, Shield, Award, Target, Clock, TrendingUp, CheckCircle, Calendar } from 'lucide-react'

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function formatJoined(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function ProfilePage() {
  const { data: session } = useSession()
  const [joinedDate, setJoinedDate] = useState<string | null>(null)

  const userName = session?.user?.name ?? ''
  const userEmail = session?.user?.email ?? ''
  const hasPassword = session?.user?.hasPassword ?? false
  const googleLinked = session?.user?.googleLinked ?? false
  const role = session?.user?.role ?? 'student'

  useEffect(() => {
    fetch('/api/user/profile')
      .then((r) => r.json())
      .then((d) => { if (d.createdAt) setJoinedDate(d.createdAt) })
      .catch(() => {})
  }, [])

  const stats = [
    { label: 'Total Exercises', value: '156', icon: Target },
    { label: 'Average Score', value: '87%', icon: TrendingUp },
    { label: 'Training Hours', value: '24.5h', icon: Clock },
    { label: 'Achievements', value: '8', icon: Award },
  ]

  const recentAchievements = [
    { name: 'Perfect Score', date: 'Dec 15, 2024', icon: '🎯' },
    { name: '10-Day Streak', date: 'Dec 18, 2024', icon: '🔥' },
    { name: 'Quick Learner', date: 'Dec 10, 2024', icon: '⚡' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Your Profile</h1>
        <p className="text-gray-600">View your account information.</p>
      </div>

      {/* Profile Card */}
      <div className="card overflow-hidden">
        {/* Cover */}
        <div className="h-32 bg-gradient-to-r from-primary-500 to-primary-700 relative">
          <div className="absolute -bottom-12 left-6">
            <div className="w-24 h-24 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center border-4 border-white shadow-lg">
              <span className="text-3xl font-bold text-white">{getInitials(userName)}</span>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="pt-16 p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{userName || '—'}</h2>
            <p className="text-gray-500 capitalize">{role}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center p-4 bg-gray-50 rounded-xl">
                <stat.icon className="w-5 h-5 text-primary-500 mx-auto mb-2" />
                <div className="text-xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-xs text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Account Details */}
          <div className="space-y-4">
            {/* Joined */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                <Calendar className="w-5 h-5 text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Joined</p>
                <p className="font-medium text-gray-900">
                  {joinedDate ? formatJoined(joinedDate) : '—'}
                </p>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                <Mail className="w-5 h-5 text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="font-medium text-gray-900">{userEmail || '—'}</p>
              </div>
            </div>

            {/* Sign-in Methods */}
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                <Shield className="w-5 h-5 text-gray-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-2">Sign-in Methods</p>
                <div className="flex flex-wrap gap-2">
                  {hasPassword && (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-primary-50 text-primary-700 border border-primary-200 rounded-full text-sm font-medium">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Email & Password
                    </span>
                  )}
                  {googleLinked && (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700 shadow-sm">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      Google
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Achievements */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Achievements</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {recentAchievements.map((achievement, index) => (
            <div key={index} className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div className="text-2xl mb-2">{achievement.icon}</div>
              <h3 className="font-medium text-amber-900">{achievement.name}</h3>
              <p className="text-xs text-amber-700">{achievement.date}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
