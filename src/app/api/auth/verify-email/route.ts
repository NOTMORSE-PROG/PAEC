import { NextRequest, NextResponse } from 'next/server'
import { verifyEmailToken } from '@/lib/authHelpers'
import { sendWelcomeEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token is required.' }, { status: 400 })
    }

    const user = await verifyEmailToken(token)
    if (!user) {
      return NextResponse.json(
        { error: 'This verification link is invalid or has expired.' },
        { status: 400 }
      )
    }

    // Fire-and-forget welcome email
    sendWelcomeEmail(user.email, user.name ?? user.email).catch(() => {})

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 })
  }
}
