'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plane, Mail, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  const sent = searchParams.get('sent')

  const [state, setState] = useState<'loading' | 'sent' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const [resendEmail, setResendEmail] = useState('')
  const [resendState, setResendState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [resendError, setResendError] = useState('')

  useEffect(() => {
    if (sent === 'true' && !token) {
      setState('sent')
      return
    }
    if (!token) {
      setState('error')
      setError('No verification token provided.')
      return
    }
    verify(token)
  }, [token, sent])

  async function verify(t: string) {
    setState('loading')
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t }),
      })
      const data = await res.json()
      if (res.ok) {
        setState('success')
      } else {
        setState('error')
        setError(data.error ?? 'Verification failed.')
      }
    } catch {
      setState('error')
      setError('Network error. Please try again.')
    }
  }

  async function handleResend(e: React.FormEvent) {
    e.preventDefault()
    setResendState('loading')
    setResendError('')
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      })
      const data = await res.json()
      if (res.ok) {
        setResendState('sent')
      } else {
        setResendState('error')
        setResendError(data.error ?? 'Failed to resend.')
      }
    } catch {
      setResendState('error')
      setResendError('Network error. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-400/20 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <div className="mb-8">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-6">
              <Plane className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold text-white mb-4">Email Verification</h1>
            <p className="text-xl text-primary-100 max-w-md">
              One last step before you start your aviation training journey.
            </p>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-gray-50">
        <div className="w-full max-w-md text-center">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg">
                <Plane className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900">Corpus-Based System</span>
            </Link>
          </div>

          {state === 'loading' && (
            <div>
              <Loader2 className="w-16 h-16 text-primary-500 animate-spin mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifying your email…</h2>
              <p className="text-gray-600">Please wait a moment.</p>
            </div>
          )}

          {state === 'sent' && (
            <div>
              <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail className="w-10 h-10 text-primary-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Check your inbox</h2>
              <p className="text-gray-600 mb-6">
                We&apos;ve sent a verification link to your email address. Click the link in the email to activate your account.
              </p>
              <p className="text-sm text-gray-500 mb-8">
                Didn&apos;t receive it? Check your spam folder or resend below.
              </p>

              {resendState === 'sent' ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                  Verification email resent! Check your inbox.
                </div>
              ) : (
                <form onSubmit={handleResend} className="space-y-3">
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="Enter your email to resend"
                    className="input-field"
                    required
                  />
                  {resendState === 'error' && (
                    <p className="text-sm text-red-600">{resendError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={resendState === 'loading'}
                    className="btn-secondary w-full py-3 flex items-center justify-center gap-2"
                  >
                    {resendState === 'loading' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Resend verification email
                  </button>
                </form>
              )}

              <p className="mt-6 text-sm text-gray-500">
                <Link href="/auth/login" className="text-primary-600 hover:text-primary-700 font-medium">
                  ← Back to Sign In
                </Link>
              </p>
            </div>
          )}

          {state === 'success' && (
            <div>
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Email verified!</h2>
              <p className="text-gray-600 mb-8">
                Your account is now active. You can sign in and start training.
              </p>
              <Link href="/auth/login" className="btn-primary w-full py-4 text-lg">
                Sign In to Your Account
              </Link>
            </div>
          )}

          {state === 'error' && (
            <div>
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Verification failed</h2>
              <p className="text-gray-600 mb-8">{error}</p>

              {resendState === 'sent' ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 mb-4">
                  Verification email resent! Check your inbox.
                </div>
              ) : (
                <form onSubmit={handleResend} className="space-y-3 mb-4">
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="Enter your email to resend"
                    className="input-field"
                    required
                  />
                  {resendState === 'error' && (
                    <p className="text-sm text-red-600">{resendError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={resendState === 'loading'}
                    className="btn-secondary w-full py-3 flex items-center justify-center gap-2"
                  >
                    {resendState === 'loading' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Resend verification email
                  </button>
                </form>
              )}

              <Link href="/auth/login" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                ← Back to Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  )
}
