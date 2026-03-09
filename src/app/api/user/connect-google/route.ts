import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasGoogleLinked } from '@/lib/authHelpers'

// Returns whether the current user has Google linked (used to refresh UI state)
export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const linked = await hasGoogleLinked(session.user.id)
  return NextResponse.json({ googleLinked: linked })
}
