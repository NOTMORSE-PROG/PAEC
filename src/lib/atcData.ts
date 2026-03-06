/**
 * Consolidated ATC Data & Training Module
 *
 * Comprehensive training corpus for ATC readback analysis
 * Based on ICAO Doc 9432, FAA Order 7110.65, and real ATC data
 */

import rawCorpus     from '../data/paecCorpus.json'      // shared: phraseology, callsigns, waypoints
import appDepCorpus  from '../data/appDepCorpus.json'    // APP/DEP training pairs
import gndCorpus     from '../data/gndCorpus.json'       // GND training pairs
import rampCorpus    from '../data/rampCorpus.json'      // RAMP training pairs (stub)

// ============================================================================
// TYPES
// ============================================================================

export interface PhraseCorrection {
  incorrect: string
  correct: string
  explanation: string
  nonStandard: RegExp
  standard: string
  weight: 'critical' | 'high' | 'medium' | 'low'
  category: 'acknowledgment' | 'instruction' | 'clarification' | 'number' | 'emergency'
  safetyImpact: 'safety' | 'clarity' | 'efficiency'
  exclude?: RegExp      // if set and matches the full line, this phrase is NOT flagged
  pattern?: RegExp
  incident?: string
  icaoDoc?: string
  issue?: string
}

export interface ReadbackRequirement {
  instructionType: string
  requiredElements: string[]
  weight: 'critical' | 'high' | 'medium' | 'low' | 'mandatory'
  instruction: RegExp
  mustReadback: string[]
  description: string
}

export interface ATCTrainingExample {
  atc: string
  pilot: string
  isCorrect: boolean
  phase: string
  errorType?: string | null  // null for correct examples, string for errors
  explanation?: string
}

export interface DepartureApproachContext {
  phase: string
  altitude?: number
  speed?: number
  heading?: number
  traffic?: string
  weather?: string
}

export interface SeverityFactors {
  phase: string
  errorType: string
  hasTraffic: boolean
  weatherConditions: string
  flightPhase?: 'ground' | 'departure' | 'climb' | 'cruise' | 'descent' | 'approach' | 'landing'
  trafficDensity?: 'low' | 'medium' | 'high'
  consecutiveErrors?: number
  instructionType?: string
}

export interface ErrorPattern {
  pattern: RegExp
  errorType: string
  weight: 'critical' | 'high' | 'medium' | 'low'
  frequency?: number
  issue?: string
  correction?: string
  nativeLanguages?: string[]
}

// ============================================================================
// PHRASEOLOGY DATABASE - NON-STANDARD PHRASES (loaded dynamically from paecCorpus.json)
// ============================================================================
//
// To add, edit, or remove a non-standard phrase:
//   Edit src/data/paecCorpus.json → phraseology.nonStandardPhrases array.
//   Each entry stores the regex as a plain string; it is compiled here at startup.
//   No code changes needed.
//
// JSON entry schema:
//   { incorrect, correct, explanation, pattern (regex string), flags,
//     standard, weight, category, safetyImpact,
//     excludePattern? (skip detection if this regex also matches the line),
//     incident?, icaoRef? }

interface RawPhraseEntry {
  incorrect: string
  correct: string
  explanation?: string
  pattern: string        // regex source — compiled with new RegExp(pattern, flags)
  flags?: string         // default "i"
  excludePattern?: string // if set and matches the line, the entry is NOT flagged
  standard: string
  weight: string
  category: string
  safetyImpact: string
  incident?: string
  icaoRef?: string
}

export const NON_STANDARD_PHRASES: PhraseCorrection[] = (
  (rawCorpus.phraseology as { nonStandardPhrases: RawPhraseEntry[] }).nonStandardPhrases
).map((entry) => {
  // Guard against invalid regex strings in JSON — a single bad pattern must not
  // crash the entire module. Fall back to a never-matching regex for that entry.
  let nonStandard: RegExp
  let exclude: RegExp | undefined
  try {
    nonStandard = new RegExp(entry.pattern, entry.flags ?? 'i')
    if (entry.excludePattern) exclude = new RegExp(entry.excludePattern, entry.flags ?? 'i')
  } catch {
    nonStandard = /(?!)/   // never matches; entry is silently skipped
  }
  return {
    incorrect:    entry.incorrect,
    correct:      entry.correct,
    explanation:  entry.explanation ?? '',
    nonStandard,
    standard:     entry.standard,
    weight:     (entry.weight    as PhraseCorrection['weight']),
    category:     (entry.category    as PhraseCorrection['category']),
    safetyImpact: (entry.safetyImpact as PhraseCorrection['safetyImpact']),
    ...(exclude        ? { exclude }                  : {}),
    ...(entry.incident ? { incident: entry.incident } : {}),
    ...(entry.icaoRef  ? { icaoDoc:  entry.icaoRef  } : {}),
  }
})

// PHRASEOLOGY DATABASE - NUMBER PRONUNCIATION
// ============================================================================

