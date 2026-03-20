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
    holdShortTaxiwayPattern: string
    crossRunwayPattern: string
    lineUpAndWaitPattern: string
    takeoffClearancePattern: string
    runwayPattern: string
    taxiwayViaPattern: string
    pushbackPattern: string
    startupPattern: string
    backtrackPattern: string
    intersectionPattern: string
    atisPattern: string
    frequencyPattern: string
    // v3.4 additions — optional so existing corpora without them degrade gracefully
    qnhPattern?: string
    conditionalPattern?: string
    windPattern?: string
  }
}).checks

/**
 * Validates that all required CHECKS patterns are present and compile as valid regexes.
 * Logs warnings (not throws) so one bad pattern does not break the entire analyzer.
 */
function validateChecks(): void {
  const required: (keyof typeof CHECKS)[] = [
    'holdShortEquivalents', 'holdShortTaxiwayPattern', 'crossRunwayPattern',
    'lineUpAndWaitPattern', 'takeoffClearancePattern', 'runwayPattern',
    'taxiwayViaPattern', 'pushbackPattern', 'backtrackPattern',
    'intersectionPattern', 'atisPattern', 'frequencyPattern',
  ]
  for (const key of required) {
    const val = CHECKS[key]
    if (!val) {
      console.warn(`[GND] CHECKS.${key} is missing from gndCorpus.json`)
      continue
    }
    if (typeof val === 'string') {
      try { new RegExp(val) }
      catch { console.warn(`[GND] CHECKS.${key} is not a valid regex: ${val}`) }
    }
  }
  // Also validate optional patterns when present
  const optional = ['qnhPattern', 'conditionalPattern', 'windPattern'] as const
  for (const key of optional) {
    const val = CHECKS[key]
    if (val) {
      try { new RegExp(val) }
      catch { console.warn(`[GND] CHECKS.${key} (optional) is not a valid regex: ${val}`) }
    }
  }
}
validateChecks()

// ============================================================================
// PHONETIC TAXIWAY UTILITIES
// ============================================================================

const PHONETIC_TO_LETTER: Record<string, string> = {
  alpha: 'A', bravo: 'B', charlie: 'C', delta: 'D', echo: 'E',
  foxtrot: 'F', golf: 'G', hotel: 'H', india: 'I', juliet: 'J',
  kilo: 'K', lima: 'L', mike: 'M', november: 'N', oscar: 'O',
  papa: 'P', quebec: 'Q', romeo: 'R', sierra: 'S', tango: 'T',
  uniform: 'U', victor: 'V', whiskey: 'W', xray: 'X', yankee: 'Y',
  zulu: 'Z',
}

const SPOKEN_DIGIT: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9', niner: '9',
}

/**
 * Extracts taxiway designators from text using ICAO phonetic alphabet names.
 * "Golf one one" → "G11", "Delta" → "D", "Foxtrot four" → "F4"
 * Also handles bare single-letter designators (e.g. "via A, B, C").
 */
