import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

/**
 * Training API - File-based storage (partitioned corpus)
 *
 * Corpus is split into three files by phase:
 *   appDepCorpus.json  — departure, approach, climb, descent, etc.
 *   gndCorpus.json     — ground, taxi
 *   rampCorpus.json    — ramp, pushback (stub)
 *
 * Shared data (phraseology, callsigns, waypoints, procedures) → paecCorpus.json
 *
 * Endpoints:
 *   GET    /api/training              — all corpus + stats
 *   GET    /api/training?corpus=gnd   — filter by corpus type
 *   GET    /api/training?phase=X      — filter by phase
 *   POST   /api/training              — add example(s) or shared data
 *   DELETE /api/training              — clear corpus entries
 */

// ── File paths ───────────────────────────────────────────────────────────────
const DATA_DIR = path.join(process.cwd(), 'src', 'data')
const SHARED_PATH   = path.join(DATA_DIR, 'paecCorpus.json')
const APP_DEP_PATH  = path.join(DATA_DIR, 'appDepCorpus.json')
const GND_PATH      = path.join(DATA_DIR, 'gndCorpus.json')
const RAMP_PATH     = path.join(DATA_DIR, 'rampCorpus.json')

const GND_PHASES  = new Set(['ground', 'taxi'])
const RAMP_PHASES = new Set(['ramp', 'pushback'])

// ── Types ────────────────────────────────────────────────────────────────────
interface ATCTrainingExample {
  atc: string
  pilot: string
  isCorrect: boolean
  phase: string
  errorType?: string
  explanation?: string
}

interface CorpusFile {
  metadata: { version: string; lastUpdated: string; description: string }
  corpus: ATCTrainingExample[]
}

interface SharedFile {
  metadata: { version: string; lastUpdated: string; description: string }
  phraseology: {
    nonStandardPhrases: { incorrect: string; correct: string; weight: string }[]
    numberPronunciation: { incorrect: string; correct: string; weight: string }[]
  }
  callsigns: { philippine: string[]; international: string[] }
  waypoints: string[]
  procedures: { sids: string[]; stars: string[] }
}

// ── File I/O helpers ─────────────────────────────────────────────────────────
async function readJSON<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T
  } catch {
    return fallback
  }
}

async function writeJSON(filePath: string, data: object): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

function corpusFilePathForPhase(phase: string): string {
  if (RAMP_PHASES.has(phase)) return RAMP_PATH
  if (GND_PHASES.has(phase))  return GND_PATH
  return APP_DEP_PATH
}

function emptyCorpus(description: string): CorpusFile {
  return {
    metadata: {
      version: '3.0',
      lastUpdated: new Date().toISOString().split('T')[0],
      description,
    },
    corpus: [],
  }
}

function emptyShared(): SharedFile {
  return {
    metadata: { version: '3.0', lastUpdated: new Date().toISOString().split('T')[0], description: 'PAEC Shared' },
    phraseology: { nonStandardPhrases: [], numberPronunciation: [] },
    callsigns: { philippine: [], international: [] },
    waypoints: [],
    procedures: { sids: [], stars: [] },
  }
}