export const NUMBER_PRONUNCIATION_ERRORS: PhraseCorrection[] = [
  {
    // "nine" → "niner": ICAO requires this to prevent confusion with German "nein" (no).
    // Restricted to digit contexts only — does NOT fire when "nine" is a quantity
    // modifier (e.g. "nine thousand") since those compound-number readings are correct.
    incorrect: "nine",
    correct: "niner",
    explanation: "ICAO requires 'niner' to prevent confusion with German 'nein' (no)",
    nonStandard: /\bnine\b(?!\s+(?:thousand|hundred))/i,
    standard: "niner",
    weight: 'medium',
    category: 'number',
    safetyImpact: 'safety',
    pattern: /\bnine\b(?!\s+(?:thousand|hundred))/i,
    issue: "Number 'nine' should be pronounced 'niner'",
    incident: "Multiple incidents where 'nine' confused with 'nein' in international operations",
    icaoDoc: "ICAO Doc 9432 Section 5.2.1.4",
  },
  {
    // "three" → "tree": Valid ICAO guidance for isolated digit transmission
    // (callsigns, headings, QNH, frequencies). NOT flagged when "three" is a compound
    // number modifier like "three thousand" or "three hundred" — those are correct English.
    incorrect: "three",
    correct: "tree",
    explanation: "ICAO phonetic: 'tree' is clearer over radio for individual digit transmission",
    nonStandard: /\bthree\b(?!\s+(?:thousand|hundred))/i,
    standard: "tree",
    weight: 'low',
    category: 'number',
    safetyImpact: 'clarity',
    pattern: /\bthree\b(?!\s+(?:thousand|hundred))/i,
    issue: "Number 'three' should be pronounced 'tree'",
    icaoDoc: "ICAO Doc 9432 Section 5.2.1.4",
  },
  {
    // "five" → "fife": Valid ICAO guidance for isolated digit transmission.
    // NOT flagged in compound quantity modifiers ("five thousand", "five hundred").
    incorrect: "five",
    correct: "fife",
    explanation: "ICAO phonetic: 'fife' prevents confusion with 'four' or 'nine' in digit-by-digit transmission",
    nonStandard: /\bfive\b(?!\s+(?:thousand|hundred))/i,
    standard: "fife",
    weight: 'low',
    category: 'number',
    safetyImpact: 'clarity',
    pattern: /\bfive\b(?!\s+(?:thousand|hundred))/i,
    issue: "Number 'five' should be pronounced 'fife'",
    icaoDoc: "ICAO Doc 9432 Section 5.2.1.4",
  },
  // NOTE: "thousand" and "decimal" entries removed.
  // ICAO Doc 9432 Table 5-1 gives pronunciation guides (TOU-SAND, DAY-SEE-MAL) for
  // the actual English words "thousand" and "decimal". In a written transcript, "thousand"
  // and "decimal" ARE the correct ICAO standard words — recommending "tousand" or
  // "day-see-mal" as replacements is factually wrong and misleads users.
]

// ============================================================================
// CLEARANCE PATTERNS
// ============================================================================

export const APP_DEP_CLEARANCE_PATTERNS = [
  /climb\s+(and\s+)?maintain/i,
  /descend\s+(and\s+)?maintain/i,
  /turn\s+(left|right)/i,
  /cleared\s+(ils|rnav|visual|vor|ndb|rnp)/i,
  /reduce\s+speed/i,
  /increase\s+speed/i,
  /maintain\s+\d+\s*knots/i,
  /expedite\s+(climb|descent)/i,
  /cross\s+\w+\s+at/i,
  /hold\s+(short|position)/i,
  /line\s+up\s+(and\s+)?wait/i,
  /cleared\s+(for\s+)?take\s*off/i,
  /cleared\s+(to\s+)?land/i,
  /go\s*around/i,
  /contact\s+\w+/i,
  /squawk\s+\d{4}/i,
  /altimeter\s+\d{4}/i,
  /qnh\s+\d{4}/i,
]

// ============================================================================
// READBACK REQUIREMENTS
// ============================================================================

export const READBACK_REQUIREMENTS: ReadbackRequirement[] = [
  {
    instructionType: 'altitude',
    requiredElements: ['action', 'value', 'callsign'],
    weight: 'mandatory',
    instruction: /climb|descend/i,
    mustReadback: ['altitude', 'action'],
    description: 'Altitude changes must be read back with climb/descend action',
  },
  {
    instructionType: 'heading',
    requiredElements: ['direction', 'value', 'callsign'],
    weight: 'mandatory',
    instruction: /\bheading\b|\bturn\s+(?:left|right)\b/i,
    mustReadback: ['heading', 'direction'],
    description: 'Heading instructions must include direction and value',
  },
  {
    instructionType: 'speed',
    requiredElements: ['value', 'callsign'],
    weight: 'mandatory',
    instruction: /\breduce\s+speed\b|\bincrease\s+speed\b|\bmaintain\s+\d+\s*knots\b|\bspeed\s+\d+\b/i,
    mustReadback: ['speed'],
    description: 'Speed instructions must be read back (ICAO Doc 4444 §12.3.2.1)',
  },
  {
    instructionType: 'squawk',
    requiredElements: ['code', 'callsign'],
    weight: 'mandatory',
    instruction: /squawk/i,
    mustReadback: ['squawk'],
    description: 'Squawk codes must be read back',
  },
  {
    instructionType: 'frequency',
    requiredElements: ['frequency', 'callsign'],
    weight: 'mandatory',
    instruction: /contact|frequency/i,
    mustReadback: ['frequency'],
    description: 'Frequency changes must be read back',
  },
  {
    instructionType: 'runway',
    requiredElements: ['runway', 'callsign'],
    weight: 'mandatory',
    instruction: /runway/i,
    mustReadback: ['runway'],
    description: 'Runway assignments are safety-critical',
  },
  {
    instructionType: 'altimeter',
    requiredElements: ['setting', 'callsign'],
    weight: 'mandatory',
    instruction: /altimeter|qnh/i,
    mustReadback: ['altimeter'],
    description: 'Altimeter settings must be read back',
  },
  {
    instructionType: 'holdShort',
    requiredElements: ['hold short', 'runway', 'callsign'],
    weight: 'mandatory',
    instruction: /hold\s*short/i,
    mustReadback: ['hold short', 'runway'],
    description: 'Hold short instructions prevent runway incursions',
  },
  {
    instructionType: 'takeoff',
    requiredElements: ['cleared for takeoff', 'runway', 'callsign'],
    weight: 'mandatory',
    instruction: /cleared\s*(for\s*)?take\s*off/i,
    mustReadback: ['cleared for takeoff', 'runway'],
    description: 'Takeoff clearance is safety-critical',
  },
  {
    instructionType: 'landing',
    requiredElements: ['cleared to land', 'runway', 'callsign'],
    weight: 'mandatory',
    instruction: /cleared\s*(to\s*)?land/i,
    mustReadback: ['cleared to land', 'runway'],
    description: 'Landing clearance is safety-critical',
  },
  {
    instructionType: 'goAround',
    requiredElements: ['go around', 'callsign'],
    weight: 'mandatory',
    instruction: /go\s*around/i,
    mustReadback: ['go around'],
    description: 'Go around instruction is safety-critical',
  },
  {
    instructionType: 'approach',
    requiredElements: ['approach type', 'runway', 'callsign'],
    weight: 'mandatory',
    instruction: /cleared\s+(?:ils|rnav|vor|ndb|visual|instrument|rnp|gls|lnav|vnav)\s+(?:runway\s+)?\d|cleared\s+(?:ils|rnav|vor|ndb|visual|rnp|gls)\s+approach/i,
    mustReadback: ['approach type', 'runway'],
    description: 'Approach clearance type and runway must be read back (ICAO Doc 4444 §12.3.4.1)',
  },
  {
    instructionType: 'lineup',
    requiredElements: ['line up and wait', 'runway', 'callsign'],
    weight: 'mandatory',
    instruction: /line\s*up\s*and\s*wait|luaw/i,
    mustReadback: ['line up and wait', 'runway'],
    description: 'Line up and wait is safety-critical — prevents runway incursion (ICAO Doc 4444 §8.5.2)',
  },
]

