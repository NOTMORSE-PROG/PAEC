import { NextRequest, NextResponse } from 'next/server'
import {
  initializeDatabase,
  saveTrainingExamplesBatch,
  getTrainingCorpus,
  getCorpusStats,
  clearTrainingCorpus,
} from '@/lib/database'

/**
 * Database API - PostgreSQL Operations
 *
 * Endpoints:
 * GET    /api/database              - Get corpus stats
 * POST   /api/database?action=init  - Initialize database schema
 * POST   /api/database?action=importCorpus - Import training corpus to DB
 * POST   /api/database?action=getCorpus   - Get training corpus entries
 * POST   /api/database?action=clearCorpus - Clear training corpus
 */

// GET - Get corpus statistics
export async function GET() {
  try {
    const corpusStats = await getCorpusStats()

    return NextResponse.json({
      success: true,
      database: {
        connected: true,
        provider: 'Neon PostgreSQL',
      },
      corpus: corpusStats,
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

      return NextResponse.json({
        success: true,
        message: 'Database initialized successfully',
        tables: ['training_corpus'],
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
      { success: false, error: 'Invalid action. Use: init, importCorpus, getCorpus, clearCorpus' },
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