// ── Stats helper ─────────────────────────────────────────────────────────────
function getStats(corpus: ATCTrainingExample[]) {
  const total     = corpus.length
  const correct   = corpus.filter(e => e.isCorrect).length
  const incorrect = total - correct
  const byPhase   = corpus.reduce((acc, e) => { acc[e.phase] = (acc[e.phase] || 0) + 1; return acc }, {} as Record<string, number>)
  const byErrorType = corpus.filter(e => !e.isCorrect && e.errorType)
    .reduce((acc, e) => { acc[e.errorType!] = (acc[e.errorType!] || 0) + 1; return acc }, {} as Record<string, number>)
  return { total, correct, incorrect, accuracy: total > 0 ? Math.round((correct / total) * 100) : 0, byPhase, byErrorType }
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const corpusFilter = searchParams.get('corpus')  // 'appdep' | 'gnd' | 'ramp'
    const phase        = searchParams.get('phase')
    const errorType    = searchParams.get('type')
    const onlyIncorrect = searchParams.get('incorrect') === 'true'
    const onlyCorrect   = searchParams.get('correct')   === 'true'

    const [shared, appDep, gnd, ramp] = await Promise.all([
      readJSON<SharedFile>(SHARED_PATH, emptyShared()),
      readJSON<CorpusFile>(APP_DEP_PATH, emptyCorpus('APP/DEP')),
      readJSON<CorpusFile>(GND_PATH,     emptyCorpus('GND')),
      readJSON<CorpusFile>(RAMP_PATH,    emptyCorpus('RAMP')),
    ])

    // Choose which corpus to return
    let corpus: ATCTrainingExample[]
    if (corpusFilter === 'gnd')   corpus = gnd.corpus
    else if (corpusFilter === 'ramp') corpus = ramp.corpus
    else if (corpusFilter === 'appdep') corpus = appDep.corpus
    else corpus = [...appDep.corpus, ...gnd.corpus, ...ramp.corpus]

    if (phase)        corpus = corpus.filter(e => e.phase === phase)
    if (errorType)    corpus = corpus.filter(e => e.errorType === errorType)
    if (onlyIncorrect) corpus = corpus.filter(e => !e.isCorrect)
    if (onlyCorrect)   corpus = corpus.filter(e => e.isCorrect)

    const all = [...appDep.corpus, ...gnd.corpus, ...ramp.corpus]

    return NextResponse.json({
      success: true,
      data: {
        metadata: shared.metadata,
        corpus,
        stats: getStats(corpus),
        totalStats: getStats(all),
        byCorpus: {
          appDep: getStats(appDep.corpus),
          gnd:    getStats(gnd.corpus),
          ramp:   getStats(ramp.corpus),
        },
        phraseology: shared.phraseology,
        callsigns:   shared.callsigns,
        waypoints:   shared.waypoints,
        procedures:  shared.procedures,
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to retrieve training data' }, { status: 500 })
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // ── add: corpus examples (routed by phase) ───────────────────────────────
    if (body.action === 'add') {
      const examples: ATCTrainingExample[] = Array.isArray(body.examples)
        ? body.examples
        : [body.example || body.examples]

      // Group by target file
      const byFile: Record<string, ATCTrainingExample[]> = {}
      for (const ex of examples) {
        if (!ex.atc || !ex.pilot || typeof ex.isCorrect !== 'boolean') {
          return NextResponse.json(
            { success: false, error: 'Each example requires: atc, pilot, isCorrect, phase' },
            { status: 400 }
          )
        }
        const filePath = corpusFilePathForPhase(ex.phase || 'general')
        ;(byFile[filePath] ??= []).push({ atc: ex.atc, pilot: ex.pilot, isCorrect: ex.isCorrect,
          phase: ex.phase || 'general', errorType: ex.errorType, explanation: ex.explanation })
      }

      const today = new Date().toISOString().split('T')[0]
      for (const [filePath, newExamples] of Object.entries(byFile)) {
        const fallbackDesc = filePath.includes('gnd') ? 'GND' : filePath.includes('ramp') ? 'RAMP' : 'APP/DEP'
        const file = await readJSON<CorpusFile>(filePath, emptyCorpus(fallbackDesc))
        file.corpus.push(...newExamples)
        file.metadata.lastUpdated = today
        await writeJSON(filePath, file)
      }

      const all = [...(await readJSON<CorpusFile>(APP_DEP_PATH, emptyCorpus(''))).corpus,
                   ...(await readJSON<CorpusFile>(GND_PATH,     emptyCorpus(''))).corpus,
                   ...(await readJSON<CorpusFile>(RAMP_PATH,    emptyCorpus(''))).corpus]

      return NextResponse.json({ success: true, message: `Added ${examples.length} training example(s)`, stats: getStats(all) })
    }

    // ── addPhrase / addCallsign / addWaypoint / addProcedure → shared file ───
    if (['addPhrase', 'addCallsign', 'addWaypoint', 'addProcedure'].includes(body.action)) {
      const shared = await readJSON<SharedFile>(SHARED_PATH, emptyShared())

      if (body.action === 'addPhrase') {
        const phrase = body.phrase
        if (!phrase?.incorrect || !phrase?.correct) {
          return NextResponse.json({ success: false, error: 'Phrase requires: incorrect, correct' }, { status: 400 })
        }
        if (body.type === 'number') shared.phraseology.numberPronunciation.push(phrase)
        else shared.phraseology.nonStandardPhrases.push(phrase)
      }

      if (body.action === 'addCallsign') {
        const cs = body.callsign
        if (body.type === 'philippine') { if (!shared.callsigns.philippine.includes(cs)) shared.callsigns.philippine.push(cs) }
        else { if (!shared.callsigns.international.includes(cs)) shared.callsigns.international.push(cs) }
      }

      if (body.action === 'addWaypoint') {
        const wp = body.waypoint
        if (!shared.waypoints.includes(wp)) shared.waypoints.push(wp)
      }

      if (body.action === 'addProcedure') {
        const proc = body.procedure
        if (body.type === 'sid') { if (!shared.procedures.sids.includes(proc)) shared.procedures.sids.push(proc) }
        else { if (!shared.procedures.stars.includes(proc)) shared.procedures.stars.push(proc) }
      }

      shared.metadata.lastUpdated = new Date().toISOString().split('T')[0]
      await writeJSON(SHARED_PATH, shared)

      return NextResponse.json({ success: true, message: `${body.action} complete` })
    }

    // ── train / analyze ───────────────────────────────────────────────────────
    if (body.action === 'train') {
      const all = [...(await readJSON<CorpusFile>(APP_DEP_PATH, emptyCorpus(''))).corpus,
                   ...(await readJSON<CorpusFile>(GND_PATH,     emptyCorpus(''))).corpus,
                   ...(await readJSON<CorpusFile>(RAMP_PATH,    emptyCorpus(''))).corpus]
      return NextResponse.json({ success: true, training: { message: 'Corpus validation complete', stats: getStats(all), sampleSize: all.length } })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use: add, addPhrase, addCallsign, addWaypoint, addProcedure, train' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Training API error:', error)
    return NextResponse.json({ success: false, error: 'Failed to process request' }, { status: 500 })
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const target = searchParams.get('target') || 'corpus'       // 'corpus' | 'appdep' | 'gnd' | 'ramp' | 'all'
    const today  = new Date().toISOString().split('T')[0]

    const clearCorpusFile = async (filePath: string, description: string) => {
      const file = await readJSON<CorpusFile>(filePath, emptyCorpus(description))
      file.corpus = []
      file.metadata.lastUpdated = today
      await writeJSON(filePath, file)
    }

    if (target === 'appdep') await clearCorpusFile(APP_DEP_PATH, 'APP/DEP')
    else if (target === 'gnd')  await clearCorpusFile(GND_PATH, 'GND')
    else if (target === 'ramp') await clearCorpusFile(RAMP_PATH, 'RAMP')
    else if (target === 'corpus' || target === 'all') {
      await Promise.all([
        clearCorpusFile(APP_DEP_PATH, 'APP/DEP'),
        clearCorpusFile(GND_PATH, 'GND'),
        clearCorpusFile(RAMP_PATH, 'RAMP'),
      ])
      if (target === 'all') {
        const shared = emptyShared()
        await writeJSON(SHARED_PATH, shared)
      }
    }

    return NextResponse.json({ success: true, message: `Cleared ${target}` })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to clear training data' }, { status: 500 })
  }
}
