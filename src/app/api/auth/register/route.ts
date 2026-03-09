import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail, createUserWithPassword } from '@/lib/authHelpers'

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    const existing = await getUserByEmail(email)

    if (existing) {
      if (!existing.password_hash) {
        return NextResponse.json(
          { error: 'This email is already registered with Google. Sign in with Google instead.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }

    await createUserWithPassword(email, name, password)

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error('Registration error:', err)
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 })
  }
}