// ============================================================================
// CALLSIGNS, FACILITIES, WAYPOINTS
// ============================================================================

// Philippine Airlines and Regional Carriers
export const PHILIPPINE_CALLSIGNS = [
  'PAL', 'CEB', 'APG', 'AXC', 'RPC', 'SRQ', 'GAP', 'AIQ', 'RYA', 'SEA',
]

// International Carriers commonly in Philippine airspace
export const INTERNATIONAL_CALLSIGNS = [
  'UAE', 'SIA', 'CPA', 'KAL', 'JAL', 'ANA', 'EVA', 'CAL', 'MAS', 'THA',
  'QTR', 'ETH', 'SWR', 'BAW', 'AFR', 'KLM', 'DLH', 'UAL', 'AAL', 'DAL',
  'FDX', 'UPS', 'GTI', 'CLX', 'ABW', 'MXD', 'CSN', 'CES', 'HVN', 'VJC',
]

export const ENHANCED_CALLSIGNS = [
  ...PHILIPPINE_CALLSIGNS,
  ...INTERNATIONAL_CALLSIGNS,
]

// Philippine ATC Facilities
export const PHILIPPINE_FACILITIES = [
  'Manila Approach', 'Manila Departure', 'Manila Tower', 'Manila Ground',
  'Cebu Approach', 'Cebu Tower', 'Cebu Ground',
  'Clark Approach', 'Clark Tower',
  'Davao Approach', 'Davao Tower',
  'Iloilo Approach', 'Iloilo Tower',
  'Kalibo Approach', 'Kalibo Tower',
  'Puerto Princesa Approach',
  'Manila Control', 'Cebu Control',
]

// Philippine Waypoints and Fixes
export const PHILIPPINE_WAYPOINTS = [
  // NAIA (Manila) area
  'BOREG', 'ELBIS', 'GUAVA', 'PANAS', 'RENAS', 'TAVER', 'AKLAN', 'LUBANG',
  'NINOY', 'SUBIC', 'TALON', 'OSIAS', 'CAPIN', 'MAPLA', 'ERLAS', 'TAROS',
  // Cebu area
  'MACTA', 'BANAT', 'MASBA', 'LINOG', 'UBINA', 'TOROD', 'POLOG',
  // General
  'BOHOL', 'PANAY', 'SAMAR', 'LEYTE', 'BATAN', 'SANGA', 'DAVAO',
]

// Standard Instrument Departures
export const ENHANCED_SIDS = [
  // NAIA SIDs
  'BOREG1A', 'BOREG1B', 'BOREG1C',
  'ELBIS1A', 'ELBIS1B', 'ELBIS2A',
  'GUAVA1A', 'GUAVA2A', 'GUAVA3A',
  'PANAS1A', 'PANAS1B', 'PANAS2A',
  'RENAS1A', 'RENAS2A', 'RENAS3A',
  'TAVER1A', 'TAVER1B', 'TAVER2A',
  'LUBANG1', 'LUBANG2', 'LUBANG3',
  // Cebu SIDs
  'MACTA1', 'MACTA2', 'BANAT1', 'MASBA1',
]

// Standard Terminal Arrival Routes
export const ENHANCED_STARS = [
  // NAIA STARs
  'AKLAN1A', 'AKLAN2A', 'AKLAN3A',
  'LUBANG1A', 'LUBANG2A', 'LUBANG3A',
  'NINOY1A', 'NINOY2A', 'NINOY1B',
  'TAVER1A', 'TAVER2A', 'TAVER3A',
  'OSIAS1A', 'OSIAS2A',
  'SUBIC1A', 'SUBIC2A',
  // Cebu STARs
  'LINOG1', 'UBINA1', 'TOROD1', 'POLOG1',
]

// ============================================================================
// SAFETY CRITICAL PATTERNS
// ============================================================================

// SAFETY_CRITICAL_PATTERNS — loaded dynamically from paecCorpus.json.
// To add or change a safety-critical keyword, edit:
//   src/data/paecCorpus.json → phraseology.safetyCriticalPatterns[]
// No code changes needed.
interface RawSafetyCriticalEntry {
  pattern: string
  description: string
  weight: 'critical' | 'high'
}

export const SAFETY_CRITICAL_PATTERNS: { pattern: RegExp; description: string; weight: 'critical' | 'high' }[] = (
  (rawCorpus.phraseology as { safetyCriticalPatterns: RawSafetyCriticalEntry[] }).safetyCriticalPatterns ?? []
).map(e => ({
  pattern:     new RegExp(e.pattern, 'i'),
  description: e.description,
  weight:    e.weight,
}))

// ============================================================================
// FORMAT PATTERNS
// ============================================================================

export const ALTITUDE_FORMATS = {
  flightLevel: /flight\s*level\s*(\d{2,3})/i,
  feet: /(\d{3,5})\s*feet/i,
  thousands: /(\d{1,2})\s*thousand/i,
}

export const HEADING_FORMAT = /heading\s*(\d{1,3})/i

export const SQUAWK_CODES = {
  emergency: '7700',
  hijack: '7500',
  commsFail: '7600',
  vfr: '1200',
  conspicuity: '1000',
}

// ============================================================================
// DEPARTURE CONTROL DATA
// ============================================================================

export const DEPARTURE_COMMANDS = [
  'climb and maintain',
  'descend and maintain',
  'turn left heading',
  'turn right heading',
  'maintain runway heading',
  'contact departure',
  'contact approach',
  'contact tower',
  'contact ground',
  'squawk',
  'radar contact',
  'radar service terminated',
  'resume own navigation',
  'proceed direct',
  'cleared direct',
  'reduce speed',
  'increase speed',
  'maintain speed',
  'no speed restrictions',
  'cross at',
  'cross at or above',
  'cross at or below',
  'hold',
  'expect',
]

