/**
 * Ground Control Rule-Based Analyzer
 *
 * Deterministic rule engine for analyzing ATC ground control communications.
 * Covers: taxi instructions, hold-short operations, runway crossings,
 * line-up-and-wait, pushback, and takeoff/landing clearances.
 *
 * NOTE: This is NOT a machine learning model. No neural networks, probabilistic
 * training loops, or adaptive learning are involved. The "ML" naming in exported
 * types is retained for API compatibility with the APP/DEP analyzer.
 *
 * References:
 * - ICAO Doc 4444 PANS-ATM §7.11 (Ground Movement)
 * - ICAO Doc 9432 Manual of Radiotelephony (5th Edition)
 * - ICAO Doc 9157 Aerodrome Design Manual
 */

import {
  analyzeReadback,
  normalizeToDigits,
  type SemanticAnalysisResult,
} from './semanticReadbackAnalyzer'

import {
  calculateEnhancedSeverity,
  detectErrorPattern,
  type ErrorPattern,
} from './atcData'

import {
  analyzeMultiPartInstruction,
  type MultiPartInstructionAnalysis,
  type SafetyVector,
} from './departureApproachAnalyzer'

import gndCorpus from '../data/gndCorpus.json'

// Runtime-loaded check config (all tunable patterns live in gndCorpus.json → "checks")
const CHECKS = (gndCorpus as unknown as {
  checks: {
    holdShortEquivalents: string[]
    lineUpAndWaitPattern: string
    takeoffClearancePattern: string
    runwayPattern: string
    taxiwayViaPattern: string
    pushbackPattern: string
  }
}).checks

// ============================================================================
// SEVERITY NORMALIZATION
// ============================================================================

type UnifiedSeverity = 'critical' | 'high' | 'medium' | 'low'

