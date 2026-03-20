/**
 * Auth helper functions for user/account management
 */

import { query } from './database'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export interface DbUser {
  id: string
  email: string
  name: string | null
  password_hash: string | null
  role: string
  avatar_url: string | null
  onboarding_completed: boolean
  email_verified: boolean
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

// ─── Email Verification Tokens ────────────────────────────────────────────────

export async function createVerificationToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  // Delete any existing tokens for this user first
  await query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId])
  await query(
    `INSERT INTO email_verification_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  )
  return token
}

export async function verifyEmailToken(token: string): Promise<DbUser | null> {
  const rows = await query<{ user_id: string; expires_at: Date }>(
    `SELECT user_id, expires_at FROM email_verification_tokens WHERE token = $1 LIMIT 1`,
    [token]
  )
  const row = rows[0]
  if (!row) return null
  if (new Date() > row.expires_at) return null

  // Mark user as verified
  await query(
    `UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1`,
    [row.user_id]
  )
  // Delete the used token
  await query('DELETE FROM email_verification_tokens WHERE token = $1', [token])

  return getUserById(row.user_id)
}

// Rate-limit helper: returns true if a token was sent within the last minute
export async function verificationTokenRecentlySent(userId: string): Promise<boolean> {
  const rows = await query<{ created_at: Date }>(
    `SELECT created_at FROM email_verification_tokens WHERE user_id = $1 LIMIT 1`,
    [userId]
  )
  if (!rows[0]) return false
  return Date.now() - rows[0].created_at.getTime() < 60_000
}

// ─── Password Reset Tokens ────────────────────────────────────────────────────

export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
  // Invalidate old tokens
  await query(
    `UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE`,
    [userId]
  )
  await query(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  )
  return token
}

// ─── Password Change OTP Codes ────────────────────────────────────────────────

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

export async function createPasswordChangeCode(userId: string): Promise<string> {
  const code = String(Math.floor(100000 + Math.random() * 900000)) // 6-digit
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
  await query('DELETE FROM password_change_codes WHERE user_id = $1', [userId])
  await query(
    `INSERT INTO password_change_codes (user_id, code_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hashCode(code), expiresAt]
  )
  return code
}

export async function verifyPasswordChangeCode(userId: string, code: string): Promise<boolean> {
  const rows = await query<{ expires_at: Date; used: boolean }>(
    `SELECT expires_at, used FROM password_change_codes
     WHERE user_id = $1 AND code_hash = $2 LIMIT 1`,
    [userId, hashCode(code)]
  )
  const row = rows[0]
  if (!row || row.used || new Date() > row.expires_at) return false
  await query(
    `UPDATE password_change_codes SET used = TRUE WHERE user_id = $1 AND code_hash = $2`,
    [userId, hashCode(code)]
  )
  return true
}

export async function passwordChangeCodeRecentlySent(userId: string): Promise<boolean> {
  const rows = await query<{ created_at: Date }>(
    `SELECT created_at FROM password_change_codes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  )
  if (!rows[0]) return false
  return Date.now() - rows[0].created_at.getTime() < 60_000
}

export async function consumePasswordResetToken(
  token: string,
  newPassword: string
): Promise<boolean> {
  const rows = await query<{ user_id: string; expires_at: Date; used: boolean }>(
    `SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token = $1 LIMIT 1`,
    [token]
  )
  const row = rows[0]
  if (!row) return false
  if (row.used) return false
  if (new Date() > row.expires_at) return false

  await updatePassword(row.user_id, newPassword)
  await query(
    `UPDATE password_reset_tokens SET used = TRUE WHERE token = $1`,
    [token]
  )
  return true
}
