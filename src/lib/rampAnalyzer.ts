/**
 * Ramp Control Rule-Based Analyzer
 *
 * Deterministic rule engine for analyzing ATC ramp control communications.
 * Covers: pushback operations, engine startup, aircraft parking (stand/bay
 * assignment), towing, apron crossings, and frequency handoffs.
 *
 * NOTE: This is NOT a machine learning model. No neural networks, probabilistic
 * training loops, or adaptive learning are involved. The "ML" naming in exported
 * types is retained for API compatibility with the APP/DEP and GND analyzers.
 *
 * References:
 * - ICAO Doc 4444 PANS-ATM §12.3 (Ramp Operations)
 * - ICAO Doc 9432 Manual of Radiotelephony (5th Edition)
 * - ICAO Doc 9157 Aerodrome Design Manual Part 2
 * - CAAP AOM (Aerodrome Operations Manual), RPLL Ramp Control Procedures
 */

import {
  analyzeReadback,
  type SemanticAnalysisResult,
} from './semanticReadbackAnalyzer'

import {
  calculateEnhancedSeverity,
  detectErrorPattern,
} from './atcData'

import {
  analyzeMultiPartInstruction,
  type MultiPartInstructionAnalysis,
  type SafetyVector,
  type SequenceAnalysis,
} from './departureApproachAnalyzer'

import rampCorpus from '../data/rampCorpus.json'

// Typed corpus entry
type RampCorpusEntry = {
  atc: string
  pilot: string
  isCorrect: boolean
  phase: string
  errorType?: string
  explanation?: string
}

const RAMP_CORPUS: RampCorpusEntry[] = (rampCorpus as unknown as { corpus: RampCorpusEntry[] }).corpus

// Runtime-loaded check config — all tunable patterns live in rampCorpus.json → "checks"
const CHECKS = (rampCorpus as unknown as {
  checks: {
    pushbackPattern: string
    pushbackDirectionPattern: string
    startupPattern: string
    standPattern: string
    towingPattern: string
    apronCrossingPattern: string
    frequencyPattern: string
    sierraPattern: string
    parkingBrakePattern: string
  }
}).checks

// ============================================================================
// WEIGHT NORMALIZATION
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

export interface RampMLResult extends SemanticAnalysisResult {
  phase: RampPhase
  phaseConfidence: number
  contextualWeight: 'critical' | 'high' | 'medium' | 'low'
  multiPartAnalysis: MultiPartInstructionAnalysis
  rampSpecificErrors: RampSpecificError[]
  safetyVectors: SafetyVector[]
  rampConfidenceScores: RampConfidenceScores
  trainingRecommendations: string[]
  sequenceAnalysis: SequenceAnalysis
}

export type RampPhase =
  | 'pushback'
  | 'startup'
  | 'parking'
  | 'towing'
  | 'crossing'
  | 'ramp'

export interface RampSpecificError {
  type: RampErrorType
  description: string
  weight: 'critical' | 'high' | 'medium' | 'low'
  correction: string
  icaoReference: string
  safetyImpact: string
}

export type RampErrorType =
  | 'pushback_direction_missing'
  | 'pushback_clearance_not_confirmed'
  | 'startup_not_confirmed'
  | 'engine_number_wrong'
  | 'stand_number_wrong'
  | 'towing_direction_missing'
  | 'apron_crossing_incomplete'
  | 'callsign_not_included'
  | 'frequency_not_confirmed'
  | 'roger_substitution'
  | 'non_standard_ramp_phraseology'
  | 'chocks_not_confirmed'

export interface RampConfidenceScores {
  phaseDetection: number
  instructionClassification: number
  errorDetection: number
  weightAssessment: number
  overallConfidence: number
}

// ============================================================================
// PHASE DETECTION ENGINE
// ============================================================================

interface RampPhasePattern {
  phase: RampPhase
  patterns: RegExp[]
  weight: number
  contextClues: string[]
}

