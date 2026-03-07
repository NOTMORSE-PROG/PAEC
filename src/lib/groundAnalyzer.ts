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
  type SequenceAnalysis,
} from './departureApproachAnalyzer'

import gndCorpus from '../data/gndCorpus.json'

// Typed corpus entry (flat format — one row per ATC/pilot pair)
type GndCorpusEntry = {
  atc: string
  pilot: string
  isCorrect: boolean
  phase: string
  errorType?: string
  explanation?: string
}

const GND_CORPUS: GndCorpusEntry[] = (gndCorpus as unknown as { corpus: GndCorpusEntry[] }).corpus

// Runtime-loaded check config (all tunable patterns live in gndCorpus.json → "checks")
const CHECKS = (gndCorpus as unknown as {
  checks: {
    holdShortEquivalents: string[]
    lineUpAndWaitPattern: string
    takeoffClearancePattern: string
    runwayPattern: string
    taxiwayViaPattern: string
    pushbackPattern: string
    backtrackPattern: string
    intersectionPattern: string
    atisPattern: string
    frequencyPattern: string
  }
}).checks

// ============================================================================
// WEIGHT NORMALIZATION
// ============================================================================

type UnifiedSeverity = 'critical' | 'high' | 'medium' | 'low'

/**
 * Normalizes weight strings from any internal subsystem into the 4-tier
 * unified weight scale. Prevents 'critical' from being silently dropped
 * when merging results from semanticReadbackAnalyzer (which uses all 4 tiers)
 * and analysisEngine (which historically only used 3 tiers).
 */
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
  sequenceAnalysis: SequenceAnalysis
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
  | 'pushback_direction_missing'
  | 'backtrack_not_confirmed'
  | 'frequency_not_confirmed'
  | 'atis_not_confirmed'
  | 'incorrect_holding_point'
  | 'unauthorized_takeoff_authority'
  | 'intersection_departure_missing'
  | 'non_standard_taxi_instruction'
  | 'roger_substitution'
  | 'missing_designator'

export interface GroundConfidenceScores {
  phaseDetection: number
  instructionClassification: number
  errorDetection: number
  weightAssessment: number
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

  // Compile corpus-driven patterns once (1D — replace inline regex with CHECKS patterns)
  const runwayRe        = new RegExp(CHECKS.runwayPattern, 'i')
  const taxiwayViaRe    = new RegExp(CHECKS.taxiwayViaPattern, 'i')
  const pushbackRe      = new RegExp(CHECKS.pushbackPattern, 'i')
  const backtrackRe     = new RegExp(CHECKS.backtrackPattern, 'i')
  const intersectionRe  = new RegExp(CHECKS.intersectionPattern, 'i')
  const atisRe          = new RegExp(CHECKS.atisPattern, 'i')
  const frequencyRe     = new RegExp(CHECKS.frequencyPattern, 'i')

  // 3. runway_crossing_incomplete (high) — uses CHECKS.runwayPattern
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

  // 4. runway_designation_wrong (high) — uses CHECKS.runwayPattern
  const atcRunwayMatch   = atcLower.match(runwayRe)
  const pilotRunwayMatch = pilotLower.match(runwayRe)
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

