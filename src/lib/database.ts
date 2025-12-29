/**
 * PostgreSQL Database Connection for Adaptive ML
 *
 * Connects to Neon PostgreSQL for persistent ML model storage
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

    // ML Model Weights table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ml_model_weights (
        id SERIAL PRIMARY KEY,
        weight_type VARCHAR(50) NOT NULL,
        weight_name VARCHAR(100) NOT NULL,
        weight_value DECIMAL(10, 6) NOT NULL DEFAULT 1.0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(weight_type, weight_name)
      )
    `)

    // ML Model Config table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ml_model_config (
        id SERIAL PRIMARY KEY,
        config_key VARCHAR(100) NOT NULL UNIQUE,
        config_value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // User Corrections table (for learning)
    await client.query(`
      CREATE TABLE IF NOT EXISTS ml_user_corrections (
        id SERIAL PRIMARY KEY,
        correction_id VARCHAR(100) NOT NULL UNIQUE,
        original_atc TEXT NOT NULL,
        original_pilot TEXT NOT NULL,
        predicted_correct BOOLEAN NOT NULL,
        predicted_errors TEXT[],
        predicted_phase VARCHAR(50),
        actual_correct BOOLEAN NOT NULL,
        actual_errors TEXT[],
        actual_phase VARCHAR(50),
        user_feedback TEXT,
        applied BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Weight Updates History table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ml_weight_updates (
        id SERIAL PRIMARY KEY,
        pattern VARCHAR(100) NOT NULL,
        old_weight DECIMAL(10, 6) NOT NULL,
        new_weight DECIMAL(10, 6) NOT NULL,
        reason VARCHAR(100),
        learning_rate DECIMAL(10, 6),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Accuracy History table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ml_accuracy_history (
        id SERIAL PRIMARY KEY,
        accuracy DECIMAL(5, 4) NOT NULL,
        total_interactions INTEGER NOT NULL DEFAULT 0,
        correct_predictions INTEGER NOT NULL DEFAULT 0,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
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
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_weights_type ON ml_model_weights(weight_type)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_corrections_created ON ml_user_corrections(created_at)
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

// Model State Database Operations
export interface DBModelWeight {
  weight_type: string
  weight_name: string
  weight_value: number
}

export async function saveModelWeights(weights: Record<string, Record<string, number>>): Promise<void> {
  const client = await getClient()

  try {
    await client.query('BEGIN')

    for (const [weightType, weightMap] of Object.entries(weights)) {
      for (const [weightName, weightValue] of Object.entries(weightMap)) {
        await client.query(`
          INSERT INTO ml_model_weights (weight_type, weight_name, weight_value, updated_at)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          ON CONFLICT (weight_type, weight_name)
          DO UPDATE SET weight_value = $3, updated_at = CURRENT_TIMESTAMP
        `, [weightType, weightName, weightValue])
      }
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function loadModelWeights(): Promise<Record<string, Record<string, number>>> {
  const rows = await query<DBModelWeight>(`
    SELECT weight_type, weight_name, weight_value
    FROM ml_model_weights
  `)

  const weights: Record<string, Record<string, number>> = {}

  for (const row of rows) {
    if (!weights[row.weight_type]) {
      weights[row.weight_type] = {}
    }
    weights[row.weight_type][row.weight_name] = Number(row.weight_value)
  }

  return weights
}

export async function saveConfig(config: Record<string, unknown>): Promise<void> {
  for (const [key, value] of Object.entries(config)) {
    await query(`
      INSERT INTO ml_model_config (config_key, config_value, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (config_key)
      DO UPDATE SET config_value = $2, updated_at = CURRENT_TIMESTAMP
    `, [key, JSON.stringify(value)])
  }
}

export async function loadConfig(): Promise<Record<string, unknown>> {
  const rows = await query<{ config_key: string; config_value: unknown }>(`
    SELECT config_key, config_value FROM ml_model_config
  `)

  const config: Record<string, unknown> = {}
  for (const row of rows) {
    config[row.config_key] = row.config_value
  }

  return config
}

export async function saveUserCorrection(correction: {
  correctionId: string
  originalAtc: string
  originalPilot: string
  predictedCorrect: boolean
  predictedErrors: string[]
  predictedPhase: string
  actualCorrect: boolean
  actualErrors: string[]
  actualPhase: string
  userFeedback?: string
}): Promise<void> {
  await query(`
    INSERT INTO ml_user_corrections (
      correction_id, original_atc, original_pilot,
      predicted_correct, predicted_errors, predicted_phase,
      actual_correct, actual_errors, actual_phase,
      user_feedback, applied
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
    ON CONFLICT (correction_id) DO NOTHING
  `, [
    correction.correctionId,
    correction.originalAtc,
    correction.originalPilot,
    correction.predictedCorrect,
    correction.predictedErrors,
    correction.predictedPhase,
    correction.actualCorrect,
    correction.actualErrors,
    correction.actualPhase,
    correction.userFeedback || null,
  ])
}

export async function saveWeightUpdate(update: {
  pattern: string
  oldWeight: number
  newWeight: number
  reason: string
  learningRate: number
}): Promise<void> {
  await query(`
    INSERT INTO ml_weight_updates (pattern, old_weight, new_weight, reason, learning_rate)
    VALUES ($1, $2, $3, $4, $5)
  `, [update.pattern, update.oldWeight, update.newWeight, update.reason, update.learningRate])
}

export async function saveAccuracyPoint(accuracy: number, total: number, correct: number): Promise<void> {
  await query(`
    INSERT INTO ml_accuracy_history (accuracy, total_interactions, correct_predictions)
    VALUES ($1, $2, $3)
  `, [accuracy, total, correct])
}

export async function getRecentCorrections(limit = 100): Promise<unknown[]> {
  return query(`
    SELECT * FROM ml_user_corrections
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit])
}

export async function getRecentWeightUpdates(limit = 100): Promise<unknown[]> {
  return query(`
    SELECT * FROM ml_weight_updates
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit])
}

export async function getAccuracyHistory(limit = 1000): Promise<{ accuracy: number; recorded_at: Date }[]> {
  return query(`
    SELECT accuracy, recorded_at
    FROM ml_accuracy_history
    ORDER BY recorded_at DESC
    LIMIT $1
  `, [limit])
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

// Get model statistics from database
export async function getModelStatsFromDB(): Promise<{
  totalInteractions: number
  correctPredictions: number
  recentAccuracy: number
  totalCorrections: number
  totalWeightUpdates: number
}> {
  const [accuracyResult] = await query<{
    total: string
    correct: string
  }>(`
    SELECT
      COALESCE(MAX(total_interactions), 0) as total,
      COALESCE(MAX(correct_predictions), 0) as correct
    FROM ml_accuracy_history
  `)

  const recentAccuracy = await query<{ accuracy: string }>(`
    SELECT AVG(accuracy) as accuracy
    FROM (
      SELECT accuracy FROM ml_accuracy_history
      ORDER BY recorded_at DESC
      LIMIT 50
    ) recent
  `)

  const [correctionCount] = await query<{ count: string }>(`
    SELECT COUNT(*) as count FROM ml_user_corrections
  `)

  const [updateCount] = await query<{ count: string }>(`
    SELECT COUNT(*) as count FROM ml_weight_updates
  `)

  return {
    totalInteractions: parseInt(accuracyResult?.total || '0'),
    correctPredictions: parseInt(accuracyResult?.correct || '0'),
    recentAccuracy: parseFloat(recentAccuracy[0]?.accuracy || '0.5'),
    totalCorrections: parseInt(correctionCount?.count || '0'),
    totalWeightUpdates: parseInt(updateCount?.count || '0'),
  }
}
