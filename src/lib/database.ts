/**
 * PostgreSQL Database Connection
 *
 * Connects to Neon PostgreSQL for training corpus storage
 */

import { Pool, PoolClient } from 'pg'

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL

    if (!connectionString) {
      throw new Error(
        'DATABASE_URL environment variable is not set. ' +
        'Please set it in your .env.local file.'
      )
    }

    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })

    pool.on('error', (err) => {
      console.error('Unexpected database error:', err)
    })
  }
  return pool
}

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  const client = await getPool().connect()
  try {
    const result = await client.query(text, params)
    return result.rows as T[]
  } finally {
    client.release()
  }
}

export async function getClient(): Promise<PoolClient> {
  return getPool().connect()
}

// Initialize database schema
export async function initializeDatabase(): Promise<void> {
  const client = await getClient()

  try {
    await client.query('BEGIN')

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        password_hash VARCHAR(255),
        role VARCHAR(50) DEFAULT 'student',
        avatar_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // OAuth accounts table (for Google etc.)
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider VARCHAR(50) NOT NULL,
        provider_account_id VARCHAR(255) NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        expires_at BIGINT,
        UNIQUE(provider, provider_account_id)
      )
    `)

    // Sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_token VARCHAR(255) UNIQUE NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires TIMESTAMP NOT NULL
      )
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)
    `)

    // Training Corpus table
    await client.query(`
      CREATE TABLE IF NOT EXISTS training_corpus (
        id SERIAL PRIMARY KEY,
        atc_instruction TEXT NOT NULL,
        pilot_readback TEXT NOT NULL,
        is_correct BOOLEAN NOT NULL,
        phase VARCHAR(50),
        error_type VARCHAR(100),
        explanation TEXT,
        source VARCHAR(100) DEFAULT 'manual',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_corpus_phase ON training_corpus(phase)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_corpus_correct ON training_corpus(is_correct)
    `)

    await client.query('COMMIT')
    console.log('Database schema initialized successfully')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Database initialization error:', error)
    throw error
  } finally {
    client.release()
  }
}

// Training Corpus Operations
export async function saveTrainingExample(example: {
  atc: string
  pilot: string
  isCorrect: boolean
  phase: string
  errorType?: string
  explanation?: string
  source?: string
}): Promise<void> {
  await query(`
    INSERT INTO training_corpus (atc_instruction, pilot_readback, is_correct, phase, error_type, explanation, source)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [
    example.atc,
    example.pilot,
    example.isCorrect,
    example.phase,
    example.errorType || null,
    example.explanation || null,
    example.source || 'manual',
  ])
}

export async function saveTrainingExamplesBatch(examples: {
  atc: string
  pilot: string
  isCorrect: boolean
  phase: string
  explanation?: string
  source?: string
}[]): Promise<number> {
  if (examples.length === 0) return 0

  const client = await getClient()
  let inserted = 0

  try {
    await client.query('BEGIN')

    for (const example of examples) {
      await client.query(`
        INSERT INTO training_corpus (atc_instruction, pilot_readback, is_correct, phase, explanation, source)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        example.atc,
        example.pilot,
        example.isCorrect,
        example.phase,
        example.explanation || null,
        example.source || 'huggingface',
      ])
      inserted++
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  return inserted
}

export async function getTrainingCorpus(options?: {
  phase?: string
  isCorrect?: boolean
  limit?: number
  offset?: number
}): Promise<{
  id: number
  atc_instruction: string
  pilot_readback: string
  is_correct: boolean
  phase: string
  error_type: string | null
  explanation: string | null
  source: string
  created_at: Date
}[]> {
  let sql = 'SELECT * FROM training_corpus WHERE 1=1'
  const params: unknown[] = []
  let paramIndex = 1

  if (options?.phase) {
    sql += ` AND phase = $${paramIndex++}`
    params.push(options.phase)
  }

  if (options?.isCorrect !== undefined) {
    sql += ` AND is_correct = $${paramIndex++}`
    params.push(options.isCorrect)
  }

  sql += ' ORDER BY created_at DESC'

  if (options?.limit) {
    sql += ` LIMIT $${paramIndex++}`
    params.push(options.limit)
  }

  if (options?.offset) {
    sql += ` OFFSET $${paramIndex++}`
    params.push(options.offset)
  }

  return query(sql, params)
}

export async function getCorpusStats(): Promise<{
  total: number
  correct: number
  incorrect: number
  byPhase: Record<string, number>
  bySource: Record<string, number>
}> {
  const [countResult] = await query<{ total: string; correct: string }>(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct
    FROM training_corpus
  `)

  const phaseResults = await query<{ phase: string; count: string }>(`
    SELECT phase, COUNT(*) as count
    FROM training_corpus
    GROUP BY phase
  `)

  const sourceResults = await query<{ source: string; count: string }>(`
    SELECT source, COUNT(*) as count
    FROM training_corpus
    GROUP BY source
  `)

  const total = parseInt(countResult?.total || '0')
  const correct = parseInt(countResult?.correct || '0')

  return {
    total,
    correct,
    incorrect: total - correct,
    byPhase: Object.fromEntries(phaseResults.map(r => [r.phase, parseInt(r.count)])),
    bySource: Object.fromEntries(sourceResults.map(r => [r.source, parseInt(r.count)])),
  }
}

export async function clearTrainingCorpus(): Promise<void> {
  await query('DELETE FROM training_corpus')
}

