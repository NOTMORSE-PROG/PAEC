import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUsers, countUsers } from '@/lib/database'

async function requireAdmin() {
  const session = await auth()
  if (!session || (session.user as { role?: string })?.role !== 'admin') return null
  return session
}

export async function GET(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const search = searchParams.get('q')?.trim() || undefined
  const limit = 30
  const [users, total] = await Promise.all([
    getUsers(limit, (page - 1) * limit, search),
    countUsers(search),
  ])
  return NextResponse.json({ users, total, page, totalPages: Math.ceil(total / limit) })
}
