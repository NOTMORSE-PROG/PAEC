'use client'

import { useState, useEffect } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { useTheme } from '@/lib/ThemeContext'
import {
  Shield,
  Palette,
  Volume2,
  Moon,
  Sun,
  Key,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
  CheckCircle,
  Link2,
  Trash2,
} from 'lucide-react'

export default function SettingsPage() {
  const { data: session, update } = useSession()
  const hasPassword = session?.user?.hasPassword ?? true
  const googleLinked = session?.user?.googleLinked ?? false
  const userEmail = session?.user?.email ?? ''

  const { darkMode, setDarkMode, autoPlayAudio, setAutoPlayAudio } = useTheme()

  // Password
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [verificationCode, setVerificationCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Connect Google
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false)
  const [googleMsg, setGoogleMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (!params.has('linked') && !params.has('error')) return
    window.history.replaceState({}, '', '/dashboard/settings')

    if (params.get('linked') === '1') {
      update()
      setGoogleMsg({ type: 'success', text: 'Google account connected successfully.' })
    } else if (params.get('error') === 'google-taken') {
      setGoogleMsg({ type: 'error', text: 'That Google account already belongs to another user. Please use a different Google account.' })
    }
  }, [update])

  // Delete account
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const handleSendCode = async () => {
    setPasswordError('')
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match.')
      return
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.')
      return
    }
    setIsSendingCode(true)
    const res = await fetch('/api/user/send-password-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      }),
    })
    const data = await res.json()
    setIsSendingCode(false)
    if (!res.ok) {
      setPasswordError(data.error ?? 'Failed to send verification code.')
    } else {
      setCodeSent(true)
    }
  }

  const handleChangePassword = async () => {
    setPasswordError('')
    setPasswordSuccess(false)
    setIsChangingPassword(true)
    const res = await fetch('/api/user/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        code: verificationCode,
      }),
    })
    const data = await res.json()
    setIsChangingPassword(false)
    if (!res.ok) {
      setPasswordError(data.error ?? 'Failed to update password.')
    } else {
      setPasswordSuccess(true)
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setVerificationCode('')
      setCodeSent(false)
    }
  }

  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true)
    await signIn('google', { callbackUrl: '/dashboard/settings?linked=1' })
  }

  const handleDeleteAccount = async () => {
    setDeleteError('')
    setIsDeletingAccount(true)
    const res = await fetch('/api/user/delete-account', { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      setDeleteError(data.error ?? 'Failed to delete account.')
      setIsDeletingAccount(false)
      return
    }
    await signOut({ callbackUrl: '/' })
  }

  const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-primary-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage your account settings and preferences.</p>
      </div>

      {/* Appearance */}
      <div className="card">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
              <Palette className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Appearance</h2>
              <p className="text-sm text-gray-500">Customize the look and feel</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {darkMode ? (
                <Moon className="w-5 h-5 text-gray-400" />
              ) : (
                <Sun className="w-5 h-5 text-gray-400" />
              )}
              <div>
                <p className="font-medium text-gray-900">Dark Mode</p>
                <p className="text-sm text-gray-500">Switch to dark theme</p>
              </div>
            </div>
            <Toggle enabled={darkMode} onChange={() => setDarkMode(!darkMode)} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">Auto-Play Audio</p>
                <p className="text-sm text-gray-500">Automatically play audio in exercises</p>
              </div>
            </div>
            <Toggle enabled={autoPlayAudio} onChange={() => setAutoPlayAudio(!autoPlayAudio)} />
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="card">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Security</h2>
              <p className="text-sm text-gray-500">Manage your password and security settings</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-6">
          {/* Connected Accounts */}
          <div>
            <h3 className="font-medium text-gray-900 mb-4">Connected Accounts</h3>
            {googleMsg && (
              <div className={`mb-3 p-3 rounded-lg flex items-center gap-2 text-sm ${
                googleMsg.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-amber-50 border border-amber-200 text-amber-700'
              }`}>
                {googleMsg.type === 'success'
                  ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                {googleMsg.text}
              </div>
            )}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <div>
                  <p className="font-medium text-gray-900">Google</p>
                  <p className="text-sm text-gray-500">
                    {googleLinked ? 'Connected — you can sign in with Google' : 'Not connected'}
                  </p>
                </div>
              </div>
              {googleLinked ? (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  <CheckCircle className="w-4 h-4" />
                  Connected
                </span>
              ) : hasPassword ? (
                <button
                  onClick={handleConnectGoogle}
                  disabled={isConnectingGoogle}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {isConnectingGoogle ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4" />
                  )}
                  Connect Google
                </button>
              ) : null}
            </div>
          </div>

          {/* Change Password */}
          {hasPassword ? (
            <div>
              <h3 className="font-medium text-gray-900 mb-4">Change Password</h3>
              {passwordError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Password updated successfully.
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="input-label">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      className="input-field pr-12"
                      placeholder="Enter current password"
                      disabled={codeSent}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center"
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="w-5 h-5 text-gray-400" />
                      ) : (
                        <Eye className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="input-label">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className="input-field pr-12"
                      placeholder="Enter new password"
                      disabled={codeSent}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-5 h-5 text-gray-400" />
                      ) : (
                        <Eye className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="input-label">Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="input-field"
                    placeholder="Confirm new password"
                    disabled={codeSent}
                  />
                </div>

                {!codeSent ? (
                  <button
                    onClick={handleSendCode}
                    disabled={isSendingCode || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSendingCode ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Key className="w-4 h-4 mr-2" />
                    )}
                    Send Verification Code
                  </button>
                ) : (
                  <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-sm text-blue-800">
                      A 6-digit verification code was sent to <strong>{userEmail}</strong>. Enter it below to confirm your password change.
                    </p>
                    <div>
                      <label className="input-label">Verification Code</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                        className="input-field tracking-widest text-center text-xl font-mono"
                        placeholder="000000"
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleChangePassword}
                        disabled={isChangingPassword || verificationCode.length !== 6}
                        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isChangingPassword ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Key className="w-4 h-4 mr-2" />
                        )}
                        Update Password
                      </button>
                      <button
                        onClick={() => { setCodeSent(false); setVerificationCode(''); setPasswordError('') }}
                        className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <p className="text-sm font-medium text-gray-700">Password changes not available</p>
              <p className="text-sm text-gray-500 mt-1">
                Your account is managed by Google. Sign in with Google to access your account.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card border-red-200">
        <div className="p-6 border-b border-red-100 bg-red-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-red-900">Danger Zone</h2>
              <p className="text-sm text-red-700">Irreversible actions — proceed with caution</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <p className="font-medium text-gray-900">Delete Account</p>
            <p className="text-sm text-gray-500 mt-1">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
          </div>
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
            <p className="text-sm text-red-800">
              To confirm, type your email address{' '}
              <span className="font-mono font-semibold">{userEmail}</span> below:
            </p>
            <input
              type="email"
              value={deleteConfirmInput}
              onChange={(e) => {
                setDeleteConfirmInput(e.target.value)
                setDeleteError('')
              }}
              className="input-field"
              placeholder="Enter your email to confirm"
              autoComplete="off"
            />
            {deleteError && (
              <p className="text-sm text-red-600">{deleteError}</p>
            )}
            <button
              onClick={handleDeleteAccount}
              disabled={deleteConfirmInput !== userEmail || isDeletingAccount}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isDeletingAccount ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Delete my account
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