function extractTaxiwayDesignators(text: string): string[] {
  const lower = text.toLowerCase()
  const result: string[] = []
  const seen = new Set<string>()

  // 1. Match phonetic name optionally followed by number words/digits
  const phoneticRe =
    /\b(alpha|bravo|charlie|delta|echo|foxtrot|golf|hotel|india|juliet|kilo|lima|mike|november|oscar|papa|quebec|romeo|sierra|tango|uniform|victor|whiskey|xray|yankee|zulu)\b((?:\s+(?:one|two|three|four|five|six|seven|eight|nine|zero|niner|\d))+)?/gi

  let m: RegExpExecArray | null
  while ((m = phoneticRe.exec(lower)) !== null) {
    const letter = PHONETIC_TO_LETTER[m[1].toLowerCase()]
    if (!letter) continue
    const numPart = (m[2] || '').trim()
    const digits = numPart
      .split(/\s+/)
      .map(w => SPOKEN_DIGIT[w] ?? (/^\d$/.test(w) ? w : null))
      .filter(Boolean)
      .join('')
    const designator = letter + digits
    if (!seen.has(designator)) { seen.add(designator); result.push(designator) }
  }

  // 2. Bare single-letter taxiways mentioned after "via" (e.g. "via A, B")
  const viaRe = /\bvia\s+((?:[a-z](?:\s*,\s*|\s+and\s+|\s+)){1,10})/gi
  while ((m = viaRe.exec(lower)) !== null) {
    for (const part of m[1].split(/[\s,]+/)) {
      const letter = part.trim().toUpperCase()
      if (letter.length === 1 && /[A-Z]/.test(letter) && !seen.has(letter)) {
        seen.add(letter); result.push(letter)
      }
    }
  }

  // 3. Compound written designators: E1, F3, G11, R2 (letter directly followed by digit)
  // Guard: require preceding whitespace/comma to avoid matching aircraft types (B737, A320)
  // (?!\d) prevents matching "B7" inside "B737" — aircraft types have 3+ digit suffixes
  const compoundRe = /(?:^|[\s,])([a-z])(\d{1,2})(?!\d)(?:\b|$)/gi
  let compoundM: RegExpExecArray | null
  while ((compoundM = compoundRe.exec(lower)) !== null) {
    const designator = compoundM[1].toUpperCase() + compoundM[2]
    if (!seen.has(designator)) { seen.add(designator); result.push(designator) }
  }

  return result
}

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
  | 'startup_runway_missing'
  | 'backtrack_not_confirmed'
  | 'frequency_not_confirmed'
  | 'atis_not_confirmed'
  | 'qnh_not_confirmed'
  | 'conditional_clearance_not_confirmed'
  | 'wind_not_confirmed'
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
    patterns: [
      /push\s*back/i, /pushback\s+approved/i, /engine\s+start/i,
      /start\s*up\s+approved/i, /startup\s+approved/i, /start\s+approved/i,
    ],
    weight: 10,
    contextClues: ['pushback', 'startup', 'start'],
  },
  {
    phase: 'taxi',
    patterns: [/\btaxi\b/i, /continue\s+taxi/i, /tow\s+\w/i],
    weight: 8,
    contextClues: ['taxi', 'via', 'taxiway', 'tow'],
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
  let bestMatch: { phase: GroundPhase; score: number; matchCount: number } = { phase: 'ground', score: 0, matchCount: 0 }

  for (const pp of GROUND_PHASE_PATTERNS) {
    let score = 0
    let matchCount = 0
    for (const pat of pp.patterns) {
      if (pat.test(text)) { score += pp.weight; matchCount++ }
    }
    for (const clue of pp.contextClues) {
      if (text.includes(clue)) { score += 2; matchCount++ }
    }
    // Prefer higher score; use matchCount as tiebreaker when scores are equal
    if (score > bestMatch.score || (score === bestMatch.score && matchCount > bestMatch.matchCount)) {
      bestMatch = { phase: pp.phase, score, matchCount }
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

  // 2. hold_short_not_confirmed
  // 2a. Critical: ATC said "hold short of runway X" — pilot must echo "hold short"
  const hsRunwayCheck = atcLower.match(/hold\s+short\s+(?:of\s+)?runway\s+(\w+)/i)
  if (hsRunwayCheck) {
    const hsRe = new RegExp(CHECKS.holdShortEquivalents.join('|'), 'i')
    if (!hsRe.test(pilotLower)) {
      errors.push({
        type: 'hold_short_not_confirmed',
        description: `Hold short of runway ${hsRunwayCheck[1].toUpperCase()} not confirmed in readback`,
        weight: 'critical',
        correction: `Read back: "Hold short runway ${hsRunwayCheck[1].toUpperCase()}, [callsign]"`,
        icaoReference: 'ICAO Doc 4444 §7.11.2',
        safetyImpact: 'ATC cannot confirm aircraft will stop before runway — runway incursion risk',
      })
    }
  }

  // 2b. High: ATC said "hold short of <taxiway>" — pilot must echo "hold short"
  // Uses holdShortTaxiwayPattern from checks; skips when 2a already matched (runway hold short).
  if (!hsRunwayCheck && CHECKS.holdShortTaxiwayPattern) {
    const hsTwRe  = new RegExp(CHECKS.holdShortTaxiwayPattern, 'i')
    const hsTwAtc = atcLower.match(hsTwRe)
    if (hsTwAtc) {
      const hsRe = new RegExp(CHECKS.holdShortEquivalents.join('|'), 'i')
      if (!hsRe.test(pilotLower)) {
        // Extract the taxiway name for the description (first capture group)
        const point = (hsTwAtc[1] || hsTwAtc[0]).trim()
        errors.push({
          type: 'hold_short_not_confirmed',
          description: `Hold short of ${point} not confirmed in readback`,
          weight: 'high',
          correction: `Read back: "Hold short ${point}, [callsign]"`,
          icaoReference: 'ICAO Doc 4444 §7.11.2',
          safetyImpact: 'Unconfirmed taxiway hold short may cause ground traffic conflict',
        })
      }
    }
  }

  // Compile corpus-driven patterns once (1D — replace inline regex with CHECKS patterns)
  const runwayRe        = new RegExp(CHECKS.runwayPattern, 'i')
  const taxiwayViaRe    = new RegExp(CHECKS.taxiwayViaPattern, 'i')
  const pushbackRe      = new RegExp(CHECKS.pushbackPattern, 'i')
  const startupRe       = new RegExp(CHECKS.startupPattern || 'start\\s*up\\s+approved|startup\\s+approved|start\\s+approved', 'i')
  const backtrackRe     = new RegExp(CHECKS.backtrackPattern, 'i')
  const intersectionRe  = new RegExp(CHECKS.intersectionPattern, 'i')
  const atisRe          = new RegExp(CHECKS.atisPattern, 'i')
  const frequencyRe     = new RegExp(CHECKS.frequencyPattern, 'i')

  // 3. runway_crossing_incomplete (high) — uses CHECKS.crossRunwayPattern (dynamic)
  const crossRe    = new RegExp(CHECKS.crossRunwayPattern, 'i')
  const crossMatch = atcLower.match(crossRe)
  if (crossMatch) {
    const rwNum = normalizeToDigits(crossMatch[1])
    const pilotCrossRunwayMatch = pilotLower.match(runwayRe)
    const pilotCrossRw = pilotCrossRunwayMatch ? normalizeToDigits(pilotCrossRunwayMatch[1]) : null
    if (rwNum && pilotCrossRw !== rwNum) {
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

  // 5. taxi_route_incomplete (medium)
  // Extract taxiway designators from ATC instruction using phonetic names
  // (e.g. "taxi Golf one one, Delta" → ["G11","D"]) — handles both "via X" and bare phonetics.
  // Falls back to single-letter "via" parsing for non-PAEC corpora.
  const atcTaxiways = extractTaxiwayDesignators(atcInstruction)
  const pilotTaxiways = extractTaxiwayDesignators(pilotReadback)

  // Only flag when ATC specified a taxi route (≥1 designator found)
  const isTaxiInstruction = /\btaxi\b/i.test(atcInstruction) || taxiwayViaRe.test(atcLower)
  if (isTaxiInstruction && atcTaxiways.length > 0) {
    const pilotSet = new Set(pilotTaxiways)
    const missing = atcTaxiways.filter(tw => !pilotSet.has(tw))
    if (missing.length > 0) {
      errors.push({
        type: 'taxi_route_incomplete',
        description: `Taxiway(s) ${missing.join(', ')} missing from readback`,
        weight: 'medium',
        correction: `Include all taxiway designators from ATC: ${atcTaxiways.join(', ')}`,
        icaoReference: 'ICAO Doc 4444 §7.11.1',
        safetyImpact: 'Aircraft may take incorrect taxi route, causing delay or conflict',
      })
    }
  }

  // 6. taxiway_designator_wrong (medium)
  // Pilot echoed a taxiway that was NOT in the ATC instruction
  if (isTaxiInstruction && atcTaxiways.length > 0 && pilotTaxiways.length > 0) {
    const atcSet = new Set(atcTaxiways)
    const wrong = pilotTaxiways.filter(tw => !atcSet.has(tw))
    if (wrong.length > 0) {
      errors.push({
        type: 'taxiway_designator_wrong',
        description: `Pilot used taxiway(s) ${wrong.join(', ')} not in ATC instruction`,
        weight: 'medium',
        correction: `Use only taxiways from ATC instruction: ${atcTaxiways.join(', ')}`,
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

  // ── New checks 8–18 ──────────────────────────────────────────────────────

  // 8. pushback_direction_missing (medium, ATC only)
  // Only fires for direct pushback movement orders — NOT for "for pushback contact [freq]"
  // which is a frequency handoff, not a direction instruction.
  const isDirectPushback =
    pushbackRe.test(atcLower) &&
    !/for\s+push(?:back)?/i.test(atcLower)      // skip "startup approved, for pushback contact X"
  if (isDirectPushback && !/\b(north|south|east|west|left|right|tail|nose|facing)\b/i.test(atcLower)) {
    errors.push({
      type: 'pushback_direction_missing',
      description: 'Pushback direction not specified',
      weight: 'medium',
      correction: 'State pushback direction or heading (e.g., "Pushback approved, facing north")',
      icaoReference: 'ICAO Doc 9432 §7.4.2',
      safetyImpact: 'Ambiguous pushback direction may conflict with adjacent traffic',
    })
  }

  // 8b. startup_runway_missing (high)
  // ATC stated a runway in startup approval but pilot omitted it in readback.
  if (startupRe.test(atcLower)) {
    const atcRwStartup = atcLower.match(runwayRe)
    if (atcRwStartup) {
      const pilotRwStartup = pilotLower.match(runwayRe)
      if (!pilotRwStartup) {
        errors.push({
          type: 'startup_runway_missing',
          description: `Runway ${atcRwStartup[1].toUpperCase()} omitted from startup approval readback`,
          weight: 'high',
          correction: `Include runway in readback: "Startup approved runway ${atcRwStartup[1].toUpperCase()}, [callsign]"`,
          icaoReference: 'ICAO Doc 9432 §7.4',
          safetyImpact: 'Departure runway must be confirmed — wrong runway assignment is a safety hazard',
        })
      }
    }
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
  // extractFullFreq: normalize phonetic words to digits, collapse space-separated digits
  // ("1 1 8" → "118"), then extract "NNN.N" pattern including spoken "decimal".
  const extractFullFreq = (text: string): string | null => {
    const norm = normalizeToDigits(text)
    // Collapse adjacent space-separated single digits: "1 1 8" → "118"
    const collapsed = norm.replace(/\b(\d)\b( \b\d\b)+/g, m => m.replace(/ /g, ''))
    const m = collapsed.match(/(\d{3})\s*(?:decimal|point|\.)\s*(\d{1,3})/i)
    if (m) return `${m[1]}.${m[2]}`
    const bare = collapsed.match(/\b(1[123]\d)\b/)
    return bare ? bare[1] : null
  }
  // Use extractFullFreq for ATC frequency presence check (handles phonetic form)
  const atcFreq = extractFullFreq(atcLower)
  const isFreqHandoff = /\b(?:contact|monitor)\b/i.test(atcLower) && atcFreq !== null
  if (isFreqHandoff) {
    const pilotFreq = extractFullFreq(pilotLower)
    // Normalise to 3 decimal places before comparing — "118.5" and "118.50" are the same freq
    const normFreq = (f: string | null) => f ? parseFloat(f).toFixed(3) : null
    if (normFreq(atcFreq) !== normFreq(pilotFreq)) {
      errors.push({
        type: 'frequency_not_confirmed',
        description: `Frequency ${atcFreq} not confirmed in readback`,
        weight: 'low',
        correction: `Read back the frequency using ICAO standard: "${atcFreq}" (use "decimal", not "point")`,
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

  // 11b. qnh_not_confirmed (medium)
  // ATC provided a QNH/altimeter setting that the pilot did not echo back.
  if (CHECKS.qnhPattern) {
    const qnhRe = new RegExp(CHECKS.qnhPattern, 'i')
    const qnhAtcMatch = atcLower.match(qnhRe)
    if (qnhAtcMatch) {
      const qnhValue = qnhAtcMatch[1]
      // Also check phonetic form: normalise pilot text to digits and strip spaces
      const pilotNorm = normalizeToDigits(pilotLower).replace(/\s+/g, '')
      if (qnhValue && !pilotLower.includes(qnhValue) && !pilotNorm.includes(qnhValue)) {
        errors.push({
          type: 'qnh_not_confirmed',
          description: `QNH ${qnhValue} not confirmed in readback`,
          weight: 'medium',
          correction: `Include QNH in readback: "QNH ${qnhValue}, [callsign]"`,
          icaoReference: 'ICAO Doc 4444 §8.6.5.2',
          safetyImpact: 'Unconfirmed QNH risks wrong altimeter setting — altitude deviation hazard',
        })
      }
    }
  }

  // 11c. conditional_clearance_not_confirmed (high)
  // ATC issued a conditional instruction ("after the landing aircraft, cross runway...")
  // but pilot did not acknowledge the condition in their readback.
  if (CHECKS.conditionalPattern) {
    const condRe = new RegExp(CHECKS.conditionalPattern, 'i')
    if (condRe.test(atcLower)) {
      const hasConditionAck = /\b(after|behind|following|traffic|landing|departing)\b/i.test(pilotLower)
      if (!hasConditionAck) {
        errors.push({
          type: 'conditional_clearance_not_confirmed',
          description: 'Conditional clearance condition not acknowledged in readback',
          weight: 'high',
          correction: 'Read back the condition phrase (e.g. "after the landing aircraft") before the clearance',
          icaoReference: 'ICAO Doc 4444 §7.11.2',
          safetyImpact: 'Unconditional readback of a conditional clearance risks premature runway entry',
        })
      }
    }
  }

  // 11d. wind_not_confirmed (low) — uses CHECKS.windPattern (dynamic)
  // Wind is NOT a mandatory readback (ICAO Doc 4444), but during startup clearances
  // including wind in the readback is good practice and worth noting for training.
  if (CHECKS.windPattern) {
    const windRe = new RegExp(CHECKS.windPattern, 'i')
    if (windRe.test(atcLower) && !windRe.test(pilotLower) && startupRe.test(atcLower)) {
      errors.push({
        type: 'wind_not_confirmed',
        description: 'Wind information not acknowledged in startup readback',
        weight: 'low',
        correction: 'Include wind in startup readback for full situational awareness',
        icaoReference: 'ICAO Doc 9432 §7.4',
        safetyImpact: 'Non-mandatory but recommended — omitting wind is non-standard during startup',
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
  // Ground control cannot issue takeoff clearances — that is TWR-only.
  // Guard: exclude frequency-transfer context ("contact Tower for takeoff" is not a clearance).
  const isFrequencyTransferCtx = /\b(?:contact|monitor)\b/i.test(atcLower)
  if (!isFrequencyTransferCtx && takeoffRe.test(atcLower) && !luawRe.test(atcLower)) {
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
  const hasAckWord = /\b(roger|wilco|copy|affirm|affirmative)\b/i.test(pilotLower)
  const hasMandatoryElement =
    runwayRe.test(pilotLower) ||
    taxiwayViaRe.test(pilotLower) ||
    new RegExp(CHECKS.holdShortEquivalents.join('|'), 'i').test(pilotLower) ||
    /\b(one|two|three|four|five|six|seven|eight|nine|decimal|zero)\b/i.test(pilotLower)
  // Only flag when the entire pilot response is just an acknowledgement (≤5 words)
  // — prevents false positives on full readbacks that include "roger" as a prefix.
  const isAcknowledgementOnly = hasAckWord && !hasMandatoryElement &&
    pilotLower.trim().split(/\s+/).length <= 5
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

  // 2. Hold short compliance — weight elevated when phase is holding; graduated penalty
  const holdShortErrors = gndErrors.filter(e =>
    e.type === 'hold_short_not_confirmed' || e.type === 'incorrect_holding_point'
  )
  const holdShortCritical = holdShortErrors.filter(e => e.weight === 'critical').length
  const holdShortHigh     = holdShortErrors.filter(e => e.weight === 'high').length
  const holdScore = Math.max(0, 100 - holdShortCritical * 40 - holdShortHigh * 20)
  const holdWeight = phase === 'holding' ? 0.30 : 0.20
  vectors.push({
    factor: 'Hold Short Compliance',
    score: holdScore,
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
    if (e.type === 'startup_runway_missing')
      recs.push('Confirm the departure runway in startup approval readback — it is safety-critical')
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
    if (e.type === 'qnh_not_confirmed')
      recs.push('QNH is a mandatory readback element — echo the altimeter value to confirm correct setting')
    if (e.type === 'conditional_clearance_not_confirmed')
      recs.push('Conditional clearances must include the condition phrase in readback (e.g. "after the landing aircraft")')
    if (e.type === 'wind_not_confirmed')
      recs.push('Include wind information in startup readbacks for complete situational awareness')
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

  // 5. Contextual weight — pick the WORST weight across all errors (base + GND-specific)
  // Previously used only baseAnalysis.errors[0], missing critical GND errors that appeared later.
  const weightOrder: Record<UnifiedSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 }
  const allWeights: UnifiedSeverity[] = [
    ...baseAnalysis.errors.map(e => mapWeight(e.weight)),
    ...gndErrors.map(e => mapWeight(e.weight)),
  ]
  const contextualWeight: UnifiedSeverity = allWeights.length > 0
    ? allWeights.reduce((worst, w) => weightOrder[w] > weightOrder[worst] ? w : worst, 'low' as UnifiedSeverity)
    : mapWeight(calculateEnhancedSeverity({ phase: mapGroundPhase(phaseResult.phase) }, 'unknown'))

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