// ============================================================================
// NON-NATIVE SPEAKER ERROR PATTERNS
// ============================================================================

// Note: "tree" (three), "fife" (five), "niner" (nine), "fower" (four) are CORRECT
// ICAO phonetic pronunciations and should NOT be flagged as errors.

export const NON_NATIVE_ERROR_PATTERNS: ErrorPattern[] = [
  // ========================================
  // ZERO PRONUNCIATION VARIANTS
  // ========================================
  {
    pattern: /\bsero\b/i,
    errorType: 'non_native_pronunciation',
    weight: 'low',
    frequency: 0.08,
    issue: 'Non-standard pronunciation of "zero" (Tagalog/Spanish influence)',
    correction: 'Pronounce as "ZEE-ro" with emphasis on first syllable',
    nativeLanguages: ['tagalog', 'spanish', 'portuguese'],
  },
  {
    pattern: /\bziro\b/i,
    errorType: 'non_native_pronunciation',
    weight: 'low',
    frequency: 0.05,
    issue: 'Non-standard pronunciation of "zero" (short vowel)',
    correction: 'Pronounce as "ZEE-ro" with long "ee" sound',
    nativeLanguages: ['japanese', 'korean'],
  },

  // ========================================
  // ONE PRONUNCIATION VARIANTS
  // ========================================
  {
    pattern: /\bwan\b/i,
    errorType: 'non_native_pronunciation',
    weight: 'low',
    frequency: 0.12,
    issue: 'Non-standard pronunciation of "one" (missing "w-uh-n" sound)',
    correction: 'Pronounce as "WUN" with clear "w" start',
    nativeLanguages: ['chinese', 'korean', 'vietnamese'],
  },

  // ========================================
  // THREE PRONUNCIATION VARIANTS (not "tree" - that's correct ICAO)
  // ========================================
  {
    pattern: /\btee\b/i,
    errorType: 'non_native_pronunciation',
    weight: 'medium',
    frequency: 0.06,
    issue: 'Dropped "th" sound in "three"',
    correction: 'Pronounce as "TREE" (ICAO standard) or "THREE"',
    nativeLanguages: ['tagalog', 'chinese', 'japanese', 'korean'],
  },
  {
    pattern: /\bsree\b/i,
    errorType: 'non_native_pronunciation',
    weight: 'medium',
    frequency: 0.04,
    issue: '"S" substitution for "th" in "three"',
    correction: 'Pronounce as "TREE" (ICAO standard)',
    nativeLanguages: ['hindi', 'urdu', 'bengali'],
  },

  // ========================================
  // FOUR PRONUNCIATION VARIANTS (not "fower" - that's correct ICAO)
  // ========================================
  {
    pattern: /\bpor\b/i,
    errorType: 'non_native_pronunciation',
    weight: 'medium',
    frequency: 0.03,
    issue: '"P" substitution for "f" in "four"',
    correction: 'Pronounce as "FOW-er" (ICAO standard)',
    nativeLanguages: ['arabic', 'korean'],
  },
  {
    pattern: /\bfo\b(?!\w)/i,
    errorType: 'non_native_pronunciation',
    weight: 'medium',
    frequency: 0.05,
    issue: 'Shortened pronunciation of "four"',
    correction: 'Pronounce as "FOW-er" (ICAO standard)',
    nativeLanguages: ['chinese', 'vietnamese'],
  },

  // ========================================
  // FIVE PRONUNCIATION VARIANTS (not "fife" - that's correct ICAO)
  // ========================================
  {
    pattern: /\bpive\b/i,
    errorType: 'non_native_pronunciation',
    weight: 'medium',
    frequency: 0.02,
    issue: '"P" substitution for "f" in "five"',
    correction: 'Pronounce as "FIFE" (ICAO standard)',
    nativeLanguages: ['arabic'],
  },

  // ========================================
  // SIX PRONUNCIATION VARIANTS
  // ========================================
  {
    pattern: /\bsicks\b/i,
    errorType: 'non_native_pronunciation',
    weight: 'low',
    frequency: 0.03,
    issue: 'Extended "six" pronunciation',
    correction: 'Pronounce as "SIX" with short "i"',
    nativeLanguages: ['spanish', 'portuguese'],
  },

  // ========================================
  // SEVEN PRONUNCIATION VARIANTS
  // ========================================
  {
    pattern: /\bseben\b/i,
    errorType: 'non_native_pronunciation',
    weight: 'medium',
    frequency: 0.08,
    issue: '"B" substitution for "v" in "seven"',
    correction: 'Pronounce as "SEV-en" with clear "v" sound',
    nativeLanguages: ['tagalog', 'spanish', 'arabic', 'chinese'],
  },
  {
    pattern: /\bsewen\b/i,
    errorType: 'non_native_pronunciation',
    weight: 'medium',
    frequency: 0.04,
    issue: '"W" substitution for "v" in "seven"',
    correction: 'Pronounce as "SEV-en" with clear "v" sound',
    nativeLanguages: ['german', 'polish'],
  },

  // ========================================
  // EIGHT PRONUNCIATION VARIANTS (not "ait" - that's acceptable)
  // ========================================
  {
    pattern: /\beyt\b/i,
    errorType: 'non_native_pronunciation',
    weight: 'low',
    frequency: 0.04,
    issue: 'Non-standard pronunciation of "eight"',
    correction: 'Pronounce as "AIT" (ICAO acceptable)',
    nativeLanguages: ['spanish', 'portuguese'],
  },

  // ========================================
  // NINE PRONUNCIATION VARIANTS (not "niner" - that's correct ICAO)
  // ========================================
  {
    pattern: /\bnain\b/i,
    errorType: 'non_native_pronunciation',
    weight: 'low',
    frequency: 0.06,
    issue: 'Non-standard pronunciation of "nine"',
    correction: 'Pronounce as "NINER" (ICAO standard)',
    nativeLanguages: ['german', 'dutch'],
  },

  // ========================================
  // PHRASEOLOGY ERRORS (Grammar/Structure)
  // ========================================
  {
    pattern: /\bclearing\s+for\b/i,
    errorType: 'non_native_grammar',
    weight: 'medium',
    frequency: 0.05,
    issue: 'Incorrect tense: "clearing for" instead of "cleared for"',
    correction: 'Use past tense "cleared for"',
    nativeLanguages: ['chinese', 'korean', 'japanese'],
  },
  {
    pattern: /\bwe\s+are\s+(climbing|descending|turning)\b/i,
    errorType: 'non_native_grammar',
    weight: 'low',
    frequency: 0.08,
    issue: 'Verbose construction - use direct form',
    correction: 'Say "climbing" not "we are climbing"',
    nativeLanguages: ['spanish', 'portuguese', 'french'],
  },
  {
    pattern: /\bplease\s+(climb|descend|turn|contact|squawk)\b/i,
    errorType: 'non_native_grammar',
    weight: 'low',
    frequency: 0.04,
    issue: 'Unnecessary politeness marker in readback',
    correction: 'Omit "please" in operational readbacks',
    nativeLanguages: ['japanese', 'korean', 'thai'],
  },

  // ========================================
  // WORD ORDER ERRORS
  // ========================================
  {
    pattern: /\b(one|two|three|four|five|six|seven|eight|nine|niner|zero)\s+(heading|altitude|speed)\b/i,
    errorType: 'non_native_word_order',
    weight: 'high',
    frequency: 0.03,
    issue: 'Number before parameter type (should be "heading 270" not "270 heading")',
    correction: 'Say parameter type first, then value',
    nativeLanguages: ['japanese', 'korean', 'turkish'],
  },

  // ========================================
  // L/R CONFUSION (Critical for runway designators)
  // ========================================
  {
    pattern: /\brunway\s+\d{1,2}\s*(reft|leight)\b/i,
    errorType: 'non_native_pronunciation',
    weight: 'critical',
    frequency: 0.02,
    issue: 'L/R confusion in runway designator - CRITICAL SAFETY ISSUE',
    correction: 'Practice clear distinction between "LEFT" and "RIGHT"',
    nativeLanguages: ['chinese', 'japanese', 'korean'],
  },
  {
    pattern: /\b(reft|leight)\s+heading\b/i,
    errorType: 'non_native_pronunciation',
    weight: 'high',
    frequency: 0.02,
    issue: 'L/R confusion in turn direction',
    correction: 'Practice clear distinction between "LEFT" and "RIGHT"',
    nativeLanguages: ['chinese', 'japanese', 'korean'],
  },

  // ========================================
  // STRESS PATTERN ERRORS
  // ========================================
  {
    pattern: /\bDEpart\b/i,
    errorType: 'non_native_stress',
    weight: 'low',
    frequency: 0.04,
    issue: 'Wrong stress pattern on "departure"',
    correction: 'Stress on second syllable: de-PAR-ture',
    nativeLanguages: ['french', 'spanish'],
  },
]

