/**
 * Auth helper functions for user/account management
 */

import { query } from './database'
import bcrypt from 'bcryptjs'

export interface DbUser {
  id: string
  email: string
  name: string | null
  password_hash: string | null
  role: string
  avatar_url: string | null
  onboarding_completed: boolean
  created_at: Date
  updated_at: Date
}

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const rows = await query<DbUser>(
    'SELECT * FROM users WHERE email = $1 LIMIT 1',
    [email.toLowerCase()]
  )
  return rows[0] ?? null
}

export async function getUserById(id: string): Promise<DbUser | null> {
  const rows = await query<DbUser>(
    'SELECT * FROM users WHERE id = $1 LIMIT 1',
    [id]
  )
  return rows[0] ?? null
}

export async function createUserWithPassword(
  email: string,
  name: string,
  password: string
): Promise<DbUser> {
  const hash = await bcrypt.hash(password, 12)
  const rows = await query<DbUser>(
    `INSERT INTO users (email, name, password_hash)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [email.toLowerCase(), name, hash]
  )
  return rows[0]
}

export async function createGoogleUser(
  email: string,
  name: string,
  avatarUrl?: string
): Promise<DbUser> {
  const rows = await query<DbUser>(
    `INSERT INTO users (email, name, avatar_url)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [email.toLowerCase(), name, avatarUrl ?? null]
  )
  return rows[0]
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function updatePassword(userId: string, newPassword: string): Promise<void> {
  const hash = await bcrypt.hash(newPassword, 12)
  await query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [hash, userId]
  )
}

export async function hasGoogleLinked(userId: string): Promise<boolean> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM accounts WHERE user_id = $1 AND provider = 'google'`,
    [userId]
  )
  return parseInt(rows[0]?.count ?? '0') > 0
}

export async function getGoogleAccount(
  providerAccountId: string
): Promise<{ user_id: string } | null> {
  const rows = await query<{ user_id: string }>(
    `SELECT user_id FROM accounts WHERE provider = 'google' AND provider_account_id = $1 LIMIT 1`,
    [providerAccountId]
  )
  return rows[0] ?? null
}

export async function linkGoogleAccount(
  userId: string,
  providerAccountId: string,
  accessToken?: string,
  refreshToken?: string,
  expiresAt?: number
): Promise<void> {
  await query(
    `INSERT INTO accounts (user_id, provider, provider_account_id, access_token, refresh_token, expires_at)
     VALUES ($1, 'google', $2, $3, $4, $5)
     ON CONFLICT (provider, provider_account_id) DO NOTHING`,
    [userId, providerAccountId, accessToken ?? null, refreshToken ?? null, expiresAt ?? null]
  )
}
