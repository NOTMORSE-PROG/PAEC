import { NextRequest, NextResponse } from 'next/server'
import {
  adaptiveAnalyze,
  applyUserCorrection,
  reinforcementUpdate,
  getModelStats,
  createDefaultModelState,
  type AdaptiveModelState,
  type UserCorrection,
  type AnalysisInput,
} from '@/lib/adaptiveML'

/**
 * Adaptive ML API - Dynamic Learning System
 *
 * Endpoints:
 * GET    /api/adaptive-ml                - Get model state & stats
 * POST   /api/adaptive-ml?action=analyze - Analyze with adaptive model
 * POST   /api/adaptive-ml?action=correct - Apply user correction (learning)
 * POST   /api/adaptive-ml?action=reinforce - Reinforcement update
 * POST   /api/adaptive-ml?action=reset   - Reset model to defaults
 * POST   /api/adaptive-ml?action=config  - Update learning config
 *
 * NOTE: Uses in-memory state for Vercel serverless compatibility.
 * State persists per-instance but resets on cold starts.
 * For persistent storage, use the database endpoints.
 */

// In-memory model state (serverless-compatible)
let cachedModelState: AdaptiveModelState | null = null

async function readModelState(): Promise<AdaptiveModelState> {
  if (cachedModelState) {
    return cachedModelState
  }
  cachedModelState = createDefaultModelState()
  return cachedModelState
}

async function writeModelState(state: AdaptiveModelState): Promise<void> {
  state.updatedAt = new Date().toISOString()
  cachedModelState = state
}

// GET - Get model state and statistics
export async function GET() {
  try {
    const modelState = await readModelState()
    const stats = getModelStats(modelState)

    return NextResponse.json({
      success: true,
      model: {
        version: modelState.version,
        createdAt: modelState.createdAt,
        updatedAt: modelState.updatedAt,
        config: modelState.config,
      },
      stats,
      weights: {
        patternWeights: modelState.weights.patternWeights,
        errorWeights: modelState.weights.errorWeights,
        phaseWeights: modelState.weights.phaseWeights,
        thresholds: modelState.weights.thresholds,
      },
      history: {
        totalInteractions: modelState.history.totalInteractions,
        correctPredictions: modelState.history.correctPredictions,
        incorrectPredictions: modelState.history.incorrectPredictions,
        recentCorrections: modelState.history.userCorrections.slice(-10),
        recentWeightUpdates: modelState.history.weightUpdates.slice(-20),
      },
    })
  } catch (error) {
    console.error('Adaptive ML GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get model state' },
      { status: 500 }
    )
  }
}