// ============================================================================
// READBACK VALIDATIONS WITH RANGE CHECKING
// ============================================================================

export const READBACK_VALIDATIONS = {
  altitude: {
    required: true,
    format: /\d{3,5}|flight\s*level\s*\d{2,3}/i,
    minValue: 0,
    maxValue: 60000,  // FL600 max practical altitude
    validate: (value: number) => value >= 0 && value <= 60000,
  },
  heading: {
    required: true,
    format: /\d{1,3}/i,
    minValue: 1,
    maxValue: 360,  // Valid compass headings
    validate: (value: number) => value >= 1 && value <= 360,
  },
  speed: {
    required: true,
    format: /\d{2,3}/i,
    minValue: 60,   // Minimum practical speed
    maxValue: 500,  // Maximum practical speed in knots
    validate: (value: number) => value >= 60 && value <= 500,
  },
  squawk: {
    required: true,
    format: /\d{4}/i,
    minValue: 0,
    maxValue: 7777,  // Valid squawk range (octal: 0000-7777)
    validate: (value: number) => value >= 0 && value <= 7777 && !String(value).match(/[89]/),
  },
  frequency: {
    required: true,
    format: /\d{3}\.\d{1,3}/i,
    minValue: 118.0,  // VHF comm range start
    maxValue: 136.975,  // VHF comm range end
    validate: (value: number) => value >= 118.0 && value <= 136.975,
  },
  runway: {
    required: true,
    format: /\d{1,2}[LRC]?/i,
    minValue: 1,
    maxValue: 36,  // Valid runway numbers
    validate: (value: number) => value >= 1 && value <= 36,
  },
  altimeter: {
    required: true,
    format: /\d{4}/i,
    minValue: 2700,  // Extreme low pressure
    maxValue: 3100,  // Extreme high pressure
    validate: (value: number) => value >= 2700 && value <= 3100,
  },
}

// ============================================================================
// RUNWAY INCURSION DETECTION PATTERNS
// ============================================================================

export const RUNWAY_INCURSION_PATTERNS = [
  {
    atcPattern: /line\s+up\s+(and\s+)?wait/i,
    errorPattern: /cleared\s+(for\s+)?take\s*off/i,
    errorType: 'critical_confusion',
    weight: 'critical',
    explanation: 'Confused line up and wait with takeoff clearance - RUNWAY INCURSION RISK',
    icaoReference: 'ICAO Doc 4444 - Line up and wait is NOT a takeoff clearance',
  },
  {
    atcPattern: /hold\s+short\s+(of\s+)?runway/i,
    errorPattern: /cross(ing)?\s+runway/i,
    errorType: 'critical_confusion',
    weight: 'critical',
    explanation: 'Confused hold short with runway crossing - RUNWAY INCURSION RISK',
    icaoReference: 'FAA 7110.65 - Hold short means do not enter runway',
  },
  {
    atcPattern: /hold\s+short\s+(of\s+)?runway\s+(\d{1,2})/i,
    errorPattern: /hold\s+short\s+(of\s+)?runway\s+(\d{1,2})/i,
    validateMatch: (atc: string, pilot: string) => {
      const atcRunway = atc.match(/runway\s+(\d{1,2})/i)?.[1]
      const pilotRunway = pilot.match(/runway\s+(\d{1,2})/i)?.[1]
      return atcRunway !== pilotRunway
    },
    errorType: 'wrong_runway',
    weight: 'critical',
    explanation: 'Wrong runway read back in hold short instruction - WRONG RUNWAY RISK',
    icaoReference: 'FAA 7110.65 - Runway must match exactly',
  },
  {
    atcPattern: /runway\s+(\d{1,2})\s*(left|right|center)/i,
    errorPattern: /runway\s+(\d{1,2})(?!\s*(left|right|center))/i,
    errorType: 'missing_designator',
    weight: 'high',
    explanation: 'Missing runway designator (L/R/C) - WRONG RUNWAY POSSIBLE',
    icaoReference: 'ICAO Annex 14 - Parallel runway designators are mandatory',
  },
  {
    atcPattern: /cleared\s+(for\s+)?take\s*off\s+runway\s+(\d{1,2})/i,
    validateMatch: (atc: string, pilot: string) => {
      const atcRunway = atc.match(/runway\s+(\d{1,2})/i)?.[1]
      const pilotRunway = pilot.match(/runway\s+(\d{1,2})/i)?.[1]
      return atcRunway !== pilotRunway
    },
    errorType: 'wrong_runway',
    weight: 'critical',
    explanation: 'Wrong runway read back in takeoff clearance',
    icaoReference: 'ICAO Doc 4444 - Runway must be verified',
  },
]

