/**
 * Consolidated ATC Data & Training Module
 *
 * Comprehensive training corpus for ATC readback analysis
 * Based on ICAO Doc 9432, FAA Order 7110.65, and real ATC data
 */

// ============================================================================
// TYPES
// ============================================================================

export interface PhraseCorrection {
  incorrect: string
  correct: string
  explanation: string
  nonStandard: RegExp
  standard: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: 'acknowledgment' | 'instruction' | 'clarification' | 'number' | 'emergency'
  safetyImpact: 'safety' | 'clarity' | 'efficiency'
  pattern?: RegExp
  incident?: string
  icaoDoc?: string
  issue?: string
}

export interface ReadbackRequirement {
  instructionType: string
  requiredElements: string[]
  severity: 'critical' | 'high' | 'medium' | 'low' | 'mandatory'
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
  severity: 'critical' | 'high' | 'medium' | 'low'
  frequency?: number
  issue?: string
  correction?: string
  nativeLanguages?: string[]
}

// ============================================================================
// PHRASEOLOGY DATABASE - NON-STANDARD PHRASES
// ============================================================================

export const NON_STANDARD_PHRASES: PhraseCorrection[] = [
  // Common acknowledgment errors
  {
    incorrect: "with you",
    correct: "on your frequency",
    explanation: "Non-standard initial contact phrase. ICAO requires stating altitude/flight level on initial contact.",
    nonStandard: /\bwith you\b/i,
    standard: "on your frequency",
    severity: 'low',
    category: 'acknowledgment',
    safetyImpact: 'clarity',
    incident: "Avianca 52 crash (1990) - miscommunication contributed to fuel exhaustion",
  },
  {
    incorrect: "checking in",
    correct: "[callsign], [altitude/flight level]",
    explanation: "Non-standard initial contact. State callsign and altitude.",
    nonStandard: /\bchecking in\b/i,
    standard: "[callsign], [altitude]",
    severity: 'low',
    category: 'acknowledgment',
    safetyImpact: 'clarity',
  },
  {
    incorrect: "any traffic",
    correct: "traffic information",
    explanation: "Use proper traffic advisory format per ICAO Doc 4444",
    nonStandard: /\bany traffic\b/i,
    standard: "traffic information",
    severity: 'low',
    category: 'instruction',
    safetyImpact: 'clarity',
  },
  {
    incorrect: "go ahead",
    correct: "pass your message",
    explanation: "ICAO standard phraseology for requesting transmission",
    nonStandard: /\bgo ahead\b/i,
    standard: "pass your message",
    severity: 'low',
    category: 'acknowledgment',
    safetyImpact: 'clarity',
  },
  {
    incorrect: "no joy",
    correct: "negative contact",
    explanation: "Military slang not part of ICAO standard phraseology",
    nonStandard: /\bno joy\b/i,
    standard: "negative contact",
    severity: 'low',
    category: 'acknowledgment',
    safetyImpact: 'clarity',
  },
  {
    incorrect: "have a good one",
    correct: "good day",
    explanation: "Professional phraseology required for frequency changes",
    nonStandard: /\bhave a good one\b/i,
    standard: "good day",
    severity: 'low',
    category: 'acknowledgment',
    safetyImpact: 'efficiency',
  },
  {
    incorrect: "see ya",
    correct: "good day",
    explanation: "Informal language not appropriate for aviation communications",
    nonStandard: /\bsee ya\b/i,
    standard: "good day",
    severity: 'low',
    category: 'acknowledgment',
    safetyImpact: 'efficiency',
  },
  {
    incorrect: "back to you",
    correct: "good day",
    explanation: "Non-standard frequency change acknowledgment",
    nonStandard: /\bback to you\b/i,
    standard: "good day",
    severity: 'low',
    category: 'acknowledgment',
    safetyImpact: 'efficiency',
  },
  {
    incorrect: "say again all after",
    correct: "say again",
    explanation: "Simplified request for repetition is standard",
    nonStandard: /\bsay again all after\b/i,
    standard: "say again",
    severity: 'low',
    category: 'clarification',
    safetyImpact: 'clarity',
  },
  {
    incorrect: "take off",
    correct: "departure",
    explanation: "Word 'takeoff' only used for actual takeoff clearance to prevent confusion",
    nonStandard: /\btake off\b(?!.*cleared)/i,
    standard: "departure",
    severity: 'high',
    category: 'instruction',
    safetyImpact: 'safety',
    incident: "Tenerife disaster (1977) - 'takeoff' misunderstood as clearance",
  },
  // NOTE: "climb to" is VALID phraseology (e.g., "climb to one zero thousand")
  // Only flag when "to" appears where a number should be in a sequence
  {
    incorrect: "to",
    correct: "two",
    explanation: "'To' can be confused with 'two' in number sequences.",
    // Only match when "to" appears in middle of number sequence (e.g., "one to three" should be "one two three")
    nonStandard: /\b(one|three|four|five|six|seven|eight|nine|niner|zero)\s+to\s+(one|two|three|four|five|six|seven|eight|nine|niner|zero)\b/i,
    standard: "use 'two' in number sequences",
    severity: 'high',
    category: 'number',
    safetyImpact: 'safety',
  },
  // NOTE: "cleared for" is VALID phraseology (e.g., "cleared for takeoff", "cleared for approach")
  // Only flag when "for" appears where "four" should be in number sequences
  {
    incorrect: "for",
    correct: "four",
    explanation: "'For' can be confused with 'four' in number sequences.",
    // Only match when "for" appears in middle of number sequence (e.g., "two for six" should be "two four six")
    nonStandard: /\b(one|two|three|five|six|seven|eight|nine|niner|zero)\s+for\s+(one|two|three|four|five|six|seven|eight|nine|niner|zero)\b/i,
    standard: "use 'four' in number sequences",
    severity: 'high',
    category: 'number',
    safetyImpact: 'safety',
  },
  {
    incorrect: "okay",
    correct: "affirm",
    explanation: "'Okay' is not ICAO standard. Use 'affirm' or 'affirmative'.",
    nonStandard: /\bokay\b/i,
    standard: "affirm",
    severity: 'low',
    category: 'acknowledgment',
    safetyImpact: 'clarity',
  },
  {
    incorrect: "yeah",
    correct: "affirm",
    explanation: "Informal acknowledgment not part of standard phraseology",
    nonStandard: /\byeah\b/i,
    standard: "affirm",
    severity: 'low',
    category: 'acknowledgment',
    safetyImpact: 'clarity',
  },
  {
    incorrect: "uh huh",
    correct: "affirm",
    explanation: "Non-verbal acknowledgment not appropriate for radio",
    nonStandard: /\buh\s*huh\b/i,
    standard: "affirm",
    severity: 'low',
    category: 'acknowledgment',
    safetyImpact: 'clarity',
  },
  {
    incorrect: "copy that",
    correct: "roger",
    explanation: "'Copy' is not ICAO standard. Use 'roger' or read back the instruction.",
    nonStandard: /\bcopy that\b/i,
    standard: "roger",
    severity: 'low',
    category: 'acknowledgment',
    safetyImpact: 'clarity',
  },
  {
    incorrect: "standby one",
    correct: "standby",
    explanation: "'One' is unnecessary. 'Standby' is sufficient.",
    nonStandard: /\bstandby one\b/i,
    standard: "standby",
    severity: 'low',
    category: 'acknowledgment',
    safetyImpact: 'efficiency',
  },
]

// ============================================================================
// PHRASEOLOGY DATABASE - NUMBER PRONUNCIATION
// ============================================================================

