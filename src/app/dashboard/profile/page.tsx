'use client'

import { useState } from 'react'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Edit2,
  Camera,
  Save,
  X,
  Award,
  Target,
  Clock,
  TrendingUp
} from 'lucide-react'

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false)
  const [profile, setProfile] = useState({
    fullName: 'Juan Santos',
    email: 'juan.santos@email.com',
    phone: '+63 917 123 4567',
    location: 'Manila, Philippines',
    organization: 'Philippine Airlines Training Center',
    role: 'Student Pilot',
    joinedDate: 'December 2024',
    bio: 'Aviation student passionate about improving communication safety in Philippine airspace.',
  })

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
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Your Profile
        </h1>
        <p className="text-gray-600">
          Manage your account information and preferences.
        </p>
      </div>

      {/* Profile Card */}
      <div className="card overflow-hidden">
        {/* Cover & Avatar */}
        <div className="h-32 bg-gradient-to-r from-primary-500 to-primary-700 relative">
          <div className="absolute -bottom-12 left-6">
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center border-4 border-white shadow-lg">
                <span className="text-3xl font-bold text-white">JS</span>
              </div>
              <button className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors">
                <Camera className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Profile Info */}
        <div className="pt-16 p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{profile.fullName}</h2>
              <p className="text-gray-500">{profile.role} at {profile.organization}</p>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={isEditing ? 'btn-secondary' : 'btn-primary'}
            >
              {isEditing ? (
                <>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </>
              ) : (
                <>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit Profile
                </>
              )}
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center p-4 bg-gray-50 rounded-xl">
                <stat.icon className="w-5 h-5 text-primary-500 mx-auto mb-2" />
                <div className="text-xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-xs text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Profile Details */}
          <div className="space-y-6">
            {isEditing ? (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Full Name</label>
                    <input
                      type="text"
                      value={profile.fullName}
                      onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="input-label">Email</label>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="input-label">Phone</label>
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="input-label">Location</label>
                    <input
                      type="text"
                      value={profile.location}
                      onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="input-label">Organization</label>
                    <input
                      type="text"
                      value={profile.organization}
                      onChange={(e) => setProfile({ ...profile, organization: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="input-label">Bio</label>
                    <textarea
                      value={profile.bio}
                      onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                      className="input-field min-h-[100px] resize-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="btn-primary"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </button>
                </div>
              </>
            ) : (
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                      <Mail className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="font-medium text-gray-900">{profile.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                      <Phone className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Phone</p>
                      <p className="font-medium text-gray-900">{profile.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Location</p>
                      <p className="font-medium text-gray-900">{profile.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Joined</p>
                      <p className="font-medium text-gray-900">{profile.joinedDate}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">About</h3>
                  <p className="text-gray-600">{profile.bio}</p>
                </div>
              </div>
            )}
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