// ============================================================================
// CRITICAL EDGE CASES - These patterns often cause false positives/negatives
// ============================================================================

export const EDGE_CASE_PATTERNS = {
  // Numbers that sound similar and are often confused
  confusableNumbers: [
    { pair: ['15', '50'], context: 'altitude/speed' },
    { pair: ['16', '60'], context: 'altitude/speed' },
    { pair: ['17', '70'], context: 'altitude/heading' },
    { pair: ['18', '80'], context: 'heading' },
    { pair: ['19', '90'], context: 'heading' },
    { pair: ['13', '30'], context: 'heading/runway' },
    { pair: ['14', '40'], context: 'altitude' },
    { pair: ['5000', '15000'], context: 'altitude' },
    { pair: ['6000', '16000'], context: 'altitude' },
  ],

  // Runway pairs that can be confused
  confusableRunways: [
    { pair: ['06', '24'], note: 'opposite ends of same runway' },
    { pair: ['06L', '06R'], note: 'parallel runways' },
    { pair: ['13', '31'], note: 'reciprocal' },
    { pair: ['09', '27'], note: 'reciprocal' },
  ],

  // Valid abbreviations that should NOT be flagged
  validAbbreviations: [
    { full: 'flight level', abbrev: 'FL', context: 'altitude' },
    { full: 'degrees', abbrev: '', context: 'heading - degrees not required' },
    { full: 'knots', abbrev: 'kts', context: 'speed' },
    { full: 'feet', abbrev: 'ft', context: 'altitude' },
    { full: 'thousand', abbrev: 'K', context: 'altitude' },
  ],

  // Phrases that are equivalent and should NOT be flagged
  equivalentPhrases: [
    { phrases: ['climb and maintain', 'climbing', 'climb maintain'] },
    { phrases: ['descend and maintain', 'descending', 'descend maintain'] },
    { phrases: ['turn left', 'left turn', 'turning left'] },
    { phrases: ['turn right', 'right turn', 'turning right'] },
    { phrases: ['cleared for takeoff', 'cleared takeoff'] },
    { phrases: ['cleared to land', 'cleared land'] },
    { phrases: ['line up and wait', 'lineup and wait', 'line up wait'] },
  ],
}

// ============================================================================
// SIMILARITY THRESHOLD FOR FUZZY MATCHING
// ============================================================================

export const SIMILARITY_THRESHOLDS = {
  // Below this = definitely wrong, above = possibly correct
  numbers: 0.9,      // Numbers must be very close
  waypoints: 0.85,   // Waypoint names can have slight variation
  callsigns: 0.8,    // Callsigns can be abbreviated
  phrases: 0.7,      // General phrases have more flexibility
}

// ============================================================================
// VALUE RANGE VALIDATORS (for detecting unrealistic values)
// ============================================================================

export function validateHeadingRange(heading: number): { valid: boolean; error?: string } {
  if (heading < 1 || heading > 360) {
    return { valid: false, error: `Invalid heading ${heading}° - must be 001-360` }
  }
  return { valid: true }
}

export function validateSpeedRange(speed: number, phase?: string): { valid: boolean; error?: string } {
  const ranges: Record<string, [number, number]> = {
    'approach': [100, 250],
    'departure': [150, 300],
    'cruise': [200, 500],
    'default': [60, 500],
  }
  const [min, max] = ranges[phase || 'default'] || ranges['default']
  if (speed < min || speed > max) {
    return { valid: false, error: `Unusual speed ${speed}kts for ${phase || 'flight'} phase (expected ${min}-${max})` }
  }
  return { valid: true }
}

export function validateAltitudeRange(altitude: number, phase?: string): { valid: boolean; error?: string } {
  // Flight levels start at 18,000 ft in most countries
  const isFlightLevel = altitude >= 180 && altitude <= 600  // FL180-FL600
  const isFeetAltitude = altitude >= 0 && altitude <= 60000

  if (!isFlightLevel && !isFeetAltitude) {
    return { valid: false, error: `Invalid altitude value ${altitude}` }
  }
  return { valid: true }
}

export function validateSquawkCode(squawk: string): { valid: boolean; error?: string } {
  // Squawk codes are octal - digits 0-7 only
  if (!/^[0-7]{4}$/.test(squawk)) {
    return { valid: false, error: `Invalid squawk code ${squawk} - must be 4 octal digits (0-7)` }
  }
  // Special codes
  const specialCodes = ['7500', '7600', '7700']  // Hijack, Comm failure, Emergency
  if (specialCodes.includes(squawk)) {
    return { valid: true, error: `Warning: ${squawk} is an emergency code` }
  }
  return { valid: true }
}

// ============================================================================
// TRAINING CORPORA — each phase type has its own JSON file.
//
// To add training examples, edit the matching file:
//   APP/DEP  →  src/data/appDepCorpus.json  → "corpus" array
//   GND      →  src/data/gndCorpus.json     → "corpus" array
//   RAMP     →  src/data/rampCorpus.json    → "corpus" array
//
// Shared rules (phraseology, callsigns, waypoints) live in paecCorpus.json.
// No code changes needed here. Changes are picked up on next build/reload.
// ============================================================================