export const NUMBER_PRONUNCIATION_ERRORS: PhraseCorrection[] = [
  {
    incorrect: "nine",
    correct: "niner",
    explanation: "ICAO requires 'niner' to prevent confusion with German 'nein' (no)",
    nonStandard: /\bnine\b/i,
    standard: "niner",
    severity: 'medium',
    category: 'number',
    safetyImpact: 'safety',
    pattern: /\bnine\b/i,
    issue: "Number 'nine' should be pronounced 'niner'",
    incident: "Multiple incidents where 'nine' confused with 'nein' in international operations",
    icaoDoc: "ICAO Doc 9432 Section 5.2.1.4",
  },
  {
    incorrect: "three",
    correct: "tree",
    explanation: "ICAO phonetic: 'tree' is clearer over radio",
    nonStandard: /\bthree\b/i,
    standard: "tree",
    severity: 'low',
    category: 'number',
    safetyImpact: 'clarity',
    pattern: /\bthree\b/i,
    issue: "Number 'three' should be pronounced 'tree'",
    icaoDoc: "ICAO Doc 9432 Section 5.2.1.4",
  },
  {
    incorrect: "five",
    correct: "fife",
    explanation: "ICAO phonetic: 'fife' prevents confusion with 'four' or 'nine'",
    nonStandard: /\bfive\b/i,
    standard: "fife",
    severity: 'low',
    category: 'number',
    safetyImpact: 'clarity',
    pattern: /\bfive\b/i,
    issue: "Number 'five' should be pronounced 'fife'",
    icaoDoc: "ICAO Doc 9432 Section 5.2.1.4",
  },
  {
    incorrect: "thousand",
    correct: "tousand",
    explanation: "ICAO phonetic pronunciation for clarity",
    nonStandard: /\bthousand\b/i,
    standard: "tousand",
    severity: 'low',
    category: 'number',
    safetyImpact: 'clarity',
    pattern: /\bthousand\b/i,
    issue: "Consider ICAO pronunciation 'tousand'",
    icaoDoc: "ICAO Doc 9432 Section 5.2.1.4",
  },
  {
    incorrect: "decimal",
    correct: "day-see-mal",
    explanation: "ICAO phonetic pronunciation for decimal point",
    nonStandard: /\bdecimal\b/i,
    standard: "day-see-mal",
    severity: 'low',
    category: 'number',
    safetyImpact: 'clarity',
    pattern: /\bdecimal\b/i,
    issue: "Consider ICAO pronunciation 'day-see-mal'",
    icaoDoc: "ICAO Doc 9432 Section 5.2.1.4",
  },
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
    severity: 'mandatory',
    instruction: /climb|descend/i,
    mustReadback: ['altitude', 'action'],
    description: 'Altitude changes must be read back with climb/descend action',
  },
  {
    instructionType: 'heading',
    requiredElements: ['direction', 'value', 'callsign'],
    severity: 'mandatory',
    instruction: /heading|turn/i,
    mustReadback: ['heading', 'direction'],
    description: 'Heading instructions must include direction and value',
  },
  {
    instructionType: 'speed',
    requiredElements: ['value', 'callsign'],
    severity: 'high',
    instruction: /speed|knots/i,
    mustReadback: ['speed'],
    description: 'Speed instructions must be read back',
  },
  {
    instructionType: 'squawk',
    requiredElements: ['code', 'callsign'],
    severity: 'mandatory',
    instruction: /squawk/i,
    mustReadback: ['squawk'],
    description: 'Squawk codes must be read back',
  },
  {
    instructionType: 'frequency',
    requiredElements: ['frequency', 'callsign'],
    severity: 'mandatory',
    instruction: /contact|frequency/i,
    mustReadback: ['frequency'],
    description: 'Frequency changes must be read back',
  },
  {
    instructionType: 'runway',
    requiredElements: ['runway', 'callsign'],
    severity: 'mandatory',
    instruction: /runway/i,
    mustReadback: ['runway'],
    description: 'Runway assignments are safety-critical',
  },
  {
    instructionType: 'altimeter',
    requiredElements: ['setting', 'callsign'],
    severity: 'mandatory',
    instruction: /altimeter|qnh/i,
    mustReadback: ['altimeter'],
    description: 'Altimeter settings must be read back',
  },
  {
    instructionType: 'holdShort',
    requiredElements: ['hold short', 'runway', 'callsign'],
    severity: 'mandatory',
    instruction: /hold\s*short/i,
    mustReadback: ['hold short', 'runway'],
    description: 'Hold short instructions prevent runway incursions',
  },
  {
    instructionType: 'takeoff',
    requiredElements: ['cleared for takeoff', 'runway', 'callsign'],
    severity: 'mandatory',
    instruction: /cleared\s*(for\s*)?take\s*off/i,
    mustReadback: ['cleared for takeoff', 'runway'],
    description: 'Takeoff clearance is safety-critical',
  },
  {
    instructionType: 'landing',
    requiredElements: ['cleared to land', 'runway', 'callsign'],
    severity: 'mandatory',
    instruction: /cleared\s*(to\s*)?land/i,
    mustReadback: ['cleared to land', 'runway'],
    description: 'Landing clearance is safety-critical',
  },
  {
    instructionType: 'goAround',
    requiredElements: ['go around', 'callsign'],
    severity: 'mandatory',
    instruction: /go\s*around/i,
    mustReadback: ['go around'],
    description: 'Go around instruction is safety-critical',
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

export const SAFETY_CRITICAL_PATTERNS: { pattern: RegExp; description: string; severity: 'critical' | 'high' }[] = [
  { pattern: /runway\s*\d{1,2}[LRC]?/i, description: 'Runway designation', severity: 'critical' },
  { pattern: /hold\s*short/i, description: 'Hold short instruction', severity: 'critical' },
  { pattern: /line\s*up\s*(and\s*)?wait/i, description: 'Line up and wait', severity: 'critical' },
  { pattern: /go\s*around/i, description: 'Go around instruction', severity: 'critical' },
  { pattern: /cleared\s*(to\s*)?land/i, description: 'Landing clearance', severity: 'critical' },
  { pattern: /cleared\s*(for\s*)?take\s*off/i, description: 'Takeoff clearance', severity: 'critical' },
  { pattern: /missed\s*approach/i, description: 'Missed approach', severity: 'critical' },
  { pattern: /cancel\s*take\s*off/i, description: 'Takeoff cancellation', severity: 'critical' },
  { pattern: /stop\s*(immediately)?/i, description: 'Stop instruction', severity: 'critical' },
  { pattern: /traffic\s*alert/i, description: 'Traffic alert', severity: 'critical' },
  { pattern: /terrain\s*ahead/i, description: 'Terrain warning', severity: 'critical' },
  { pattern: /pull\s*up/i, description: 'Pull up warning', severity: 'critical' },
  { pattern: /break\s*(left|right)/i, description: 'Emergency break', severity: 'critical' },
  { pattern: /expedite/i, description: 'Expedite instruction', severity: 'high' },
  { pattern: /immediately/i, description: 'Immediate action required', severity: 'high' },
]

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
    severity: 'low',
    frequency: 0.08,
    issue: 'Non-standard pronunciation of "zero" (Tagalog/Spanish influence)',
    correction: 'Pronounce as "ZEE-ro" with emphasis on first syllable',
    nativeLanguages: ['tagalog', 'spanish', 'portuguese'],
  },
  {
    pattern: /\bziro\b/i,
    errorType: 'non_native_pronunciation',
    severity: 'low',
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
    severity: 'low',
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
    severity: 'medium',
    frequency: 0.06,
    issue: 'Dropped "th" sound in "three"',
    correction: 'Pronounce as "TREE" (ICAO standard) or "THREE"',
    nativeLanguages: ['tagalog', 'chinese', 'japanese', 'korean'],
  },
  {
    pattern: /\bsree\b/i,
    errorType: 'non_native_pronunciation',
    severity: 'medium',
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
    severity: 'medium',
    frequency: 0.03,
    issue: '"P" substitution for "f" in "four"',
    correction: 'Pronounce as "FOW-er" (ICAO standard)',
    nativeLanguages: ['arabic', 'korean'],
  },
  {
    pattern: /\bfo\b(?!\w)/i,
    errorType: 'non_native_pronunciation',
    severity: 'medium',
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
    severity: 'medium',
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
    severity: 'low',
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
    severity: 'medium',
    frequency: 0.08,
    issue: '"B" substitution for "v" in "seven"',
    correction: 'Pronounce as "SEV-en" with clear "v" sound',
    nativeLanguages: ['tagalog', 'spanish', 'arabic', 'chinese'],
  },
  {
    pattern: /\bsewen\b/i,
    errorType: 'non_native_pronunciation',
    severity: 'medium',
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
    severity: 'low',
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
    severity: 'low',
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
    severity: 'medium',
    frequency: 0.05,
    issue: 'Incorrect tense: "clearing for" instead of "cleared for"',
    correction: 'Use past tense "cleared for"',
    nativeLanguages: ['chinese', 'korean', 'japanese'],
  },
  {
    pattern: /\bwe\s+are\s+(climbing|descending|turning)\b/i,
    errorType: 'non_native_grammar',
    severity: 'low',
    frequency: 0.08,
    issue: 'Verbose construction - use direct form',
    correction: 'Say "climbing" not "we are climbing"',
    nativeLanguages: ['spanish', 'portuguese', 'french'],
  },
  {
    pattern: /\bplease\s+(climb|descend|turn|contact|squawk)\b/i,
    errorType: 'non_native_grammar',
    severity: 'low',
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
    severity: 'high',
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
    severity: 'critical',
    frequency: 0.02,
    issue: 'L/R confusion in runway designator - CRITICAL SAFETY ISSUE',
    correction: 'Practice clear distinction between "LEFT" and "RIGHT"',
    nativeLanguages: ['chinese', 'japanese', 'korean'],
  },
  {
    pattern: /\b(reft|leight)\s+heading\b/i,
    errorType: 'non_native_pronunciation',
    severity: 'high',
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
    severity: 'low',
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
    severity: 'critical',
    explanation: 'Confused line up and wait with takeoff clearance - RUNWAY INCURSION RISK',
    icaoReference: 'ICAO Doc 4444 - Line up and wait is NOT a takeoff clearance',
  },
  {
    atcPattern: /hold\s+short\s+(of\s+)?runway/i,
    errorPattern: /cross(ing)?\s+runway/i,
    errorType: 'critical_confusion',
    severity: 'critical',
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
    severity: 'critical',
    explanation: 'Wrong runway read back in hold short instruction - WRONG RUNWAY RISK',
    icaoReference: 'FAA 7110.65 - Runway must match exactly',
  },
  {
    atcPattern: /runway\s+(\d{1,2})\s*(left|right|center)/i,
    errorPattern: /runway\s+(\d{1,2})(?!\s*(left|right|center))/i,
    errorType: 'missing_designator',
    severity: 'high',
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
    severity: 'critical',
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
// COMPREHENSIVE TRAINING CORPUS
// ============================================================================

export let DEPARTURE_APPROACH_CORPUS: ATCTrainingExample[] = [
  // ========================================
  // DEPARTURE PHASE - CORRECT EXAMPLES
  // ========================================

  // Climb instructions - correct
  {
    atc: "PAL123, climb and maintain flight level three five zero",
    pilot: "Climb and maintain flight level three five zero, PAL123",
    isCorrect: true,
    phase: 'departure',
  },
  {
    atc: "CEB456, climb and maintain one zero thousand",
    pilot: "Climbing one zero thousand, CEB456",
    isCorrect: true,
    phase: 'departure',
  },
  {
    atc: "UAE789, climb and maintain flight level two eight zero",
    pilot: "Climb maintain flight level two eight zero, UAE789",
    isCorrect: true,
    phase: 'departure',
  },
  {
    atc: "SIA321, climb and maintain flight level three niner zero",
    pilot: "Climb and maintain flight level three niner zero, SIA321",
    isCorrect: true,
    phase: 'departure',
  },
  {
    atc: "PAL555, climb and maintain eight thousand",
    pilot: "Climbing to eight thousand, PAL555",
    isCorrect: true,
    phase: 'departure',
  },
  {
    atc: "CEB777, after passing five thousand, climb and maintain one two thousand",
    pilot: "After passing five thousand, climb one two thousand, CEB777",
    isCorrect: true,
    phase: 'departure',
  },
  {
    atc: "QTR444, climb and maintain flight level four one zero",
    pilot: "Climb maintain flight level four one zero, QTR444",
    isCorrect: true,
    phase: 'departure',
  },

  // Heading instructions - correct
  {
    atc: "PAL123, turn right heading two seven zero",
    pilot: "Right heading two seven zero, PAL123",
    isCorrect: true,
    phase: 'departure',
  },
  {
    atc: "CEB456, turn left heading zero niner zero",
    pilot: "Left heading zero niner zero, CEB456",
    isCorrect: true,
    phase: 'departure',
  },
  {
    atc: "UAE789, fly heading three six zero",
    pilot: "Heading three six zero, UAE789",
    isCorrect: true,
    phase: 'departure',
  },
  {
    atc: "SIA321, turn right heading one eight zero",
    pilot: "Turn right heading one eight zero, SIA321",
    isCorrect: true,
    phase: 'departure',
  },
  {
    atc: "PAL888, maintain runway heading",
    pilot: "Maintaining runway heading, PAL888",
    isCorrect: true,
    phase: 'departure',
  },
  {
    atc: "CEB999, turn left heading zero three zero",
    pilot: "Left zero three zero, CEB999",
    isCorrect: true,
    phase: 'departure',
  },

  // Squawk instructions - correct
  {
    atc: "PAL123, squawk two four six one",
    pilot: "Squawk two four six one, PAL123",
    isCorrect: true,
    phase: 'departure',
  },
  {
    atc: "CEB456, squawk five five two seven",
    pilot: "Squawking five five two seven, CEB456",
    isCorrect: true,
    phase: 'departure',
  },
  {
    atc: "UAE789, squawk ident",
    pilot: "Squawk ident, UAE789",
    isCorrect: true,
    phase: 'departure',
  },
  {
    atc: "SIA321, squawk one two zero zero",
    pilot: "Squawk one two zero zero, SIA321",
    isCorrect: true,
    phase: 'departure',
  },

  // Frequency changes - correct
  {
    atc: "PAL123, contact Manila Control one two four decimal five",
    pilot: "Contact Manila Control one two four decimal five, PAL123",
    isCorrect: true,
    phase: 'departure',
  },
  {
    atc: "CEB456, contact departure one one niner decimal one",
    pilot: "Departure one one niner decimal one, CEB456",
    isCorrect: true,
    phase: 'departure',
  },
  {
    atc: "UAE789, contact Manila Approach one two one decimal three",
    pilot: "Manila Approach one two one decimal three, UAE789",
    isCorrect: true,
    phase: 'departure',
  },

  // Combined instructions - correct
  {
    atc: "PAL123, climb and maintain flight level two four zero, turn right heading zero six zero",
    pilot: "Climb flight level two four zero, right heading zero six zero, PAL123",
    isCorrect: true,
    phase: 'departure',
  },
  {
    atc: "CEB456, turn left heading three three zero, climb and maintain one five thousand",
    pilot: "Left three three zero, climbing one five thousand, CEB456",
    isCorrect: true,
    phase: 'departure',
  },

  // ========================================
  // DEPARTURE PHASE - INCORRECT EXAMPLES
  // ========================================

  // Incomplete readback - just "Roger"
  {
    atc: "PAL789, climb and maintain flight level three five zero",
    pilot: "Roger, PAL789",
    isCorrect: false,
    phase: 'departure',
    errorType: 'incomplete_readback',
    explanation: 'Altitude instructions require full readback, not just "Roger"',
  },
  {
    atc: "CEB101, turn right heading two seven zero",
    pilot: "Roger",
    isCorrect: false,
    phase: 'departure',
    errorType: 'incomplete_readback',
    explanation: 'Heading instructions require full readback with direction and value',
  },
  {
    atc: "UAE222, squawk five five two one",
    pilot: "Copy, UAE222",
    isCorrect: false,
    phase: 'departure',
    errorType: 'incomplete_readback',
    explanation: 'Squawk codes must be read back completely',
  },
  {
    atc: "SIA333, contact departure one one niner decimal one",
    pilot: "Wilco, SIA333",
    isCorrect: false,
    phase: 'departure',
    errorType: 'incomplete_readback',
    explanation: 'Frequency changes must be read back with the frequency',
  },

  // Wrong value errors
  {
    atc: "PAL444, climb and maintain flight level three five zero",
    pilot: "Climb flight level three four zero, PAL444",
    isCorrect: false,
    phase: 'departure',
    errorType: 'wrong_value',
    explanation: 'Altitude mismatch: instructed FL350, readback FL340',
  },
  {
    atc: "CEB555, turn left heading one eight zero",
    pilot: "Left heading one niner zero, CEB555",
    isCorrect: false,
    phase: 'departure',
    errorType: 'wrong_value',
    explanation: 'Heading mismatch: instructed 180, readback 190',
  },
  {
    atc: "UAE666, squawk two four six one",
    pilot: "Squawk two four one six, UAE666",
    isCorrect: false,
    phase: 'departure',
    errorType: 'transposition',
    explanation: 'Squawk code transposition: 2461 vs 2416',
  },
  {
    atc: "SIA777, contact departure one two one decimal three",
    pilot: "Departure one two one decimal eight, SIA777",
    isCorrect: false,
    phase: 'departure',
    errorType: 'wrong_value',
    explanation: 'Frequency mismatch: 121.3 vs 121.8',
  },

  // Wrong direction
  {
    atc: "PAL888, turn right heading two seven zero",
    pilot: "Left heading two seven zero, PAL888",
    isCorrect: false,
    phase: 'departure',
    errorType: 'wrong_direction',
    explanation: 'Turn direction error: instructed right, readback left',
  },
  {
    atc: "CEB999, turn left heading zero niner zero",
    pilot: "Right zero niner zero, CEB999",
    isCorrect: false,
    phase: 'departure',
    errorType: 'wrong_direction',
    explanation: 'Turn direction error: instructed left, readback right',
  },

  // Missing callsign
  {
    atc: "PAL111, climb and maintain flight level two eight zero",
    pilot: "Climb and maintain flight level two eight zero",
    isCorrect: false,
    phase: 'departure',
    errorType: 'missing_callsign',
    explanation: 'Callsign missing from readback',
  },

  // Parameter confusion
  {
    atc: "CEB222, turn right heading three five zero",
    pilot: "Climb flight level three five zero, CEB222",
    isCorrect: false,
    phase: 'departure',
    errorType: 'parameter_confusion',
    explanation: 'Confused heading 350 with flight level 350',
  },
  {
    atc: "UAE333, climb and maintain one two thousand",
    pilot: "Right heading one two zero, UAE333",
    isCorrect: false,
    phase: 'departure',
    errorType: 'parameter_confusion',
    explanation: 'Confused altitude 12000 with heading 120',
  },

  // ========================================
  // APPROACH PHASE - CORRECT EXAMPLES
  // ========================================

  // Descent instructions - correct
  {
    atc: "PAL123, descend and maintain five thousand",
    pilot: "Descend and maintain five thousand, PAL123",
    isCorrect: true,
    phase: 'approach',
  },
  {
    atc: "CEB456, descend and maintain flight level one two zero",
    pilot: "Descending flight level one two zero, CEB456",
    isCorrect: true,
    phase: 'approach',
  },
  {
    atc: "UAE789, descend and maintain three thousand, altimeter two niner niner two",
    pilot: "Descend three thousand, altimeter two niner niner two, UAE789",
    isCorrect: true,
    phase: 'approach',
  },
  {
    atc: "SIA321, descend and maintain two thousand five hundred",
    pilot: "Descending two thousand five hundred, SIA321",
    isCorrect: true,
    phase: 'approach',
  },
  {
    atc: "PAL555, cross AKLAN at or above eight thousand",
    pilot: "Cross AKLAN at or above eight thousand, PAL555",
    isCorrect: true,
    phase: 'approach',
  },

  // Approach clearances - correct
  {
    atc: "PAL123, cleared ILS runway zero six approach",
    pilot: "Cleared ILS runway zero six approach, PAL123",
    isCorrect: true,
    phase: 'approach',
  },
  {
    atc: "CEB456, cleared RNAV runway two four approach",
    pilot: "Cleared RNAV runway two four approach, CEB456",
    isCorrect: true,
    phase: 'approach',
  },
  {
    atc: "UAE789, cleared visual approach runway one three",
    pilot: "Cleared visual approach runway one three, UAE789",
    isCorrect: true,
    phase: 'approach',
  },
  {
    atc: "SIA321, cleared ILS runway zero six, maintain one seven zero knots to the marker",
    pilot: "Cleared ILS zero six, one seven zero knots to the marker, SIA321",
    isCorrect: true,
    phase: 'approach',
  },

  // Speed instructions - correct
  {
    atc: "PAL123, reduce speed to one eight zero knots",
    pilot: "Speed one eight zero knots, PAL123",
    isCorrect: true,
    phase: 'approach',
  },
  {
    atc: "CEB456, maintain two one zero knots",
    pilot: "Maintain two one zero knots, CEB456",
    isCorrect: true,
    phase: 'approach',
  },
  {
    atc: "UAE789, reduce to one six zero knots",
    pilot: "Reducing one six zero knots, UAE789",
    isCorrect: true,
    phase: 'approach',
  },
  {
    atc: "SIA321, no speed restrictions",
    pilot: "No speed restrictions, SIA321",
    isCorrect: true,
    phase: 'approach',
  },

  // Vectors - correct
  {
    atc: "PAL123, turn right heading zero niner zero, vectors for ILS runway zero six",
    pilot: "Right zero niner zero, vectors ILS zero six, PAL123",
    isCorrect: true,
    phase: 'approach',
  },
  {
    atc: "CEB456, turn left heading two four zero, vectors for final",
    pilot: "Left two four zero, vectors for final, CEB456",
    isCorrect: true,
    phase: 'approach',
  },

  // ========================================
  // APPROACH PHASE - INCORRECT EXAMPLES
  // ========================================

  // Incomplete readback
  {
    atc: "PAL789, descend and maintain three thousand",
    pilot: "Roger, PAL789",
    isCorrect: false,
    phase: 'approach',
    errorType: 'incomplete_readback',
    explanation: 'Altitude instructions require full readback in approach phase',
  },
  {
    atc: "CEB101, cleared ILS runway zero six approach",
    pilot: "Roger, CEB101",
    isCorrect: false,
    phase: 'approach',
    errorType: 'incomplete_readback',
    explanation: 'Approach clearances must be read back with approach type and runway',
  },
  {
    atc: "UAE222, reduce speed to one six zero knots",
    pilot: "Wilco, UAE222",
    isCorrect: false,
    phase: 'approach',
    errorType: 'incomplete_readback',
    explanation: 'Speed instructions must be read back with the speed value',
  },

  // Wrong values
  {
    atc: "PAL444, descend and maintain four thousand",
    pilot: "Descend and maintain five thousand, PAL444",
    isCorrect: false,
    phase: 'approach',
    errorType: 'wrong_value',
    explanation: 'Altitude mismatch: instructed 4000, readback 5000',
  },
  {
    atc: "CEB555, cleared ILS runway zero six approach",
    pilot: "Cleared ILS runway two four approach, CEB555",
    isCorrect: false,
    phase: 'approach',
    errorType: 'wrong_value',
    explanation: 'Wrong runway in approach clearance readback',
  },
  {
    atc: "UAE666, reduce speed to one eight zero knots",
    pilot: "Speed one six zero knots, UAE666",
    isCorrect: false,
    phase: 'approach',
    errorType: 'wrong_value',
    explanation: 'Speed mismatch: instructed 180, readback 160',
  },
  {
    atc: "SIA777, altimeter two niner niner two",
    pilot: "Altimeter two niner two niner, SIA777",
    isCorrect: false,
    phase: 'approach',
    errorType: 'transposition',
    explanation: 'Altimeter setting transposition: 2992 vs 2929',
  },

  // Missing elements
  {
    atc: "PAL888, descend and maintain three thousand, altimeter three zero one zero",
    pilot: "Descend three thousand, PAL888",
    isCorrect: false,
    phase: 'approach',
    errorType: 'missing_element',
    explanation: 'Missing altimeter setting in readback',
  },
  {
    atc: "CEB999, cross LUBANG at or below one zero thousand, then descend and maintain six thousand",
    pilot: "Descend six thousand, CEB999",
    isCorrect: false,
    phase: 'approach',
    errorType: 'missing_element',
    explanation: 'Missing crossing restriction in readback',
  },

  // ========================================
  // GROUND PHASE - CORRECT EXAMPLES
  // ========================================

  // Taxi instructions - correct
  {
    atc: "PAL123, taxi to runway zero six via alpha, bravo",
    pilot: "Taxi runway zero six via alpha, bravo, PAL123",
    isCorrect: true,
    phase: 'ground',
  },
  {
    atc: "CEB456, taxi to gate two five via charlie, delta",
    pilot: "Taxi gate two five via charlie, delta, CEB456",
    isCorrect: true,
    phase: 'ground',
  },
  {
    atc: "UAE789, hold short of runway zero six",
    pilot: "Hold short runway zero six, UAE789",
    isCorrect: true,
    phase: 'ground',
  },
  {
    atc: "SIA321, cross runway two four",
    pilot: "Cross runway two four, SIA321",
    isCorrect: true,
    phase: 'ground',
  },

  // Line up and wait - correct
  {
    atc: "PAL123, runway zero six, line up and wait",
    pilot: "Line up and wait runway zero six, PAL123",
    isCorrect: true,
    phase: 'ground',
  },
  {
    atc: "CEB456, runway two four, line up and wait, traffic on short final",
    pilot: "Line up and wait runway two four, traffic in sight, CEB456",
    isCorrect: true,
    phase: 'ground',
  },

  // Takeoff clearance - correct
  {
    atc: "PAL123, runway zero six, cleared for takeoff, wind zero four zero at one zero",
    pilot: "Cleared for takeoff runway zero six, PAL123",
    isCorrect: true,
    phase: 'ground',
  },
  {
    atc: "CEB456, runway two four, cleared for takeoff",
    pilot: "Cleared for takeoff runway two four, CEB456",
    isCorrect: true,
    phase: 'ground',
  },
  {
    atc: "UAE789, runway zero six right, cleared for takeoff",
    pilot: "Cleared takeoff zero six right, UAE789",
    isCorrect: true,
    phase: 'ground',
  },

  // Landing clearance - correct
  {
    atc: "PAL123, runway zero six, cleared to land",
    pilot: "Cleared to land runway zero six, PAL123",
    isCorrect: true,
    phase: 'ground',
  },
  {
    atc: "CEB456, runway two four, cleared to land, wind two one zero at one five",
    pilot: "Cleared to land runway two four, CEB456",
    isCorrect: true,
    phase: 'ground',
  },

  // ========================================
  // GROUND PHASE - INCORRECT EXAMPLES
  // ========================================

  // Critical - confused line up with takeoff
  {
    atc: "PAL789, runway zero six, line up and wait",
    pilot: "Cleared for takeoff runway zero six, PAL789",
    isCorrect: false,
    phase: 'ground',
    errorType: 'parameter_confusion',
    explanation: 'CRITICAL: Confused line up and wait with takeoff clearance - potential runway incursion',
  },

  // Incomplete hold short
  {
    atc: "CEB101, hold short of runway zero six",
    pilot: "Roger, CEB101",
    isCorrect: false,
    phase: 'ground',
    errorType: 'incomplete_readback',
    explanation: 'CRITICAL: Hold short instructions must be read back completely',
  },

  // Wrong runway
  {
    atc: "UAE222, runway zero six, cleared for takeoff",
    pilot: "Cleared for takeoff runway two four, UAE222",
    isCorrect: false,
    phase: 'ground',
    errorType: 'wrong_value',
    explanation: 'CRITICAL: Wrong runway in takeoff clearance readback',
  },
  {
    atc: "SIA333, runway two four, cleared to land",
    pilot: "Cleared to land runway zero six, SIA333",
    isCorrect: false,
    phase: 'ground',
    errorType: 'wrong_value',
    explanation: 'CRITICAL: Wrong runway in landing clearance readback',
  },

  // Missing runway
  {
    atc: "PAL444, runway zero six, cleared for takeoff",
    pilot: "Cleared for takeoff, PAL444",
    isCorrect: false,
    phase: 'ground',
    errorType: 'missing_element',
    explanation: 'Missing runway in takeoff clearance readback',
  },

  // ========================================
  // GO-AROUND / MISSED APPROACH
  // ========================================

  // Correct
  {
    atc: "PAL123, go around, climb and maintain three thousand",
    pilot: "Going around, climb three thousand, PAL123",
    isCorrect: true,
    phase: 'approach',
  },
  {
    atc: "CEB456, go around, fly runway heading, climb and maintain four thousand",
    pilot: "Going around, runway heading, climbing four thousand, CEB456",
    isCorrect: true,
    phase: 'approach',
  },

  // Incorrect
  {
    atc: "UAE789, go around",
    pilot: "Roger, UAE789",
    isCorrect: false,
    phase: 'approach',
    errorType: 'incomplete_readback',
    explanation: 'CRITICAL: Go around instruction must be acknowledged with "going around"',
  },

  // ========================================
  // EMERGENCY / SPECIAL SITUATIONS
  // ========================================

  {
    atc: "PAL123, I have your emergency, cleared direct NINOY, descend and maintain three thousand",
    pilot: "Direct NINOY, descending three thousand, PAL123",
    isCorrect: true,
    phase: 'approach',
  },
  {
    atc: "CEB456, squawk seven seven zero zero",
    pilot: "Squawking seven seven zero zero, CEB456",
    isCorrect: true,
    phase: 'departure',
  },

  // ========================================
  // ADDITIONAL SCENARIOS
  // ========================================

  // Expedite
  {
    atc: "PAL123, expedite climb through flight level two four zero, traffic twelve o'clock, opposite direction",
    pilot: "Expedite climb through flight level two four zero, traffic in sight, PAL123",
    isCorrect: true,
    phase: 'departure',
  },
  {
    atc: "CEB456, expedite descent, traffic twelve o'clock, same direction, one thousand feet below",
    pilot: "Roger, expediting, CEB456",
    isCorrect: false,
    phase: 'approach',
    errorType: 'incomplete_readback',
    explanation: 'Expedite with altitude should be read back',
  },

  // Direct routing
  {
    atc: "PAL123, proceed direct BOREG",
    pilot: "Direct BOREG, PAL123",
    isCorrect: true,
    phase: 'departure',
  },
  {
    atc: "CEB456, when able, proceed direct LUBANG",
    pilot: "When able, direct LUBANG, CEB456",
    isCorrect: true,
    phase: 'approach',
  },

  // Holding
  {
    atc: "PAL123, hold at AKLAN as published, expect approach clearance at one five three zero",
    pilot: "Hold at AKLAN as published, expect approach one five three zero, PAL123",
    isCorrect: true,
    phase: 'approach',
  },

  // Complex multi-element instructions
  {
    atc: "CEB456, descend and maintain flight level one two zero, reduce speed to two eight zero knots, turn left heading two one zero",
    pilot: "Descend flight level one two zero, speed two eight zero, left two one zero, CEB456",
    isCorrect: true,
    phase: 'approach',
  },
  {
    atc: "PAL789, turn right heading zero six zero, descend and maintain seven thousand, contact approach one two one decimal three",
    pilot: "Right zero six zero, descending seven thousand, approach one two one three, PAL789",
    isCorrect: true,
    phase: 'approach',
  },

  // STAR/SID instructions
  {
    atc: "PAL123, cleared BOREG1A departure, runway zero six, climb and maintain five thousand, expect flight level three five zero ten minutes after departure",
    pilot: "BOREG1A departure, runway zero six, climb five thousand, expect flight level three five zero ten minutes after departure, PAL123",
    isCorrect: true,
    phase: 'departure',
  },
  {
    atc: "CEB456, descend via the AKLAN1A arrival",
    pilot: "Descend via AKLAN1A, CEB456",
    isCorrect: true,
    phase: 'approach',
  },

  // Weather deviations
  {
    atc: "PAL123, deviation approved, proceed direct BOREG when able",
    pilot: "Deviation approved, direct BOREG when able, PAL123",
    isCorrect: true,
    phase: 'departure',
  },
  {
    atc: "CEB456, deviation left of course approved, advise when ready to proceed on course",
    pilot: "Deviation left approved, will advise, CEB456",
    isCorrect: true,
    phase: 'approach',
  },

  // More transposition errors
  {
    atc: "PAL123, climb and maintain flight level three one zero",
    pilot: "Climb flight level one three zero, PAL123",
    isCorrect: false,
    phase: 'departure',
    errorType: 'transposition',
    explanation: 'Flight level transposition: FL310 vs FL130',
  },
  {
    atc: "CEB456, contact approach one two three decimal four",
    pilot: "Approach one three two decimal four, CEB456",
    isCorrect: false,
    phase: 'approach',
    errorType: 'transposition',
    explanation: 'Frequency transposition: 123.4 vs 132.4',
  },
  {
    atc: "UAE789, turn right heading one seven zero",
    pilot: "Right heading one zero seven, UAE789",
    isCorrect: false,
    phase: 'approach',
    errorType: 'transposition',
    explanation: 'Heading transposition: 170 vs 107',
  },

  // ============================================================================
  // CONDITIONAL CLEARANCES - WHEN/UNTIL/AFTER/ONCE
  // Source: ICAO Doc 4444, FAA 7110.65, EUROCONTROL, IVAO, VATSIM
  // ============================================================================

  // CORRECT - Condition properly read back
  {
    atc: "PAL123, when passing flight level two five zero descend flight level one eight zero",
    pilot: "When passing flight level two five zero descend flight level one eight zero, PAL123",
    isCorrect: true,
    phase: 'descent',
    errorType: null,
    explanation: 'Conditional phrase correctly read back',
  },
  {
    atc: "CEB456, after LUBOG turn right heading zero niner zero",
    pilot: "After LUBOG right heading zero niner zero, CEB456",
    isCorrect: true,
    phase: 'approach',
    errorType: null,
    explanation: 'After condition correctly read back',
  },
  {
    atc: "PAL789, maintain three thousand until established on the localizer",
    pilot: "Maintain three thousand until established, PAL789",
    isCorrect: true,
    phase: 'approach',
    errorType: null,
    explanation: 'Until condition correctly read back',
  },

  // ERROR - Condition omitted
  {
    atc: "PAL123, when passing flight level two five zero descend flight level one eight zero",
    pilot: "Descend flight level one eight zero, PAL123",
    isCorrect: false,
    phase: 'descent',
    errorType: 'condition_omitted',
    explanation: 'Conditional phrase "when passing FL250" not read back - pilot may execute immediately',
  },
  {
    atc: "CEB456, after passing TONDO climb flight level three two zero",
    pilot: "Climb flight level three two zero, CEB456",
    isCorrect: false,
    phase: 'climb',
    errorType: 'condition_omitted',
    explanation: 'Condition "after passing TONDO" omitted - timing unclear to controller',
  },
  {
    atc: "PAL789, maintain three thousand until established on the localizer",
    pilot: "Maintain three thousand, PAL789",
    isCorrect: false,
    phase: 'approach',
    errorType: 'condition_omitted',
    explanation: 'Until condition omitted - pilot may descend before being established',
  },
  {
    atc: "UAE321, once airborne turn left direct BOREG",
    pilot: "Left direct BOREG, UAE321",
    isCorrect: false,
    phase: 'departure',
    errorType: 'condition_omitted',
    explanation: 'Condition "once airborne" not read back',
  },

  // ERROR - Condition violated (adding "now" to conditional instruction)
  {
    atc: "PAL123, when passing flight level two five zero descend flight level one eight zero",
    pilot: "Descending flight level one eight zero now, PAL123",
    isCorrect: false,
    phase: 'descent',
    errorType: 'condition_violated',
    explanation: 'Pilot added "now" to conditional instruction - may cause premature execution',
  },
  {
    atc: "CEB456, after LUBOG turn right heading zero niner zero",
    pilot: "Right heading zero niner zero immediately, CEB456",
    isCorrect: false,
    phase: 'approach',
    errorType: 'condition_violated',
    explanation: 'Pilot added "immediately" contradicting the conditional timing',
  },
  {
    atc: "PAL789, once established on localizer descend to two thousand five hundred",
    pilot: "Descending two thousand five hundred now, PAL789",
    isCorrect: false,
    phase: 'approach',
    errorType: 'condition_violated',
    explanation: 'Pilot executing immediately instead of waiting for establishment',
  },

  // ============================================================================
  // ALTITUDE CONSTRAINTS - AT OR ABOVE/BELOW
  // ============================================================================

  // CORRECT - Constraint properly read back
  {
    atc: "PAL123, cross LUBOG at or above eight thousand",
    pilot: "Cross LUBOG at or above eight thousand, PAL123",
    isCorrect: true,
    phase: 'descent',
    errorType: null,
    explanation: 'Altitude constraint correctly read back',
  },
  {
    atc: "CEB456, cross IPUMY at or below flight level one eight zero",
    pilot: "Cross IPUMY at or below flight level one eight zero, CEB456",
    isCorrect: true,
    phase: 'descent',
    errorType: null,
    explanation: 'At or below constraint correctly read back',
  },

  // ERROR - Constraint missing
  {
    atc: "PAL123, cross LUBOG at or above eight thousand",
    pilot: "Cross LUBOG eight thousand, PAL123",
    isCorrect: false,
    phase: 'descent',
    errorType: 'constraint_missing',
    explanation: 'Constraint "at or above" omitted - pilot may cross below required altitude',
  },
  {
    atc: "CEB456, cross IPUMY at or below flight level one eight zero",
    pilot: "Cross IPUMY flight level one eight zero, CEB456",
    isCorrect: false,
    phase: 'descent',
    errorType: 'constraint_missing',
    explanation: 'Constraint "at or below" omitted - critical restriction not acknowledged',
  },
  {
    atc: "UAE789, descend five thousand cross TONDO at or above seven thousand",
    pilot: "Descend five thousand cross TONDO seven thousand, UAE789",
    isCorrect: false,
    phase: 'descent',
    errorType: 'constraint_missing',
    explanation: 'Crossing constraint not read back - restriction may be violated',
  },

  // ============================================================================
  // ROGER/WILCO SUBSTITUTION FOR SAFETY-CRITICAL ITEMS
  // ============================================================================

  // ERROR - Roger substitution on safety-critical items
  {
    atc: "PAL123, cleared for takeoff runway two four",
    pilot: "Roger, PAL123",
    isCorrect: false,
    phase: 'takeoff',
    errorType: 'roger_substitution',
    explanation: 'Roger cannot substitute for takeoff clearance readback - full readback required',
  },
  {
    atc: "CEB456, cleared to land runway zero six",
    pilot: "Wilco, CEB456",
    isCorrect: false,
    phase: 'landing',
    errorType: 'roger_substitution',
    explanation: 'Wilco cannot substitute for landing clearance readback',
  },
  {
    atc: "PAL789, line up and wait runway two four",
    pilot: "Copy, PAL789",
    isCorrect: false,
    phase: 'ground',
    errorType: 'roger_substitution',
    explanation: 'Line up and wait requires full readback for safety verification',
  },
  {
    atc: "UAE321, hold short of runway two four",
    pilot: "Roger, UAE321",
    isCorrect: false,
    phase: 'ground',
    errorType: 'roger_substitution',
    explanation: 'Hold short instruction requires runway readback to prevent incursions',
  },
  {
    atc: "SIA456, climb and maintain flight level three five zero",
    pilot: "Wilco, SIA456",
    isCorrect: false,
    phase: 'climb',
    errorType: 'roger_substitution',
    explanation: 'Altitude assignments require full readback for verification',
  },

  // ============================================================================
  // HOLDING PATTERN CLEARANCES
  // ============================================================================

  // CORRECT
  {
    atc: "PAL123, hold at LUBOG as published expect further clearance at one five three zero",
    pilot: "Hold LUBOG as published expect further clearance one five three zero, PAL123",
    isCorrect: true,
    phase: 'cruise',
    errorType: null,
    explanation: 'Holding clearance correctly read back',
  },
  {
    atc: "CEB456, hold south of TONDO left turns one minute legs maintain flight level one eight zero",
    pilot: "Hold south TONDO left turns one minute legs flight level one eight zero, CEB456",
    isCorrect: true,
    phase: 'cruise',
    errorType: null,
    explanation: 'Complex holding clearance correctly read back',
  },

  // ERROR - Holding elements missing
  {
    atc: "PAL123, hold at LUBOG as published expect further clearance at one five three zero",
    pilot: "Hold LUBOG, PAL123",
    isCorrect: false,
    phase: 'cruise',
    errorType: 'missing_element',
    explanation: 'Expected further clearance time not read back',
  },
  {
    atc: "CEB456, hold south of TONDO left turns one minute legs",
    pilot: "Hold TONDO two minute legs, CEB456",
    isCorrect: false,
    phase: 'cruise',
    errorType: 'wrong_value',
    explanation: 'Leg time mismatch: one minute vs two minutes',
  },

  // ============================================================================
  // COMPLEX MULTI-PART INSTRUCTIONS
  // ============================================================================

  // CORRECT
  {
    atc: "PAL123, turn left heading two seven zero descend and maintain four thousand reduce speed one eight zero knots",
    pilot: "Left two seven zero descend four thousand speed one eight zero, PAL123",
    isCorrect: true,
    phase: 'approach',
    errorType: null,
    explanation: 'All three parts correctly read back',
  },

  // ERROR - Missing parts
  {
    atc: "PAL123, turn left heading two seven zero descend and maintain four thousand reduce speed one eight zero knots",
    pilot: "Left two seven zero four thousand, PAL123",
    isCorrect: false,
    phase: 'approach',
    errorType: 'missing_element',
    explanation: 'Speed instruction not read back',
  },

  // ============================================================================
  // APPROACH CLEARANCES WITH RESTRICTIONS
  // ============================================================================

  // CORRECT
  {
    atc: "PAL123, cleared ILS approach runway two four maintain three thousand until established",
    pilot: "Cleared ILS runway two four three thousand until established, PAL123",
    isCorrect: true,
    phase: 'approach',
    errorType: null,
    explanation: 'Approach clearance with altitude restriction correctly read back',
  },

  // ERROR
  {
    atc: "PAL123, cleared ILS approach runway two four maintain three thousand until established",
    pilot: "Cleared ILS runway two four, PAL123",
    isCorrect: false,
    phase: 'approach',
    errorType: 'condition_omitted',
    explanation: 'Altitude and establishment condition not read back',
  },

  // ============================================================================
  // FREQUENCY CHANGES WITH CONDITIONS
  // ============================================================================

  {
    atc: "PAL123, when passing flight level two eight zero contact manila control one two eight decimal six",
    pilot: "Contact manila control one two eight decimal six, PAL123",
    isCorrect: false,
    phase: 'climb',
    errorType: 'condition_omitted',
    explanation: 'Condition for frequency change not read back - may contact too early',
  },
  {
    atc: "CEB456, upon reaching flight level three five zero contact cebu center one three two decimal one",
    pilot: "Upon reaching flight level three five zero contact cebu center one three two decimal one, CEB456",
    isCorrect: true,
    phase: 'climb',
    errorType: null,
    explanation: 'Conditional frequency change correctly read back',
  },

  // ============================================================================
  // GO-AROUND INSTRUCTIONS
  // ============================================================================

  {
    atc: "PAL123, go around climb and maintain three thousand turn right heading zero niner zero",
    pilot: "Going around climb three thousand right zero niner zero, PAL123",
    isCorrect: true,
    phase: 'go_around',
    errorType: null,
    explanation: 'Go-around with multiple elements correctly read back',
  },
  {
    atc: "CEB456, go around fly runway heading climb four thousand",
    pilot: "Roger going around, CEB456",
    isCorrect: false,
    phase: 'go_around',
    errorType: 'roger_substitution',
    explanation: 'Go-around altitude and heading not read back',
  },

  // ============================================================================
  // EXPEDITE/IMMEDIATE INSTRUCTIONS (legitimate "now" usage)
  // ============================================================================

  {
    atc: "PAL123, immediately turn left heading two seven zero traffic alert",
    pilot: "Immediately left two seven zero, PAL123",
    isCorrect: true,
    phase: 'cruise',
    errorType: null,
    explanation: 'Immediate instruction correctly acknowledged',
  },
  {
    atc: "CEB456, expedite climb flight level three niner zero traffic",
    pilot: "Expedite climb flight level three niner zero, CEB456",
    isCorrect: true,
    phase: 'climb',
    errorType: null,
    explanation: 'Expedite instruction correctly read back',
  },

  // ============================================================================
  // EDGE CASES - CONFUSABLE NUMBERS
  // These test the system's ability to detect similar-sounding number errors
  // ============================================================================

  // 15 vs 50 confusion
  {
    atc: "PAL123, climb and maintain one five thousand",
    pilot: "Climb five zero thousand, PAL123",
    isCorrect: false,
    phase: 'climb',
    errorType: 'wrong_value',
    explanation: 'Confused 15000 with 50000 - similar sound in radio',
  },
  {
    atc: "CEB456, reduce speed one five zero knots",
    pilot: "Speed five zero knots, CEB456",
    isCorrect: false,
    phase: 'approach',
    errorType: 'wrong_value',
    explanation: 'Confused 150 with 50 - dropped leading digit',
  },

  // Flight level similar sounds
  {
    atc: "PAL789, descend flight level one three zero",
    pilot: "Descend flight level three one zero, PAL789",
    isCorrect: false,
    phase: 'descent',
    errorType: 'transposition',
    explanation: 'FL130 vs FL310 - digit transposition with major altitude difference',
  },
  {
    atc: "UAE321, climb flight level one eight zero",
    pilot: "Climb flight level one zero eight, UAE321",
    isCorrect: false,
    phase: 'climb',
    errorType: 'transposition',
    explanation: 'FL180 vs FL108 - transposition creating invalid flight level',
  },

  // Heading similar sounds
  {
    atc: "SIA456, turn right heading one seven zero",
    pilot: "Right heading seven one zero, SIA456",
    isCorrect: false,
    phase: 'cruise',
    errorType: 'wrong_value',
    explanation: 'Heading 170 vs 710 - 710 is invalid heading but pilot may have said "seven ten"',
  },
  {
    atc: "PAL111, fly heading zero niner zero",
    pilot: "Heading niner zero, PAL111",
    isCorrect: false,
    phase: 'departure',
    errorType: 'wrong_value',
    explanation: 'Missing leading zero - 090 vs 90 creates ambiguity',
  },

  // ============================================================================
  // EDGE CASES - EQUIVALENT PHRASES (should be CORRECT)
  // These test that valid abbreviations are NOT flagged as errors
  // ============================================================================

  {
    atc: "PAL123, climb and maintain flight level three five zero",
    pilot: "Climbing FL350, PAL123",
    isCorrect: true,
    phase: 'climb',
    errorType: null,
    explanation: '"Climbing FL350" is valid abbreviation of full instruction',
  },
  {
    atc: "CEB456, descend and maintain eight thousand feet",
    pilot: "Descend eight thousand, CEB456",
    isCorrect: true,
    phase: 'descent',
    errorType: null,
    explanation: 'Omitting "feet" is acceptable - altitude value is clear',
  },
  {
    atc: "PAL789, turn right heading two seven zero degrees",
    pilot: "Right two seven zero, PAL789",
    isCorrect: true,
    phase: 'cruise',
    errorType: null,
    explanation: 'Omitting "heading" and "degrees" acceptable when direction included',
  },
  {
    atc: "UAE321, reduce speed to one eight zero knots",
    pilot: "One eight zero kts, UAE321",
    isCorrect: true,
    phase: 'approach',
    errorType: null,
    explanation: '"kts" is acceptable abbreviation for "knots"',
  },

  // ============================================================================
  // EDGE CASES - CALLSIGN VARIATIONS
  // ============================================================================

  {
    atc: "Philippine Airlines one two three, climb and maintain flight level three five zero",
    pilot: "Climb FL350, PAL123",
    isCorrect: true,
    phase: 'climb',
    errorType: null,
    explanation: 'Callsign abbreviation (PAL123) is standard and acceptable',
  },
  {
    atc: "PAL123, contact Manila Approach one two one decimal three",
    pilot: "Approach one two one three, one two three",
    isCorrect: true,
    phase: 'cruise',
    errorType: null,
    explanation: 'Using flight number only (one two three) for callsign is acceptable',
  },

  // ============================================================================
  // EDGE CASES - PARTIAL READBACKS
  // Testing boundary between acceptable partial and incomplete readback
  // ============================================================================

  {
    atc: "PAL123, descend and maintain seven thousand, reduce speed one six zero",
    pilot: "Seven thousand, one six zero, PAL123",
    isCorrect: true,
    phase: 'approach',
    errorType: null,
    explanation: 'Key values read back correctly even without action words',
  },
  {
    atc: "CEB456, turn left heading two four zero, descend four thousand",
    pilot: "Left two four zero, PAL456",
    isCorrect: false,
    phase: 'approach',
    errorType: 'missing_element',
    explanation: 'Altitude not read back - second critical element missing',
  },

  // ============================================================================
  // EDGE CASES - RUNWAY DESIGNATOR CRITICAL
  // ============================================================================

  {
    atc: "PAL123, runway zero six left, cleared for takeoff",
    pilot: "Cleared takeoff zero six, PAL123",
    isCorrect: false,
    phase: 'takeoff',
    errorType: 'missing_designator',
    explanation: 'Missing "left" designator on parallel runway - CRITICAL',
  },
  {
    atc: "CEB456, hold short of runway two four right",
    pilot: "Hold short two four, CEB456",
    isCorrect: false,
    phase: 'ground',
    errorType: 'missing_designator',
    explanation: 'Missing "right" designator in hold short - runway incursion risk',
  },
  {
    atc: "UAE789, cross runway one three center",
    pilot: "Cross one three, UAE789",
    isCorrect: false,
    phase: 'ground',
    errorType: 'missing_designator',
    explanation: 'Missing "center" designator when crossing parallel runways',
  },

  // ============================================================================
  // EDGE CASES - WORD ORDER VARIATIONS
  // Testing if system correctly handles valid word order changes
  // ============================================================================

  {
    atc: "PAL123, climb flight level three five zero and maintain",
    pilot: "Climb and maintain flight level three five zero, PAL123",
    isCorrect: true,
    phase: 'climb',
    errorType: null,
    explanation: 'Pilot used standard word order - valid readback',
  },
  {
    atc: "CEB456, runway two four line up and wait",
    pilot: "Line up wait two four, CEB456",
    isCorrect: true,
    phase: 'ground',
    errorType: null,
    explanation: 'Runway position variation is acceptable',
  },

  // ============================================================================
  // EDGE CASES - NEAR-MISS VALUES
  // Values very close but critically different
  // ============================================================================

  {
    atc: "PAL123, squawk two four six one",
    pilot: "Squawk two four six two, PAL123",
    isCorrect: false,
    phase: 'departure',
    errorType: 'wrong_value',
    explanation: 'Single digit error in squawk - different aircraft identification',
  },
  {
    atc: "CEB456, contact departure one one niner decimal one",
    pilot: "Departure one one niner decimal two, CEB456",
    isCorrect: false,
    phase: 'departure',
    errorType: 'wrong_value',
    explanation: 'Frequency off by 0.1 MHz - may contact wrong facility',
  },
  {
    atc: "PAL789, altimeter two niner niner three",
    pilot: "Altimeter two niner niner two, PAL789",
    isCorrect: false,
    phase: 'approach',
    errorType: 'wrong_value',
    explanation: 'Altimeter off by 1 millibar - altitude error potential',
  },

  // ============================================================================
  // ICAO PHONETIC CORRECT USAGE (should NOT be flagged)
  // ============================================================================

  {
    atc: "PAL123, climb and maintain niner thousand",
    pilot: "Climb niner thousand, PAL123",
    isCorrect: true,
    phase: 'climb',
    errorType: null,
    explanation: '"Niner" is correct ICAO pronunciation - not an error',
  },
  {
    atc: "CEB456, turn left heading tree six zero",
    pilot: "Left tree six zero, CEB456",
    isCorrect: true,
    phase: 'departure',
    errorType: null,
    explanation: '"Tree" is correct ICAO pronunciation for 3 - not an error',
  },
  {
    atc: "PAL789, reduce speed to one fife zero knots",
    pilot: "Speed one fife zero, PAL789",
    isCorrect: true,
    phase: 'approach',
    errorType: null,
    explanation: '"Fife" is correct ICAO pronunciation for 5 - not an error',
  },
  {
    atc: "UAE321, squawk fower seven two one",
    pilot: "Squawk fower seven two one, UAE321",
    isCorrect: true,
    phase: 'departure',
    errorType: null,
    explanation: '"Fower" is correct ICAO pronunciation for 4 - not an error',
  },

  // ============================================================================
  // AMBIGUOUS INSTRUCTIONS - CLARIFICATION NEEDED
  // ============================================================================

  {
    atc: "PAL123, maintain",
    pilot: "Say again, PAL123",
    isCorrect: true,
    phase: 'cruise',
    errorType: null,
    explanation: 'Pilot correctly requested clarification for incomplete instruction',
  },
  {
    atc: "CEB456, climb... uh... maintain flight level",
    pilot: "Say again altitude, CEB456",
    isCorrect: true,
    phase: 'climb',
    errorType: null,
    explanation: 'Pilot correctly requested clarification when instruction was unclear',
  },
]

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

// ============================================================================
// TRAINING DATA MANAGEMENT
// ============================================================================

export function addTrainingExample(example: ATCTrainingExample): void {
  DEPARTURE_APPROACH_CORPUS.push(example)
}

export function addTrainingExamples(examples: ATCTrainingExample[]): void {
  DEPARTURE_APPROACH_CORPUS.push(...examples)
}

export function getTrainingCorpus(): ATCTrainingExample[] {
  return [...DEPARTURE_APPROACH_CORPUS]
}

export function clearTrainingCorpus(): void {
  DEPARTURE_APPROACH_CORPUS = []
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
