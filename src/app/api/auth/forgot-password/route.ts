import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail, createPasswordResetToken } from '@/lib/authHelpers'
import { sendPasswordResetEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    const user = await getUserByEmail(email)

    // Always return 200 — don't reveal whether the email exists
    if (!user || !user.password_hash) {
      return NextResponse.json({ success: true })
    }

    const token = await createPasswordResetToken(user.id)
    await sendPasswordResetEmail(user.email, user.name ?? user.email, token)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to send reset email. Please try again.' }, { status: 500 })
  }
}