export const DEPARTURE_APPROACH_CORPUS: ATCTrainingExample[] =
  (appDepCorpus.corpus as unknown as ATCTrainingExample[])

export const GND_CORPUS: ATCTrainingExample[] =
  (gndCorpus.corpus as unknown as ATCTrainingExample[])

export const RAMP_CORPUS: ATCTrainingExample[] =
  (rampCorpus.corpus as unknown as ATCTrainingExample[])

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function extractCommandsFromText(text: string): string[] {
  const commands: string[] = []
  for (const cmd of DEPARTURE_COMMANDS) {
    if (text.toLowerCase().includes(cmd)) {
      commands.push(cmd)
    }
  }
  return commands
}

export function validateReadback(
  instruction: string,
  readback: string,
  instructionType: string
): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  const validation = READBACK_VALIDATIONS[instructionType as keyof typeof READBACK_VALIDATIONS]

  if (!validation) {
    return { isValid: true, errors: [] }
  }

  if (validation.required && !validation.format.test(readback)) {
    errors.push(`Missing or invalid ${instructionType} in readback`)
  }

  return { isValid: errors.length === 0, errors }
}

export function calculateEnhancedSeverity(
  context: DepartureApproachContext,
  errorType: string
): 'critical' | 'high' | 'medium' | 'low' {
  // Critical phase errors
  if (context.phase === 'ground' || context.phase === 'takeoff' || context.phase === 'landing') {
    if (errorType.includes('runway') || errorType.includes('takeoff') || errorType.includes('landing')) {
      return 'critical'
    }
  }

  if (context.phase === 'approach' || context.phase === 'departure') {
    if (errorType.includes('altitude') || errorType.includes('runway')) {
      return 'critical'
    }
    if (errorType.includes('heading')) {
      return 'high'
    }
  }

  if (errorType.includes('missing') || errorType.includes('wrong') || errorType.includes('transposition')) {
    return 'high'
  }

  if (errorType.includes('incomplete')) {
    return 'medium'
  }

  return 'low'
}

export function getDepartureApproachSeverityModifier(phase: string): number {
  const modifiers: Record<string, number> = {
    'departure': 1.5,
    'approach': 1.5,
    'landing': 2.0,
    'takeoff': 2.0,
    'ground': 1.8,
    'cruise': 1.0,
  }
  return modifiers[phase] || 1.0
}

export function detectErrorPattern(text: string): ErrorPattern | null {
  for (const errPattern of NON_NATIVE_ERROR_PATTERNS) {
    if (errPattern.pattern.test(text)) {
      return errPattern
    }
  }
  return null
}