const RAMP_PHASE_PATTERNS: RampPhasePattern[] = [
  {
    phase: 'pushback',
    patterns: [/push\s*back/i, /pushback\s+appro/i, /sierra\s+\w/i],
    weight: 12,
    contextClues: ['pushback', 'push', 'sierra', 'facing'],
  },
  {
    phase: 'startup',
    patterns: [
      /start\s*up\s+appro/i, /startup\s+appro/i, /start\s+appro/i,
      /idle\s+power\s+appro/i, /engine\s+start/i,
    ],
    weight: 12,
    contextClues: ['startup', 'start', 'idle', 'engine', 'power'],
  },
  {
    phase: 'towing',
    patterns: [/\btow(?:ing)?\b/i, /continue\s+tow/i],
    weight: 12,
    contextClues: ['tow', 'towing', 'tug'],
  },
  {
    phase: 'parking',
    patterns: [/\bbay\s+\w/i, /\bspot\s+\d/i, /\bstand\s+\d/i, /continue\s+(?:charlie|golf|november|delta|alpha|lima)/i],
    weight: 8,
    contextClues: ['bay', 'spot', 'stand', 'gate', 'parking', 'charlie', 'golf'],
  },
  {
    phase: 'crossing',
    patterns: [/hold\s+short\s+(?:of\s+)?(?!runway)/i, /cross\s+(?:apron|taxiway)/i],
    weight: 8,
    contextClues: ['hold short', 'cross', 'crossing', 'november', 'golf'],
  },
  {
    phase: 'ramp',
    patterns: [/contact\s+ground/i, /contact\s+tower/i, /one\s+two\s+one/i, /standby/i],
    weight: 6,
    contextClues: ['contact', 'ground', 'frequency', 'standby', 'ramp'],
  },
]

/**
 * Detects the current ramp phase from ATC instruction and optional pilot readback.
 */
