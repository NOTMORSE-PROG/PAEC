import { auth } from '@/lib/auth'
import { completeOnboarding } from '@/lib/database'
import { NextResponse } from 'next/server'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await completeOnboarding(session.user.id)
  return NextResponse.json({ success: true })
}
