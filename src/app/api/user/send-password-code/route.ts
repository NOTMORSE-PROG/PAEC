import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUserById, verifyPassword, createPasswordChangeCode, passwordChangeCodeRecentlySent } from '@/lib/authHelpers'
import { sendPasswordChangeCode } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await getUserById(session.user.id)
    if (!dbUser || !dbUser.password_hash) {
      return NextResponse.json({ error: 'Password changes are not available for Google accounts.' }, { status: 403 })
    }

    const { currentPassword, newPassword } = await req.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 })
    }

    const valid = await verifyPassword(currentPassword, dbUser.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 })
    }

    const recentlySent = await passwordChangeCodeRecentlySent(session.user.id)
    if (recentlySent) {
      return NextResponse.json({ error: 'A code was already sent. Please wait a minute before requesting another.' }, { status: 429 })
    }

    const code = await createPasswordChangeCode(session.user.id)
    await sendPasswordChangeCode(dbUser.email, dbUser.name ?? dbUser.email, code)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[send-password-code]', err)
    return NextResponse.json({ error: 'Failed to send verification code. Please try again.' }, { status: 500 })
  }
}
