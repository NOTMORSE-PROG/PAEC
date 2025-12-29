import { NextRequest, NextResponse } from 'next/server'
import {
  initializeDatabase,
  saveModelWeights,
  loadModelWeights,
  saveConfig,
  loadConfig,
  saveTrainingExamplesBatch,
  getTrainingCorpus,
  getCorpusStats,
  getModelStatsFromDB,
  getRecentCorrections,
  getRecentWeightUpdates,
  clearTrainingCorpus,
} from '@/lib/database'
import {
  createDefaultModelState,
  type AdaptiveModelState,
} from '@/lib/adaptiveML'

/**
 * Database API - PostgreSQL Operations
 *
 * Endpoints:
 * GET    /api/database              - Get database stats
 * POST   /api/database?action=init  - Initialize database schema
 * POST   /api/database?action=sync  - Sync model to database
 * POST   /api/database?action=load  - Load model from database
 * POST   /api/database?action=importCorpus - Import training corpus to DB
 */

// GET - Get database statistics
export async function GET() {
  try {
    const corpusStats = await getCorpusStats()
    const modelStats = await getModelStatsFromDB()
    const recentCorrections = await getRecentCorrections(5)
    const recentUpdates = await getRecentWeightUpdates(10)

    return NextResponse.json({
      success: true,
      database: {
        connected: true,
        provider: 'Neon PostgreSQL',
      },
      corpus: corpusStats,
      model: modelStats,
      recent: {
        corrections: recentCorrections,
        weightUpdates: recentUpdates,
      },
    })
  } catch (error) {
    console.error('Database GET error:', error)
    return NextResponse.json({
      success: false,
      database: {
        connected: false,
        error: String(error),
      },
    }, { status: 500 })
  }
}

// POST - Database operations
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'status'
    const body = await request.json().catch(() => ({}))

    // Action: init - Initialize database schema
    if (action === 'init') {
      await initializeDatabase()

      // Insert default weights if empty
      const existingWeights = await loadModelWeights()
      if (Object.keys(existingWeights).length === 0) {
        const defaultState = createDefaultModelState()
        await saveModelWeights({
          pattern: defaultState.weights.patternWeights,
          error: defaultState.weights.errorWeights,
          phase: defaultState.weights.phaseWeights,
          severity: defaultState.weights.severityWeights,
        })
        await saveConfig(defaultState.config as unknown as Record<string, unknown>)
      }

      return NextResponse.json({
        success: true,
        message: 'Database initialized successfully',
        tables: [
          'ml_model_weights',
          'ml_model_config',
          'ml_user_corrections',
          'ml_weight_updates',
          'ml_accuracy_history',
          'training_corpus',
        ],
      })
    }

    // Action: sync - Sync current model state to database
    if (action === 'sync') {
      const modelState = body.modelState as AdaptiveModelState

      if (!modelState?.weights) {
        return NextResponse.json(
          { success: false, error: 'Requires: modelState with weights' },
          { status: 400 }
        )
      }

      await saveModelWeights({
        pattern: modelState.weights.patternWeights,
        error: modelState.weights.errorWeights,
        phase: modelState.weights.phaseWeights,
        severity: modelState.weights.severityWeights,
      })

      await saveConfig(modelState.config as unknown as Record<string, unknown>)

      return NextResponse.json({
        success: true,
        message: 'Model state synced to database',
      })
    }

    // Action: load - Load model state from database
    if (action === 'load') {
      const weights = await loadModelWeights()
      const config = await loadConfig()
      const stats = await getModelStatsFromDB()

      // Reconstruct model state
      const modelState: Partial<AdaptiveModelState> = {
        version: '3.0.0-adaptive-db',
        updatedAt: new Date().toISOString(),
        weights: {
          patternWeights: weights.pattern || {},
          errorWeights: weights.error || {},
          phaseWeights: weights.phase || {},
          severityWeights: (weights.severity as AdaptiveModelState['weights']['severityWeights']) || {
            critical: 1.5,
            high: 1.2,
            medium: 1.0,
            low: 0.7,
          },
          thresholds: {
            errorDetection: 0.65,
            phaseConfidence: 0.70,
            readbackAccuracy: 0.80,
          },
        },
        config: {
          learningRate: (config.learningRate as number) || 0.1,
          momentum: (config.momentum as number) || 0.3,
          minConfidence: (config.minConfidence as number) || 0.5,
          adaptiveRateEnabled: (config.adaptiveRateEnabled as boolean) ?? true,
          reinforcementEnabled: (config.reinforcementEnabled as boolean) ?? true,
          maxHistorySize: (config.maxHistorySize as number) || 1000,
        },
        history: {
          totalInteractions: stats.totalInteractions,
          correctPredictions: stats.correctPredictions,
          incorrectPredictions: stats.totalInteractions - stats.correctPredictions,
          userCorrections: [],
          weightUpdates: [],
          accuracyOverTime: [],
          lastTrainingDate: new Date().toISOString(),
        },
      }

      return NextResponse.json({
        success: true,
        modelState,
        stats,
      })
    }

    // Action: importCorpus - Import training corpus to database
    if (action === 'importCorpus') {
      const examples = body.examples || []

      if (!Array.isArray(examples) || examples.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Requires: examples array' },
          { status: 400 }
        )
      }

      const inserted = await saveTrainingExamplesBatch(examples.map((e: {
        atc: string
        pilot: string
        isCorrect: boolean
        phase: string
        explanation?: string
      }) => ({
        atc: e.atc,
        pilot: e.pilot,
        isCorrect: e.isCorrect,
        phase: e.phase || 'general',
        explanation: e.explanation,
        source: 'import',
      })))

      const stats = await getCorpusStats()

      return NextResponse.json({
        success: true,
        message: `Imported ${inserted} examples to database`,
        corpusStats: stats,
      })
    }

    // Action: getCorpus - Get training corpus from database
    if (action === 'getCorpus') {
      const corpus = await getTrainingCorpus({
        phase: body.phase,
        isCorrect: body.isCorrect,
        limit: body.limit || 100,
        offset: body.offset || 0,
      })

      const stats = await getCorpusStats()

      return NextResponse.json({
        success: true,
        corpus,
        stats,
      })
    }

    // Action: clearCorpus - Clear training corpus
    if (action === 'clearCorpus') {
      await clearTrainingCorpus()

      return NextResponse.json({
        success: true,
        message: 'Training corpus cleared',
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use: init, sync, load, importCorpus, getCorpus, clearCorpus' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Database POST error:', error)
    return NextResponse.json(
      { success: false, error: `Database error: ${error}` },
      { status: 500 }
    )
  }
}
