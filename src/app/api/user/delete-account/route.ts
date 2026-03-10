import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query } from '@/lib/database'

export async function DELETE() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await query('DELETE FROM users WHERE id = $1', [session.user.id])

  return NextResponse.json({ success: true })
}