  // 5. taxi_route_incomplete (medium) — uses CHECKS.taxiwayViaPattern
  const viaMatch = atcLower.match(taxiwayViaRe)
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
  if (atcTaxiways.length > 0) {
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

  // 7. callsign_not_included (medium)
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

  // ── New checks 8–15 ──────────────────────────────────────────────────────

  // 8. pushback_direction_missing (medium, ATC only) — uses CHECKS.pushbackPattern
  if (pushbackRe.test(atcLower) && !/\b(north|south|east|west|tail|nose|facing)\b/i.test(atcLower)) {
    errors.push({
      type: 'pushback_direction_missing',
      description: 'Pushback direction not specified',
      weight: 'medium',
      correction: 'State pushback direction or heading (e.g., "Pushback approved, facing north")',
      icaoReference: 'ICAO Doc 9432 §7.4.2',
      safetyImpact: 'Ambiguous pushback direction may conflict with adjacent traffic',
    })
  }

  // 9. backtrack_not_confirmed (medium)
  if (backtrackRe.test(atcLower) && !backtrackRe.test(pilotLower)) {
    errors.push({
      type: 'backtrack_not_confirmed',
      description: 'Backtrack instruction not confirmed in readback',
      weight: 'medium',
      correction: 'Read back "backtrack runway [number]" to confirm',
      icaoReference: 'ICAO Doc 4444 §7.11.1',
      safetyImpact: 'Aircraft may enter opposite-direction runway without confirming backtrack',
    })
  }

  // 10. frequency_not_confirmed (low)
  const freqAtcMatch = atcLower.match(frequencyRe)
  if (freqAtcMatch) {
    const extractFullFreq = (text: string): string | null => {
      const norm = normalizeToDigits(text)
      const m = norm.match(/(\d{3})\s*(?:decimal|point|\.)\s*(\d{1,3})/i)
      if (m) return `${m[1]}.${m[2]}`
      const bare = norm.match(/\b(1[123]\d)\b/)
      return bare ? bare[1] : null
    }
    const atcFreq   = extractFullFreq(freqAtcMatch[0])
    const pilotFreq = extractFullFreq(pilotLower)
    if (atcFreq && atcFreq !== pilotFreq) {
      errors.push({
        type: 'frequency_not_confirmed',
        description: 'Frequency change not read back',
        weight: 'low',
        correction: `Read back the frequency: "${freqAtcMatch[0].trim()}"`,
        icaoReference: 'ICAO Doc 4444 §7.5',
        safetyImpact: 'Missed frequency change may cause loss of communication',
      })
    }
  }

  // 11. atis_not_confirmed (low)
  const atisAtcMatch = atcLower.match(atisRe)
  if (atisAtcMatch) {
    const atisLetter = (atisAtcMatch[1] || atisAtcMatch[2] || '').toLowerCase()
    if (atisLetter && !pilotLower.includes(atisLetter)) {
      errors.push({
        type: 'atis_not_confirmed',
        description: `ATIS information "${atisLetter.toUpperCase()}" not confirmed`,
        weight: 'low',
        correction: `Include ATIS code in initial call: "information ${atisLetter.toUpperCase()}"`,
        icaoReference: 'ICAO Doc 4444 §4.3.2',
        safetyImpact: 'Unchecked ATIS may mean outdated altimeter or runway information',
      })
    }
  }

  // 12. incorrect_holding_point (high) — cross-check hold short runway vs pilot readback
  const hsRunwayMatch = atcLower.match(/hold\s+short\s+(?:of\s+)?runway\s+(\w+)/i)
  if (hsRunwayMatch) {
    const pilotRwMatch = pilotLower.match(runwayRe)
    if (pilotRwMatch) {
      const atcRw   = normalizeToDigits(hsRunwayMatch[1])
      const pilotRw = normalizeToDigits(pilotRwMatch[1])
      if (atcRw && pilotRw && atcRw !== pilotRw) {
        errors.push({
          type: 'incorrect_holding_point',
          description: `Wrong holding point: ATC hold short runway ${hsRunwayMatch[1].toUpperCase()}, pilot confirmed runway ${pilotRwMatch[1].toUpperCase()}`,
          weight: 'high',
          correction: `Correct holding point is runway ${hsRunwayMatch[1].toUpperCase()}`,
          icaoReference: 'ICAO Doc 4444 §7.11.2',
          safetyImpact: 'Incorrect holding point may result in runway incursion at wrong position',
        })
      }
    }
  }

  // 13. unauthorized_takeoff_authority (critical, ATC only)
  // Ground control cannot issue takeoff clearances — that is TWR-only
  if (takeoffRe.test(atcLower) && !luawRe.test(atcLower)) {
    // Only flag when the exchange context suggests this is a ground (non-lineup) phase
    const phaseHint = detectGroundPhase(atcInstruction, pilotReadback).phase
    if (['taxi', 'ground', 'pushback', 'holding'].includes(phaseHint)) {
      errors.push({
        type: 'unauthorized_takeoff_authority',
        description: 'Takeoff clearance issued during ground control phase',
        weight: 'critical',
        correction: 'Only Tower (TWR) may issue takeoff clearances — ground control issues "line up and wait"',
        icaoReference: 'ICAO Doc 4444 §7.10',
        safetyImpact: 'Takeoff without proper TWR clearance is an airspace violation',
      })
    }
  }

  // 14. intersection_departure_missing (medium)
  const intAtcMatch = atcLower.match(intersectionRe)
  if (intAtcMatch && !intersectionRe.test(pilotLower)) {
    errors.push({
      type: 'intersection_departure_missing',
      description: 'Intersection departure not confirmed in readback',
      weight: 'medium',
      correction: 'Read back the intersection designator to confirm departure point',
      icaoReference: 'ICAO Doc 4444 §7.11.1',
      safetyImpact: 'Aircraft may use full-length runway instead of designated intersection',
    })
  }

  // 15. non_standard_taxi_instruction (low)
  const combinedText = atcLower + ' ' + pilotLower
  if (/proceed\s+to(?!\s+(?:runway|holding|stand|gate))/i.test(combinedText) ||
      /taxi\s+to\s+position/i.test(pilotLower)) {
    errors.push({
      type: 'non_standard_taxi_instruction',
      description: 'Non-standard taxi phraseology detected',
      weight: 'low',
      correction: 'Use standard ICAO phraseology: "Taxi to holding point runway X via [taxiways]"',
      icaoReference: 'ICAO Doc 9432 §7.1.2',
      safetyImpact: 'Non-standard phrases risk misunderstanding between controller and pilot',
    })
  }

  // 16. roger_substitution (high) — "roger/wilco" alone for a safety-critical instruction
  // Exchange-level: ATC gave a safety-critical instruction but pilot only acknowledged
  const isSafetyCritical = [luawRe, takeoffRe, /hold\s+short/i, /cross\s+runway/i, taxiwayViaRe]
    .some(re => re.test(atcLower))
  const isAcknowledgementOnly =
    /\b(roger|wilco|copy|affirm|affirmative)\b/i.test(pilotLower) &&
    pilotLower.trim().split(/\s+/).length <= 4
  if (isSafetyCritical && isAcknowledgementOnly) {
    errors.push({
      type: 'roger_substitution',
      description: '"Roger/Wilco" used instead of full readback for a mandatory readback instruction',
      weight: 'high',
      correction: 'Read back the complete instruction: operation + runway/taxiway designator + callsign',
      icaoReference: 'ICAO Doc 4444 §7.11.2',
      safetyImpact: '"Roger" does not confirm the pilot received the specific values — ATC loses verification',
    })
  }

  // 17. missing_designator (high) — L/R/C qualifier omitted from runway readback
  // ATC gave "runway XX[L/R/C]" but pilot's readback lacks the qualifier
  const atcRwFull = atcLower.match(/runway\s+(\d{1,2})([lrc])\b/i)
  if (atcRwFull) {
    const qualifier = atcRwFull[2].toLowerCase()
    const pilotHasRunway = /runway/i.test(pilotLower)
    const pilotHasQualifier = new RegExp(`\\b${atcRwFull[1]}\\s*${qualifier}\\b`, 'i').test(pilotLower)
    if (pilotHasRunway && !pilotHasQualifier) {
      errors.push({
        type: 'missing_designator',
        description: `Runway qualifier "${atcRwFull[2].toUpperCase()}" (Left/Right/Center) omitted from readback`,
        weight: 'high',
        correction: `Include full designator: "runway ${(atcRwFull[1] + atcRwFull[2]).toUpperCase()}"`,
        icaoReference: 'ICAO Doc 4444 §7.11',
        safetyImpact: 'Omitting L/R/C at parallel-runway airports causes positional ambiguity',
      })
    }
  }

  return errors
}

// ============================================================================
// SAFETY VECTORS
// ============================================================================

/**
 * Calculates safety vectors for GND operations analysis.
 * Uses the same SafetyVector interface as departureApproachAnalyzer for UI compatibility.
 */
export function calculateGroundSafetyVectors(
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
    factor: 'Parameter Readback Accuracy',
    score: Math.max(0, 100 - criticalGndErrors.length * 30),
    weight: 0.30,
    description: 'Accuracy of mandatory readback values (runway designation, hold-short confirmation)',
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
export function calculateGroundConfidence(
  phaseConfidence: number,
  baseAnalysis: SemanticAnalysisResult,
  gndErrors: GndSpecificError[],
  multiPart: MultiPartInstructionAnalysis
): GroundConfidenceScores {
  const phaseDetection = phaseConfidence

  // Instruction classification: penalize based on error count relative to
  // total instruction parts. More errors vs. parts = less confident.
  const totalParts = multiPart.parts.length || 1
  const errorRatio = baseAnalysis.errors.length / totalParts
  const instructionClassification = Math.max(0.5, Math.min(1.0, 1 - errorRatio * 0.5))

  // Error detection: derived from multi-part completeness. A higher
  // completeness score means we were able to validate more elements.
  const errorDetection = Math.max(0.5, multiPart.readbackCompleteness / 100 * 0.5 + 0.5)

  // Weight assessment: penalized for each critical/high GND error found.
  const criticalCount = gndErrors.filter(e => e.weight === 'critical').length
  const highCount     = gndErrors.filter(e => e.weight === 'high').length
  const weightAssessment = Math.max(0.4, Math.min(1.0, 1 - criticalCount * 0.3 - highCount * 0.15))

  const overallConfidence =
    phaseDetection * 0.30 +
    instructionClassification * 0.25 +
    errorDetection * 0.25 +
    weightAssessment * 0.20

  return {
    phaseDetection:            Math.round(phaseDetection * 100) / 100,
    instructionClassification: Math.round(instructionClassification * 100) / 100,
    errorDetection:            Math.round(errorDetection * 100) / 100,
    weightAssessment:          Math.round(weightAssessment * 100) / 100,
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
      recs.push('Never commence takeoff roll without explicit "cleared for takeoff" from ATC')
    if (e.type === 'hold_short_not_confirmed')
      recs.push('Hold-short instructions must always be read back completely — mandatory readback')
    if (e.type === 'taxi_route_incomplete')
      recs.push('Read back all taxiway designators in the via route to confirm correct routing')
    if (e.type === 'runway_crossing_incomplete')
      recs.push('Always confirm the runway number when reading back a crossing clearance')
    if (e.type === 'pushback_direction_missing')
      recs.push('Include pushback direction or facing in readback to prevent ramp conflicts')
    if (e.type === 'backtrack_not_confirmed')
      recs.push('Confirm "backtrack runway XX" explicitly — backtrack requires full readback')
    if (e.type === 'frequency_not_confirmed')
      recs.push('Read back frequency handoffs to confirm correct channel before contact')
    if (e.type === 'incorrect_holding_point')
      recs.push('Double-check holding point runway number — wrong holding point risks runway incursion')
    if (e.type === 'unauthorized_takeoff_authority')
      recs.push('Takeoff clearances are issued by TWR only — GND uses "line up and wait"')
    if (e.type === 'intersection_departure_missing')
      recs.push('Confirm intersection designator in readback for non-full-length departures')
    if (e.type === 'roger_substitution')
      recs.push('Never use "Roger/Wilco" alone for mandatory readbacks — read back all values explicitly')
    if (e.type === 'missing_designator')
      recs.push('Always include Left/Right/Center qualifier when runway has parallel designators')
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

  const weightValues: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
  const recent = previousErrors.slice(-Math.ceil(previousErrors.length / 2))
  const older  = previousErrors.slice(0, Math.floor(previousErrors.length / 2))

  const recentAvg = recent.reduce((s, e) => s + (weightValues[e.weight] || 0), 0) / recent.length
  const olderAvg  = older.reduce((s, e) => s + (weightValues[e.weight] || 0), 0) / older.length

  if (recentAvg < olderAvg - 0.5) return 'improving'
  if (recentAvg > olderAvg + 0.5) return 'declining'
  return 'stable'
}

function countConsecutiveErrors(
  previousErrors: { type: string; weight: string; timestamp: number }[]
): number {
  let count = 0
  for (let i = previousErrors.length - 1; i >= 0; i--) {
    if (previousErrors[i].weight !== 'low') {
      count++
    } else {
      break
    }
  }
  return count
}

// ============================================================================
// HELPER — map GroundPhase to SeverityFactors.flightPhase
// ============================================================================

type GndSeverityPhase = 'ground' | 'departure' | 'climb' | 'cruise' | 'descent' | 'approach' | 'landing'

function mapGroundPhase(phase: GroundPhase): GndSeverityPhase {
  const map: Record<GroundPhase, GndSeverityPhase> = {
    pushback: 'departure',  // Pre-departure directional risk
    taxi:     'ground',
    ground:   'ground',
    lineup:   'departure',  // On runway — highest ground risk
    crossing: 'landing',    // Active runway crossing — incursion risk
    holding:  'approach',   // Runway perimeter proximity
  }
  return map[phase] ?? 'ground'
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
  const groundConfidenceScores = calculateGroundConfidence(phaseResult.confidence, baseAnalysis, gndErrors, multiPartAnalysis)

  // 8. Training recommendations
  const trainingRecommendations = generateGroundRecommendations(baseAnalysis, phaseResult.phase, gndErrors)

  // 9. Sequence analysis — track error trends over multiple exchanges
  const errorPattern = detectErrorPattern(gndErrors.map(e => e.type).join(' '))
  const sequenceAnalysis: SequenceAnalysis = {
    totalInstructions: (previousErrors?.length || 0) + 1,
    correctSequence:   baseAnalysis.isCorrect,
    escalatingErrors:  errorPattern?.errorType === 'escalating',
    errorTrend:        getErrorTrend(previousErrors || []),
    consecutiveErrors: countConsecutiveErrors(previousErrors || []),
    patternDetected:   errorPattern,
  }

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
    sequenceAnalysis,
  }
}

// ============================================================================
// EXPORT FOR HUGGINGFACE TRAINING
// ============================================================================

/**
 * Exports GND training data in HuggingFace compatible format.
 * Reads from gndCorpus.json (the single source of truth for GND training data).
 */
export function exportGroundTrainingData() {
  return GND_CORPUS.map(entry => ({
    instruction:    entry.atc,
    pilot_response: entry.pilot,
    label:          entry.isCorrect ? 'correct' : 'incorrect' as 'correct' | 'incorrect',
    phase:          entry.phase as GroundPhase,
    error_type:     entry.errorType,
  }))
}

// ============================================================================
// BATCH ANALYSIS
// ============================================================================

/**
 * Batch analysis for GND corpus evaluation.
 * Parallel to batchAnalyzeDepartureApproach() in departureApproachAnalyzer.ts.
 */
export function batchAnalyzeGround(
  exchanges: { atc: string; pilot: string; expectedPhase?: GroundPhase }[]
): {
  totalExchanges: number
  correctReadbacks: number
  phaseAccuracy: number
  groundErrorRate: number
  averageCompleteness: number
  criticalErrorCount: number
} {
  let correctReadbacks = 0
  let correctPhaseDetections = 0
  let totalGndErrors = 0
  let totalCompleteness = 0
  let criticalErrorCount = 0

  for (const exchange of exchanges) {
    const result = analyzeGround(exchange.atc, exchange.pilot)

    if (result.isCorrect) correctReadbacks++
    if (exchange.expectedPhase && result.phase === exchange.expectedPhase) {
      correctPhaseDetections++
    }

    totalGndErrors   += result.groundSpecificErrors.length
    totalCompleteness += result.multiPartAnalysis.readbackCompleteness

    if (result.contextualWeight === 'critical') criticalErrorCount++
  }

  const total = exchanges.length

  return {
    totalExchanges:    total,
    correctReadbacks,
    phaseAccuracy:     total > 0 ? Math.round((correctPhaseDetections / total) * 100) : 0,
    groundErrorRate:   total > 0 ? Math.round((totalGndErrors / total) * 100) : 0,
    averageCompleteness: total > 0 ? Math.round(totalCompleteness / total) : 100,
    criticalErrorCount,
  }
}

// ============================================================================
// GND MODEL TRAINING & VALIDATION
// ============================================================================

export interface GndTrainingResult {
  totalSamples: number
  correctDetections: number
  accuracy: number
  phaseAccuracy: number
  errorTypeAccuracy: number
  correctExampleAccuracy: number
  errorExampleAccuracy: number
  confusionMatrix: {
    truePositives: number
    trueNegatives: number
    falsePositives: number
    falseNegatives: number
  }
  trainingTime: number
  modelVersion: string
}

/**
 * Train and validate the GND rule engine against the gndCorpus.json corpus.
 * Tests pattern matching accuracy against labeled examples.
 * Parallel to trainDepartureApproachModel() in departureApproachAnalyzer.ts.
 */
export function trainGroundModel(): GndTrainingResult {
  const startTime = Date.now()

  let totalSamples = 0
  let correctDetections = 0
  let correctPhaseDetections = 0
  let correctErrorTypeDetections = 0
  let correctExampleTotal = 0
  let correctExampleCorrect = 0
  let errorExampleTotal = 0
  let errorExampleCorrect = 0

  let truePositives = 0   // Correctly detected errors
  let trueNegatives = 0   // Correctly passed correct readbacks
  let falsePositives = 0  // Flagged correct readback as error
  let falseNegatives = 0  // Missed a real error

  for (const entry of GND_CORPUS) {
    totalSamples++
    const result = analyzeGround(entry.atc, entry.pilot)

    // Phase detection accuracy
    if (result.phase === entry.phase) correctPhaseDetections++

    if (entry.isCorrect) {
      correctExampleTotal++
      if (result.isCorrect) {
        correctDetections++
        correctExampleCorrect++
        trueNegatives++
      } else {
        falsePositives++
      }
    } else {
      errorExampleTotal++
      const hasErrors = !result.isCorrect || result.groundSpecificErrors.length > 0
      if (hasErrors) {
        correctDetections++
        errorExampleCorrect++
        truePositives++

        // Check if the specific error type was identified
        if (entry.errorType) {
          const detectedGndTypes = result.groundSpecificErrors.map(e => e.type)
          const detectedBaseTypes = result.errors.map(e => e.type)
          if (
            detectedGndTypes.includes(entry.errorType as GndErrorType) ||
            detectedBaseTypes.some(t => t.includes(entry.errorType!.replace('_', ' ')))
          ) {
            correctErrorTypeDetections++
          }
        }
      } else {
        falseNegatives++
      }
    }
  }

  const trainingTime = Date.now() - startTime
  const totalErrorSamples = truePositives + falseNegatives

  return {
    totalSamples,
    correctDetections,
    accuracy:              Math.round((correctDetections / totalSamples) * 100),
    phaseAccuracy:         Math.round((correctPhaseDetections / totalSamples) * 100),
    errorTypeAccuracy:     totalErrorSamples > 0 ? Math.round((correctErrorTypeDetections / totalErrorSamples) * 100) : 0,
    correctExampleAccuracy: correctExampleTotal > 0 ? Math.round((correctExampleCorrect / correctExampleTotal) * 100) : 0,
    errorExampleAccuracy:  errorExampleTotal > 0 ? Math.round((errorExampleCorrect / errorExampleTotal) * 100) : 0,
    confusionMatrix: {
      truePositives,
      trueNegatives,
      falsePositives,
      falseNegatives,
    },
    trainingTime,
    modelVersion: '3.0.0-ground',
  }
}

/**
 * Get GND training corpus statistics.
 * Parallel to getTrainingCorpusStats() in departureApproachAnalyzer.ts.
 */
export function getGroundCorpusStats() {
  const totalExamples    = GND_CORPUS.length
  const correctExamples  = GND_CORPUS.filter(e => e.isCorrect).length
  const errorExamples    = GND_CORPUS.filter(e => !e.isCorrect).length

  const errorTypes = new Set<string>()
  const phases     = new Set<string>()

  for (const entry of GND_CORPUS) {
    phases.add(entry.phase)
    if (entry.errorType) errorTypes.add(entry.errorType)
  }

  return {
    totalExamples,
    correctExamples,
    errorExamples,
    uniqueErrorTypes:   Array.from(errorTypes),
    coveredPhases:      Array.from(phases),
    errorRate:          Math.round((errorExamples / totalExamples) * 100),
  }
}

/**
 * Get all GND training data.
 * Parallel to getAllTrainingData() in departureApproachAnalyzer.ts.
 */
export function getAllGroundTrainingData() {
  return { corpus: GND_CORPUS }
}