function mapWeight(raw: string | undefined): UnifiedSeverity {
  switch ((raw || '').toLowerCase()) {
    case 'critical': return 'critical'
    case 'high':     return 'high'
    case 'medium':   return 'medium'
    default:         return 'low'
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface GroundMLResult extends SemanticAnalysisResult {
  phase: GroundPhase
  phaseConfidence: number
  contextualWeight: 'critical' | 'high' | 'medium' | 'low'
  multiPartAnalysis: MultiPartInstructionAnalysis
  groundSpecificErrors: GndSpecificError[]
  safetyVectors: SafetyVector[]
  groundConfidenceScores: GroundConfidenceScores
  trainingRecommendations: string[]
}

export type GroundPhase =
  | 'pushback'
  | 'ground'
  | 'taxi'
  | 'lineup'
  | 'crossing'
  | 'holding'

export interface GndSpecificError {
  type: GndErrorType
  description: string
  weight: 'critical' | 'high' | 'medium' | 'low'
  correction: string
  icaoReference: string
  safetyImpact: string
}

export type GndErrorType =
  | 'lineup_vs_takeoff_confusion'
  | 'hold_short_not_confirmed'
  | 'runway_crossing_incomplete'
  | 'runway_designation_wrong'
  | 'taxi_route_incomplete'
  | 'taxiway_designator_wrong'
  | 'callsign_not_included'

export interface GroundConfidenceScores {
  phaseDetection: number
  instructionClassification: number
  errorDetection: number
  overallConfidence: number
}

// ============================================================================
// PHASE DETECTION ENGINE
// ============================================================================

interface GroundPhasePattern {
  phase: GroundPhase
  patterns: RegExp[]
  weight: number
  contextClues: string[]
}

const GROUND_PHASE_PATTERNS: GroundPhasePattern[] = [
  {
    phase: 'holding',
    patterns: [/hold\s+short/i, /hold\s+position/i],
    weight: 10,
    contextClues: ['hold', 'short'],
  },
  {
    phase: 'crossing',
    patterns: [/cross\s+runway/i, /cleared\s+to\s+cross/i],
    weight: 10,
    contextClues: ['cross', 'crossing'],
  },
  {
    phase: 'lineup',
    patterns: [/line\s*up\s*(and\s*)?wait/i, /behind.*line\s*up/i],
    weight: 10,
    contextClues: ['lineup', 'wait'],
  },
  {
    phase: 'pushback',
    patterns: [/push\s*back/i, /pushback\s+approved/i, /engine\s+start/i, /start\s+up/i],
    weight: 10,
    contextClues: ['pushback', 'start'],
  },
  {
    phase: 'taxi',
    patterns: [/taxi\s+(to|via)/i, /continue\s+taxi/i],
    weight: 8,
    contextClues: ['taxi', 'via', 'taxiway'],
  },
  {
    phase: 'ground',
    patterns: [/ground\s+control/i, /clearance\s+delivery/i],
    weight: 6,
    contextClues: ['ground', 'delivery'],
  },
]

/**
 * Detects the current ground phase from ATC instruction and optional pilot readback
 */
export function detectGroundPhase(
  atcInstruction: string,
  pilotReadback?: string
): { phase: GroundPhase; confidence: number } {
  const text = (atcInstruction + ' ' + (pilotReadback || '')).toLowerCase()
  let bestMatch: { phase: GroundPhase; score: number } = { phase: 'taxi', score: 0 }

  for (const pp of GROUND_PHASE_PATTERNS) {
    let score = 0
    for (const pat of pp.patterns) {
      if (pat.test(text)) score += pp.weight
    }
    for (const clue of pp.contextClues) {
      if (text.includes(clue)) score += 2
    }
    if (score > bestMatch.score) {
      bestMatch = { phase: pp.phase, score }
    }
  }

  const confidence = Math.round(Math.min(bestMatch.score / 20, 1) * 100) / 100
  return { phase: bestMatch.phase, confidence }
}

// ============================================================================
// GROUND-SPECIFIC ERROR DETECTION
// ============================================================================

/**
 * Detects GND-specific readback errors: hold-short, lineup/takeoff confusion,
 * runway crossing, runway designation, taxi route completeness, callsign.
 */
export function detectGndErrors(
  atcInstruction: string,
  pilotReadback: string,
  callsign?: string
): GndSpecificError[] {
  const errors: GndSpecificError[] = []
  const atcLower = atcInstruction.toLowerCase()
  const pilotLower = pilotReadback.toLowerCase()

  // 1. lineup_vs_takeoff_confusion (critical)
  // ATC issued "line up and wait" but pilot read back "cleared for takeoff"
  const luawRe    = new RegExp(CHECKS.lineUpAndWaitPattern, 'i')
  const takeoffRe = new RegExp(CHECKS.takeoffClearancePattern, 'i')
  if (luawRe.test(atcLower) && takeoffRe.test(pilotLower)) {
    errors.push({
      type: 'lineup_vs_takeoff_confusion',
      description: 'Pilot read back takeoff clearance instead of line up and wait',
      weight: 'critical',
      correction: 'Do NOT commence takeoff until "cleared for takeoff" is explicitly issued',
      icaoReference: 'ICAO Doc 4444 §7.11.3',
      safetyImpact: 'Runway incursion risk — aircraft may depart without a takeoff clearance',
    })
  }

  // 2. hold_short_not_confirmed (critical)
  // ATC said "hold short of runway X" but pilot did not echo "hold short"
  const hsMatch = atcLower.match(/hold\s+short\s+(?:of\s+)?runway\s+(\w+)/i)
  if (hsMatch) {
    const hsRe = new RegExp(CHECKS.holdShortEquivalents.join('|'), 'i')
    if (!hsRe.test(pilotLower)) {
      errors.push({
        type: 'hold_short_not_confirmed',
        description: `Hold short of runway ${hsMatch[1].toUpperCase()} not confirmed in readback`,
        weight: 'critical',
        correction: `Read back: "Hold short runway ${hsMatch[1].toUpperCase()}, [callsign]"`,
        icaoReference: 'ICAO Doc 4444 §7.11.2',
        safetyImpact: 'ATC cannot confirm aircraft will stop before runway — runway incursion risk',
      })
    }
  }

  // 3. runway_crossing_incomplete (high)
  // ATC cleared "cross runway X" but pilot did not confirm the runway number
  const crossMatch = atcLower.match(/cross\s+runway\s+(\w+)/i)
  if (crossMatch) {
    const rwNum = normalizeToDigits(crossMatch[1])
    if (rwNum && !normalizeToDigits(pilotLower).includes(rwNum)) {
      errors.push({
        type: 'runway_crossing_incomplete',
        description: `Runway ${crossMatch[1].toUpperCase()} crossing clearance not confirmed`,
        weight: 'high',
        correction: `Confirm: "Cross runway ${crossMatch[1].toUpperCase()}, [callsign]"`,
        icaoReference: 'ICAO Doc 4444 §7.7.2',
        safetyImpact: 'Unconfirmed runway crossing risks incursion',
      })
    }
  }

  // 4. runway_designation_wrong (high)
  // ATC and pilot both mention a runway but the designators differ
  const atcRunwayMatch   = atcLower.match(/runway\s+(\d{1,2}[lrc]?)/i)
  const pilotRunwayMatch = pilotLower.match(/runway\s+(\d{1,2}[lrc]?)/i)
  if (atcRunwayMatch && pilotRunwayMatch) {
    const atcRw   = normalizeToDigits(atcRunwayMatch[1])
    const pilotRw = normalizeToDigits(pilotRunwayMatch[1])
    if (atcRw && pilotRw && atcRw !== pilotRw) {
      errors.push({
        type: 'runway_designation_wrong',
        description: `Runway mismatch: ATC said ${atcRunwayMatch[1].toUpperCase()}, pilot read ${pilotRunwayMatch[1].toUpperCase()}`,
        weight: 'high',
        correction: `Correct runway: ${atcRunwayMatch[1].toUpperCase()}`,
        icaoReference: 'ICAO Doc 4444 §7.11',
        safetyImpact: 'Wrong runway used for takeoff/landing — CFIT / incursion risk',
      })
    }
  }

  // 5. taxi_route_incomplete (medium)
  // ATC gave "via [taxiways]" but pilot omitted some taxiway letters
  const viaMatch = atcLower.match(/via\s+([a-z][a-z,\s]*)(?:\s+(?:runway|hold|cross)|,\s*hold|\s*$)/i)
  let atcTaxiways: string[] = []
  if (viaMatch) {
    atcTaxiways = viaMatch[1].split(/[,\s]+/).filter(t => /^[a-z]$/i.test(t.trim())).map(t => t.toLowerCase())
    const missingTaxiways = atcTaxiways.filter(tw => !pilotLower.includes(tw))
    if (missingTaxiways.length > 0) {
      errors.push({
        type: 'taxi_route_incomplete',
        description: `Taxiway(s) ${missingTaxiways.map(t => t.toUpperCase()).join(', ')} missing from readback`,
        weight: 'medium',
        correction: `Include all taxiway designators: "via ${viaMatch[1].trim()}"`,
        icaoReference: 'ICAO Doc 4444 §7.11.1',
        safetyImpact: 'Aircraft may take incorrect taxi route, causing delay or conflict',
      })
    }
  }

  // 6. taxiway_designator_wrong (medium)
  // Pilot mentions a single-letter taxiway NOT in the ATC via-route
  // Only fire when ATC gave a via-route AND pilot gave a different letter
  if (atcTaxiways.length > 0) {
    // collect all isolated single-letter words in pilot readback as potential taxiway designators
    const pilotLetters = (pilotLower.match(/\b([a-z])\b/g) || []).filter(l => l !== 'a')
    const wrongTaxiways = pilotLetters.filter(tw => !atcTaxiways.includes(tw))
    if (wrongTaxiways.length > 0) {
      errors.push({
        type: 'taxiway_designator_wrong',
        description: `Pilot used taxiway(s) ${wrongTaxiways.map(t => t.toUpperCase()).join(', ')} not in ATC instruction`,
        weight: 'medium',
        correction: `Use taxiways from ATC instruction: ${atcTaxiways.map(t => t.toUpperCase()).join(', ')}`,
        icaoReference: 'ICAO Doc 4444 §7.11.1',
        safetyImpact: 'Wrong taxi routing may cause runway incursion or conflict',
      })
    }
  }

  // 7. callsign_not_included (medium) — same pattern as detectDepartureErrors / detectApproachErrors
  if (callsign) {
    const csLower   = callsign.toLowerCase()
    const csNumeric = csLower.replace(/[^0-9]/g, '')
    const csAlpha   = csLower.replace(/[0-9]/g, '').trim()
    const hasCallsign = pilotLower.includes(csLower) ||
      (csNumeric.length > 0 && pilotLower.includes(csNumeric)) ||
      (csAlpha.length > 0 && pilotLower.includes(csAlpha))
    if (!hasCallsign) {
      errors.push({
        type: 'callsign_not_included',
        description: `Callsign "${callsign.toUpperCase()}" not included in readback`,
        weight: 'medium',
        correction: `End readback with callsign: "..., ${callsign.toUpperCase()}"`,
        icaoReference: 'ICAO Doc 9432 Chapter 5',
        safetyImpact: 'ATC cannot confirm correct aircraft acknowledged the instruction',
      })
    }
  }

  return errors
}

// ============================================================================
// READBACK COMPLETENESS
// ============================================================================

/**
 * Computes a 0–100 readback completeness score based on which mandatory
 * elements are present in the pilot readback.
 *
 * Weighting:
 *   - Runway number:      35 pts (if ATC mentioned a runway)
 *   - Taxiway route:      25 pts (if ATC gave a via route)
 *   - Operation keyword:  25 pts (hold short / cross / taxi / line up / cleared)
 *   - Callsign:           15 pts
 *
 * When ATC didn't mention a runway the operation keyword pool is expanded to 60 pts.
 */
function computeReadbackCompleteness(
  atcInstruction: string,
  pilotReadback: string
): number {
  const atcLower   = atcInstruction.toLowerCase()
  const pilotLower = pilotReadback.toLowerCase()
  let score = 0

  const hasRunwayInATC = /runway\s+\d/i.test(atcLower)

  // Runway (35 pts)
  if (hasRunwayInATC) {
    const atcRwMatch = atcLower.match(/runway\s+(\d{1,2}[lrc]?)/i)
    if (atcRwMatch) {
      const rwDigits = normalizeToDigits(atcRwMatch[1])
      if (rwDigits && normalizeToDigits(pilotLower).includes(rwDigits)) {
        score += 35
      }
    }
  }

  // Taxiway route via (25 pts)
  const viaMatch = atcLower.match(/via\s+([a-z][a-z,\s]*)(?:\s+|$)/i)
  if (viaMatch) {
    const taxiways = viaMatch[1].split(/[,\s]+/).filter(t => /^[a-z]$/i.test(t.trim()))
    const found = taxiways.filter(tw => pilotLower.includes(tw.toLowerCase()))
    if (taxiways.length > 0) {
      score += Math.round((found.length / taxiways.length) * 25)
    }
  } else if (!hasRunwayInATC) {
    // No via route and no runway mentioned → give via points freely
    score += 25
  }

  // Operation keyword
  const opKeywords = ['hold short', 'cross', 'line up', 'taxi', 'cleared', 'pushback', 'engine start']
  const hasOp = opKeywords.some(kw => pilotLower.includes(kw))
  score += hasOp ? (hasRunwayInATC ? 25 : 60) : 0

  // Callsign (15 pts)
  if (/\b([A-Z]{2,3}\d{2,4}|[A-Z]{3}\s*\d{3,4})\b/i.test(pilotReadback)) {
    score += 15
  }

  return Math.min(score, 100)
}

// ============================================================================
// SAFETY VECTORS
// ============================================================================

/**
 * Calculates safety vectors for GND operations analysis.
 * Uses the same SafetyVector interface as departureApproachAnalyzer for UI compatibility.
 */
function calculateGroundSafetyVectors(
  baseAnalysis: SemanticAnalysisResult,
  phase: GroundPhase,
  gndErrors: GndSpecificError[]
): SafetyVector[] {
  const vectors: SafetyVector[] = []

  // 1. Critical parameter accuracy
  const criticalGndErrors = gndErrors.filter(e =>
    e.type === 'lineup_vs_takeoff_confusion' ||
    e.type === 'hold_short_not_confirmed' ||
    e.type === 'runway_designation_wrong'
  )
  vectors.push({
    factor: 'Critical Parameter Accuracy',
    score: Math.max(0, 100 - criticalGndErrors.length * 30),
    weight: 0.30,
    description: 'Accuracy of safety-critical values (runway designation, hold-short confirmation)',
    mitigationRequired: criticalGndErrors.length > 0,
  })

  // 2. Hold short compliance — weight elevated when phase is holding
  const holdShortErrors = gndErrors.filter(e => e.type === 'hold_short_not_confirmed')
  const holdWeight = phase === 'holding' ? 0.30 : 0.20
  vectors.push({
    factor: 'Hold Short Compliance',
    score: holdShortErrors.length === 0 ? 100 : 20,
    weight: holdWeight,
    description: 'Full readback of hold-short instructions to prevent runway incursions',
    mitigationRequired: holdShortErrors.length > 0,
  })

  // 3. Readback completeness
  const incompleteErrors = baseAnalysis.errors.filter(e => e.type === 'incomplete_readback').length
  const completeness = Math.max(0, 100 - incompleteErrors * 20)
  vectors.push({
    factor: 'Readback Completeness',
    score: completeness,
    weight: 0.25,
    description: 'Percentage of required elements included in readback',
    mitigationRequired: completeness < 80,
  })

  // 4. Callsign compliance — weight adjusts so all weights sum to 1.0
  const csErrors = gndErrors.filter(e => e.type === 'callsign_not_included')
  const csWeight = 0.25 - (holdWeight - 0.20)
  vectors.push({
    factor: 'Callsign Compliance',
    score: csErrors.length === 0 ? 100 : 60,
    weight: csWeight,
    description: 'Callsign included at end of readback per ICAO Doc 9432',
    mitigationRequired: csErrors.length > 0,
  })

  return vectors
}

// ============================================================================
// ML CONFIDENCE SCORING
// ============================================================================

/**
 * Calculates confidence scores for the GND analysis
 */
function calculateGroundConfidence(
  phaseConfidence: number,
  baseAnalysis: SemanticAnalysisResult,
  gndErrors: GndSpecificError[]
): GroundConfidenceScores {
  const phaseDetection = phaseConfidence

  const errorCount = baseAnalysis.errors.length
  const instructionClassification = Math.max(
    0.5,
    Math.min(1.0, 1 - (errorCount / Math.max(errorCount + 1, 1)) * 0.5)
  )

  const criticalCount = gndErrors.filter(e => e.weight === 'critical').length
  const errorDetection = Math.max(0.5, 1 - criticalCount * 0.2)

  const overallConfidence = phaseDetection * 0.35 + instructionClassification * 0.35 + errorDetection * 0.30

  return {
    phaseDetection:            Math.round(phaseDetection * 100) / 100,
    instructionClassification: Math.round(instructionClassification * 100) / 100,
    errorDetection:            Math.round(errorDetection * 100) / 100,
    overallConfidence:         Math.round(overallConfidence * 100) / 100,
  }
}

// ============================================================================
// TRAINING RECOMMENDATIONS
// ============================================================================

function generateGroundRecommendations(
  baseAnalysis: SemanticAnalysisResult,
  _phase: GroundPhase,
  gndErrors: GndSpecificError[]
): string[] {
  const recs: string[] = []

  // From base semantic errors
  for (const e of baseAnalysis.errors) {
    if (e.type === 'incomplete_readback')
      recs.push('Practice full readback format: [operation] + [runway/taxiway] + [callsign]')
    if (e.type === 'wrong_value')
      recs.push('Focus on runway designation accuracy (zero-six vs two-four, zero-four vs zero-two)')
    if (e.type === 'parameter_confusion')
      recs.push('Distinguish clearly: "line up and wait" ≠ "cleared for takeoff" — wait for explicit clearance')
    if (e.type === 'missing_element')
      recs.push('Use systematic checklist for complex taxi clearances: runway + taxiways + hold-short + callsign')
  }

  // From GND-specific errors
  for (const e of gndErrors) {
    if (e.type === 'lineup_vs_takeoff_confusion')
      recs.push('CRITICAL: Never commence takeoff roll without explicit "cleared for takeoff" from ATC')
    if (e.type === 'hold_short_not_confirmed')
      recs.push('Hold-short instructions must always be read back completely — runway safety-critical')
    if (e.type === 'taxi_route_incomplete')
      recs.push('Read back all taxiway designators in the via route to confirm correct routing')
    if (e.type === 'runway_crossing_incomplete')
      recs.push('Always confirm the runway number when reading back a crossing clearance')
  }

  return Array.from(new Set(recs)).slice(0, 5)
}

// ============================================================================
// SEQUENCE ANALYSIS HELPERS (parallel to departureApproachAnalyzer helpers)
// ============================================================================

function getErrorTrend(
  previousErrors: { type: string; weight: string; timestamp: number }[]
): 'improving' | 'stable' | 'declining' {
  if (previousErrors.length < 2) return 'stable'

  const sev: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
  const recent = previousErrors.slice(-Math.ceil(previousErrors.length / 2))
  const older  = previousErrors.slice(0, Math.floor(previousErrors.length / 2))

  const recentAvg = recent.reduce((s, e) => s + (sev[e.weight] || 0), 0) / recent.length
  const olderAvg  = older.reduce((s, e) => s + (sev[e.weight] || 0), 0) / older.length

  if (recentAvg < olderAvg - 0.5) return 'improving'
  if (recentAvg > olderAvg + 0.5) return 'declining'
  return 'stable'
}

// ============================================================================
// HELPER — map GroundPhase to SeverityFactors.flightPhase
// ============================================================================

type GndSeverityPhase = 'ground' | 'departure' | 'climb' | 'cruise' | 'descent' | 'approach' | 'landing'

function mapGroundPhase(_phase: GroundPhase): GndSeverityPhase {
  return 'ground'   // All GND phases map to 'ground' weight context
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Performs enhanced analysis for ground control communications.
 * Parallel structure to analyzeDepartureApproach() in departureApproachAnalyzer.ts.
 */
export function analyzeGround(
  atcInstruction: string,
  pilotReadback: string,
  callsign?: string,
  previousErrors?: { type: string; weight: string; timestamp: number }[]
): GroundMLResult {
  // 1. Base semantic analysis
  const baseAnalysis = analyzeReadback(atcInstruction, pilotReadback, callsign)

  // 2. Detect ground phase
  const phaseResult = detectGroundPhase(atcInstruction, pilotReadback)

  // 3. Multi-part instruction analysis (reuse from departureApproachAnalyzer)
  const multiPartAnalysis = analyzeMultiPartInstruction(atcInstruction, pilotReadback)

  // 4. Detect GND-specific errors
  const gndErrors = detectGndErrors(atcInstruction, pilotReadback, callsign)

  // 5. Contextual weight
  const contextualWeight: UnifiedSeverity = mapWeight(
    calculateEnhancedSeverity(
      { phase: mapGroundPhase(phaseResult.phase) },
      baseAnalysis.errors.length > 0 ? baseAnalysis.errors[0].type : 'unknown'
    )
  )

  // 6. Safety vectors
  const safetyVectors = calculateGroundSafetyVectors(baseAnalysis, phaseResult.phase, gndErrors)

  // 7. Confidence scores
  const groundConfidenceScores = calculateGroundConfidence(phaseResult.confidence, baseAnalysis, gndErrors)

  // 8. Training recommendations
  const trainingRecommendations = generateGroundRecommendations(baseAnalysis, phaseResult.phase, gndErrors)

  // Suppress unused-variable warning for helpers used in future sequence analysis
  void getErrorTrend(previousErrors || [])
  void detectErrorPattern

  return {
    ...baseAnalysis,
    phase: phaseResult.phase,
    phaseConfidence: phaseResult.confidence,
    contextualWeight,
    multiPartAnalysis,
    groundSpecificErrors: gndErrors,
    safetyVectors,
    groundConfidenceScores,
    trainingRecommendations,
  }
}
