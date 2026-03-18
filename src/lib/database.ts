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
        onboarding_completed BOOLEAN DEFAULT FALSE NOT NULL,
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

    // Training questions (admin-managed question pool)
    await client.query(`
      CREATE TABLE IF NOT EXISTS training_questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category VARCHAR(50) NOT NULL,
        question_data JSONB NOT NULL,
        difficulty VARCHAR(20) DEFAULT 'medium',
        is_active BOOLEAN DEFAULT false,
        source VARCHAR(50) DEFAULT 'manual',
        source_meta JSONB,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tq_category_active ON training_questions(category, is_active)
    `)

    // Training sessions (per-user session records)
    await client.query(`
      CREATE TABLE IF NOT EXISTS training_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category VARCHAR(50) NOT NULL,
        question_ids JSONB NOT NULL,
        answers JSONB DEFAULT '{}',
        question_scores JSONB DEFAULT '{}',
        score INTEGER,
        completed BOOLEAN DEFAULT false,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      )
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_user_category ON training_sessions(user_id, category)
    `)

    // Migrate existing tables — safe no-ops if column already exists
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE NOT NULL
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

// User Operations
export async function completeOnboarding(userId: string): Promise<void> {
  await query(
    `UPDATE users SET onboarding_completed = TRUE, updated_at = NOW() WHERE id = $1`,
    [userId]
  )
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

// ─── Training Questions ──────────────────────────────────────────────────────

export interface TrainingQuestion {
  id: string
  category: string
  question_data: Record<string, unknown>
  difficulty: string
  is_active: boolean
  source: string
  source_meta: Record<string, unknown> | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export async function getRandomActiveQuestions(
  category: string,
  count = 10
): Promise<TrainingQuestion[]> {
  return query<TrainingQuestion>(
    `SELECT * FROM training_questions
     WHERE category = $1 AND is_active = true
     ORDER BY RANDOM()
     LIMIT $2`,
    [category, count]
  )
}

export async function countActiveQuestions(category: string): Promise<number> {
  const [row] = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM training_questions WHERE category = $1 AND is_active = true`,
    [category]
  )
  return parseInt(row?.count || '0')
}

export async function saveDraftQuestion(
  category: string,
  questionData: Record<string, unknown>,
  sourceMeta?: Record<string, unknown>,
  createdBy?: string
): Promise<string> {
  const [row] = await query<{ id: string }>(
    `INSERT INTO training_questions (category, question_data, is_active, source, source_meta, created_by)
     VALUES ($1, $2, false, 'analysis', $3, $4)
     RETURNING id`,
    [category, JSON.stringify(questionData), sourceMeta ? JSON.stringify(sourceMeta) : null, createdBy || null]
  )
  return row.id
}

export async function createTrainingQuestion(data: {
  category: string
  questionData: Record<string, unknown>
  difficulty?: string
  isActive?: boolean
  source?: string
  sourceMeta?: Record<string, unknown>
  createdBy?: string
}): Promise<string> {
  const [row] = await query<{ id: string }>(
    `INSERT INTO training_questions (category, question_data, difficulty, is_active, source, source_meta, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      data.category,
      JSON.stringify(data.questionData),
      data.difficulty || 'medium',
      data.isActive ?? false,
      data.source || 'manual',
      data.sourceMeta ? JSON.stringify(data.sourceMeta) : null,
      data.createdBy || null,
    ]
  )
  return row.id
}

export async function getTrainingQuestions(filters?: {
  category?: string
  isActive?: boolean
  source?: string
  limit?: number
  offset?: number
}): Promise<TrainingQuestion[]> {
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters?.category) {
    params.push(filters.category)
    conditions.push(`category = $${params.length}`)
  }
  if (filters?.isActive !== undefined) {
    params.push(filters.isActive)
    conditions.push(`is_active = $${params.length}`)
  }
  if (filters?.source) {
    params.push(filters.source)
    conditions.push(`source = $${params.length}`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filters?.limit ? `LIMIT ${filters.limit}` : ''
  const offset = filters?.offset ? `OFFSET ${filters.offset}` : ''

  return query<TrainingQuestion>(
    `SELECT * FROM training_questions ${where} ORDER BY created_at DESC ${limit} ${offset}`,
    params
  )
}

export async function getTrainingQuestionById(id: string): Promise<TrainingQuestion | null> {
  const [row] = await query<TrainingQuestion>(
    `SELECT * FROM training_questions WHERE id = $1`,
    [id]
  )
  return row || null
}

export async function updateTrainingQuestion(
  id: string,
  data: Partial<{
    questionData: Record<string, unknown>
    difficulty: string
    isActive: boolean
  }>
): Promise<void> {
  const sets: string[] = ['updated_at = NOW()']
  const params: unknown[] = []

  if (data.questionData !== undefined) {
    params.push(JSON.stringify(data.questionData))
    sets.push(`question_data = $${params.length}`)
  }
  if (data.difficulty !== undefined) {
    params.push(data.difficulty)
    sets.push(`difficulty = $${params.length}`)
  }
  if (data.isActive !== undefined) {
    params.push(data.isActive)
    sets.push(`is_active = $${params.length}`)
  }

  params.push(id)
  await query(`UPDATE training_questions SET ${sets.join(', ')} WHERE id = $${params.length}`, params)
}

export async function deleteTrainingQuestion(id: string): Promise<void> {
  await query('DELETE FROM training_questions WHERE id = $1', [id])
}

export async function bulkCreateTrainingQuestions(questions: {
  category: string
  questionData: Record<string, unknown>
  difficulty?: string
  isActive?: boolean
  source?: string
  sourceMeta?: Record<string, unknown>
  createdBy?: string
}[]): Promise<number> {
  if (questions.length === 0) return 0
  const client = await getClient()
  let inserted = 0
  try {
    await client.query('BEGIN')
    for (const q of questions) {
      await client.query(
        `INSERT INTO training_questions (category, question_data, difficulty, is_active, source, source_meta, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          q.category,
          JSON.stringify(q.questionData),
          q.difficulty || 'medium',
          q.isActive ?? true,
          q.source || 'manual',
          q.sourceMeta ? JSON.stringify(q.sourceMeta) : null,
          q.createdBy || null,
        ]
      )
      inserted++
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
  return inserted
}

// ─── Training Sessions ───────────────────────────────────────────────────────

export interface TrainingSession {
  id: string
  user_id: string
  category: string
  question_ids: string[]
  answers: Record<string, unknown>
  question_scores: Record<string, number>
  score: number | null
  completed: boolean
  started_at: string
  completed_at: string | null
}

export async function createTrainingSession(
  userId: string,
  category: string,
  questionIds: string[]
): Promise<string> {
  const [row] = await query<{ id: string }>(
    `INSERT INTO training_sessions (user_id, category, question_ids)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, category, JSON.stringify(questionIds)]
  )
  return row.id
}

export async function getTrainingSession(id: string): Promise<TrainingSession | null> {
  const [row] = await query<TrainingSession>(
    `SELECT * FROM training_sessions WHERE id = $1`,
    [id]
  )
  return row || null
}

export async function submitTrainingSession(
  sessionId: string,
  answers: Record<string, unknown>,
  questionScores: Record<string, number>,
  score: number
): Promise<void> {
  await query(
    `UPDATE training_sessions
     SET answers = $1, question_scores = $2, score = $3,
         completed = true, completed_at = NOW()
     WHERE id = $4`,
    [JSON.stringify(answers), JSON.stringify(questionScores), score, sessionId]
  )
}

export async function getUserTrainingSessions(
  userId: string,
  category?: string,
  limit = 10
): Promise<TrainingSession[]> {
  if (category) {
    return query<TrainingSession>(
      `SELECT * FROM training_sessions
       WHERE user_id = $1 AND category = $2 AND completed = true
       ORDER BY completed_at DESC LIMIT $3`,
      [userId, category, limit]
    )
  }
  return query<TrainingSession>(
    `SELECT * FROM training_sessions
     WHERE user_id = $1 AND completed = true
     ORDER BY completed_at DESC LIMIT $2`,
    [userId, limit]
  )
}

export async function getUserBestScore(userId: string, category: string): Promise<number | null> {
  const [row] = await query<{ best: string | null }>(
    `SELECT MAX(score) as best FROM training_sessions
     WHERE user_id = $1 AND category = $2 AND completed = true`,
    [userId, category]
  )
  return row?.best !== null && row?.best !== undefined ? parseInt(row.best) : null
}

export async function getUserSessionCount(userId: string, category: string): Promise<number> {
  const [row] = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM training_sessions
     WHERE user_id = $1 AND category = $2 AND completed = true`,
    [userId, category]
  )
  return parseInt(row?.count || '0')
}