// POST - Perform actions on the adaptive model
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'analyze'
    const body = await request.json()

    const modelState = await readModelState()

    // Action: analyze - Analyze ATC/pilot exchange with adaptive model
    if (action === 'analyze') {
      const input: AnalysisInput = {
        atc: body.atc,
        pilot: body.pilot,
        callsign: body.callsign,
        context: body.context,
      }

      if (!input.atc || !input.pilot) {
        return NextResponse.json(
          { success: false, error: 'Requires: atc, pilot' },
          { status: 400 }
        )
      }

      const result = adaptiveAnalyze(input, modelState)

      // Record interaction
      modelState.history.totalInteractions++
      if (result.isCorrect) {
        modelState.history.correctPredictions++
      }

      // Record accuracy point
      const currentAccuracy = modelState.history.correctPredictions / modelState.history.totalInteractions
      modelState.history.accuracyOverTime.push({
        timestamp: Date.now(),
        accuracy: currentAccuracy,
      })

      await writeModelState(modelState)

      return NextResponse.json({
        success: true,
        analysis: result,
        modelInfo: {
          version: modelState.version,
          totalInteractions: modelState.history.totalInteractions,
          currentAccuracy: Math.round(currentAccuracy * 100),
        },
      })
    }

    // Action: correct - Apply user correction to learn from mistake
    if (action === 'correct') {
      const correction: UserCorrection = {
        id: `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        original: {
          atc: body.original?.atc || '',
          pilot: body.original?.pilot || '',
          predictedCorrect: body.original?.predictedCorrect ?? true,
          predictedErrors: body.original?.predictedErrors || [],
          predictedPhase: body.original?.predictedPhase || 'cruise',
        },
        corrected: {
          isActuallyCorrect: body.corrected?.isActuallyCorrect ?? false,
          actualErrors: body.corrected?.actualErrors || [],
          actualPhase: body.corrected?.actualPhase || 'cruise',
          userFeedback: body.corrected?.userFeedback,
        },
        applied: false,
      }

      if (!body.original || !body.corrected) {
        return NextResponse.json(
          { success: false, error: 'Requires: original, corrected objects' },
          { status: 400 }
        )
      }

      const { updatedState, updates } = applyUserCorrection(modelState, correction)
      await writeModelState(updatedState)

      const stats = getModelStats(updatedState)

      return NextResponse.json({
        success: true,
        message: 'Correction applied - model updated',
        correctionId: correction.id,
        weightUpdates: updates,
        newAccuracy: stats.accuracy,
        learningProgress: stats.learningProgress,
      })
    }

    // Action: reinforce - Apply reinforcement learning from session
    if (action === 'reinforce') {
      const sessionResults = {
        totalReadbacks: body.totalReadbacks || 0,
        correctReadbacks: body.correctReadbacks || 0,
        commonErrors: body.commonErrors || [],
        phases: body.phases || [],
      }

      if (sessionResults.totalReadbacks === 0) {
        return NextResponse.json(
          { success: false, error: 'Requires: totalReadbacks > 0' },
          { status: 400 }
        )
      }

      const updatedState = reinforcementUpdate(modelState, sessionResults)
      await writeModelState(updatedState)

      const stats = getModelStats(updatedState)

      return NextResponse.json({
        success: true,
        message: 'Reinforcement update applied',
        sessionAccuracy: sessionResults.correctReadbacks / sessionResults.totalReadbacks,
        modelStats: stats,
      })
    }

    // Action: reset - Reset model to default weights
    if (action === 'reset') {
      const preserveHistory = body.preserveHistory ?? false

      const newState = createDefaultModelState()

      if (preserveHistory) {
        newState.history = modelState.history
      }

      await writeModelState(newState)

      return NextResponse.json({
        success: true,
        message: preserveHistory ? 'Model reset (history preserved)' : 'Model completely reset',
        model: {
          version: newState.version,
          createdAt: newState.createdAt,
        },
      })
    }

    // Action: config - Update learning configuration
    if (action === 'config') {
      if (body.learningRate !== undefined) {
        modelState.config.learningRate = Math.max(0.01, Math.min(0.5, body.learningRate))
      }
      if (body.momentum !== undefined) {
        modelState.config.momentum = Math.max(0, Math.min(0.9, body.momentum))
      }
      if (body.minConfidence !== undefined) {
        modelState.config.minConfidence = Math.max(0.3, Math.min(0.9, body.minConfidence))
      }
      if (body.adaptiveRateEnabled !== undefined) {
        modelState.config.adaptiveRateEnabled = !!body.adaptiveRateEnabled
      }
      if (body.reinforcementEnabled !== undefined) {
        modelState.config.reinforcementEnabled = !!body.reinforcementEnabled
      }

      await writeModelState(modelState)

      return NextResponse.json({
        success: true,
        message: 'Configuration updated',
        config: modelState.config,
      })
    }

    // Action: batchLearn - Learn from multiple examples at once
    if (action === 'batchLearn') {
      const examples = body.examples || []
      if (!Array.isArray(examples) || examples.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Requires: examples array' },
          { status: 400 }
        )
      }

      let totalUpdates = 0

      for (const example of examples) {
        if (example.atc && example.pilot) {
          // Analyze with current model
          const result = adaptiveAnalyze({ atc: example.atc, pilot: example.pilot }, modelState)

          // If user provided the correct answer, apply as correction
          if (example.isCorrect !== undefined && example.isCorrect !== result.isCorrect) {
            const correction: UserCorrection = {
              id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              timestamp: Date.now(),
              original: {
                atc: example.atc,
                pilot: example.pilot,
                predictedCorrect: result.isCorrect,
                predictedErrors: result.errors.map(e => e.type),
                predictedPhase: result.phase,
              },
              corrected: {
                isActuallyCorrect: example.isCorrect,
                actualErrors: example.errors || [],
                actualPhase: example.phase || result.phase,
              },
              applied: false,
            }

            const { updates } = applyUserCorrection(modelState, correction)
            totalUpdates += updates.length
          }
        }
      }

      await writeModelState(modelState)
      const stats = getModelStats(modelState)

      return NextResponse.json({
        success: true,
        message: `Batch learning complete: ${examples.length} examples processed`,
        weightsUpdated: totalUpdates,
        modelStats: stats,
      })
    }

    // Action: export - Export model for backup/sharing
    if (action === 'export') {
      return NextResponse.json({
        success: true,
        export: modelState,
      })
    }

    // Action: import - Import model from backup
    if (action === 'import') {
      if (!body.model) {
        return NextResponse.json(
          { success: false, error: 'Requires: model object' },
          { status: 400 }
        )
      }

      const importedState = body.model as AdaptiveModelState
      importedState.updatedAt = new Date().toISOString()

      await writeModelState(importedState)

      return NextResponse.json({
        success: true,
        message: 'Model imported successfully',
        version: importedState.version,
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use: analyze, correct, reinforce, reset, config, batchLearn, export, import' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Adaptive ML POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
