import { NextRequest, NextResponse } from 'next/server'
import {
  getUserByEmail,
  createVerificationToken,
  verificationTokenRecentlySent,
} from '@/lib/authHelpers'
import { sendVerificationEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    const user = await getUserByEmail(email)

    // Return 200 even if user not found — don't leak existence
    if (!user || !user.password_hash) {
      return NextResponse.json({ success: true })
    }

    if (user.email_verified) {
      return NextResponse.json({ error: 'This email is already verified.' }, { status: 400 })
    }

    const recentlySent = await verificationTokenRecentlySent(user.id)
    if (recentlySent) {
      return NextResponse.json(
        { error: 'A verification email was sent recently. Please wait a minute before requesting another.' },
        { status: 429 }
      )
    }

    const token = await createVerificationToken(user.id)
    await sendVerificationEmail(user.email, user.name ?? user.email, token)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to resend verification email.' }, { status: 500 })
  }
}
