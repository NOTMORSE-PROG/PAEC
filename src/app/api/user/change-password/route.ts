import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUserById, verifyPassword, updatePassword, verifyPasswordChangeCode } from '@/lib/authHelpers'

export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dbUser = await getUserById(session.user.id)
  if (!dbUser || !dbUser.password_hash) {
    return NextResponse.json({ error: 'Password changes are not available for Google accounts.' }, { status: 403 })
  }

  const { currentPassword, newPassword, code } = await req.json()

  if (!currentPassword || !newPassword || !code) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 })
  }

  const valid = await verifyPassword(currentPassword, dbUser.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 })
  }

  const codeValid = await verifyPasswordChangeCode(session.user.id, code.trim())
  if (!codeValid) {
    return NextResponse.json({ error: 'Invalid or expired verification code.' }, { status: 400 })
  }

  await updatePassword(session.user.id, newPassword)

  return NextResponse.json({ success: true })
}