export function detectRampPhase(
  atcInstruction: string,
  pilotReadback?: string
): { phase: RampPhase; confidence: number } {
  const text = (atcInstruction + ' ' + (pilotReadback || '')).toLowerCase()
  let bestMatch: { phase: RampPhase; score: number } = { phase: 'ramp', score: 0 }

  for (const pp of RAMP_PHASE_PATTERNS) {
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

  const confidence = Math.round(Math.min(bestMatch.score / 24, 1) * 100) / 100
  return { phase: bestMatch.phase, confidence }
}

// ============================================================================
// RAMP-SPECIFIC ERROR DETECTION
// ============================================================================

/**
 * Detects RAMP-specific readback errors:
 * pushback direction/clearance, startup confirmation, stand number,
 * towing destination, apron crossings, callsign, frequency handoffs.
 */
export function detectRampErrors(
  atcInstruction: string,
  pilotReadback: string,
  callsign?: string
): RampSpecificError[] {
  const errors: RampSpecificError[] = []
  const atcL  = atcInstruction.toLowerCase()
  const pilotL = pilotReadback.toLowerCase()

  const pushbackRe  = new RegExp(CHECKS.pushbackPattern, 'i')
  const directionRe = new RegExp(CHECKS.pushbackDirectionPattern, 'i')
  const startupRe   = new RegExp(CHECKS.startupPattern, 'i')
  const towingRe    = new RegExp(CHECKS.towingPattern, 'i')
  const standRe     = new RegExp(CHECKS.standPattern, 'i')
  const freqRe      = new RegExp(CHECKS.frequencyPattern, 'i')
  const sierraRe    = new RegExp(CHECKS.sierraPattern, 'i')
  const crossRe     = new RegExp(CHECKS.apronCrossingPattern, 'i')
  const brakeRe     = new RegExp(CHECKS.parkingBrakePattern, 'i')

  // ── 1. roger_substitution ──────────────────────────────────────────────────
  // Safety-critical ramp instructions must not be acknowledged with Roger alone
  const isSafetyCritical =
    pushbackRe.test(atcL) ||
    startupRe.test(atcL) ||
    crossRe.test(atcL) ||
    /hold\s+short/i.test(atcL)

  if (isSafetyCritical && /^(?:roger|wilco|copy|affirmative|ok|aight)\.?$/i.test(pilotL.trim())) {
    errors.push({
      type: 'roger_substitution',
      description: 'Pilot acknowledged safety-critical ramp instruction with Roger/Wilco alone',
      weight: 'high',
      correction: 'Read back key elements: pushback position, direction, runway or hold-short point',
      icaoReference: 'ICAO Doc 4444 §12.4.4',
      safetyImpact: 'ATC cannot confirm pilot received all clearance parameters',
    })
    return errors // No point checking further for a bare Roger
  }

  // ── 2. pushback_direction_missing ─────────────────────────────────────────
  // ATC gave a facing direction but pilot omitted it
  if (pushbackRe.test(atcL)) {
    const dirMatch = atcL.match(/(?:facing|face)\s+(north|south|east|west|golf|sierra|charlie|november|delta|alpha|bravo|lima\b)/i)
    if (dirMatch) {
      const dir = dirMatch[1].toLowerCase()
      if (!pilotL.includes(dir)) {
        errors.push({
          type: 'pushback_direction_missing',
          description: `Pushback facing direction "${dirMatch[1]}" not confirmed in readback`,
          weight: 'high',
          correction: `Include direction in readback: "pushback [position], facing ${dirMatch[1]}, [callsign]"`,
          icaoReference: 'ICAO Doc 4444 §12.3.1',
          safetyImpact: 'Tug crew and controller may misalign on pushback direction — ramp conflict risk',
        })
      }
    }
  }

  // ── 3. pushback_clearance_not_confirmed ───────────────────────────────────
  // ATC issued pushback but pilot did not confirm Sierra position or runway
  if (pushbackRe.test(atcL)) {
    const sierraMatch = atcL.match(/sierra\s+([\w\s]+?)(?=\s*[,.]|\s+(?:facing|face|runway|contact|$))/i)
    if (sierraMatch) {
      const pos = sierraMatch[1].trim().toLowerCase()
      // Check pilot has "sierra" and key part of position
      const pilotHasSierra = /sierra/i.test(pilotL)
      const posWord = pos.split(/\s+/)[0]  // first word of position number
      const pilotHasPos = pilotL.includes(posWord)
      if (!pilotHasSierra || !pilotHasPos) {
        errors.push({
          type: 'pushback_clearance_not_confirmed',
          description: `Pushback position "Sierra ${sierraMatch[1].trim()}" not confirmed in readback`,
          weight: 'critical',
          correction: 'Read back full pushback clearance: "Pushback Sierra [position], [direction], runway [X], [callsign]"',
          icaoReference: 'ICAO Doc 4444 §12.3.1',
          safetyImpact: 'Controller cannot verify aircraft will push to the correct apron lane',
        })
      }
    }

    // Runway given but not confirmed
    const rwyMatch = atcL.match(/runway\s+([\w\s]+?)(?=\s*[,.]|\s*$)/i)
    if (rwyMatch && errors.length === 0) {  // only if no position error already flagged
      const rwy = rwyMatch[1].trim().toLowerCase()
      const rwyNorm = rwy.replace(/\s+/g, '')
      const pilotNorm = pilotL.replace(/\s+/g, '')
      if (!pilotNorm.includes(rwyNorm)) {
        errors.push({
          type: 'pushback_clearance_not_confirmed',
          description: `Departure runway "${rwyMatch[1].trim()}" not confirmed in pushback readback`,
          weight: 'high',
          correction: 'Confirm runway designation in pushback readback per ICAO Doc 4444',
          icaoReference: 'ICAO Doc 4444 §12.3.1',
          safetyImpact: 'Wrong runway confirmation can lead to conflict with active runway operations',
        })
      }
    }
  }

  // ── 4. startup_not_confirmed ──────────────────────────────────────────────
  if (startupRe.test(atcL)) {
    const hasAcknowledge = /appro|roger|wilco|standby|will\s+advise|noted|copy|confirmed/i.test(pilotL)
    if (!hasAcknowledge) {
      errors.push({
        type: 'startup_not_confirmed',
        description: 'Engine start/idle power approval not confirmed in pilot readback',
        weight: 'high',
        correction: 'Acknowledge startup approval: "Startup approved / Idle power approved, will advise when ready, [callsign]"',
        icaoReference: 'ICAO Doc 4444 §12.3.2',
        safetyImpact: 'Unacknowledged startup approval may cause uncoordinated engine start near ground equipment',
      })
    }
  }

  // ── 5. engine_number_wrong ────────────────────────────────────────────────
  // If ATC specified a specific engine number and pilot read back a different one
  const atcEngineMatch  = atcL.match(/engine\s+(one|two|three|four|number\s+\d)/i)
  const pilotEngineMatch = pilotL.match(/engine\s+(one|two|three|four|number\s+\d)/i)
  if (atcEngineMatch && pilotEngineMatch && atcEngineMatch[1].trim() !== pilotEngineMatch[1].trim()) {
    errors.push({
      type: 'engine_number_wrong',
      description: `Engine number mismatch: ATC said engine ${atcEngineMatch[1]}, pilot read back engine ${pilotEngineMatch[1]}`,
      weight: 'high',
      correction: `Confirm correct engine number: "Engine ${atcEngineMatch[1].toUpperCase()}"`,
      icaoReference: 'ICAO Doc 4444 §12.3.2',
      safetyImpact: 'Starting wrong engine near ground equipment or other aircraft is a safety hazard',
    })
  }

  // ── 6. stand_number_wrong ─────────────────────────────────────────────────
  // ATC assigned a bay/stand but pilot either omitted it or read a different one
  if (standRe.test(atcL) && !pushbackRe.test(atcL)) {
    const atcBayMatch  = atcL.match(/\b(?:bay|spot|stand)\s+([\w\s]{1,12}?)(?=\s*[,.]|\s*$)/i)
    const pilotBayMatch = pilotL.match(/\b(?:bay|spot|stand)\s+([\w\s]{1,12}?)(?=\s*[,.]|\s*$)/i)
    if (atcBayMatch && !pilotBayMatch) {
      errors.push({
        type: 'stand_number_wrong',
        description: `Bay/stand assignment "${atcBayMatch[1].trim()}" not confirmed in pilot readback`,
        weight: 'high',
        correction: `Read back bay assignment: "Bay ${atcBayMatch[1].trim()}, [callsign]"`,
        icaoReference: 'ICAO Doc 9157 Part 2',
        safetyImpact: 'Aircraft may proceed to wrong gate, causing traffic conflict on apron',
      })
    }
  }

  // ── 7. towing_direction_missing ───────────────────────────────────────────
  if (towingRe.test(atcL)) {
    const atcTowBay  = atcL.match(/\b(?:bay|stand|spot)\s+([\w\s]{1,12}?)(?=\s*[,.]|\s*$)/i)
    const pilotHasBay = /\b(?:bay|stand|spot)\s+\w/i.test(pilotL)
    if (atcTowBay && !pilotHasBay) {
      errors.push({
        type: 'towing_direction_missing',
        description: `Towing destination "Bay ${atcTowBay[1].trim()}" not confirmed in readback`,
        weight: 'medium',
        correction: 'Confirm tow destination bay number to ensure tug crew has correct routing',
        icaoReference: 'ICAO Doc 9157 Part 2',
        safetyImpact: 'Tug crew may route to wrong bay, causing congestion or aircraft conflict',
      })
    }
  }

  // ── 8. apron_crossing_incomplete ─────────────────────────────────────────
  // ATC instructed hold short on apron (non-runway) — pilot must confirm
  const hsApronMatch = atcL.match(/hold\s+short\s+(?:of\s+)?(?!runway)([a-z][a-z0-9\s]{1,20}?)(?=\s*[,.]|\s+contact|\s*$)/i)
  if (hsApronMatch) {
    const hs = hsApronMatch[1].trim()
    const pilotHasHs = /hold\s+short|holding\s+short/i.test(pilotL)
    if (!pilotHasHs) {
      errors.push({
        type: 'apron_crossing_incomplete',
        description: `Hold short of "${hs}" not confirmed in readback`,
        weight: 'high',
        correction: `Read back: "Hold short ${hs}, [callsign]"`,
        icaoReference: 'ICAO Doc 4444 §12.3.3',
        safetyImpact: 'Pilot may cross taxiway without clearance — apron traffic conflict risk',
      })
    }
  }

  // ── 9. callsign_not_included ──────────────────────────────────────────────
  // Mandatory readback instructions (pushback, startup, hold short) should include callsign
  const isMandatoryReadback = pushbackRe.test(atcL) || startupRe.test(atcL) || crossRe.test(atcL)
  if (isMandatoryReadback && callsign) {
    const csNorm = callsign.toLowerCase().replace(/\s+/g, '')
    const pilotNorm = pilotL.replace(/\s+/g, '')
    if (!pilotNorm.includes(csNorm) && pilotL.split(' ').length < 4) {
      errors.push({
        type: 'callsign_not_included',
        description: 'Callsign omitted from mandatory readback',
        weight: 'medium',
        correction: 'End readback with callsign per ICAO Doc 9432: "[readback], [callsign]"',
        icaoReference: 'ICAO Doc 9432 §4.5',
        safetyImpact: 'Without callsign, ATC cannot confirm correct aircraft received clearance',
      })
    }
  }

  // ── 10. frequency_not_confirmed ───────────────────────────────────────────
  const freqMatch = atcL.match(freqRe)
  if (freqMatch) {
    const freqVal = freqMatch[1]?.replace(/\s/g, '') || ''
    const pilotFreqNorm = pilotL.replace(/decimal/gi, '.').replace(/\s/g, '')
    if (freqVal && !pilotFreqNorm.includes(freqVal.replace('.', ''))) {
      errors.push({
        type: 'frequency_not_confirmed',
        description: `Frequency "${freqMatch[1]}" not confirmed in handoff readback`,
        weight: 'low',
        correction: 'Read back frequency to confirm correct channel before switch',
        icaoReference: 'ICAO Doc 4444 §12.4.4',
        safetyImpact: 'Pilot may switch to wrong frequency and lose contact with ATC',
      })
    }
  }

  // ── 11. chocks_not_confirmed ──────────────────────────────────────────────
  if (brakeRe.test(atcL)) {
    if (!/chocks|brake|set/i.test(pilotL)) {
      errors.push({
        type: 'chocks_not_confirmed',
        description: 'Parking brake/chocks instruction not confirmed in readback',
        weight: 'medium',
        correction: 'Acknowledge chocks or brakes set instruction before ground crew proceeds',
        icaoReference: 'ICAO Doc 9157 Part 2',
        safetyImpact: 'Unacknowledged brake/chocks instruction risks aircraft movement on ramp',
      })
    }
  }

  // ── 12. non_standard_ramp_phraseology ────────────────────────────────────
  // ATC used non-ICAO ramp phraseology (informational, low weight)
  if (
    /\b(?:go ahead|what's?\s+your|what\s+is\s+your|uh|uhm|aight)\b/i.test(atcL) &&
    errors.length === 0
  ) {
    errors.push({
      type: 'non_standard_ramp_phraseology',
      description: 'Non-standard phraseology detected in ramp instruction',
      weight: 'low',
      correction: 'Use ICAO standard ramp phraseology per Doc 9432 and local AOM',
      icaoReference: 'ICAO Doc 9432 §4.2',
      safetyImpact: 'Non-standard phrases may cause readback confusion or misinterpretation',
    })
  }

  return errors
}

// ============================================================================
// SAFETY VECTORS
// ============================================================================

/**
 * Calculates safety vectors for ramp operations analysis.
 * Uses the same SafetyVector interface as departureApproachAnalyzer for UI compatibility.
 */
export function calculateRampSafetyVectors(
  baseAnalysis: SemanticAnalysisResult,
  phase: RampPhase,
  rampErrors: RampSpecificError[]
): SafetyVector[] {
  const vectors: SafetyVector[] = []

  // 1. Parameter Readback Accuracy (30%)
  // Critical: pushback_clearance_not_confirmed, startup_not_confirmed, stand_number_wrong
  const criticalErrors = rampErrors.filter(e =>
    e.type === 'pushback_clearance_not_confirmed' ||
    e.type === 'startup_not_confirmed' ||
    e.type === 'stand_number_wrong'
  )
  vectors.push({
    factor: 'Parameter Readback Accuracy',
    score: Math.max(0, 100 - criticalErrors.length * 30),
    weight: 0.30,
    description: 'Accuracy of mandatory readback values (pushback position, stand number, startup approval)',
    mitigationRequired: criticalErrors.length > 0,
  })

  // 2. Pushback/Startup Compliance (25%) — elevated when in pushback or startup phase
  const pushbackErrors = rampErrors.filter(e =>
    e.type === 'pushback_direction_missing' ||
    e.type === 'engine_number_wrong'
  )
  const pbWeight = (phase === 'pushback' || phase === 'startup') ? 0.30 : 0.25
  vectors.push({
    factor: 'Pushback & Startup Compliance',
    score: pushbackErrors.length === 0 ? 100 : 30,
    weight: pbWeight,
    description: 'Correct readback of pushback direction and engine startup parameters',
    mitigationRequired: pushbackErrors.length > 0,
  })

  // 3. Instruction Completeness (20%)
  const incompleteErrors = baseAnalysis.errors.filter(e => e.type === 'incomplete_readback').length
  const apronCrossErrors = rampErrors.filter(e =>
    e.type === 'apron_crossing_incomplete' || e.type === 'towing_direction_missing'
  ).length
  const completeness = Math.max(0, 100 - (incompleteErrors + apronCrossErrors) * 20)
  vectors.push({
    factor: 'Instruction Completeness',
    score: completeness,
    weight: 0.20,
    description: 'All required elements (routing, stand, crossing) confirmed in readback',
    mitigationRequired: completeness < 80,
  })

  // 4. Phrase Accuracy (15%)
  const phraseErrors = rampErrors.filter(e =>
    e.type === 'non_standard_ramp_phraseology' || e.type === 'chocks_not_confirmed'
  ).length
  const phraseScore = Math.max(0, 100 - phraseErrors * 25)
  vectors.push({
    factor: 'Phrase Accuracy',
    score: phraseScore,
    weight: 0.15,
    description: 'Use of ICAO-standard ramp phraseology and confirmation of operational instructions',
    mitigationRequired: phraseScore < 75,
  })

  // 5. Callsign Compliance (weights adjusted so all sum to 1.0)
  const csErrors = rampErrors.filter(e => e.type === 'callsign_not_included')
  const csWeight = 0.05 + (0.25 - pbWeight)  // compensates when pbWeight is elevated
  vectors.push({
    factor: 'Callsign Compliance',
    score: csErrors.length === 0 ? 100 : 60,
    weight: Math.max(0.05, csWeight),
    description: 'Callsign included in readback per ICAO Doc 9432',
    mitigationRequired: csErrors.length > 0,
  })

  return vectors
}

// ============================================================================
// CONFIDENCE SCORING
// ============================================================================

/**
 * Calculates confidence scores for the RAMP analysis
 */
export function calculateRampConfidence(
  phaseConfidence: number,
  baseAnalysis: SemanticAnalysisResult,
  rampErrors: RampSpecificError[],
  multiPart: MultiPartInstructionAnalysis
): RampConfidenceScores {
  const phaseDetection = phaseConfidence

  const totalParts = multiPart.parts.length || 1
  const errorRatio = baseAnalysis.errors.length / totalParts
  const instructionClassification = Math.max(0.5, Math.min(1.0, 1 - errorRatio * 0.5))

  const errorDetection = Math.max(0.5, multiPart.readbackCompleteness / 100 * 0.5 + 0.5)

  const criticalCount = rampErrors.filter(e => e.weight === 'critical').length
  const highCount     = rampErrors.filter(e => e.weight === 'high').length
  const weightAssessment = Math.max(0.4, Math.min(1.0, 1 - criticalCount * 0.3 - highCount * 0.15))

  const overallConfidence =
    phaseDetection           * 0.30 +
    instructionClassification * 0.25 +
    errorDetection            * 0.25 +
    weightAssessment          * 0.20

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

function generateRampRecommendations(
  baseAnalysis: SemanticAnalysisResult,
  _phase: RampPhase,
  rampErrors: RampSpecificError[]
): string[] {
  const recs: string[] = []

  for (const e of baseAnalysis.errors) {
    if (e.type === 'incomplete_readback')
      recs.push('Practice full readback format: [operation] + [position/stand] + [callsign]')
    if (e.type === 'wrong_value')
      recs.push('Focus on alphanumeric stand/bay accuracy — single-digit errors can cause ramp conflicts')
    if (e.type === 'missing_element')
      recs.push('Use a checklist approach: sierra position + direction + runway + callsign for all pushbacks')
  }

  for (const e of rampErrors) {
    if (e.type === 'pushback_direction_missing')
      recs.push('Always confirm pushback facing direction — tug crew needs it to position correctly')
    if (e.type === 'pushback_clearance_not_confirmed')
      recs.push('Read back full pushback clearance: position (Sierra X), runway, and callsign')
    if (e.type === 'startup_not_confirmed')
      recs.push('Acknowledge startup approval explicitly: "Startup approved / Idle power approved, [callsign]"')
    if (e.type === 'engine_number_wrong')
      recs.push('Verify engine number before readback — starting wrong engine is a serious safety hazard')
    if (e.type === 'stand_number_wrong')
      recs.push('Confirm bay/stand number clearly — write it down if needed to avoid confusion')
    if (e.type === 'towing_direction_missing')
      recs.push('Confirm tow destination bay number so tug crew can plan safe routing on apron')
    if (e.type === 'apron_crossing_incomplete')
      recs.push('Always read back hold-short point on apron — prevents taxiway conflict with arriving traffic')
    if (e.type === 'callsign_not_included')
      recs.push('End every readback with callsign — required by ICAO Doc 9432 §4.5')
    if (e.type === 'frequency_not_confirmed')
      recs.push('Read back frequency in full before switching — prevents contact on wrong channel')
    if (e.type === 'roger_substitution')
      recs.push('Never use "Roger" alone for mandatory readbacks — read back key elements explicitly')
    if (e.type === 'non_standard_ramp_phraseology')
      recs.push('Use ICAO standard ramp phraseology for clarity and international interoperability')
    if (e.type === 'chocks_not_confirmed')
      recs.push('Acknowledge chocks/parking brake instructions before ground crew proceeds')
  }

  return Array.from(new Set(recs)).slice(0, 5)
}

// ============================================================================
// SEQUENCE ANALYSIS HELPERS
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
    if (previousErrors[i].weight !== 'low') count++
    else break
  }
  return count
}

// ============================================================================
// HELPER — map RampPhase to SeverityFactors.flightPhase
// ============================================================================

type RampSeverityPhase = 'ground' | 'departure' | 'climb' | 'cruise' | 'descent' | 'approach' | 'landing'

function mapRampPhase(phase: RampPhase): RampSeverityPhase {
  const map: Record<RampPhase, RampSeverityPhase> = {
    pushback: 'departure',   // Pre-departure — directional risk
    startup:  'departure',   // Engine start — ground equipment proximity
    parking:  'landing',     // Arriving aircraft — stand conflict risk
    towing:   'ground',      // Ground movement on apron
    crossing: 'approach',    // Hold-short on apron — traffic conflict
    ramp:     'ground',      // General ramp coordination
  }
  return map[phase] ?? 'ground'
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Performs enhanced analysis for ramp control communications.
 * Parallel structure to analyzeGround() in groundAnalyzer.ts.
 */
export function analyzeRamp(
  atcInstruction: string,
  pilotReadback: string,
  callsign?: string,
  previousErrors?: { type: string; weight: string; timestamp: number }[]
): RampMLResult {
  // 1. Base semantic analysis
  const baseAnalysis = analyzeReadback(atcInstruction, pilotReadback, callsign)

  // 2. Detect ramp phase
  const phaseResult = detectRampPhase(atcInstruction, pilotReadback)

  // 3. Multi-part instruction analysis (reused from departureApproachAnalyzer)
  const multiPartAnalysis = analyzeMultiPartInstruction(atcInstruction, pilotReadback)

  // 4. Detect RAMP-specific errors
  const rampErrors = detectRampErrors(atcInstruction, pilotReadback, callsign)

  // 5. Contextual weight
  const contextualWeight: UnifiedSeverity = mapWeight(
    calculateEnhancedSeverity(
      { phase: mapRampPhase(phaseResult.phase) },
      baseAnalysis.errors.length > 0 ? baseAnalysis.errors[0].type : 'unknown'
    )
  )

  // 6. Safety vectors
  const safetyVectors = calculateRampSafetyVectors(baseAnalysis, phaseResult.phase, rampErrors)

  // 7. Confidence scores
  const rampConfidenceScores = calculateRampConfidence(phaseResult.confidence, baseAnalysis, rampErrors, multiPartAnalysis)

  // 8. Training recommendations
  const trainingRecommendations = generateRampRecommendations(baseAnalysis, phaseResult.phase, rampErrors)

  // 9. Sequence analysis
  const errorPattern = detectErrorPattern(rampErrors.map(e => e.type).join(' '))
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
    phase:                phaseResult.phase,
    phaseConfidence:      phaseResult.confidence,
    contextualWeight,
    multiPartAnalysis,
    rampSpecificErrors:   rampErrors,
    safetyVectors,
    rampConfidenceScores,
    trainingRecommendations,
    sequenceAnalysis,
  }
}

// ============================================================================
// EXPORT FOR HUGGINGFACE TRAINING
// ============================================================================

export function exportRampTrainingData() {
  return RAMP_CORPUS.map(entry => ({
    instruction:    entry.atc,
    pilot_response: entry.pilot,
    label:          entry.isCorrect ? 'correct' : 'incorrect' as 'correct' | 'incorrect',
    phase:          entry.phase as RampPhase,
    error_type:     entry.errorType,
  }))
}

// ============================================================================
// BATCH ANALYSIS
// ============================================================================

export function batchAnalyzeRamp(
  exchanges: { atc: string; pilot: string; expectedPhase?: RampPhase }[]
): {
  totalExchanges: number
  correctReadbacks: number
  phaseAccuracy: number
  rampErrorRate: number
  averageCompleteness: number
  criticalErrorCount: number
} {
  let correctReadbacks = 0
  let correctPhaseDetections = 0
  let totalRampErrors = 0
  let totalCompleteness = 0
  let criticalErrorCount = 0

  for (const exchange of exchanges) {
    const result = analyzeRamp(exchange.atc, exchange.pilot)

    if (result.isCorrect) correctReadbacks++
    if (exchange.expectedPhase && result.phase === exchange.expectedPhase) {
      correctPhaseDetections++
    }

    totalRampErrors   += result.rampSpecificErrors.length
    totalCompleteness += result.multiPartAnalysis.readbackCompleteness

    if (result.contextualWeight === 'critical') criticalErrorCount++
  }

  const total = exchanges.length

  return {
    totalExchanges:      total,
    correctReadbacks,
    phaseAccuracy:       total > 0 ? Math.round((correctPhaseDetections / total) * 100) : 0,
    rampErrorRate:       total > 0 ? Math.round((totalRampErrors / total) * 100) : 0,
    averageCompleteness: total > 0 ? Math.round(totalCompleteness / total) : 100,
    criticalErrorCount,
  }
}

// ============================================================================
// RAMP CORPUS STATISTICS
// ============================================================================

export interface RampTrainingResult {
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

export function trainRampModel(): RampTrainingResult {
  const startTime = Date.now()

  let totalSamples = 0
  let correctDetections = 0
  let correctPhaseDetections = 0
  let correctErrorTypeDetections = 0
  let correctExampleTotal = 0
  let correctExampleCorrect = 0
  let errorExampleTotal = 0
  let errorExampleCorrect = 0
  let truePositives = 0
  let trueNegatives = 0
  let falsePositives = 0
  let falseNegatives = 0

  for (const entry of RAMP_CORPUS) {
    totalSamples++
    const result = analyzeRamp(entry.atc, entry.pilot)

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
      const hasErrors = !result.isCorrect || result.rampSpecificErrors.length > 0
      if (hasErrors) {
        correctDetections++
        errorExampleCorrect++
        truePositives++
        if (entry.errorType) {
          const detectedRampTypes = result.rampSpecificErrors.map(e => e.type)
          const detectedBaseTypes = result.errors.map(e => e.type)
          if (
            detectedRampTypes.includes(entry.errorType as RampErrorType) ||
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
    accuracy:               Math.round((correctDetections / totalSamples) * 100),
    phaseAccuracy:          Math.round((correctPhaseDetections / totalSamples) * 100),
    errorTypeAccuracy:      totalErrorSamples > 0 ? Math.round((correctErrorTypeDetections / totalErrorSamples) * 100) : 0,
    correctExampleAccuracy: correctExampleTotal > 0 ? Math.round((correctExampleCorrect / correctExampleTotal) * 100) : 0,
    errorExampleAccuracy:   errorExampleTotal > 0 ? Math.round((errorExampleCorrect / errorExampleTotal) * 100) : 0,
    confusionMatrix: { truePositives, trueNegatives, falsePositives, falseNegatives },
    trainingTime,
    modelVersion: '2.0.0-ramp',
  }
}

export function getRampCorpusStats() {
  const totalExamples   = RAMP_CORPUS.length
  const correctExamples = RAMP_CORPUS.filter(e => e.isCorrect).length
  const errorExamples   = RAMP_CORPUS.filter(e => !e.isCorrect).length
  const errorTypes      = new Set<string>()
  const phases          = new Set<string>()
  for (const entry of RAMP_CORPUS) {
    phases.add(entry.phase)
    if (entry.errorType) errorTypes.add(entry.errorType)
  }
  return {
    totalExamples,
    correctExamples,
    errorExamples,
    uniqueErrorTypes: Array.from(errorTypes),
    coveredPhases:    Array.from(phases),
    errorRate:        Math.round((errorExamples / totalExamples) * 100),
  }
}

export function getAllRampTrainingData() {
  return { corpus: RAMP_CORPUS }
}