export function getCorpusStats() {
  const total = DEPARTURE_APPROACH_CORPUS.length
  const correct = DEPARTURE_APPROACH_CORPUS.filter(e => e.isCorrect).length
  const incorrect = total - correct

  const byPhase = DEPARTURE_APPROACH_CORPUS.reduce((acc, e) => {
    acc[e.phase] = (acc[e.phase] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const byErrorType = DEPARTURE_APPROACH_CORPUS
    .filter(e => !e.isCorrect && e.errorType)
    .reduce((acc, e) => {
      acc[e.errorType!] = (acc[e.errorType!] || 0) + 1
      return acc
    }, {} as Record<string, number>)

  return {
    total,
    correct,
    incorrect,
    accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    byPhase,
    byErrorType,
  }
}

export function getExamplesByPhase(phase: string): ATCTrainingExample[] {
  return DEPARTURE_APPROACH_CORPUS.filter(e => e.phase === phase)
}

export function getExamplesByErrorType(errorType: string): ATCTrainingExample[] {
  return DEPARTURE_APPROACH_CORPUS.filter(e => e.errorType === errorType)
}

export function getIncorrectExamples(): ATCTrainingExample[] {
  return DEPARTURE_APPROACH_CORPUS.filter(e => !e.isCorrect)
}

export function getCorrectExamples(): ATCTrainingExample[] {
  return DEPARTURE_APPROACH_CORPUS.filter(e => e.isCorrect)
}

// ============================================================================
// DATA QUALITY VALIDATION
// ============================================================================

/**
 * Validate training corpus for common data quality issues
 * Run this to identify potential problems in training data
 */
export function validateTrainingCorpus(): {
  valid: boolean
  issues: { index: number; issue: string; example: ATCTrainingExample }[]
  stats: {
    total: number
    correct: number
    incorrect: number
    missingErrorType: number
    duplicates: number
  }
} {
  const issues: { index: number; issue: string; example: ATCTrainingExample }[] = []
  const seen = new Map<string, number>()
  let missingErrorType = 0
  let duplicates = 0

  DEPARTURE_APPROACH_CORPUS.forEach((example, index) => {
    // Check: incorrect examples must have errorType
    if (!example.isCorrect && !example.errorType) {
      issues.push({
        index,
        issue: 'Incorrect example missing errorType',
        example,
      })
      missingErrorType++
    }

    // Check: correct examples should not have errorType (or should be null)
    if (example.isCorrect && example.errorType && example.errorType !== null) {
      issues.push({
        index,
        issue: 'Correct example should not have errorType',
        example,
      })
    }

    // Check: empty or very short ATC/pilot strings
    if (example.atc.trim().length < 10) {
      issues.push({
        index,
        issue: 'ATC instruction too short',
        example,
      })
    }
    if (example.pilot.trim().length < 5) {
      issues.push({
        index,
        issue: 'Pilot readback too short',
        example,
      })
    }

    // Check: phase is valid
    const validPhases = ['ground', 'taxi', 'departure', 'climb', 'cruise', 'descent', 'approach', 'landing', 'go_around', 'takeoff']
    if (!validPhases.includes(example.phase)) {
      issues.push({
        index,
        issue: `Invalid phase: ${example.phase}`,
        example,
      })
    }

    // Check for duplicates
    const key = `${example.atc.toLowerCase()}|${example.pilot.toLowerCase()}`
    if (seen.has(key)) {
      issues.push({
        index,
        issue: `Duplicate of index ${seen.get(key)}`,
        example,
      })
      duplicates++
    } else {
      seen.set(key, index)
    }

    // Check: if contains "Roger" or "Wilco" alone, should be incorrect
    const pilotTrimmed = example.pilot.trim().toLowerCase()
    if (['roger', 'wilco', 'copy'].includes(pilotTrimmed.replace(/[,.\s]+.*/, '')) && example.isCorrect) {
      // Only flag if it's a safety-critical instruction
      const safetyCritical = /takeoff|landing|hold short|line up|runway/i.test(example.atc)
      if (safetyCritical) {
        issues.push({
          index,
          issue: 'Roger/Wilco for safety-critical instruction should be incorrect',
          example,
        })
      }
    }
  })

  const total = DEPARTURE_APPROACH_CORPUS.length
  const correct = DEPARTURE_APPROACH_CORPUS.filter(e => e.isCorrect).length

  return {
    valid: issues.length === 0,
    issues,
    stats: {
      total,
      correct,
      incorrect: total - correct,
      missingErrorType,
      duplicates,
    },
  }
}

/**
 * Get training corpus statistics with detailed breakdown
 */
export function getDetailedCorpusStats() {
  const stats = getCorpusStats()

  // Error type distribution
  const errorTypeDistribution = DEPARTURE_APPROACH_CORPUS
    .filter(e => !e.isCorrect && e.errorType)
    .reduce((acc, e) => {
      const type = e.errorType as string
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

  // Calculate balance metrics
  const correctRatio = stats.correct / stats.total
  const isBalanced = correctRatio >= 0.4 && correctRatio <= 0.6

  // Phase coverage
  const phaseCoverage = Object.keys(stats.byPhase).length

  return {
    ...stats,
    errorTypeDistribution,
    balance: {
      correctRatio: Math.round(correctRatio * 100),
      isBalanced,
      recommendation: correctRatio < 0.4
        ? 'Add more correct examples'
        : correctRatio > 0.6
          ? 'Add more error examples'
          : 'Good balance',
    },
    coverage: {
      phases: phaseCoverage,
      errorTypes: Object.keys(errorTypeDistribution).length,
    },
  }
}

// ============================================================================
// DYNAMIC PATTERN BUILDERS
// ============================================================================
// Regex constants built from the data arrays above.
// To support a new airline, facility, or ATC role, edit the relevant array —
// every regex here regenerates automatically without touching other files.

function _escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const _allCallsignsAlt = ENHANCED_CALLSIGNS.map(_escapeRegex).join('|')
const _facilityCityAlt = [
  ...new Set(PHILIPPINE_FACILITIES.map(f => f.split(' ')[0].toUpperCase())),
].map(_escapeRegex).join('|')
const _ATC_SUFFIX_ALT = 'APP|DEP|TWR|GND|CTR|APPROACH|DEPARTURE|TOWER|GROUND|CONTROL'

/** Callsign used as a line-label prefix: "PAL456:" / "CEB 789" */
export const CALLSIGN_LABEL_RE = new RegExp(`^(${_allCallsignsAlt})\\s*\\d+[:\\s]`, 'i')

// Spoken digit alternatives — includes ICAO phonetic digits AND tens (twenty/thirty/…/ninety)
// so that informal spoken callsigns like "Philippine one eighty niner" (189) are matched.
// Tens must appear BEFORE individual digits in the alternation so the regex engine prefers
// the longer match ("eighty" over "eight").
const _spokenDigitAlt =
  '(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|' +
  'zero|one|two|three|four|five|six|seven|eight|nine|niner)'

/** Callsign followed by spoken-digit words: "PHILIPPINE four two eight", "COOLRED eight eight four",
 *  "Philippine one eighty niner".  Complements CALLSIGN_IN_TEXT_RE which only matches numeric suffixes. */
export const CALLSIGN_SPOKEN_RE = new RegExp(
  `\\b(${_allCallsignsAlt})(?:\\s+${_spokenDigitAlt}){1,4}\\b`, 'i',
)

/** Callsign at end of a sentence — strongest pilot-readback indicator.
 *  Matches both numeric form "Philippine 189." and spoken form "Philippine one eighty niner." */
export const CALLSIGN_AT_END_RE = new RegExp(
  `,\\s*(${_allCallsignsAlt})(?:\\s*\\d+|(?:\\s+${_spokenDigitAlt}){1,4})\\.?$`, 'i',
)

/** Callsign at start of a sentence — ATC-addressing indicator.
 *  Matches both numeric form "PAL456, …" and spoken form "Philippine one eight niner, …" */
export const CALLSIGN_AT_START_RE = new RegExp(
  `^(${_allCallsignsAlt})(?:\\s*\\d+|(?:\\s+${_spokenDigitAlt}){1,4})[,\\s]`, 'i',
)

/** Callsign anywhere in text (single-match): "PAL456", "CEB 789".
 *  For global extraction use: new RegExp(CALLSIGN_IN_TEXT_RE.source, 'gi') */
export const CALLSIGN_IN_TEXT_RE = new RegExp(`\\b(${_allCallsignsAlt})\\s*\\d{2,4}\\b`, 'i')

/** Philippine aircraft registration: "RP-C1234", "RPC1234" */
export const PH_REGISTRATION_RE = /\b(?:RP-C|RPC)\d+\b/i

/** Facility label prefix: "Manila Approach:", "CEBU APP:", "CLARK TWR" */
export const FACILITY_LABEL_RE = new RegExp(
  `^(${_facilityCityAlt})\\s*(${_ATC_SUFFIX_ALT})[:\\s]?`, 'i',
)

/** Generic ATC role labels (no facility name): "TOWER:", "RADAR:", etc. */
export const ATC_ROLE_LABEL_RE =
  /^(ATC|ATCO|TOWER|GROUND|APPROACH|DEPARTURE|CONTROL|RADAR|CENTER|CENTRE|RAMP|CLEARANCE|DELIVERY|CLR|ATIS)[:\s]/i

/** Generic pilot role labels: "PILOT:", "CREW:", "FO:", "CAPT:", etc. */
export const PILOT_ROLE_LABEL_RE =
  /^(PILOT|PLT|CREW|FO|CAPT|CAPTAIN|PF|PM)[:\s]/i
