/**
 * Enhanced Aviation Communication Analysis Engine
 * Analyzes ATC-Pilot dialogues for ICAO compliance and error detection
 * Focused on APP/DEP (Approach/Departure) Control communications
 */

// Consolidated ATC data
import {
  NON_STANDARD_PHRASES,
  NUMBER_PRONUNCIATION_ERRORS,
  READBACK_REQUIREMENTS,
  PHILIPPINE_WAYPOINTS,
  SAFETY_CRITICAL_PATTERNS,
  ENHANCED_CALLSIGNS,
  ENHANCED_SIDS,
  ENHANCED_STARS,
  NON_NATIVE_ERROR_PATTERNS,
  DEPARTURE_APPROACH_CORPUS,
  GND_CORPUS,
  extractCommandsFromText,
  // Dynamic pattern builders — add new airlines/facilities to atcData.ts only
  CALLSIGN_LABEL_RE,
  CALLSIGN_AT_END_RE,
  CALLSIGN_AT_START_RE,
  CALLSIGN_IN_TEXT_RE,
  CALLSIGN_SPOKEN_RE,
  PH_REGISTRATION_RE,
  FACILITY_LABEL_RE,
  ATC_ROLE_LABEL_RE,
  PILOT_ROLE_LABEL_RE,
  type PhraseCorrection,
} from './atcData'

// Semantic readback analyzer
import {
  analyzeReadback as semanticAnalyzeReadback,
} from './semanticReadbackAnalyzer'

// ============================================================================
// TYPES
// ============================================================================

export interface AnalysisInput {
  text: string
  corpusType: 'APP/DEP' | 'GND' | 'RAMP'
}

export interface AnalysisOutput {
  corpusType: string
  totalWords: number
  totalExchanges: number
  nonStandardFreq: number
  clarificationCount: number
  languageErrors: ErrorDetail[]
  numberErrors: ErrorDetail[]
  phraseologyErrors: PhraseologyError[]
  readbackAnalysis: ReadbackAnalysis
  safetyMetrics: SafetyMetrics
  riskLevel: 'low' | 'medium' | 'high'
  summary: AnalysisSummary
  detailedFindings: DetailedFinding[]
  parsedLines: ParsedLine[]
  // Dynamic context information
  contextInfo: ContextInfo
}

export interface ContextInfo {
  flightPhase: string
  phaseDescription: string
  detectedCallsign: string | null
  exchangeAnalysis: ExchangeAnalysisResult[]
  patternWarning: string | null
  escalationLevel: number
  situationalFactors: string[]
}

export interface ExchangeAnalysisResult {
  atcInstruction: string
  pilotResponse: string | null
  instructionType: string
  readbackQuality: 'complete' | 'partial' | 'missing' | 'incorrect'
  contextualWeight: 'low' | 'medium' | 'high' | 'critical'
  issue: string | null
  dynamicFeedback: string
}

export interface ErrorDetail {
  type: string
  count: number
  percentage: number
  examples?: string[]
}

export interface PhraseologyError {
  line: number
  original: string
  issue: string
  suggestion: string
  weight: 'low' | 'medium' | 'high'
  category: 'language' | 'number' | 'procedure' | 'structure' | 'safety'
  safetyImpact?: 'clarity' | 'efficiency' | 'safety'
  // Enhanced descriptive fields
  icaoReference?: string
  explanation?: string
  correctExample?: string
  incorrectPhrase?: string
  whyItMatters?: string
}

export interface ReadbackAnalysis {
  totalInstructions: number
  completeReadbacks: number
  incompleteReadbacks: number
  missingElements: MissingElement[]
  completenessScore: number
}

export interface MissingElement {
  line: number
  instruction: string
  missing: string[]
  weight: 'mandatory' | 'recommended'
}

export interface SafetyMetrics {
  criticalIssues: number
  highWeightIssues: number
  mediumWeightIssues: number
  lowWeightIssues: number
  safetyCriticalPhrases: SafetyCriticalDetection[]
  overallSafetyScore: number
}

export interface SafetyCriticalDetection {
  line: number
  text: string
  type: string
  description: string
}

export interface AnalysisSummary {
  overallCompliance: number
  keyFindings: string[]
  recommendations: string[]
  criticalIssues: string[]
  strengthAreas: string[]
}

export interface DetailedFinding {
  category: string
  description: string
  occurrences: number
  impact: 'safety' | 'efficiency' | 'clarity'
  examples: string[]
}

export interface ParsedLine {
  lineNumber: number
  text: string
  speaker: 'ATC' | 'PILOT' | 'UNKNOWN'
  rawText: string
  /** Conversation group — lines separated by blank lines belong to different groups */
  conversationGroup?: number
}

// ============================================================================
// DYNAMIC CONTEXT TRACKING
// ============================================================================

type FlightPhase = 'ground' | 'departure' | 'enroute' | 'approach' | 'landing' | 'unknown'

interface ConversationContext {
  flightPhase: FlightPhase
  detectedCallsigns: Set<string>
  primaryCallsign: string | null
  pendingInstructions: PendingInstruction[]
  acknowledgedInstructions: AcknowledgedInstruction[]
  currentAltitude: string | null
  clearedAltitude: string | null
  currentHeading: string | null
  assignedHeading: string | null
  assignedSquawk: string | null
  assignedFrequency: string | null
  assignedRunway: string | null
  emergencyDeclared: boolean
  tcasActive: boolean
  exchangePairs: ExchangePair[]
  issueAccumulator: IssueAccumulator
}

interface PendingInstruction {
  lineNumber: number
  type: 'altitude' | 'heading' | 'speed' | 'squawk' | 'frequency' | 'runway' | 'approach' | 'other'
  value: string
  requiresReadback: boolean
  urgency: 'routine' | 'priority' | 'immediate'
}

interface AcknowledgedInstruction {
  instruction: PendingInstruction
  responseLineNumber: number
  readbackComplete: boolean
  readbackAccurate: boolean
}

interface ExchangePair {
  atcLine: ParsedLine
  pilotLine: ParsedLine | null
  instructionType: string
  readbackQuality: 'complete' | 'partial' | 'missing' | 'incorrect'
  responseDelay: number // lines between instruction and response
  contextualWeight: 'low' | 'medium' | 'high' | 'critical'
}

interface IssueAccumulator {
  recentIssues: { line: number; weight: string; timestamp: number }[]
  escalationLevel: number // 0-3, increases with consecutive issues
  patternDetected: string | null
}

// Initialize empty context
function createInitialContext(): ConversationContext {
  return {
    flightPhase: 'unknown',
    detectedCallsigns: new Set(),
    primaryCallsign: null,
    pendingInstructions: [],
    acknowledgedInstructions: [],
    currentAltitude: null,
    clearedAltitude: null,
    currentHeading: null,
    assignedHeading: null,
    assignedSquawk: null,
    assignedFrequency: null,
    assignedRunway: null,
    emergencyDeclared: false,
    tcasActive: false,
    exchangePairs: [],
    issueAccumulator: {
      recentIssues: [],
      escalationLevel: 0,
      patternDetected: null,
    },
  }
}

// Detect flight phase from conversation content
function detectFlightPhase(lines: ParsedLine[]): FlightPhase {
  const fullText = lines.map(l => l.text).join(' ').toLowerCase()

  // Check for specific phase indicators (order matters - more specific first)
  const phaseIndicators: { phase: FlightPhase; patterns: RegExp[] }[] = [
    {
      phase: 'landing',
      patterns: [
        /cleared\s+(to\s+)?land/i,
        /on\s+(short\s+)?final/i,
        /over\s+the\s+threshold/i,
        /touchdown/i,
      ],
    },
    {
      phase: 'approach',
      patterns: [
        /cleared\s+(ils|rnav|vor|visual|ndb)\s+approach/i,
        /vectoring\s+for\s+(final|approach|ils|rnav)/i,
        /expect\s+(ils|rnav|vor|visual)\s+approach/i,
        /intercept\s+(the\s+)?localizer/i,
        /establish(ed)?\s+on\s+(the\s+)?(ils|localizer|glideslope)/i,
        /descend\s+(via|and\s+maintain)/i,
        /contact\s+\w+\s+tower/i,
      ],
    },
    {
      phase: 'departure',
      patterns: [
        /cleared\s+(for\s+)?takeoff/i,
        /line\s+up\s+and\s+wait/i,
        /\w+\s+departure/i, // SID name
        /initial\s+climb/i,
        /passing\s+\d+.*climbing/i,
        /contact\s+\w+\s+departure/i,
        /airborne/i,
      ],
    },
    {
      phase: 'ground',
      patterns: [
        /taxi\s+(to|via)/i,
        /hold\s+short/i,
        /cross\s+runway/i,
        /pushback/i,
        /startup/i,
        /clearance\s+delivery/i,
        /ground\s+control/i,
        /at\s+gate/i,
        /parking/i,
      ],
    },
    {
      phase: 'enroute',
      patterns: [
        /cruise|cruising/i,
        /maintain\s+FL\s*\d{3}/i,
        /direct\s+\w+/i,
        /proceed\s+direct/i,
        /resume\s+own\s+navigation/i,
        /\d+\s+miles?\s+(from|to)/i,
      ],
    },
  ]

  for (const { phase, patterns } of phaseIndicators) {
    if (patterns.some(p => p.test(fullText))) {
      return phase
    }
  }

  return 'unknown'
}

// Extract callsigns from conversation
function extractCallsigns(lines: ParsedLine[]): { callsigns: Set<string>; primary: string | null } {
  const callsigns = new Set<string>()
  const callsignCounts = new Map<string, number>()

  const callsignPatterns = [
    new RegExp(CALLSIGN_IN_TEXT_RE.source, 'gi'), // built from ENHANCED_CALLSIGNS
    /\bRP-?C\d{3,5}\b/gi,
    /\b[A-Z]{3}\s*\d{2,4}\b/g, // Generic 3-letter + numbers
  ]

  for (const line of lines) {
    for (const pattern of callsignPatterns) {
      const matches = line.text.match(pattern)
      if (matches) {
        for (const match of matches) {
          const normalized = match.toUpperCase().replace(/\s+/g, '')
          callsigns.add(normalized)
          callsignCounts.set(normalized, (callsignCounts.get(normalized) || 0) + 1)
        }
      }
    }
  }

  // Primary callsign is the most frequently mentioned
  let primary: string | null = null
  let maxCount = 0
  callsignCounts.forEach((count, callsign) => {
    if (count > maxCount) {
      maxCount = count
      primary = callsign
    }
  })

  return { callsigns, primary }
}

// Build exchange pairs - match ATC instructions with pilot responses
function buildExchangePairs(lines: ParsedLine[], context: ConversationContext): ExchangePair[] {
  const pairs: ExchangePair[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.speaker === 'ATC') {
      // Find instruction type
      const instructionType = detectInstructionType(line.text)

      if (instructionType !== 'information') { // Skip pure information (weather, traffic advisories)
        // Look for pilot response within next 3 lines, but ONLY within the same conversation group
        let pilotResponse: ParsedLine | null = null
        let responseDelay = 0
        const currentGroup = line.conversationGroup

        for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
          // Don't pair across conversation boundaries.
          // Note: undefined === undefined (both unknown-group) → same group → don't break.
          // Any mismatch (number vs undefined, or different numbers) → different group → break.
          if (currentGroup !== lines[j].conversationGroup) {
            break
          }
          // If another non-information ATC instruction appears before a pilot response,
          // this ATC instruction has no readback — the next instruction "owns" the pilot reply.
          // This prevents cross-aircraft false pairings (e.g. PHI655 altitude instruction
          // incorrectly paired with PHI300's frequency readback).
          if (lines[j].speaker === 'ATC' && detectInstructionType(lines[j].text) !== 'information') {
            break
          }
          if (lines[j].speaker === 'PILOT') {
            pilotResponse = lines[j]
            responseDelay = j - i
            break
          }
        }

        // Evaluate readback quality
        const readbackQuality = pilotResponse
          ? evaluateReadbackQuality(line, pilotResponse, instructionType)
          : 'missing'

        // Calculate contextual weight based on phase and instruction type
        const contextualWeight = calculateContextualSeverity(
          instructionType,
          readbackQuality,
          context.flightPhase,
          context.emergencyDeclared
        )

        pairs.push({
          atcLine: line,
          pilotLine: pilotResponse,
          instructionType,
          readbackQuality,
          responseDelay,
          contextualWeight,
        })
      }
    }
  }

  return pairs
}

// Detect what type of instruction an ATC message contains
function detectInstructionType(text: string): string {
  // Normalize spoken numbers before pattern matching so "five thousand" → "5000",
  // "two hundred and ten knots" → "210 knots", "heading zero six zero" → "heading 060"
  const n = normalizeSpelledNumbers(text)

  const instructionPatterns: { type: string; pattern: RegExp }[] = [
    // Altitude instructions - critical
    { type: 'altitude', pattern: /(climb|descend)\s+(and\s+)?maintain/i },
    { type: 'altitude', pattern: /(climb|descend)\s+(to\s+|and\s+maintain\s+)?(flight\s+level|FL|\d)/i },
    // Speed "maintain X knots" must come BEFORE altitude "maintain \d" to prevent
    // "maintain 160 knots" from matching the altitude pattern first.
    { type: 'speed', pattern: /maintain\s+\d+\s*knots/i },

    { type: 'altitude', pattern: /maintain\s+(flight\s+level|FL|\d)/i },
    // "descend to five thousand" with no "maintain": detect via spoken OR numeric altitude word
    { type: 'altitude', pattern: /(climb|descend)\s+.{0,30}(flight\s+level|\d{3,5})/i },

    // Heading instructions - critical
    { type: 'heading', pattern: /turn\s+(left|right)/i },  // direction alone is enough
    { type: 'heading', pattern: /heading\s+\d/i },
    { type: 'heading', pattern: /fly\s+heading\s+\d/i },

    // Speed instructions
    { type: 'speed', pattern: /(reduce|increase)\s+speed\s+(to\s+)?\d/i },
    { type: 'speed', pattern: /maintain\s+(\d+\s*knots|speed)/i },
    { type: 'speed', pattern: /speed\s+\d+\s*knots/i },
    { type: 'speed', pattern: /\d+\s*knots/i },

    // Altimeter - safety critical (must be separate from 'information')
    { type: 'altimeter', pattern: /altimeter\s+\d/i },
    { type: 'altimeter', pattern: /qnh\s+\d/i },

    // Other critical instructions
    { type: 'squawk', pattern: /squawk\s+\d/i },
    // Frequency: "contact Manila Tower on 118" — allow 1-2 word facility name
    { type: 'frequency', pattern: /contact\s+\w+(?:\s+\w+)?\s+(on\s+)?\d/i },
    { type: 'frequency', pattern: /monitor\s+\w+/i },
    // Approach clearance — runway number may appear between type and "approach"
    { type: 'approach', pattern: /cleared\s+(ils|rnav|vor|visual|ndb)\s+(?:runway\s+\S+\s+)?approach/i },
    { type: 'approach', pattern: /cleared\s+(?:for\s+)?(?:the\s+)?(ils|rnav|vor|visual|ndb)\s+approach/i },
    { type: 'takeoff', pattern: /cleared\s+(for\s+)?take\s*off/i },
    { type: 'landing', pattern: /cleared\s+to\s+land/i },
    // GND taxi: "taxi Golf one one, delta" — no "to/via" needed
    { type: 'taxi', pattern: /\btaxi\b/i },
    // Holding — match any form: "hold over", "hold at", "hold short", "holding pattern"
    // Must come AFTER taxi so "taxi … and hold short" doesn't become 'hold'
    { type: 'hold', pattern: /\bhold\b/i },
    { type: 'lineup', pattern: /line\s+up\s+and\s+wait/i },
    { type: 'direct', pattern: /proceed\s+direct|direct\s+(to\s+)?\w+/i },

    // Information only (no readback required)
    { type: 'information', pattern: /traffic\s+\d+\s+o'?clock|weather|wind\s+\d/i },
  ]

  for (const { type, pattern } of instructionPatterns) {
    if (pattern.test(n)) {
      return type
    }
  }

  return 'other'
}

// Helper: Convert spelled-out numbers to digits for comparison.
// Handles both ICAO phonetic individual digits (for headings, QNH, callsigns)
// AND natural-language compound numbers (for altitudes, speeds):
//   "five thousand"          → "5000"
//   "three thousand five hundred" → "3500"
//   "two hundred and ten"    → "210"
//   "two hundred fifty"      → "250"
//   "one one eight"          → "118"   (phonetic digit-by-digit)
//   "flight level two four zero" → "FL 240"
function normalizeSpelledNumbers(text: string): string {
  // Numeric values for all relevant spoken words
  const WORD_TO_NUM: Record<string, number> = {
    zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9,
    niner:9, tree:3, fife:5, fower:4,
    // ICAO Doc 9432 phonetic word variants (wun, too, ait, oh) — needed so compound
    // numbers like "wun tousand" or "ait hundred" resolve correctly via this table.
    wun:1, too:2, ait:8, oh:0,
    ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15,
    sixteen:16, seventeen:17, eighteen:18, nineteen:19,
    twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90,
  }

  // Parse a one-or-two-word number phrase (0-99), e.g. "five"→5, "twenty one"→21, "eighty"→80
  function parseSubHundred(s: string): number {
    const parts = s.trim().toLowerCase().split(/[\s-]+/).filter(Boolean)
    const v0 = WORD_TO_NUM[parts[0]] ?? NaN
    if (parts.length === 1) return isNaN(v0) ? 0 : v0
    const v1 = WORD_TO_NUM[parts[1]] ?? 0
    if (!isNaN(v0) && v0 >= 10 && v0 < 100 && v1 >= 0 && v1 < 10) return v0 + v1
    return 0
  }

  let s = text.toLowerCase()

  // Normalise common corpus typos/phonetic variants before any number conversion.
  s = s.replace(/\btousand\b/gi, 'thousand')   // "eight tousand" → "eight thousand"
  s = s.replace(/\bday[\-\s]?see[\-\s]?mal\b/gi, 'decimal')  // "day-see-mal" → "decimal"
  s = s.replace(/\bdesimal\b/gi, 'decimal')

  // ── Phase A: compound number forms (handled before phonetic digit replacement) ──
  //
  // A1: "X thousand [Y hundred [and Z]]"
  //   "five thousand"            → 5000
  //   "three thousand five hundred" → 3500
  //   "twelve thousand"          → 12000
  const ONES_TENS = '(?:zero|one|two|three|four|five|six|seven|eight|nine|niner|' +
                    'ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|' +
                    'twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)'
  const SUB100   = `(?:(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\\s-]+)?${ONES_TENS}`

  s = s.replace(
    new RegExp(
      `\\b(${SUB100})\\s+thousand` +
      `(?:\\s+(?:and\\s+)?(${ONES_TENS})\\s+hundred(?:\\s+(?:and\\s+)?(${SUB100}))?)?` +
      `(?:\\s+(?:and\\s+)?(${SUB100})(?!\\s+hundred))?\\b`,
      'gi',
    ),
    (_m: string, th: string, hun?: string, afterHun?: string, noHun?: string) => {
      const thV = parseSubHundred(th)
      if (!thV || thV > 999) return _m
      let total = thV * 1000
      if (hun) {
        const hV = parseSubHundred(hun)
        if (hV > 0 && hV <= 9) {
          total += hV * 100
          if (afterHun) total += parseSubHundred(afterHun)
        }
      } else if (noHun) {
        const nV = parseSubHundred(noHun)
        if (nV > 0 && nV < 1000) total += nV
      }
      return String(total)
    },
  )

  // A2: "X hundred [and Y]"
  //   "two hundred"              → 200
  //   "two hundred and ten"      → 210
  //   "two hundred fifty"        → 250
  s = s.replace(
    new RegExp(
      `\\b(zero|one|two|three|four|five|six|seven|eight|nine|niner)\\s+hundred` +
      `(?:\\s+(?:and\\s+)?(${SUB100}))?\\b`,
      'gi',
    ),
    (_m: string, hun: string, rest?: string) => {
      const hV = WORD_TO_NUM[hun.toLowerCase()] ?? 0
      if (!hV || hV > 9) return _m
      let total = hV * 100
      if (rest) {
        const rV = parseSubHundred(rest)
        if (rV > 0 && rV < 100) total += rV
      }
      return String(total)
    },
  )

  // ── Phase B: individual ICAO phonetic digits (headings, QNH, callsigns, squawks) ──
  const PHONETIC: Record<string, string> = {
    zero:'0', one:'1', two:'2', three:'3', four:'4', five:'5',
    six:'6', seven:'7', eight:'8', nine:'9', niner:'9', tree:'3', fife:'5', fower:'4',
  }
  for (const [word, digit] of Object.entries(PHONETIC)) {
    s = s.replace(new RegExp(`\\b${word}\\b`, 'gi'), digit)
  }

  // Collapse spaces between consecutive digits produced by Phase B.
  // Must loop: "1 8 0" → (pass 1) "18 0" → (pass 2) "180".
  let prev: string
  do {
    prev = s
    s = s.replace(/(\d)\s+(\d)/g, '$1$2')
  } while (s !== prev)
  return s
}

// Helper: Extract altitude value (handles both digits and spelled-out)
function extractAltitude(text: string): string | null {
  const normalized = normalizeSpelledNumbers(text)

  // Flight level
  const flMatch = normalized.match(/flight\s*level\s*(\d{2,3})/i) ||
                  normalized.match(/FL\s*(\d{2,3})/i)
  if (flMatch) return flMatch[1]

  // Altitude anchored to an instruction verb — prevents callsign digits like
  // "1809" (from "Philippine one eighty niner") from being grabbed instead of
  // the actual cleared altitude ("5000", "3000", etc.).
  const verbMatch = normalized.match(
    /(?:climb|descend|maintain|to|at)\s+(?:and\s+maintain\s+)?(\d{3,5})\b/i
  )
  if (verbMatch) return verbMatch[1]

  // Altitude with explicit "feet" or "ft" unit — still safe (callsign has no unit)
  const feetMatch = normalized.match(/(\d{3,5})\s*(?:feet|ft)\b/i)
  if (feetMatch) return feetMatch[1]

  return null
}

// Helper: Extract heading value (handles both digits and spelled-out)
function extractHeading(text: string): string | null {
  const normalized = normalizeSpelledNumbers(text)
  // Match "heading XXX" or "turn left/right heading XXX" or just "heading" followed by numbers
  const match = normalized.match(/heading\s*(\d{1,3})/i) ||
                normalized.match(/turn\s+(?:left|right)\s+(?:heading\s+)?(\d{1,3})/i)
  return match ? match[1].padStart(3, '0') : null
}

// Helper: Extract speed value (handles both digits and spelled-out)
function extractSpeed(text: string): string | null {
  const normalized = normalizeSpelledNumbers(text)
  // Match "speed XXX knots" or "reduce/increase speed to XXX" or just "XXX knots"
  const match = normalized.match(/speed\s*(?:to\s+)?(\d{2,3})\s*(?:knots)?/i) ||
                normalized.match(/(\d{2,3})\s*knots/i) ||
                normalized.match(/(?:reduce|increase|maintain)\s+(?:speed\s+)?(?:to\s+)?(\d{2,3})/i)
  return match ? match[1] : null
}

// Helper: Extract altimeter setting (handles QNH format)
function extractAltimeter(text: string): string | null {
  const normalized = normalizeSpelledNumbers(text)
  // Match "altimeter XXXX" or "QNH XXXX"
  const match = normalized.match(/(?:altimeter|qnh)\s*(\d{4})/i)
  return match ? match[1] : null
}

// Helper: Detect parameter confusion (e.g., pilot reads heading as altitude)
interface ParameterConfusion {
  detected: boolean
  atcParameter: string
  pilotParameter: string
  atcValue: string
  pilotValue: string
}

function detectParameterConfusion(atcText: string, pilotText: string): ParameterConfusion | null {
  const atcNorm = normalizeSpelledNumbers(atcText.toLowerCase())
  const pilotNorm = normalizeSpelledNumbers(pilotText.toLowerCase())

  // Case: ATC gave heading, pilot read back as altitude/flight level
  if (/heading\s*\d{1,3}/i.test(atcNorm) || /turn\s+(?:left|right)/i.test(atcNorm)) {
    if (/flight\s*level|climb|descend|altitude/i.test(pilotNorm)) {
      const atcHeading = extractHeading(atcNorm)
      const pilotAlt = extractAltitude(pilotNorm)
      if (atcHeading && pilotAlt && atcHeading === pilotAlt.slice(-3).padStart(3, '0')) {
        return {
          detected: true,
          atcParameter: 'heading',
          pilotParameter: 'altitude/flight level',
          atcValue: atcHeading,
          pilotValue: pilotAlt
        }
      }
    }
  }

  // Case: ATC gave altitude, pilot read back as heading
  if (/(?:climb|descend)\s+(?:and\s+)?maintain|flight\s*level/i.test(atcNorm)) {
    if (/heading/i.test(pilotNorm) && !/(?:climb|descend|maintain|altitude|flight\s*level)/i.test(pilotNorm)) {
      const atcAlt = extractAltitude(atcNorm)
      const pilotHeading = extractHeading(pilotNorm)
      if (atcAlt && pilotHeading) {
        return {
          detected: true,
          atcParameter: 'altitude',
          pilotParameter: 'heading',
          atcValue: atcAlt,
          pilotValue: pilotHeading
        }
      }
    }
  }

  // Case: ATC gave speed, pilot read back as altitude
  if (/(?:reduce|increase|maintain)\s+speed|speed\s+\d|knots/i.test(atcNorm)) {
    if (/flight\s*level|climb|descend|altitude/i.test(pilotNorm) && !/speed|knots/i.test(pilotNorm)) {
      const atcSpeed = extractSpeed(atcNorm)
      const pilotAlt = extractAltitude(pilotNorm)
      if (atcSpeed && pilotAlt) {
        return {
          detected: true,
          atcParameter: 'speed',
          pilotParameter: 'altitude',
          atcValue: atcSpeed,
          pilotValue: pilotAlt
        }
      }
    }
  }

  return null
}

// Extended readback analysis result with detailed mismatch info
interface ReadbackAnalysisDetail {
  quality: 'complete' | 'partial' | 'missing' | 'incorrect'
  mismatchDetails?: {
    type: 'wrong_value' | 'missing_element' | 'parameter_confusion' | 'incomplete'
    parameter: string
    atcValue: string | null
    pilotValue: string | null
    expectedPhrase: string
    actualPhrase: string
  }[]
}

// Helper: Map semantic error types to internal types
function mapSemanticErrorType(semanticType: string): 'wrong_value' | 'missing_element' | 'parameter_confusion' | 'incomplete' {
  switch (semanticType) {
    case 'wrong_value':
    case 'transposition':
    case 'hearback_error':
      return 'wrong_value'
    case 'missing_element':
      return 'missing_element'
    case 'parameter_confusion':
      return 'parameter_confusion'
    case 'incomplete_readback':
    case 'extra_element':
    default:
      return 'incomplete'
  }
}

// Evaluate how well a pilot read back an instruction - ENHANCED VERSION
function evaluateReadbackQuality(
  atcLine: ParsedLine,
  pilotLine: ParsedLine,
  instructionType: string
): 'complete' | 'partial' | 'missing' | 'incorrect' {
  const result = evaluateReadbackQualityDetailed(atcLine, pilotLine, instructionType)
  return result.quality
}

// Detailed version that returns mismatch information
// ENHANCED: Now uses semantic analysis for dynamic understanding
function evaluateReadbackQualityDetailed(
  atcLine: ParsedLine,
  pilotLine: ParsedLine,
  instructionType: string
): ReadbackAnalysisDetail {
  const atcText = atcLine.text.toLowerCase()
  const pilotText = pilotLine.text.toLowerCase()
  const mismatchDetails: ReadbackAnalysisDetail['mismatchDetails'] = []

  // ==========================================================================
  // NEW: Use semantic analyzer for comprehensive analysis
  // ==========================================================================
  const semanticResult = semanticAnalyzeReadback(atcLine.text, pilotLine.text)

  // If semantic says correct with no errors, trust it and return immediately.
  // Do NOT run the fallback — it uses unanchored extractAltitude which can
  // mistake callsign digits (e.g. "Philippine one eighty niner" → 1809) for
  // an altitude value, producing false mismatches on correct exchanges.
  if (semanticResult.isCorrect) {
    return { quality: 'complete', mismatchDetails: [] }
  }

  // If semantic found errors, surface them and skip the fallback.
  if (semanticResult.errors.length > 0) {
    for (const error of semanticResult.errors) {
      mismatchDetails.push({
        type: mapSemanticErrorType(error.type),
        parameter: error.parameter,
        atcValue: error.expectedValue,
        pilotValue: error.actualValue,
        expectedPhrase: semanticResult.expectedResponse,
        actualPhrase: pilotLine.text
      })
    }
    return { quality: semanticResult.quality, mismatchDetails }
  }

  // ==========================================================================
  // FALLBACK: Only reached when semantic returned !isCorrect AND no errors
  // (defensive path — should be rare in practice)
  // ==========================================================================

  // ==========================================================================
  // CHECK FOR IMPROPER ACKNOWLEDGMENTS (Roger, Copy, OK without proper readback)
  // ==========================================================================
  const improperAckPatterns = /\b(roger|copied|copy|ok|okay|understood|got\s+it|wilco)\b/i
  const hasImproperAck = improperAckPatterns.test(pilotText)
  const wordCount = pilotText.split(/\s+/).length

  // If ONLY said "Roger" or similar with no other content - this is MISSING readback
  if (hasImproperAck && wordCount < 5) {
    mismatchDetails.push({
      type: 'incomplete',
      parameter: 'readback',
      atcValue: atcLine.text,
      pilotValue: pilotText.match(improperAckPatterns)?.[0] || 'Roger',
      expectedPhrase: `Full readback of: ${atcLine.text}`,
      actualPhrase: pilotText
    })
    return { quality: 'missing', mismatchDetails }
  }

  // ==========================================================================
  // CHECK FOR PARAMETER CONFUSION (heading read as altitude, etc.)
  // ==========================================================================
  const confusion = detectParameterConfusion(atcText, pilotText)
  if (confusion) {
    mismatchDetails.push({
      type: 'parameter_confusion',
      parameter: confusion.atcParameter,
      atcValue: confusion.atcValue,
      pilotValue: confusion.pilotValue,
      expectedPhrase: `${confusion.atcParameter} ${confusion.atcValue}`,
      actualPhrase: `${confusion.pilotParameter} ${confusion.pilotValue}`
    })
    return { quality: 'incorrect', mismatchDetails }
  }

  // ==========================================================================
  // CHECK BASED ON INSTRUCTION TYPE
  // ==========================================================================
  switch (instructionType) {
    case 'altitude': {
      const atcAlt = extractAltitude(atcText)
      const pilotAlt = extractAltitude(pilotText)

      // Check if pilot mentioned altitude-related words
      const pilotHasAltitudeWords = /\b(climb|descend|maintain|flight\s*level|altitude|FL|thousand|hundred)\b/i.test(pilotText) ||
                                    /\b(one|two|three|four|five|six|seven|eight|nine|niner|zero)\s+(one|two|three|four|five|six|seven|eight|nine|niner|zero)/i.test(pilotText)

      if (!pilotHasAltitudeWords && !pilotAlt) {
        mismatchDetails.push({
          type: 'missing_element',
          parameter: 'altitude',
          atcValue: atcAlt,
          pilotValue: null,
          expectedPhrase: `Altitude: ${atcAlt}`,
          actualPhrase: pilotText
        })
        return { quality: 'missing', mismatchDetails }
      }

      // If both have altitude values, compare them - WRONG ALTITUDE
      if (atcAlt && pilotAlt && atcAlt !== pilotAlt) {
        mismatchDetails.push({
          type: 'wrong_value',
          parameter: 'altitude',
          atcValue: atcAlt,
          pilotValue: pilotAlt,
          expectedPhrase: atcAlt,
          actualPhrase: pilotAlt
        })
        return { quality: 'incorrect', mismatchDetails }
      }

      // Check for climb/descend action word
      const atcHasAction = /\b(climb|descend)\b/i.test(atcText)
      const pilotHasAction = /\b(climb|descend|climbing|descending)\b/i.test(pilotText)
      if (atcHasAction && !pilotHasAction) {
        mismatchDetails.push({
          type: 'missing_element',
          parameter: 'climb/descend action',
          atcValue: atcText.match(/\b(climb|descend)\b/i)?.[0] || null,
          pilotValue: null,
          expectedPhrase: 'climb/descend',
          actualPhrase: pilotText
        })
        return { quality: 'partial', mismatchDetails }
      }

      // Also check QNH when the altitude instruction bundles an altimeter setting
      // (very common in ICAO: "descend to five thousand, QNH one zero one three")
      const atcQnh = extractAltimeter(atcText)
      if (atcQnh) {
        const pilotQnh = extractAltimeter(pilotText)
        if (!pilotQnh) {
          mismatchDetails.push({
            type: 'missing_element',
            parameter: 'QNH',
            atcValue: atcQnh,
            pilotValue: null,
            expectedPhrase: `QNH ${atcQnh}`,
            actualPhrase: pilotText,
          })
          return { quality: 'partial', mismatchDetails }
        }
        if (pilotQnh !== atcQnh) {
          mismatchDetails.push({
            type: 'wrong_value',
            parameter: 'QNH',
            atcValue: atcQnh,
            pilotValue: pilotQnh,
            expectedPhrase: atcQnh,
            actualPhrase: pilotQnh,
          })
          return { quality: 'incorrect', mismatchDetails }
        }
      }

      return { quality: 'complete' }
    }

    case 'heading': {
      const atcHeading = extractHeading(atcText)
      const pilotHeading = extractHeading(pilotText)

      // Check if pilot mentioned heading-related words
      const pilotHasHeadingWords = /\bheading\b/i.test(pilotText) ||
                                   /\b(left|right)\s+(heading|turn)?\s*(one|two|three|four|five|six|seven|eight|nine|niner|zero|\d)/i.test(pilotText)

      if (!pilotHasHeadingWords && !pilotHeading) {
        mismatchDetails.push({
          type: 'missing_element',
          parameter: 'heading',
          atcValue: atcHeading,
          pilotValue: null,
          expectedPhrase: `Heading: ${atcHeading}`,
          actualPhrase: pilotText
        })
        return { quality: 'missing', mismatchDetails }
      }

      // If both have heading values, compare them - WRONG HEADING
      if (atcHeading && pilotHeading && atcHeading !== pilotHeading) {
        mismatchDetails.push({
          type: 'wrong_value',
          parameter: 'heading',
          atcValue: atcHeading,
          pilotValue: pilotHeading,
          expectedPhrase: atcHeading,
          actualPhrase: pilotHeading
        })
        return { quality: 'incorrect', mismatchDetails }
      }

      // Check turn direction
      const atcDirection = /\b(left|right)\b/i.exec(atcText)
      const pilotDirection = /\b(left|right)\b/i.exec(pilotText)
      if (atcDirection && !pilotDirection) {
        mismatchDetails.push({
          type: 'missing_element',
          parameter: 'turn direction',
          atcValue: atcDirection[1],
          pilotValue: null,
          expectedPhrase: `turn ${atcDirection[1]}`,
          actualPhrase: pilotText
        })
        return { quality: 'partial', mismatchDetails }
      }
      if (atcDirection && pilotDirection && atcDirection[1].toLowerCase() !== pilotDirection[1].toLowerCase()) {
        mismatchDetails.push({
          type: 'wrong_value',
          parameter: 'turn direction',
          atcValue: atcDirection[1],
          pilotValue: pilotDirection[1],
          expectedPhrase: atcDirection[1],
          actualPhrase: pilotDirection[1]
        })
        return { quality: 'incorrect', mismatchDetails }
      }

      return { quality: 'complete' }
    }

    case 'speed': {
      const atcSpeed = extractSpeed(atcText)
      const pilotSpeed = extractSpeed(pilotText)

      // Check if pilot mentioned speed
      const pilotHasSpeedWords = /\b(speed|knots|reduce|increase)\b/i.test(pilotText)

      if (!pilotHasSpeedWords && !pilotSpeed) {
        mismatchDetails.push({
          type: 'missing_element',
          parameter: 'speed',
          atcValue: atcSpeed,
          pilotValue: null,
          expectedPhrase: `Speed: ${atcSpeed} knots`,
          actualPhrase: pilotText
        })
        return { quality: 'missing', mismatchDetails }
      }

      // WRONG SPEED
      if (atcSpeed && pilotSpeed && atcSpeed !== pilotSpeed) {
        mismatchDetails.push({
          type: 'wrong_value',
          parameter: 'speed',
          atcValue: atcSpeed,
          pilotValue: pilotSpeed,
          expectedPhrase: `${atcSpeed} knots`,
          actualPhrase: `${pilotSpeed} knots`
        })
        return { quality: 'incorrect', mismatchDetails }
      }

      return { quality: 'complete' }
    }

    case 'altimeter': {
      const atcAltimeter = extractAltimeter(atcText)
      const pilotAltimeter = extractAltimeter(pilotText)

      // Check if pilot mentioned altimeter
      const pilotHasAltimeterWords = /\b(altimeter|qnh)\b/i.test(pilotText)

      if (!pilotHasAltimeterWords && !pilotAltimeter) {
        mismatchDetails.push({
          type: 'missing_element',
          parameter: 'altimeter',
          atcValue: atcAltimeter,
          pilotValue: null,
          expectedPhrase: `Altimeter: ${atcAltimeter}`,
          actualPhrase: pilotText
        })
        return { quality: 'missing', mismatchDetails }
      }

      // WRONG ALTIMETER - safety critical!
      if (atcAltimeter && pilotAltimeter && atcAltimeter !== pilotAltimeter) {
        mismatchDetails.push({
          type: 'wrong_value',
          parameter: 'altimeter',
          atcValue: atcAltimeter,
          pilotValue: pilotAltimeter,
          expectedPhrase: atcAltimeter,
          actualPhrase: pilotAltimeter
        })
        return { quality: 'incorrect', mismatchDetails }
      }

      return { quality: 'complete' }
    }

    case 'squawk': {
      const normalized = normalizeSpelledNumbers(pilotText)
      const atcSquawk = normalizeSpelledNumbers(atcText).match(/squawk\s*(\d{4})/i)
      const pilotSquawk = normalized.match(/(\d{4})/i)

      if (!pilotSquawk) {
        mismatchDetails.push({
          type: 'missing_element',
          parameter: 'squawk',
          atcValue: atcSquawk?.[1] || null,
          pilotValue: null,
          expectedPhrase: `Squawk: ${atcSquawk?.[1]}`,
          actualPhrase: pilotText
        })
        return { quality: 'missing', mismatchDetails }
      }
      if (atcSquawk && pilotSquawk && atcSquawk[1] !== pilotSquawk[1]) {
        mismatchDetails.push({
          type: 'wrong_value',
          parameter: 'squawk',
          atcValue: atcSquawk[1],
          pilotValue: pilotSquawk[1],
          expectedPhrase: atcSquawk[1],
          actualPhrase: pilotSquawk[1]
        })
        return { quality: 'incorrect', mismatchDetails }
      }
      return { quality: 'complete' }
    }

    case 'frequency': {
      const atcFreq = atcText.match(/(\d{3})[.\s](\d{1,3})/i)
      const pilotFreq = pilotText.match(/(\d{3})[.\s](\d{1,3})/i)

      if (!pilotFreq) {
        // Try spelled out
        const normalizedPilot = normalizeSpelledNumbers(pilotText)
        const spelledFreq = normalizedPilot.match(/(\d{3}).*?(\d{1,3})/i)
        if (!spelledFreq) {
          mismatchDetails.push({
            type: 'missing_element',
            parameter: 'frequency',
            atcValue: atcFreq ? `${atcFreq[1]}.${atcFreq[2]}` : null,
            pilotValue: null,
            expectedPhrase: `Frequency: ${atcFreq ? `${atcFreq[1]}.${atcFreq[2]}` : 'unknown'}`,
            actualPhrase: pilotText
          })
          return { quality: 'missing', mismatchDetails }
        }
      }

      if (atcFreq && pilotFreq) {
        const atcFullFreq = atcFreq[1] + atcFreq[2]
        const pilotFullFreq = pilotFreq[1] + pilotFreq[2]
        if (atcFullFreq !== pilotFullFreq) {
          mismatchDetails.push({
            type: 'wrong_value',
            parameter: 'frequency',
            atcValue: `${atcFreq[1]}.${atcFreq[2]}`,
            pilotValue: `${pilotFreq[1]}.${pilotFreq[2]}`,
            expectedPhrase: `${atcFreq[1]}.${atcFreq[2]}`,
            actualPhrase: `${pilotFreq[1]}.${pilotFreq[2]}`
          })
          return { quality: 'incorrect', mismatchDetails }
        }
      }
      return { quality: 'complete' }
    }

    case 'takeoff':
    case 'landing':
    case 'lineup':
    case 'hold': {
      // Derive required pilot phrase from what ATC actually instructed.
      // "hold short of runway X"  → pilot must echo "hold short"
      // "hold at <taxiway>"       → pilot must echo "hold at" or "holding"
      // "hold position"           → pilot must echo "hold position" or "holding"
      // Fallback: any "hold" word in pilot response is accepted.
      let holdPattern: RegExp
      if (/hold\s+short/i.test(atcText)) {
        holdPattern = /hold\s*short/i
      } else if (/hold\s+at\b/i.test(atcText)) {
        holdPattern = /\bhold(?:ing)?\s+(at\b|position)?/i
      } else if (/hold\s+position/i.test(atcText)) {
        holdPattern = /\bhold(?:ing)?\s*position/i
      } else {
        holdPattern = /\bhold/i
      }
      if (!holdPattern.test(pilotText)) {
        mismatchDetails.push({
          type: 'missing_element',
          parameter: instructionType,
          atcValue: null,
          pilotValue: null,
          expectedPhrase: `Required phrase for ${instructionType}`,
          actualPhrase: pilotText
        })
        return { quality: 'missing', mismatchDetails }
      }
      // Check runway
      const normalizedAtc = normalizeSpelledNumbers(atcText)
      const normalizedPilot = normalizeSpelledNumbers(pilotText)
      const atcRunway = normalizedAtc.match(/runway\s*(\d{1,2}[LRC]?)/i)
      const pilotRunway = normalizedPilot.match(/runway\s*(\d{1,2}[LRC]?)/i)
      if (atcRunway && !pilotRunway) {
        mismatchDetails.push({
          type: 'missing_element',
          parameter: 'runway',
          atcValue: atcRunway[1],
          pilotValue: null,
          expectedPhrase: `Runway ${atcRunway[1]}`,
          actualPhrase: pilotText
        })
        return { quality: 'partial', mismatchDetails }
      }
      if (atcRunway && pilotRunway && atcRunway[1].toLowerCase() !== pilotRunway[1].toLowerCase()) {
        mismatchDetails.push({
          type: 'wrong_value',
          parameter: 'runway',
          atcValue: atcRunway[1],
          pilotValue: pilotRunway[1],
          expectedPhrase: `Runway ${atcRunway[1]}`,
          actualPhrase: `Runway ${pilotRunway[1]}`
        })
        return { quality: 'incorrect', mismatchDetails }
      }
      return { quality: 'complete' }
    }

    default:
      // For other types, check if pilot repeated key elements
      if (pilotText.length < 10) {
        mismatchDetails.push({
          type: 'incomplete',
          parameter: 'general',
          atcValue: null,
          pilotValue: null,
          expectedPhrase: 'Full readback expected',
          actualPhrase: pilotText
        })
        return { quality: 'partial', mismatchDetails }
      }
      return { quality: 'complete' }
  }
}

// Calculate weight dynamically based on context
function calculateContextualSeverity(
  instructionType: string,
  readbackQuality: string,
  flightPhase: FlightPhase,
  emergencyDeclared: boolean
): 'low' | 'medium' | 'high' | 'critical' {
  // Emergency always escalates weight
  if (emergencyDeclared) {
    if (readbackQuality === 'missing' || readbackQuality === 'incorrect') {
      return 'critical'
    }
    return 'high'
  }

  // Phase-based weight adjustment
  const criticalPhases: FlightPhase[] = ['approach', 'landing', 'departure']
  const isPhraseCritical = criticalPhases.includes(flightPhase)

  // Instruction type weight
  const criticalInstructions = ['altitude', 'takeoff', 'landing', 'lineup', 'hold']
  const isInstructionCritical = criticalInstructions.includes(instructionType)

  // Calculate final weight
  if (readbackQuality === 'incorrect') {
    return 'critical' // Wrong readback is always critical
  }

  if (readbackQuality === 'missing') {
    if (isInstructionCritical && isPhraseCritical) return 'critical'
    if (isInstructionCritical || isPhraseCritical) return 'high'
    return 'medium'
  }

  if (readbackQuality === 'partial') {
    if (isInstructionCritical && isPhraseCritical) return 'high'
    if (isInstructionCritical || isPhraseCritical) return 'medium'
    return 'low'
  }

  return 'low'
}

// Update issue accumulator and detect patterns
function updateIssueAccumulator(
  accumulator: IssueAccumulator,
  newIssue: { line: number; weight: string }
): IssueAccumulator {
  const now = Date.now()
  const recentWindow = 5 // Consider issues within 5 lines as "recent"

  // Add new issue
  const updated = {
    ...accumulator,
    recentIssues: [
      ...accumulator.recentIssues.filter(i => newIssue.line - i.line < recentWindow),
      { ...newIssue, timestamp: now },
    ],
  }

  // Calculate escalation level from SIGNIFICANT issues only.
  // Low-weight issues (number pronunciation, minor phrasing) are common in
  // real transcripts and should not trigger the 🔴 pattern warning.
  // Only medium/high/critical errors drive the escalation counter.
  const significantCount = updated.recentIssues.filter(
    i => i.weight === 'medium' || i.weight === 'high' || i.weight === 'critical'
  ).length

  if (significantCount >= 4) {
    updated.escalationLevel = 3
    updated.patternDetected = 'Multiple consecutive errors detected - systematic issue'
  } else if (significantCount >= 3) {
    updated.escalationLevel = 2
    updated.patternDetected = 'Error pattern emerging - attention required'
  } else if (significantCount >= 2) {
    updated.escalationLevel = 1
    updated.patternDetected = null
  } else {
    updated.escalationLevel = 0
    updated.patternDetected = null
  }

  return updated
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Normalize raw input text before parsing.
 * Applied to ALL input paths (paste, PDF extraction, DOCX extraction) so that
 * the analysis engine receives consistent text regardless of input source.
 * Does NOT collapse newlines — line structure must be preserved for parseLines().
 * PDF extractor applies these same fixes per-line during its reconstruction step;
 * DOCX extractor applies them in normaliseDocxText(). This ensures pasted text
 * receives identical treatment.
 */
function normalizeInputText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')                    // CRLF / CR → LF (Windows paste)
    .replace(/\u2018|\u2019/g, "'")             // smart single quotes → ASCII '
    .replace(/\u201C|\u201D/g, '"')             // smart double quotes → ASCII "
    .replace(/\u2013/g, '-')                    // en-dash → hyphen
    .replace(/\u2014/g, '-')                    // em-dash → hyphen
    .replace(/\u00A0/g, ' ')                    // non-breaking space → regular space
    .replace(/[\u200B-\u200D\uFEFF]/g, '')      // zero-width / BOM chars → removed
    .replace(/\n{4,}/g, '\n\n\n')              // collapse 4+ blank lines to max 2
}

export function analyzeDialogue(input: AnalysisInput): AnalysisOutput {
  const { corpusType } = input
  // Normalize input regardless of source (paste / PDF / DOCX) so the parser
  // always receives clean, consistent text.
  const text = normalizeInputText(input.text)

  // Parse lines
  const parsedLines = parseLines(text)

  // ============================================================================
  // DYNAMIC CONTEXT ANALYSIS
  // ============================================================================

  // Initialize context
  let context = createInitialContext()

  // Detect flight phase dynamically
  context.flightPhase = detectFlightPhase(parsedLines)

  // Extract callsigns
  const { callsigns, primary } = extractCallsigns(parsedLines)
  context.detectedCallsigns = callsigns
  context.primaryCallsign = primary

  // Check for emergency declarations
  context.emergencyDeclared = parsedLines.some(l =>
    /\b(mayday|pan\s+pan|emergency)\b/i.test(l.text)
  )
  context.tcasActive = parsedLines.some(l =>
    /\btcas\s*(ra|resolution)/i.test(l.text)
  )

  // Build exchange pairs for dynamic analysis
  context.exchangePairs = buildExchangePairs(parsedLines, context)

  // ============================================================================
  // STANDARD ANALYSIS
  // ============================================================================

  // Basic metrics
  const words = text.split(/\s+/).filter(w => w.length > 0)
  const totalWords = words.length
  const totalExchanges = countExchanges(parsedLines)

  // Comprehensive error detection with context
  const phraseologyErrors = detectAllErrorsWithContext(parsedLines, corpusType, context)

  // Categorize errors
  const languageErrors = categorizeLanguageErrors(phraseologyErrors)
  const numberErrors = categorizeNumberErrors(phraseologyErrors, text)

  // Readback analysis
  const readbackAnalysis = analyzeReadbacks(parsedLines)

  // Safety metrics
  const safetyMetrics = calculateSafetyMetrics(parsedLines, phraseologyErrors, context.exchangePairs.length)

  // Calculate non-standard frequency
  const nonStandardCount = phraseologyErrors.filter(e =>
    e.category === 'language' || e.category === 'procedure'
  ).length
  const nonStandardFreq = totalWords > 0 ? (nonStandardCount / totalWords) * 1000 : 0

  // Count clarifications
  const clarificationCount = countClarifications(text)

  // Determine risk level
  const riskLevel = calculateRiskLevel(phraseologyErrors, safetyMetrics, readbackAnalysis)

  // Generate summary
  const summary = generateComprehensiveSummary(
    phraseologyErrors,
    readbackAnalysis,
    safetyMetrics,
    corpusType,
    totalWords,
    context.exchangePairs.length
  )

  // Detailed findings
  const detailedFindings = generateDetailedFindings(phraseologyErrors, readbackAnalysis)

  // ============================================================================
  // BUILD CONTEXT INFO FOR OUTPUT
  // ============================================================================

  const contextInfo = buildContextInfo(context)

  return {
    corpusType,
    totalWords,
    totalExchanges,
    nonStandardFreq: Math.round(nonStandardFreq * 10) / 10,
    clarificationCount,
    languageErrors,
    numberErrors,
    phraseologyErrors,
    readbackAnalysis,
    safetyMetrics,
    riskLevel,
    summary,
    detailedFindings,
    parsedLines,
    contextInfo,
  }
}

// Build context info for output
function buildContextInfo(context: ConversationContext): ContextInfo {
  // Generate phase description
  const phaseDescriptions: Record<FlightPhase, string> = {
    ground: 'Ground operations - taxi, pushback, or parking',
    departure: 'Departure phase - takeoff, initial climb, or SID',
    enroute: 'Enroute/cruise phase - level flight',
    approach: 'Approach phase - vectors, descent, or approach clearance',
    landing: 'Landing phase - final approach or landing clearance',
    unknown: 'Phase not clearly identified from dialogue',
  }

  // Build exchange analysis results
  const exchangeAnalysis: ExchangeAnalysisResult[] = context.exchangePairs.map(pair => {
    const issue = getExchangeIssue(pair)
    const dynamicFeedback = generateDynamicFeedback(pair, context.flightPhase)

    return {
      atcInstruction: pair.atcLine.rawText.substring(0, 80),
      pilotResponse: pair.pilotLine?.rawText.substring(0, 80) || null,
      instructionType: pair.instructionType,
      readbackQuality: pair.readbackQuality,
      contextualWeight: pair.contextualWeight,
      issue,
      dynamicFeedback,
    }
  })

  // Identify situational factors that affect analysis
  const situationalFactors: string[] = []

  if (context.emergencyDeclared) {
    situationalFactors.push('⚠️ EMERGENCY DECLARED - All communications require heightened accuracy')
  }
  if (context.tcasActive) {
    situationalFactors.push('⚠️ TCAS RA Active - Pilot must follow TCAS, not ATC')
  }
  if (context.flightPhase === 'approach' || context.flightPhase === 'landing') {
    situationalFactors.push('📍 Approach/Landing phase - Extra attention to readbacks required')
  }
  if (context.flightPhase === 'departure') {
    situationalFactors.push('📍 Departure phase - Altitude and heading readbacks require full accuracy')
  }
  if (context.detectedCallsigns.size > 1) {
    situationalFactors.push(`📻 Multiple callsigns detected (${context.detectedCallsigns.size}) - Watch for callsign confusion`)
  }

  // Check for similar callsigns that could cause confusion
  const callsignArray = Array.from(context.detectedCallsigns)
  for (let i = 0; i < callsignArray.length; i++) {
    for (let j = i + 1; j < callsignArray.length; j++) {
      if (areSimilarCallsigns(callsignArray[i], callsignArray[j])) {
        situationalFactors.push(`⚠️ Similar callsigns detected: ${callsignArray[i]} and ${callsignArray[j]} - High confusion risk`)
      }
    }
  }

  return {
    flightPhase: context.flightPhase,
    phaseDescription: phaseDescriptions[context.flightPhase],
    detectedCallsign: context.primaryCallsign,
    exchangeAnalysis,
    patternWarning: context.issueAccumulator.patternDetected,
    escalationLevel: context.issueAccumulator.escalationLevel,
    situationalFactors,
  }
}

// Check if two callsigns are similar enough to cause confusion
function areSimilarCallsigns(cs1: string, cs2: string): boolean {
  // Same prefix with similar numbers
  const prefix1 = cs1.replace(/\d/g, '')
  const prefix2 = cs2.replace(/\d/g, '')
  const num1 = cs1.replace(/\D/g, '')
  const num2 = cs2.replace(/\D/g, '')

  // Same airline prefix
  if (prefix1 === prefix2) {
    // Check if numbers differ by only one digit
    if (Math.abs(num1.length - num2.length) <= 1) {
      let differences = 0
      const maxLen = Math.max(num1.length, num2.length)
      for (let i = 0; i < maxLen; i++) {
        if (num1[i] !== num2[i]) differences++
      }
      if (differences <= 1) return true
    }
  }

  return false
}

// Get issue description for an exchange pair
function getExchangeIssue(pair: ExchangePair): string | null {
  if (pair.readbackQuality === 'complete') return null

  switch (pair.readbackQuality) {
    case 'missing':
      return `No proper readback for ${pair.instructionType} instruction`
    case 'partial':
      return `Incomplete readback - missing elements for ${pair.instructionType}`
    case 'incorrect':
      return `Incorrect readback for ${pair.instructionType} - values don't match`
    default:
      return null
  }
}

// Generate dynamic, context-aware feedback
function generateDynamicFeedback(pair: ExchangePair, flightPhase: FlightPhase): string {
  const { instructionType, readbackQuality, contextualWeight } = pair

  // If everything is fine
  if (readbackQuality === 'complete') {
    return '✓ Proper readback completed'
  }

  // Generate context-specific feedback
  let feedback = ''

  // Phase-specific context
  if (flightPhase === 'approach' || flightPhase === 'landing') {
    feedback += 'During approach/landing phase, '
  } else if (flightPhase === 'departure') {
    feedback += 'During departure phase, '
  }

  // Instruction-specific feedback
  switch (instructionType) {
    case 'altitude':
      feedback += 'altitude instructions are MANDATORY readback items. Failure to read back altitude has caused numerous altitude busts and near-misses.'
      break
    case 'heading':
      feedback += 'heading assignments must be read back with the turn direction. Missing direction can lead to 180° heading errors.'
      break
    case 'takeoff':
      feedback += 'takeoff clearances MUST be read back verbatim with runway. This instruction requires verbatim readback per ICAO Doc 4444.'
      break
    case 'landing':
      feedback += 'landing clearances require full readback with runway. Runway confusion is a leading cause of runway incursions.'
      break
    case 'hold':
      feedback += 'hold short instructions require full readback. Failure to properly acknowledge can result in runway incursions.'
      break
    case 'squawk':
      feedback += 'squawk codes must be read back to ensure correct radar identification.'
      break
    case 'frequency':
      feedback += 'frequency changes must be read back to prevent loss of communication.'
      break
    default:
      feedback += 'this instruction requires proper acknowledgment.'
  }

  // Severity-specific addition
  if (contextualWeight === 'critical') {
    feedback += ' ⚠️ This requires careful attention in the current context.'
  } else if (contextualWeight === 'high') {
    feedback += ' This requires immediate attention.'
  }

  return feedback
}

// ============================================================================
// LINE PARSING - Smart multi-format parser
// ============================================================================

export function parseLines(text: string): ParsedLine[] {
  const parsedLines: ParsedLine[] = []

  // PHASE 1: Try labeled-line parsing first (most transcript formats)
  // This handles ANY format like "SomeLabel: dialogue" regardless of naming convention
  // Pass RAW lines (including blanks) so we can detect conversation boundaries
  const rawLines = text.split('\n')
  const lines = rawLines.filter(l => l.trim())
  const labeledResult = tryLabeledLineParsing(rawLines)

  if (labeledResult.length > 0) {
    parsedLines.push(...labeledResult)
  } else {
    // PHASE 1.5: Try normalising multi-line format (number / speaker / dialogue on separate
    // lines) then re-attempt labeled parsing before falling back to content inference.
    const normalizedLines = normalizeMultiLineFormat(rawLines)
    const normalizedResult = tryLabeledLineParsing(normalizedLines)
    if (normalizedResult.length > 0) {
      parsedLines.push(...normalizedResult)
    } else {
      // PHASE 2: Try quoted-segment extraction (handles unlabeled "quote1" "quote2" format)
      const quotedSegments = extractQuotedSegments(text)

      if (quotedSegments.length >= 2) {
        quotedSegments.forEach((segment, index) => {
          const speaker = inferSpeakerFromContent(segment, index)
          parsedLines.push({
            lineNumber: index + 1,
            text: cleanText(segment),
            speaker,
            rawText: segment,
            conversationGroup: 0,
          })
        })
      } else {
        // PHASE 3: Fall back to line-by-line content-based parsing
        lines.forEach((line, index) => {
          const lineQuotes = extractQuotedSegments(line)
          if (lineQuotes.length >= 2) {
            lineQuotes.forEach((segment) => {
              const speaker = inferSpeakerFromContent(segment, parsedLines.length)
              parsedLines.push({
                lineNumber: parsedLines.length + 1,
                text: cleanText(segment),
                speaker,
                rawText: segment,
                conversationGroup: 0,
              })
            })
          } else {
            const speaker = identifySpeaker(line)
            const cleanedText = cleanSpeakerLabel(line)
            parsedLines.push({
              lineNumber: index + 1,
              text: cleanedText,
              speaker,
              rawText: line.trim(),
              conversationGroup: 0,
            })
          }
        })
      }
    } // end Phase 1.5 else
  } // end Phase 1 else

  // If speakers are all UNKNOWN, try to infer from content patterns
  const unknownCount = parsedLines.filter(l => l.speaker === 'UNKNOWN').length
  if (unknownCount > parsedLines.length / 2) {
    inferSpeakersFromContext(parsedLines)
  }

  return parsedLines
}

// ============================================================================
// GENERIC LABELED-LINE PARSER
// ============================================================================
// Handles ANY transcript format where lines look like:
//   SomeLabel: "dialogue text"
//   AnotherLabel: dialogue text
//   APPDEP_PAEC09_C007_Phi_MNL: "Eva two-seven-one, descend eight thousand"
//   Pilot_PAEC09_C007_Phi_MNL: "descend eight thousand, Eva two-seven-one"
//   TWR_Session1: "runway 24, cleared to land"
//   GND_CTRL: taxi via alpha
// Works by detecting the "Label:" pattern, then classifying the label generically.

// ── Inline-label expansion ────────────────────────────────────────────────────
// DOCX paragraphs can contain multiple exchanges concatenated with speaker
// labels acting as inline separators, e.g.:
//   "APP-DEP_PAEC1_C001_Phi_MNL:textA.Pilot_PAEC1_C001_Phi_MNL:textB."
// Split each such line on PAEC speaker-label boundaries so every exchange
// gets its own line before the label-extraction pass runs.
//
// Pattern covers ALL variants found across the APP-DEP PAEC corpus:
//   APP-DEP_PAEC{n}   App/Dep_Paec{n}   APPDEP_PAEC{n}
//   Pilot_PAEC{n}     PILOT_PAEC{n}
//   TWR_PAEC{n}       DEP_PAEC{n}       GND_PAEC{n}   RAMP_PAEC{n}
// The `_PAEC\d` suffix ensures we only split on transcript labels, never
// mid-sentence words like "DEP" in "DEP clearance" or "APPROACH frequency".
// Negative lookbehind on the bare `DEP` alternative prevents double-splitting
// "APP-DEP_PAEC1" at both position 0 (APP-DEP) and position 4 (DEP), which
// was leaving orphaned "APP-" / "App/" / "APP/" fragments as UNKNOWN lines.
const PAEC_INLINE_SPLIT_RE = /(?=(?:APP[-/]?DEP|APPDEP|(?<![A-Za-z/\-])DEP|TWR|GND|RAMP|PILOT)_PAEC\d)/i

function expandInlineLabels(lines: string[]): string[] {
  const out: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (!t) { out.push(line); continue }
    const parts = t.split(PAEC_INLINE_SPLIT_RE)
    if (parts.length > 1) {
      parts.forEach(p => { if (p.trim()) out.push(p.trim()) })
    } else {
      out.push(line)
    }
  }
  return out
}

/**
 * Pre-process transcripts where exchange number, speaker keyword, and dialogue
 * appear on three separate lines (no colon on the label line), e.g.:
 *   "18\nATC\nCathay niner zero one, turn left…"
 *
 * Converts to colon-label form that tryLabeledLineParsing can handle:
 *   "ATC: Cathay niner zero one, turn left…"
 *
 * Standalone exchange-number lines (1–3 digits) are discarded.
 * All other lines pass through unchanged.
 */
function normalizeMultiLineFormat(rawLines: string[]): string[] {
  const ATC_STANDALONE    = /^(ATC|ATCO|APP|DEP|TWR|TOWER|GND|GROUND|APPROACH|DEPARTURE|RADAR|CONTROL|RAMP|CLEARANCE|CLR|DELIVERY|DEL|ATIS)$/i
  const PILOT_STANDALONE  = /^(PILOT|PLT|CREW|FO|CAPT|CAPTAIN|PF|PM|PNF)$/i
  const EXCHANGE_NUMBER   = /^\d{1,3}$/

  const result: string[] = []
  let pendingLabel: string | null = null

  for (const line of rawLines) {
    const trimmed = line.trim()

    if (!trimmed) {
      // Blank line: discard any unmatched pending label, preserve blank for boundary detection
      pendingLabel = null
      result.push(line)
      continue
    }

    // Discard standalone exchange-sequence numbers
    if (EXCHANGE_NUMBER.test(trimmed)) continue

    // Standalone speaker keyword — hold it until the next dialogue line
    if (ATC_STANDALONE.test(trimmed) || PILOT_STANDALONE.test(trimmed)) {
      pendingLabel = trimmed
      continue
    }

    // Dialogue line: attach any pending speaker label
    if (pendingLabel !== null) {
      result.push(`${pendingLabel}: ${trimmed}`)
      pendingLabel = null
    } else {
      result.push(line)
    }
  }

  return result
}

function tryLabeledLineParsing(rawLines: string[]): ParsedLine[] {
  // Expand any lines that contain multiple inline PAEC speaker labels
  // (common in DOCX files where multiple exchanges share one paragraph)
  const expandedLines = expandInlineLabels(rawLines)

  // First pass: check if this text uses a labeled format at all
  // A line is "labeled" if it matches: <non-quote-chars> : <something>
  // We require at least 40% of non-empty lines to have labels to use this mode
  // Also track blank lines as conversation boundaries
  const labelPattern = /^([^"":]+):\s*(.*)$/
  let labeledCount = 0
  let nonEmptyCount = 0
  const parsed: { label: string; dialogue: string; raw: string; isBlank: boolean }[] = []

  for (const line of expandedLines) {
    const trimmed = line.trim()

    // Preserve blank lines as conversation boundary markers
    if (!trimmed) {
      parsed.push({ label: '', dialogue: '', raw: '', isBlank: true })
      continue
    }

    nonEmptyCount++

    // Skip lines that are just <unclear/> or similar XML tags with no label
    if (/^<[^>]+\/?>$/i.test(trimmed)) {
      parsed.push({ label: '', dialogue: trimmed, raw: trimmed, isBlank: false })
      continue
    }

    const match = trimmed.match(labelPattern)
    if (match) {
      labeledCount++
      parsed.push({ label: match[1].trim(), dialogue: match[2].trim(), raw: trimmed, isBlank: false })
    } else {
      // PAEC2 corpus format: label not followed by a colon, e.g.
      //   "App/Dep_Paec2_C001_Phi_Mnl <Anon Type="Cebu"/> dialogue"
      //   "APP/DEP_PAEC2_ C009_PHI_MNL All Stations, One More Arrival..."
      // Detect by PAEC speaker prefix; split on the first '<' (anon tag) or
      // on the end of the continuous non-space/non-angle label token.
      const paecPfx = trimmed.match(
        /^((?:APP[-/]?DEP|APPDEP|(?<![A-Za-z/\-])DEP|TWR|GND|RAMP|PILOT)_PAEC\d+[^\s<]*)\s*/i,
      )
      if (paecPfx) {
        const labelPart = paecPfx[1]
        const ltIdx = trimmed.indexOf('<')
        const dialoguePart = ltIdx !== -1
          ? trimmed.slice(ltIdx)
          : trimmed.slice(paecPfx[0].length)
        labeledCount++
        parsed.push({ label: labelPart, dialogue: dialoguePart, raw: trimmed, isBlank: false })
      } else {
        parsed.push({ label: '', dialogue: trimmed, raw: trimmed, isBlank: false })
      }
    }
  }

  // Need at least 40% labeled lines and at least 2 labeled lines to use this mode
  if (labeledCount < 2 || nonEmptyCount === 0 || labeledCount / nonEmptyCount < 0.4) {
    return []
  }

  // Second pass: classify each label, track conversation groups.
  //
  // DYNAMIC conversation-boundary detection — groups change ONLY when the
  // aircraft identity changes, never on blank lines.  Blank lines in PAEC
  // corpus files are formatting/spacing between exchanges within the same
  // conversation; treating them as boundaries creates false splits.
  //
  // Three-tier conversation boundary detection (no hardcoded values):
  //   Tier 1 — PAEC label C-number (C001, C002 …) from speaker labels  ← most reliable
  //   Tier 2 — Full callsign in dialogue text: "PAL 456" or "PAL456"
  //   Tier 3 — Airline name from <Anon Type="…"/> tags via extractAnonType()
  //   The first tier that fires wins; lower tiers are tried only when upper tiers have no data.
  const CALLSIGN_RE = /\b([A-Z]{2,3})\s*(\d{2,4})\b/i   // matches "PAL 456" and "PAL456"
  const result: ParsedLine[] = []
  let lineNum = 0
  let conversationGroup = 0
  let lastCallsign: string | null = null
  let lastLabelConvId: number | null = null

  for (const entry of parsed) {
    lineNum++

    // Blank lines are formatting only — skip without changing conversation group
    if (entry.isBlank) continue

    const { label, dialogue, raw } = entry

    // Detect aircraft identity from content dynamically.
    // extractAnonType handles every PAEC corpus variant (PAEC01–PAEC31).
    // Falls back to Philippine-style explicit callsigns (PAL456, CEB1234).
    const src = dialogue || raw
    const anonId = extractAnonType(src)
    const csMatch = !anonId ? src.match(CALLSIGN_RE) : null
    // Normalise "PAL 456" and "PAL456" → "PAL456" (group 1 = alpha, group 2 = digits)
    const detectedId = anonId
      ? anonId
      : csMatch
        ? (csMatch[1] + csMatch[2]).toUpperCase()
        : null

    // ── TIER 1: PAEC label C-number — most reliable boundary signal ───────────
    // Labels like "APP-DEP_PAEC1_C001_Phi_MNL" → C001 = conversation 1
    const labelConvMatch = label ? label.match(/\bC(\d{1,4})\b/i) : null
    const labelConvId = labelConvMatch ? parseInt(labelConvMatch[1], 10) : null

    if (labelConvId !== null) {
      // C-number changed → new conversation (no min-lines guard; labels are authoritative)
      if (lastLabelConvId !== null && labelConvId !== lastLabelConvId) {
        conversationGroup++
      }
      lastLabelConvId = labelConvId

    // ── TIER 2 & 3: callsign / anon-tag from content ─────────────────────────
    // Handles plain-text transcripts ("PAL 456", "CEB 777") and anon-tag files
    } else if (detectedId) {
      if (lastCallsign && detectedId !== lastCallsign) {
        conversationGroup++
      }
      lastCallsign = detectedId
    }

    // Skip <unclear/> lines entirely — they carry no analysable content
    if (/^<\s*unclear\s*\/?\s*>$/i.test(dialogue) || /^<\s*unclear\s*\/?\s*>$/i.test(raw)) {
      continue
    }

    // Skip audio filenames and PAEC metadata lines embedded in the transcript
    // e.g. "RPLL-App-Dep-124800-Feb-1-2025-0030Z.mp3", "PAEC-COO1-0000Z", "PAEC01_C001_0000Z"
    if (/\.(mp3|wav|m4a|aac|ogg|pdf)$/i.test(raw) ||
        /^(?:PAEC[-_]?[A-Z0-9]+(?:[-_][A-Z0-9]+)*Z|PAEC\d+)$/i.test(raw.trim())) {
      continue
    }

    // Clean the dialogue: strip quotes then strip corpus annotation tags
    // (e.g. <Anon Type="Philippine"/>) and normalise "/" separators
    const cleanedDialogue = stripAnonTags(stripQuotes(dialogue))
    if (!cleanedDialogue || cleanedDialogue.length < 2) continue

    // ── Continuation-line merging ─────────────────────────────────────────
    // In labeled-line mode, any entry without a label is a physical line break
    // within a single speaker turn (common in PDFs and word-wrapped transcripts).
    // Merge it into the previous ParsedLine rather than creating a new entry,
    // so downstream readback / callsign checks see the full turn text.
    if (!label && result.length > 0) {
      const prev = result[result.length - 1]
      prev.text    = (prev.text + ' ' + cleanedDialogue).replace(/\s{2,}/g, ' ').trim()
      prev.rawText = (prev.rawText + ' ' + raw).trim()
      continue
    }

    // Classify the label
    const speaker = label ? classifyLabel(label) : inferSpeakerFromContent(cleanedDialogue, result.length)

    result.push({
      lineNumber: lineNum,
      text: cleanedDialogue,
      speaker,
      rawText: raw,
      conversationGroup,
    })
  }

  return result
}

// Classify ANY label string as ATC or PILOT by scanning for keywords
// This is intentionally generic — it doesn't care about the exact format,
// just whether the label contains ATC-ish or Pilot-ish words anywhere.
function classifyLabel(label: string): 'ATC' | 'PILOT' | 'UNKNOWN' {
  const upper = label.toUpperCase()

  // ATC keywords — if ANY of these appear anywhere in the label, it's ATC
  const atcKeywords = [
    'ATC', 'ATCO',
    'APP', 'APPDEP', 'APPROACH', 'DEPARTURE', 'DEP',
    'TWR', 'TOWER',
    'GND', 'GROUND',
    'CTR', 'CENTER', 'CENTRE',
    'RADAR', 'CONTROL',
    'RAMP', 'CLEARANCE', 'DELIVERY', 'CLR',
    'ATIS',
  ]

  // Pilot keywords — if ANY of these appear anywhere in the label, it's PILOT
  const pilotKeywords = [
    'PILOT', 'PLT', 'CREW', 'FO', 'CAPT', 'CAPTAIN',
    'FIRST_OFFICER', 'PF', 'PM', 'PNF',
  ]

  // Check ATC keywords (word boundary-ish: check as substring in underscore/space separated parts)
  const labelParts = upper.split(/[\s_\-./]+/)
  for (const part of labelParts) {
    if (atcKeywords.includes(part)) return 'ATC'
  }
  for (const part of labelParts) {
    if (pilotKeywords.includes(part)) return 'PILOT'
  }

  // Also check if the whole label starts with a known keyword (handles "Pilot_..." or "APPDEP_...")
  for (const kw of atcKeywords) {
    if (upper.startsWith(kw)) return 'ATC'
  }
  for (const kw of pilotKeywords) {
    if (upper.startsWith(kw)) return 'PILOT'
  }

  return 'UNKNOWN'
}

// Strip surrounding quotes from dialogue text (any quote style)
function stripQuotes(text: string): string {
  return text
    .replace(/^[\s"'""''`´«»\u201C\u201D\u2018\u2019]+/, '')
    .replace(/[\s"'""''`´«»\u201C\u201D\u2018\u2019]+$/, '')
    .trim()
}

/**
 * Dynamically extract the aircraft-type value from any PAEC Anon token.
 * Works regardless of bracket style, quoting, or spacing used across corpus
 * versions (PAEC01–PAEC31+).  Returns null when no token is found.
 *
 * Supported formats (discovered from real corpus files):
 *   <Anon Type = "Philippine"/>        PAEC02 — space-padded, quoted, self-close
 *   <anon type="Coolred"/>             PAEC01 — lowercase, tightly-quoted, self-close
 *   < Anon Type = "Qatar"/>            PAEC02 — space after <
 *   <<Anon Type = "Cool Red"/>         PAEC02 — double <
 *   <Anon Type= "Philippine"/>         no space before quote
 *   <anon type="X">                    PAEC24/31 — open-close > (no slash before >)
 *   anon type= Philippine /            PAEC18 — no angle brackets, unquoted
 *   anon type= Cool Red /              PAEC18 — multi-word unquoted value
 */
function extractAnonType(raw: string): string | null {
  // Normalise bracket noise then run a single universal pattern:
  //   optional angle brackets + optional spaces  →  "anon type = <value>"
  const normalised = raw.replace(/<<+/g, '<').replace(/<\s+/g, '<')
  // The value sits between "=" and the next quote/slash/angle-bracket/newline
  // Two-pass match: prefer delimited form, fall back to end-of-line anchor for truncated tags
  // like `<anon type="Philippine"` (no closing >).
  const m = normalised.match(/\banon\s+type\s*=\s*["']?\s*([A-Za-z][A-Za-z ]*?)["']?\s*[/<>]/i)
         || normalised.match(/\banon\s+type\s*=\s*["']([^"'\n]+)["']\s*$/im)
  if (!m) return null
  return m[1].trim().toUpperCase().replace(/\s+/g, '')
}

/**
 * Strip all PAEC corpus annotation tags from dialogue text and normalise
 * "/" utterance separators so phrase-matching works on clean aviation prose.
 *
 * Dynamic: uses a single normalise-then-match approach so any new tag variant
 * in future corpus versions is handled without code changes.
 */
function stripAnonTags(text: string): string {
  // Step 0 — strip orphaned anon-tag fragments that appear when the PDF engine
  // splits "<anon" to one y-position and "type=..." to another, resulting in
  // continuation lines that start with residual XML attribute text:
  //   type="Philippine", > four three eight.   →  four three eight.
  //   type="Cathay">niner one two.             →  niner one two.
  //   Philippine", > four three eight.         →  four three eight.
  //   > four three eight.                      →  four three eight.
  let result = text
  result = result.replace(/^type\s*=\s*["'][^"']*["']?[,]?\s*\/?>\s*/i, '')  // type="X", /> prefix
  result = result.replace(/^["'][^"',]{0,40}["'][,]?\s*\/?>\s*/,       '')  // "X", /> or "X"> prefix
  result = result.replace(/^[A-Za-z][A-Za-z\s]{0,30}",\s*\/?>\s*/,    '')  // Philippine", > prefix
  result = result.replace(/^>\s+/,                                       '')  // bare leading >

  // Step 1 — normalise bracket/spacing noise so one pattern covers all variants
  result = result.replace(/<<+/g, '<').replace(/<\s+/g, '<')

  // Step 2 — replace any "anon type = <value>" token (tagged or untagged) with
  //           the airline name so the callsign slot stays semantically intact
  //           e.g. "PHILIPPINE, climb and maintain flight level one five zero"
  // Closing forms seen in corpus:
  //   />   — XML self-close (PAEC01-PAEC20, most files)
  //   >    — open-close without slash (PAEC24/31: <anon type="X">)
  //   /    — slash only, no angle bracket (PAEC18 untagged: anon type= Philippine /)
  // Pattern: (?:\/?>|\/) = (optional-/ then >) OR (/ alone)
  // This is tried left-to-right so /> is consumed as a unit before / alone.
  result = result.replace(
    /<?anon\s+type\s*=\s*["']?\s*([A-Za-z][A-Za-z ]*?)["']?\s*(?:\/?>|\/)/gi,
    (_m, val: string) => val.trim().toUpperCase().replace(/\s+/g, '') + ' ',
  )

  // Step 2.4 — PAEC12/GND corpus: unclosed <anon type=... tags where the type=
  //            field IS the actual utterance text with no closing > or />.
  //            Format: "<anon type=Cebu seven zero three, hold short Golf four"
  //            Replace with just the content after "type=" so the dialogue is preserved.
  //            Must run before Step 2.5 which would otherwise strip everything.
  //            Special sub-tags like <no_reply/> and <unclear/> in the type= field
  //            are passed through and cleaned up by Step 3.
  result = result.replace(
    /<anon\s+type\s*=\s*([^>\n]+)/gi,
    (_m, content: string) => content.trim(),
  )

  // Step 2.5 — strip malformed anon tags where the type= value contains
  //            actual dialogue text (corpus annotation errors), e.g.:
  //              <anon type=Roger.          (no proper closing, no quotes)
  //              <anon type=Good evening.   (sentence in type field)
  //              <anon type=Climb niner thousand.../>  (full instruction in type field)
  //            These fall through Step 2 (non-letter chars break the value regex).
  //            [^>\n]* consumes everything up to the next > or newline.
  //            >? optionally consumes the closing > so /> pairs are fully removed.
  result = result.replace(/<?anon\b[^>\n]*>?/gi, '')

  // Step 2.7 — strip mid-line broken anon tag residue produced when the PDF
  //            y-position grouper splits <anon type="Cebu"/> across two physical
  //            lines.  The second fragment lands mid-sentence:
  //              "One two five decimal seven, "Cebu", > one zero eight five."
  //            Replace the fragment with the callsign so it remains readable:
  //              "One two five decimal seven, CEBU one zero eight five."
  result = result.replace(
    /[""']([A-Za-z][A-Za-z ]{0,20})[""'][,]?\s*\/?>\s*/g,
    (_m: string, name: string) => name.trim().toUpperCase().replace(/\s+/g, '') + ' ',
  )

  // Step 3 — strip any remaining XML / annotation tags
  //           (<unclear/>, <no_reply/>, <vocal desc="...">, <event ...>, etc.)
  result = result.replace(/<[^>]+>/g, '')

  // Step 4 — normalise "/" utterance separators → ", "
  result = result.replace(/\s*\/\s*/g, ', ')

  // Step 5 — collapse artefacts from previous steps
  result = result.replace(/,\s*,/g, ',').replace(/^[,\s]+|[,\s]+$/g, '').replace(/\s{2,}/g, ' ')

  return result.trim()
}

// Extract all quoted segments from text
function extractQuotedSegments(text: string): string[] {
  const segments: string[] = []

  // Normalize ALL possible quote characters (comprehensive Unicode coverage)
  let normalized = text
  // Replace all Unicode double quote variants with ASCII "
  const doubleQuotes = /[\u0022\u201C\u201D\u201E\u201F\u2033\u2036\u00AB\u00BB\uFF02\u301D\u301E\u301F]/g
  normalized = normalized.replace(doubleQuotes, '"')
  // Replace all Unicode single quote variants with ASCII "
  const singleQuotes = /[\u0027\u2018\u2019\u201A\u201B\u2032\u2035\uFF07\u0060\u00B4]/g
  normalized = normalized.replace(singleQuotes, '"')

  // Method 1: Split by quote character and filter meaningful parts
  const splitParts = normalized.split('"')

  for (const part of splitParts) {
    const cleaned = part.trim()

    // Skip if too short or doesn't have meaningful content
    if (cleaned.length <= 10) continue

    // Skip speaker labels — generic: anything that looks like a label with metadata separators
    if (/^(ATC|Pilot|PLT|ATCO|Tower|Ground|Approach|Departure|Center)[\s:]*$/i.test(cleaned)) continue
    // Skip metadata labels (e.g. "APPDEP_PAEC09_C007_Phi_MNL:" or "Pilot_PAEC09_C007_Phi_MNL:")
    if (/^[A-Za-z][A-Za-z\d_\-./]*[\s:]*$/i.test(cleaned) && /[_]/.test(cleaned)) continue

    // Skip "Expected:" text or purely parenthetical content
    if (/^\(Expected:/i.test(cleaned) || /^\([^)]*\)$/.test(cleaned)) continue

    // Must have some alphabetic content (not just punctuation/numbers)
    if (!/[a-zA-Z]{3,}/.test(cleaned)) continue

    const withoutBrackets = cleaned.replace(/\[\[|\]\]/g, '')
    segments.push(withoutBrackets)
  }

  if (segments.length >= 2) {
    return segments
  }

  // Method 2: Look for pattern ."" or "." to split consecutive quotes
  segments.length = 0
  const consecutivePattern = /\."[\s]*"|"\s*"/g
  if (consecutivePattern.test(normalized)) {
    const parts = normalized.split(/\."[\s]*"|"\s*"/)
    for (const part of parts) {
      const cleaned = part.replace(/^"|"$/g, '').replace(/\[\[|\]\]/g, '').trim()
      if (cleaned.length > 3 && /[a-zA-Z]{2,}/.test(cleaned)) {
        segments.push(cleaned)
      }
    }
  }

  if (segments.length >= 2) {
    return segments
  }

  // Method 3: Content-based split - look for callsign patterns to detect dialogue boundaries
  // Pattern: "CALLSIGN, instruction..." followed by another "Response, CALLSIGN"
  segments.length = 0
  const callsignPattern = /\b([A-Z]{2,3}\d{2,4}|[A-Z]{3,})\b/g
  const callsigns = normalized.match(callsignPattern) || []

  if (callsigns.length >= 2 && callsigns[0] && callsigns[1]) {
    // Find where second callsign appears - that's likely the response start
    const firstCallsign = callsigns[0]
    const secondCallsign = callsigns[1]
    const firstIdx = normalized.indexOf(firstCallsign)
    const secondIdx = normalized.indexOf(secondCallsign, firstIdx + firstCallsign.length)

    if (secondIdx > 10) {
      // Look backwards for a quote or period before second callsign
      const beforeSecond = normalized.substring(0, secondIdx).trim()
      const afterSecond = normalized.substring(secondIdx).trim()

      // Clean both parts
      const part1 = beforeSecond.replace(/^"|"$/g, '').replace(/\[\[|\]\]/g, '').trim()
      const part2 = afterSecond.replace(/^"|"$/g, '').replace(/\[\[|\]\]/g, '').trim()

      if (part1.length > 5 && part2.length > 5) {
        segments.push(part1)
        segments.push(part2)
      }
    }
  }

  if (segments.length >= 2) {
    return segments
  }

  // Method 4: Split by period followed by quote-like pattern or uppercase start
  segments.length = 0
  const sentenceSplitPattern = /\.\s*"?\s*(?=[A-Z][a-z]*,|\[\[|")/
  const sentenceParts = normalized.split(sentenceSplitPattern)

  for (const part of sentenceParts) {
    const cleaned = part.replace(/^"|"$/g, '').replace(/\[\[|\]\]/g, '').trim()
    if (cleaned.length > 5 && /[a-zA-Z]{2,}/.test(cleaned)) {
      segments.push(cleaned)
    }
  }

  return segments
}

// Infer speaker from content (ATC gives instructions, Pilot responds)
function inferSpeakerFromContent(text: string, index: number): 'ATC' | 'PILOT' | 'UNKNOWN' {
  // PRIORITY 1: Callsign at END is the strongest pilot indicator
  // Pilots always end readbacks with their callsign, ATC starts with it
  const callsignAtEnd = /,\s*[A-Z]{2,4}\s*\d{2,4}\.?$/i.test(text) ||
                        CALLSIGN_AT_END_RE.test(text)
  if (callsignAtEnd) {
    return 'PILOT'
  }

  // PRIORITY 2: Callsign at START is a strong ATC indicator (ATC addressing aircraft)
  const callsignAtStart = /^[A-Z]{2,4}\s*\d{2,4}[,\s]/i.test(text) ||
                          CALLSIGN_AT_START_RE.test(text)
  if (callsignAtStart) {
    return 'ATC'
  }

  // PRIORITY 3: ATC-specific patterns (corrections, confirmations, commands)
  // These patterns are ONLY used by ATC, never pilots
  const atcOnlyPatterns = [
    /\bnegative[—Loss–-]/i,                       // "negative—" ATC correction (with em-dash/en-dash)
    /\bconfirm\b/i,                               // "confirm" is ATC asking for verification
    /\bsay\s+again/i,                             // ATC requesting repeat
    /\bread\s*back/i,                             // ATC requesting readback
    /\bverify/i,                                  // ATC verifying
    /\bcorrection/i,                              // ATC making correction
    /\bdisregard/i,                               // ATC canceling
    /\bstandby/i,                                 // ATC putting on hold
    /\bradar\s+contact/i,
    /\bidentified/i,
    /\bcontact\s+\w+\s+(on|one)/i,                // Contact facility on frequency
    /\bwhen\s+passing/i,                          // Conditional instruction
    /\bafter\s+passing/i,                         // After condition
  ]

  if (atcOnlyPatterns.some(p => p.test(text))) {
    return 'ATC'
  }

  // PRIORITY 4: Strong Pilot indicators (acknowledging/responding)
  const pilotPatterns = [
    /\b(roger|wilco)\b/i,                         // Pure acknowledgments
    /\bunable\b/i,                                // Pilot declining
    /\b(requesting|request)\b/i,
    /\bwith\s+you\b/i,
    /\bready\s+(for|to)/i,
    /\bchecking\s+in/i,
    /\b(climbing|descending|turning|maintaining)\b/i, // Present participle = pilot action
  ]

  if (pilotPatterns.some(p => p.test(text))) {
    return 'PILOT'
  }

  // PRIORITY 5: ATC command patterns
  const atcCommandPatterns = [
    /\b(climb|descend)\s+(and\s+)?(maintain|to)/i,
    /\bturn\s+(left|right)/i,
    /\b(maintain|reduce|increase)\s+(speed|FL|flight\s*level|\d)/i,
    /\bcleared\s+(for|to|ils|rnav|vor|visual|takeoff|land)/i,
    /\bcontact\s+\w+/i,
    /\bsquawk\s+\d/i,
    /\btaxi\s+(to|via)/i,
    /\bhold\s+short/i,
    /\bline\s+up\s+and\s+wait/i,
    /\bexpect\s+(vectors|ils|rnav|runway|delay)/i,
    /\bvectors?\s+for/i,
    /\breport\s+(passing|established|ready)/i,
  ]

  if (atcCommandPatterns.some(p => p.test(text))) {
    return 'ATC'
  }

  // Alternating pattern assumption: even index = ATC, odd index = PILOT
  // (ATC typically speaks first in an exchange)
  return index % 2 === 0 ? 'ATC' : 'PILOT'
}

// Infer speakers from context when labels are missing
function inferSpeakersFromContext(lines: ParsedLine[]): void {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].speaker === 'UNKNOWN') {
      lines[i].speaker = inferSpeakerFromContent(lines[i].text, i)
    }
  }
}

// Clean text - remove brackets, extra quotes, speaker labels, normalize
function cleanText(text: string): string {
  let cleaned = text
    .replace(/\[\[|\]\]/g, '') // Remove [[ and ]] markers

  // GENERIC: Strip label prefix if present (anything before colon that classifies as speaker/metadata)
  const labelMatch = cleaned.match(/^([^"":]{1,80}):\s*(.*)$/)
  if (labelMatch) {
    const label = labelMatch[1].trim()
    const classified = classifyLabel(label)
    const looksLikeMetadata = /[_]/.test(label) || /^[A-Z\d_\-\s.]+$/.test(label)
    if (classified !== 'UNKNOWN' || looksLikeMetadata) {
      cleaned = labelMatch[2]
    }
  }

  return stripQuotes(cleaned)
}

function identifySpeaker(line: string): 'ATC' | 'PILOT' | 'UNKNOWN' {
  // GENERIC: Try to extract a label before the first colon
  const labelMatch = line.match(/^([^"":]+):\s*/)
  if (labelMatch) {
    const label = labelMatch[1].trim()
    const classified = classifyLabel(label)
    if (classified !== 'UNKNOWN') return classified
  }

  // Legacy explicit patterns (kept as fallback for formats without colon)
  // Patterns are built dynamically from atcData constants — add new
  // airlines/facilities there, not here.
  if (ATC_ROLE_LABEL_RE.test(line) || FACILITY_LABEL_RE.test(line)) return 'ATC'
  if (PILOT_ROLE_LABEL_RE.test(line) || /^P[:\s]/i.test(line) ||
      CALLSIGN_LABEL_RE.test(line) || PH_REGISTRATION_RE.test(line)) return 'PILOT'

  // No explicit label - try to infer from content
  return inferSpeakerFromContent(line, 0)
}

function cleanSpeakerLabel(line: string): string {
  // GENERIC: Strip everything before and including the first colon if it looks like a label
  // A label is: non-quote chars before a colon, NOT part of the dialogue itself
  const labelMatch = line.match(/^([^"":]{1,80}):\s*(.*)$/)
  if (labelMatch) {
    const label = labelMatch[1].trim()
    // Only strip if the label classifies as a speaker (ATC/PILOT) or looks like a metadata label
    // (contains underscores, all-caps segments, etc.)
    const classified = classifyLabel(label)
    const looksLikeMetadata = /[_]/.test(label) || /^[A-Z\d_\-\s.]+$/.test(label)
    if (classified !== 'UNKNOWN' || looksLikeMetadata) {
      return stripQuotes(labelMatch[2])
    }
  }

  // Legacy cleanup — all patterns built from atcData constants
  return line
    .replace(/^(ATC|PILOT|TOWER|GROUND|APPROACH|DEPARTURE|CONTROL|RADAR|CENTER|P)[:\s]*/i, '')
    .replace(FACILITY_LABEL_RE, '')
    .replace(CALLSIGN_LABEL_RE, '')
    .replace(PH_REGISTRATION_RE, '')
    .replace(/\[\[|\]\]/g, '')
    .replace(/^["'""\s]+|["'""\s]+$/g, '')
    .trim()
}

// ============================================================================
// ERROR DETECTION
// ============================================================================

// Context-aware error detection with dynamic weight adjustment
function detectAllErrorsWithContext(
  lines: ParsedLine[],
  corpusType: string,
  context: ConversationContext
): PhraseologyError[] {
  const errors: PhraseologyError[] = []
  let issueAccumulator = context.issueAccumulator

  for (const line of lines) {
    const lineErrors: PhraseologyError[] = []

    // Check non-standard phrases
    lineErrors.push(...detectNonStandardPhrases(line))

    // Check number errors
    lineErrors.push(...detectNumberErrors(line))

    // Check structural issues
    lineErrors.push(...detectStructuralIssues(line))

    // Check safety-critical patterns
    lineErrors.push(...detectSafetyCriticalIssues(line))

    // Corpus-specific checks
    if (corpusType === 'APP/DEP') {
      lineErrors.push(...detectAppDepSpecificErrors(line))
    } else if (corpusType === 'GND') {
      lineErrors.push(...detectGndSpecificErrors(line))
    }

    // Apply dynamic weight adjustment based on context
    for (const error of lineErrors) {
      const adjustedError = adjustErrorSeverity(error, context)

      // Update issue accumulator for pattern detection
      issueAccumulator = updateIssueAccumulator(issueAccumulator, {
        line: error.line,
        weight: adjustedError.weight,
      })

      // Add escalation warning only for medium/high weight errors.
      // Low-weight flags (number pronunciation, minor phrasing) should never
      // carry the 🔴 warning — that would mislead reviewers into thinking a
      // mostly-correct dialogue has systematic safety issues.
      if (
        issueAccumulator.escalationLevel >= 2 &&
        issueAccumulator.patternDetected &&
        (adjustedError.weight === 'medium' || adjustedError.weight === 'high')
      ) {
        adjustedError.whyItMatters = `${adjustedError.whyItMatters || ''}\n\n🔴 ${issueAccumulator.patternDetected}`
      }

      errors.push(adjustedError)
    }
  }

  // Add context-based errors from exchange pair analysis
  errors.push(...generateExchangePairErrors(context, corpusType))

  // Update context with final accumulator state
  context.issueAccumulator = issueAccumulator

  return errors
}

// Adjust error weight based on flight phase and context
function adjustErrorSeverity(
  error: PhraseologyError,
  context: ConversationContext
): PhraseologyError {
  const adjusted = { ...error }

  // Emergency context - escalate everything
  if (context.emergencyDeclared) {
    if (adjusted.weight === 'low') adjusted.weight = 'medium'
    if (adjusted.weight === 'medium') adjusted.weight = 'high'
    adjusted.whyItMatters = `⚠️ EMERGENCY CONTEXT: ${adjusted.whyItMatters || 'Heightened accuracy required during emergency.'}`
  }

  // TCAS active - altitude errors are critical
  if (context.tcasActive && error.category === 'number') {
    if (/altitude|flight\s+level|FL/i.test(error.issue)) {
      adjusted.weight = 'high'
      adjusted.whyItMatters = `⚠️ TCAS ACTIVE: ${adjusted.whyItMatters || 'Altitude accuracy is essential during TCAS RA.'}`
    }
  }

  // Critical flight phases - escalate procedural errors
  if (context.flightPhase === 'approach' || context.flightPhase === 'landing') {
    if (error.category === 'procedure' || error.category === 'structure') {
      if (adjusted.weight === 'low') adjusted.weight = 'medium'
      if (adjusted.weight === 'medium' && error.safetyImpact === 'safety') {
        adjusted.weight = 'high'
      }
      adjusted.explanation = `[APPROACH/LANDING PHASE] ${adjusted.explanation || ''}`
    }
  }

  if (context.flightPhase === 'departure') {
    // Altitude and heading errors are more critical during departure
    if (/altitude|heading|climb/i.test(error.issue)) {
      if (adjusted.weight === 'low') adjusted.weight = 'medium'
      adjusted.explanation = `[DEPARTURE PHASE] ${adjusted.explanation || ''}`
    }
  }

  if (context.flightPhase === 'ground') {
    // Runway and taxi instructions are critical on ground
    if (/runway|taxi|hold\s+short/i.test(error.issue)) {
      if (adjusted.weight === 'medium') adjusted.weight = 'high'
      adjusted.explanation = `[GROUND PHASE] ${adjusted.explanation || ''}`
    }
  }

  return adjusted
}

// Generate errors from exchange pair analysis
function generateExchangePairErrors(context: ConversationContext, corpusType: string = 'APP/DEP'): PhraseologyError[] {
  const errors: PhraseologyError[] = []

  for (const pair of context.exchangePairs) {
    // Skip if readback was complete
    if (pair.readbackQuality === 'complete') continue

    // Skip very short ATC lines — these are PDF line-split fragments, not
    // standalone instructions (e.g. "eight eight four.", "two.", "three.")
    if (pair.atcLine.text.trim().split(/\s+/).length < 4) continue

    // Generate error based on exchange pair analysis
    const dynamicFeedback = generateDynamicFeedback(pair, context.flightPhase)

    // Map contextual weight to standard weight
    const weightMap: Record<string, 'low' | 'medium' | 'high'> = {
      'low': 'low',
      'medium': 'medium',
      'high': 'high',
      'critical': 'high', // Map critical to high for the standard type
    }

    // ==========================================================================
    // NEW: Use semantic analyzer for detailed error information
    // ==========================================================================
    const atcText = pair.atcLine.text
    const pilotText = pair.pilotLine?.text || ''
    const semanticResult = semanticAnalyzeReadback(atcText, pilotText, context.primaryCallsign || undefined)

    // Find matching training example for better explanations
    const trainingMatch = findMatchingTrainingExample(atcText, pilotText, corpusType)

    if (pair.readbackQuality === 'incorrect') {
      // Get specific error details from semantic analysis
      const errorDetails = semanticResult.errors.map(e => e.explanation).join(' ')
      const expectedReadback = semanticResult.expectedResponse

      errors.push({
        line: pair.pilotLine?.lineNumber || pair.atcLine.lineNumber,
        original: pair.pilotLine?.rawText || 'No response',
        issue: semanticResult.errors.length > 0
          ? `INCORRECT READBACK: ${semanticResult.errors[0].explanation}`
          : `INCORRECT READBACK: ${pair.instructionType} values don't match ATC instruction`,
        suggestion: `Correct readback: "${expectedReadback}"`,
        weight: 'high',
        category: 'safety',
        safetyImpact: 'safety',
        icaoReference: semanticResult.errors[0]?.icaoReference || 'ICAO Doc 4444 Section 12.3.1.5',
        explanation: errorDetails || `The pilot's readback contained incorrect values for ${pair.instructionType}. This could lead to the pilot executing the wrong instruction.`,
        whyItMatters: trainingMatch
          ? `${dynamicFeedback}\n\n📚 Training Note: ${trainingMatch.explanation}`
          : dynamicFeedback,
        incorrectPhrase: pair.pilotLine?.text || '',
        correctExample: `Should be: "${expectedReadback}"`,
      })
    } else if (pair.readbackQuality === 'missing' && pair.contextualWeight !== 'low') {
      // Detect if pilot used improper acknowledgment like "Roger", "Copy", etc.
      const improperAckMatch = pilotText.match(/\b(roger|copied|copy|ok|okay|understood|got\s*it|wilco)\b/i)
      const improperAck = improperAckMatch ? improperAckMatch[0] : null
      const expectedReadback = semanticResult.expectedResponse

      errors.push({
        line: pair.pilotLine?.lineNumber || pair.atcLine.lineNumber,
        original: pair.pilotLine?.rawText || 'No response detected',
        issue: improperAck
          ? `"${improperAck.toUpperCase()}" is inadequate - missing ${pair.instructionType} readback`
          : `Missing readback for ${pair.instructionType} instruction`,
        suggestion: `Correct readback: "${expectedReadback}"`,
        weight: weightMap[pair.contextualWeight],
        category: 'structure',
        safetyImpact: pair.contextualWeight === 'critical' || pair.contextualWeight === 'high' ? 'safety' : 'clarity',
        icaoReference: 'ICAO Doc 4444 Section 12.3.1.5',
        explanation: improperAck
          ? `"${improperAck.toUpperCase()}" only indicates message received. It does NOT confirm understanding of ${pair.instructionType}. ATC needs verbal confirmation of the specific values.`
          : dynamicFeedback,
        incorrectPhrase: improperAck || undefined,
        correctExample: `Should be: "${expectedReadback}"`,
        whyItMatters: trainingMatch
          ? `${trainingMatch.explanation}`
          : `In the current ${context.flightPhase} phase, proper readback of ${pair.instructionType} is essential for accurate communication.`,
      })
    } else if (pair.readbackQuality === 'partial') {
      const expectedReadback = semanticResult.expectedResponse

      errors.push({
        line: pair.pilotLine?.lineNumber || pair.atcLine.lineNumber,
        original: pair.pilotLine?.rawText || '',
        issue: `Incomplete readback for ${pair.instructionType}`,
        suggestion: `Complete readback: "${expectedReadback}"`,
        // Partial readbacks are always clarity issues (pilot DID acknowledge, just incompletely).
        // Cap at 'medium' regardless of contextual weight — prevents high-context partial readbacks
        // from being penalized at the same rate as completely missing readbacks.
        weight: weightMap[pair.contextualWeight] === 'high' ? 'medium' : weightMap[pair.contextualWeight],
        category: 'structure',
        safetyImpact: 'clarity',
        icaoReference: 'ICAO Doc 4444 Section 12.3.1.5',
        explanation: dynamicFeedback,
        whyItMatters: `Partial readbacks can lead to misunderstandings. Required elements: ${getRequiredElements(pair.instructionType)}`,
      })
    }
  }

  return errors
}

// Helper: Find matching training example for better error explanations
// NOTE: Only returns examples when there's a very specific match to avoid false positives
function findMatchingTrainingExample(atcInstruction: string, pilotReadback: string, corpusType: string = 'APP/DEP'): { explanation: string } | null {
  const atcLower = atcInstruction.toLowerCase()
  const pilotLower = pilotReadback.toLowerCase()

  // Extract the actual values from the current instruction for comparison
  const atcNorm = normalizeSpelledNumbers(atcLower)
  const pilotNorm = normalizeSpelledNumbers(pilotLower)

  const corpus = corpusType === 'GND' ? GND_CORPUS : DEPARTURE_APPROACH_CORPUS

  for (const example of corpus) {
    if (!example.isCorrect || !example.explanation) continue

    // For parameter confusion
    if (example.errorType === 'parameter_confusion') {
      if (corpusType === 'APP/DEP') {
        // APP/DEP: heading vs altitude confusion
        const atcHasHeading = /heading\s*\d+/.test(atcNorm)
        const pilotHasAltitude = /flight\s*level|FL\s*\d|climb|descend/.test(pilotNorm)
        const atcHasAltitude = /flight\s*level|FL\s*\d|climb|descend/.test(atcNorm)
        const pilotHasHeading = /heading\s*\d+/.test(pilotNorm)

        if ((atcHasHeading && pilotHasAltitude && !atcHasAltitude) ||
            (atcHasAltitude && pilotHasHeading && !atcHasHeading)) {
          return { explanation: example.explanation }
        }
      } else if (corpusType === 'GND') {
        // GND: line up and wait vs takeoff clearance confusion
        const atcHasLUAW = /line\s*up\s*(and\s*)?wait/i.test(atcLower)
        const pilotHasTO = /cleared\s+(for\s+)?take\s*off/i.test(pilotLower)
        if (atcHasLUAW && pilotHasTO) {
          return { explanation: example.explanation || 'Confused line up and wait with takeoff clearance' }
        }
      }
    }

    // For wrong direction: pilot said left when ATC said right, or vice versa (APP/DEP only)
    if (example.errorType === 'wrong_direction' && corpusType === 'APP/DEP') {
      const atcSaidRight = /\bright\b/.test(atcLower)
      const atcSaidLeft = /\bleft\b/.test(atcLower)
      const pilotSaidRight = /\bright\b/.test(pilotLower)
      const pilotSaidLeft = /\bleft\b/.test(pilotLower)

      if ((atcSaidRight && pilotSaidLeft) || (atcSaidLeft && pilotSaidRight)) {
        return { explanation: 'Turn direction error: pilot read back opposite direction' }
      }
    }

    // For missing readback: pilot just said "roger" or similar
    if (example.errorType === 'incomplete_readback' && /\b(roger|copy|wilco)\b/.test(pilotLower)) {
      return { explanation: example.explanation }
    }
  }

  return null
}

// Get required elements for different instruction types
function getRequiredElements(instructionType: string): string {
  const requirements: Record<string, string> = {
    altitude: 'altitude/flight level, climb/descend, callsign',
    heading: 'turn direction, heading value, callsign',
    speed: 'speed value, callsign',
    squawk: 'squawk code, callsign',
    frequency: 'facility name, frequency, callsign',
    takeoff: '"cleared for takeoff", runway, callsign',
    landing: '"cleared to land", runway, callsign',
    hold: '"hold short", runway, callsign',
    lineup: '"line up and wait", runway, callsign',
    approach: 'approach type, runway, callsign',
  }
  return requirements[instructionType] || 'all instruction elements, callsign'
}


function detectNonStandardPhrases(line: ParsedLine): PhraseologyError[] {
  if (line.speaker !== 'PILOT') return []
  const errors: PhraseologyError[] = []

  for (const phrase of NON_STANDARD_PHRASES) {
    const match = line.text.match(phrase.nonStandard)
    // If the phrase has an excludePattern and it matches the same line, skip.
    // This lets the JSON control context-specific suppression (e.g. "take off"
    // should not be flagged when "cleared" appears anywhere on the same line).
    if (match && phrase.exclude && phrase.exclude.test(line.text)) continue
    if (match) {
      const incorrectPhrase = match[0]
      const weight = phrase.weight === 'critical' ? 'high' : phrase.weight
      errors.push({
        line: line.lineNumber,
        original: line.rawText,
        issue: phrase.explanation,
        suggestion: `Use "${phrase.standard}" instead`,
        weight: weight as 'low' | 'medium' | 'high',
        category: phrase.category === 'acknowledgment' || phrase.category === 'instruction'
          ? 'language' : 'procedure',
        safetyImpact: phrase.safetyImpact,
        icaoReference: getICAOReference(phrase.category),
        explanation: getDetailedExplanation(phrase),
        correctExample: generateCorrectExample(phrase, line.text),
        incorrectPhrase: incorrectPhrase,
        whyItMatters: getWhyItMatters(phrase.safetyImpact, phrase.category),
      })
    }
  }

  return errors
}

// Helper functions for enhanced descriptions
function getICAOReference(category: string): string {
  switch (category) {
    case 'acknowledgment':
      return 'ICAO Doc 9432 (Manual of Radiotelephony) Section 5.3'
    case 'instruction':
      return 'ICAO Doc 4444 (PANS-ATM) Chapter 12'
    case 'clarification':
      return 'ICAO Doc 9432 Section 5.1.1'
    case 'emergency':
      return 'ICAO Doc 9432 Chapter 8 (Emergency Procedures)'
    case 'number':
      return 'ICAO Doc 9432 Section 5.2.1.4 (Transmission of Numbers)'
    default:
      return 'ICAO Doc 9432 (Manual of Radiotelephony)'
  }
}

function getDetailedExplanation(phrase: PhraseCorrection): string {
  const explanations: Record<string, string> = {
    'acknowledgment': `The phrase you used is commonly heard but is not part of the ICAO standard phraseology. Standard phraseology ensures consistent, unambiguous communication worldwide. Using "${phrase.standard}" is the internationally recognized way to confirm receipt of a message.`,
    'instruction': `ICAO standard phraseology uses specific terms to convey precise meanings. The non-standard phrase could be misinterpreted or may not be understood by pilots/controllers from different regions. "${phrase.standard}" is universally understood in aviation.`,
    'clarification': `When clarification is needed, ICAO prescribes specific phrases to indicate exactly what information is required. This prevents further confusion and ensures efficient communication.`,
    'number': `Numbers in aviation must be pronounced using the ICAO phonetic number system. This system was developed because certain numbers sound similar, especially over radio with background noise or poor reception.`,
  }
  return explanations[phrase.category] || phrase.explanation
}

function generateCorrectExample(phrase: PhraseCorrection, originalText: string): string {
  const std = phrase.standard.trim()
  // Strip the non-standard word when:
  //   • standard is a format template with [...] placeholders (e.g. "[frequency] [callsign]")
  //   • standard starts with "(omit" (e.g. "(omit)" or "(omit — use no social pleasantry)")
  // In both cases we simply remove the offending word/phrase and tidy up extra spaces/commas.
  if (/\[.+?\]/.test(std) || /^\(omit/i.test(std)) {
    return originalText
      .replace(phrase.nonStandard, '')
      .replace(/,\s*,/g, ',')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }
  return originalText.replace(phrase.nonStandard, std)
}

function getWhyItMatters(impact?: string, category?: string): string {
  if (impact === 'safety') {
    // Add incident context for safety-critical issues
    if (category === 'instruction') {
      return 'Non-standard phraseology contributes to miscommunication. The 1977 Tenerife disaster (583 deaths) was partly caused by non-standard phraseology and miscommunication. Clear, standard language saves lives.'
    }
    return 'Precise phraseology prevents miscommunication. could lead to loss of separation, runway incursions, or altitude deviations.'
  } else if (impact === 'clarity') {
    return 'Clear communication prevents misunderstandings that could require additional clarification, wasting valuable radio time and potentially causing confusion.'
  } else if (impact === 'efficiency') {
    return 'Standard phraseology is more concise and efficient, reducing radio congestion and ensuring timely communication in busy airspace.'
  }
  return 'Using standard ICAO phraseology ensures your communications are understood universally by aviation professionals worldwide.'
}

function detectNumberErrors(line: ParsedLine): PhraseologyError[] {
  if (line.speaker !== 'PILOT') return []
  const errors: PhraseologyError[] = []

  for (const numError of NUMBER_PRONUNCIATION_ERRORS) {
    // Use pattern or nonStandard regex
    const pattern = numError.pattern || numError.nonStandard
    if (!pattern) continue

    const match = line.text.match(pattern)
    if (match) {
      // Build incident reference note if available
      const incidentNote = numError.incident
        ? `\n\n⚠️ Real incident: ${numError.incident}`
        : ''

      // Use specific ICAO reference if available, otherwise default
      const icaoRef = numError.icaoDoc || 'ICAO Doc 9432 Section 5.2.1.4 (Transmission of Numbers)'

      // Build comprehensive explanation with incident data
      const baseExplanation = `ICAO requires specific number pronunciations to prevent misunderstandings over radio. "${numError.correct}" is designed to be distinct and unambiguous, even with poor radio reception or background noise.`
      const fullExplanation = baseExplanation + incidentNote

      // Enhanced "why it matters" with real incident context
      let whyItMatters = 'Incorrect number pronunciation can cause altitude busts, heading deviations, or frequency errors - all potentially dangerous situations.'
      if (numError.incident) {
        whyItMatters = `This exact issue has caused real aviation incidents. ${numError.incident}. Using proper ICAO pronunciation prevents these dangerous miscommunications.`
      }

      // Map weight
      const weight = numError.weight === 'critical' ? 'high' : numError.weight

      errors.push({
        line: line.lineNumber,
        original: line.rawText,
        issue: numError.issue || numError.explanation,
        suggestion: `Use "${numError.correct}" for ICAO standard pronunciation`,
        weight: weight as 'low' | 'medium' | 'high',
        category: 'number',
        icaoReference: icaoRef,
        explanation: fullExplanation,
        incorrectPhrase: match[0],
        correctExample: line.text.replace(pattern, numError.correct),
        whyItMatters: whyItMatters,
      })
    }
  }

  // Check heading format (must be 3 digits)
  const headingMatch = line.text.match(/heading\s+(\d+)/i)
  if (headingMatch) {
    const heading = headingMatch[1]
    if (heading.length !== 3) {
      const correctedHeading = heading.padStart(3, '0')
      errors.push({
        line: line.lineNumber,
        original: line.rawText,
        issue: 'Heading must be expressed as 3 digits',
        suggestion: `Use "heading ${correctedHeading}" instead of "heading ${heading}"`,
        weight: 'low',
        category: 'number',
        icaoReference: 'ICAO Doc 9432 Section 5.2.1.4.1',
        explanation: 'All headings must be expressed using three digits (001-360). This prevents confusion between similar-sounding headings and ensures clarity in navigation instructions.',
        incorrectPhrase: `heading ${heading}`,
        correctExample: line.text.replace(/heading\s+\d+/i, `heading ${correctedHeading}`),
        whyItMatters: 'A heading error, even a small one, can result in significant deviation from the intended flight path, potentially causing traffic conflicts.',
      })
    }

    const headingValue = parseInt(heading)
    if (headingValue < 1 || headingValue > 360) {
      errors.push({
        line: line.lineNumber,
        original: line.rawText,
        issue: 'Invalid heading value - outside valid range',
        suggestion: 'Heading must be between 001 and 360',
        weight: 'high',
        category: 'number',
        safetyImpact: 'safety',
        icaoReference: 'ICAO Doc 9432 Section 5.2.1.4.1',
        explanation: 'Magnetic headings range from 001° to 360°. A heading of 000° should be expressed as 360°. Values outside this range are physically impossible.',
        incorrectPhrase: `heading ${heading}`,
        whyItMatters: 'An invalid heading value indicates a serious transmission error that must be corrected immediately to ensure safe navigation.',
      })
    }
  }

  // Check flight level format
  const flMatch = line.text.match(/FL\s*(\d+)/i)
  if (flMatch) {
    const fl = flMatch[1]
    if (fl.length < 2 || fl.length > 3) {
      errors.push({
        line: line.lineNumber,
        original: line.rawText,
        issue: 'Flight level format incorrect',
        suggestion: 'Flight levels should be 2-3 digits (e.g., FL350, FL50)',
        weight: 'low',
        category: 'number',
        icaoReference: 'ICAO Doc 9432 Section 5.2.1.4.2',
        explanation: 'Flight levels are expressed in hundreds of feet above the standard pressure datum (1013.25 hPa). FL350 means 35,000 feet, FL050 means 5,000 feet.',
        incorrectPhrase: `FL${fl}`,
        whyItMatters: 'Incorrect flight level format could lead to altitude assignment confusion, risking loss of separation between aircraft.',
      })
    }
  }

  // Check squawk code format
  const squawkMatch = line.text.match(/squawk\s+(\d+)/i)
  if (squawkMatch) {
    const squawk = squawkMatch[1]
    if (squawk.length !== 4) {
      errors.push({
        line: line.lineNumber,
        original: line.rawText,
        issue: 'Squawk code must be 4 digits',
        suggestion: `Use 4-digit squawk code (0000-7777). Did you mean "squawk ${squawk.padStart(4, '0')}"?`,
        weight: 'medium',
        category: 'number',
        icaoReference: 'ICAO Doc 9432 Section 5.2.1.4.4',
        explanation: 'Transponder (squawk) codes are always 4 digits, using octal numbers (0-7 only). Each code is unique for radar identification.',
        incorrectPhrase: `squawk ${squawk}`,
        correctExample: line.text.replace(/squawk\s+\d+/i, `squawk ${squawk.padStart(4, '0')}`),
        whyItMatters: 'Incorrect squawk code format prevents proper radar identification of the aircraft.',
      })
    } else if (/[89]/.test(squawk)) {
      errors.push({
        line: line.lineNumber,
        original: line.rawText,
        issue: 'Invalid squawk code - contains digits 8 or 9',
        suggestion: 'Squawk codes use octal digits (0-7) only. This code is physically impossible to set.',
        weight: 'high',
        category: 'number',
        safetyImpact: 'safety',
        icaoReference: 'ICAO Doc 9432 Section 5.2.1.4.4',
        explanation: 'Transponder codes use the OCTAL system (base-8), which only includes digits 0 through 7. Codes containing 8 or 9 cannot exist in the transponder system.',
        incorrectPhrase: `squawk ${squawk}`,
        whyItMatters: 'An impossible squawk code indicates a serious communication error that must be corrected immediately for radar identification.',
      })
    }
  }

  return errors
}

function detectStructuralIssues(line: ParsedLine): PhraseologyError[] {
  const errors: PhraseologyError[] = []

  // Check for missing callsign in pilot responses
  if (line.speaker === 'PILOT' && line.text.length > 15) {
    // Extra check for callsigns that include phonetic alphabet letters mixed with
    // spoken digits, e.g. "Cebu fife Juliet one two tree" (= CEB 5J123).
    // CALLSIGN_SPOKEN_RE only handles spoken-digit suffixes, not letter designators.
    const _phoneticToken = /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|niner|tree|fife|fower|alpha|bravo|charlie|delta|echo|foxtrot|golf|hotel|india|juliet|kilo|lima|mike|november|oscar|papa|quebec|romeo|sierra|tango|uniform|victor|whiskey|x[\-\s]?ray|yankee|zulu)\b/gi
    const _airlineName = /\b(?:philippine|cebu|cathay|emirates|coolred|airphil|dynasty|jetstar|soriano|maharlika|medevac|sunlight|blue\s*jay|gulf\s*air|china|korean|singapore|japan|thai|malaysia|xiamen|qatari|scoot|allnippon|airblue)\b/i
    const hasCallsignWithLetters =
      _airlineName.test(line.text) &&
      ((line.text.match(_phoneticToken) || []).length >= 2)

    const hasCallsign =
      CALLSIGN_IN_TEXT_RE.test(line.text) ||   // ICAO numeric: PAL456, CEB1113
      CALLSIGN_SPOKEN_RE.test(line.text) ||    // spoken: PHILIPPINE four two eight
      PH_REGISTRATION_RE.test(line.text) ||    // registration: RP-C1234
      hasCallsignWithLetters                   // phonetic-letter: Cebu fife Juliet one two tree
    if (!hasCallsign) {
      errors.push({
        line: line.lineNumber,
        original: line.rawText,
        issue: 'Missing callsign in pilot transmission',
        suggestion: 'Always include aircraft callsign at the end of readback',
        weight: 'medium',
        category: 'structure',
        safetyImpact: 'clarity',
      })
    }
  }

  // NOTE: Incomplete readback detection has been removed from this function.
  // It is handled correctly by generateExchangePairErrors() which uses the semantic
  // analyzer. The old checkReadbackCompleteness() approach used findPrecedingATCInstruction()
  // with text line numbers as array indices — causing every pilot line to be evaluated
  // against the WRONG ATC instruction (off by the number of blank lines stripped from the
  // array). This produced systematically false "Incomplete readback - missing: heading,
  // turn direction" errors that drove the ICAO score to 13% and safety score to 0%.

  return errors
}


function detectSafetyCriticalIssues(line: ParsedLine): PhraseologyError[] {
  const errors: PhraseologyError[] = []

  for (const pattern of SAFETY_CRITICAL_PATTERNS) {
    if (pattern.pattern.test(line.text)) {
      errors.push({
        line: line.lineNumber,
        original: line.rawText,
        issue: pattern.description,
        suggestion: 'Verify proper handling of this phrase',
        weight: pattern.weight === 'critical' ? 'high' : 'medium',
        category: 'safety',
        safetyImpact: 'safety',
      })
    }
  }

  return errors
}

function detectAppDepSpecificErrors(line: ParsedLine): PhraseologyError[] {
  const errors: PhraseologyError[] = []

  // ============================================================================
  // ENHANCED COMMAND DETECTION
  // ============================================================================

  // Extract commands using patterns
  const extractedCommands = extractCommandsFromText(line.text)

  // Check for altitude transposition risks — only when numbers are written as digits
  // (PAEC corpus uses spelled-out numbers, so \d+ avoids false positives on spoken text)
  if (line.speaker === 'ATC' &&
      extractedCommands.some(cmd => cmd.includes('climb') || cmd.includes('descend'))) {
    const altMatch = line.text.match(/(\d)\s*(\d)\s*(thousand|hundred)/i)
    if (altMatch) {
      errors.push({
        line: line.lineNumber,
        original: line.rawText,
        issue: 'Altitude readback requires careful verification',
        suggestion: 'Verify altitude digits are in correct order',
        weight: 'low',
        category: 'procedure',
        safetyImpact: 'clarity',
        explanation: 'Altitude transpositions are a common error in ATC communications',
      })
    }
  }

  // "And maintain" check — only applies to ATC instructions, NOT pilot readbacks.
  // Pilot readbacks do not need to mirror the exact ATC wording; confirming the
  // altitude (e.g. "climbing flight level 250") is acceptable per ICAO.
  if (line.speaker === 'ATC') {
    if (/descend\s+to\b/i.test(line.text) && !/descend\s+(to\s+)?(and\s+)?maintain/i.test(line.text)) {
      errors.push({
        line: line.lineNumber,
        original: line.rawText,
        issue: 'Incomplete descent instruction',
        suggestion: 'Use "DESCEND AND MAINTAIN [altitude]" for standard phraseology',
        weight: 'low',
        category: 'procedure',
        safetyImpact: 'clarity',
        icaoReference: 'ICAO Doc 4444 Section 12.3.1',
        explanation: 'Standard phraseology requires explicit "AND MAINTAIN" to confirm target altitude.',
      })
    }

    // "climb to and maintain" IS valid ICAO phraseology — only flag when there's
    // genuinely no "maintain" at all after the "climb to" fragment.
    if (/climb\s+to\b/i.test(line.text) && !/climb\s+(to\s+)?(and\s+)?maintain/i.test(line.text)) {
      errors.push({
        line: line.lineNumber,
        original: line.rawText,
        issue: 'Incomplete climb instruction',
        suggestion: 'Use "CLIMB AND MAINTAIN [altitude]" for standard phraseology',
        weight: 'low',
        category: 'procedure',
        safetyImpact: 'clarity',
        icaoReference: 'ICAO Doc 4444 Section 12.3.1',
        explanation: 'Standard phraseology requires "CLIMB AND MAINTAIN" to confirm target altitude.',
      })
    }
  }

  // ============================================================================
  // ENHANCED SEPARATION INSTRUCTION DETECTION (From ATCOSIM)
  // ============================================================================

  // Check for separation instructions — only on ATC lines.
  // Valid forms per ICAO Doc 4444 Chapter 8:
  //   "turn left/right [heading XXX] for separation"
  //   "expedite climb/descent for separation"
  //   "maintain [heading/altitude] for separation"
  //   "climb/descend [level] for separation"
  if (line.speaker === 'ATC' && /for\s+separation/i.test(line.text)) {
    const hasValidSeparationForm =
      /turn\s+(left|right)/i.test(line.text) ||           // turn with direction
      /expedite\s+(climb|descent)/i.test(line.text) ||    // expedite climb/descent
      /maintain\s+(heading|\d)/i.test(line.text) ||       // maintain heading/altitude
      /\b(climb|descend|descending|climbing)\b/i.test(line.text) // altitude change

    if (!hasValidSeparationForm) {
      errors.push({
        line: line.lineNumber,
        original: line.rawText,
        issue: 'Incomplete separation instruction format',
        suggestion: 'Use "TURN LEFT/RIGHT HEADING [XXX] FOR SEPARATION" or "EXPEDITE CLIMB/DESCENT FOR SEPARATION"',
        weight: 'medium',
        category: 'procedure',
        safetyImpact: 'safety',
        icaoReference: 'ICAO Doc 4444 Chapter 8',
        explanation: 'Separation instructions must specify the action (turn direction, altitude change, or expedite) to be unambiguous.',
      })
    }
  }

  // ============================================================================
  // ENHANCED CONTACT/FREQUENCY DETECTION (From ATCO2)
  // ============================================================================

  // Check for proper frequency format (based on ATCO2 patterns)
  if (/contact\s+\w+/i.test(line.text)) {
    // Check for "decimal" vs "point" (ICAO requires "decimal")
    if (/\d{3}\s+point\s+\d/i.test(line.text)) {
      errors.push({
        line: line.lineNumber,
        original: line.rawText,
        issue: 'Non-standard frequency pronunciation: "point" instead of "decimal"',
        suggestion: 'Use "DECIMAL" not "point" for frequencies (e.g., "ONE ONE NINER DECIMAL ONE")',
        weight: 'low',
        category: 'procedure',
        safetyImpact: 'clarity',
        icaoReference: 'ICAO Doc 9432 Section 5.2.1.4',
        explanation: 'ATCO2 corpus shows European ATC uses "decimal" consistently.',
      })
    }
  }

  // ============================================================================
  // NON-NATIVE SPEAKER ERROR DETECTION
  // ============================================================================

  for (const errorPattern of NON_NATIVE_ERROR_PATTERNS) {
    if (errorPattern.pattern.test(line.text)) {
      if (errorPattern.issue && errorPattern.correction) {
        const weight = errorPattern.weight === 'critical' ? 'high' : errorPattern.weight
        errors.push({
          line: line.lineNumber,
          original: line.rawText,
          issue: errorPattern.issue,
          suggestion: errorPattern.correction,
          weight: weight as 'low' | 'medium' | 'high',
          category: 'language',
          safetyImpact: 'clarity',
          explanation: errorPattern.nativeLanguages?.length
            ? `Non-native speaker pattern (common in ${errorPattern.nativeLanguages.join(', ')} speakers).`
            : 'Non-native speaker pronunciation pattern detected.',
        })
      }
    }
  }

  // ============================================================================
  // SID/STAR VALIDATION
  // ============================================================================

  // Check if SID is mentioned and validate format
  const sidMatch = line.text.match(/\b([A-Z]{4,5}\d[A-Z])\b/i)
  if (sidMatch) {
    const sidName = sidMatch[1].toUpperCase()
    const knownSid = ENHANCED_SIDS.includes(sidName)
    const knownStar = ENHANCED_STARS.includes(sidName)

    // Just validate that the SID/STAR format looks correct
    if (!knownSid && !knownStar) {
      // Unknown procedure - might be valid, just not in our database
    }
  }

  // Check for proper approach clearance format — ATC lines only.
  // Pilot readbacks don't need to say "approach" a second time if the type was given.
  if (line.speaker === 'ATC' &&
      /cleared\s+(ils|rnav|vor|visual|ndb)/i.test(line.text) &&
      !/approach/i.test(line.text)) {
    errors.push({
      line: line.lineNumber,
      original: line.rawText,
      issue: 'Incomplete approach clearance',
      suggestion: 'Include "APPROACH" after the approach type (e.g., "CLEARED ILS APPROACH RUNWAY XX")',
      weight: 'medium',
      category: 'procedure',
      safetyImpact: 'clarity',
      icaoReference: 'ICAO Doc 4444 §8.9.3',
      explanation: 'ICAO standard clearance format: "CLEARED [type] APPROACH RUNWAY [designator]".',
    })
  }

  // Check for vectoring phraseology — ATC lines only.
  if (line.speaker === 'ATC' &&
      /vector/i.test(line.text) &&
      !/vectoring\s+(for|to)/i.test(line.text)) {
    errors.push({
      line: line.lineNumber,
      original: line.rawText,
      issue: 'Incomplete vectoring instruction',
      suggestion: 'Use "VECTORING FOR [approach type] APPROACH" or "VECTORING TO [waypoint]"',
      weight: 'low',
      category: 'procedure',
      safetyImpact: 'clarity',
      icaoReference: 'ICAO Doc 4444 §8.9.1',
    })
  }

  // ── Philippine waypoint check (informational — no error pushed) ──────────
  PHILIPPINE_WAYPOINTS.some(wp => new RegExp(`\\b${wp}\\b`, 'i').test(line.text))

  // ============================================================================
  // ENHANCED HEADING INSTRUCTION DETECTION
  // ============================================================================

  // "Turn heading" without left/right direction is safety-critical — a pilot
  // cannot safely execute a turn without knowing which way to turn.
  // Gate to ATC lines: pilot readbacks may omit "turn" and just say the direction.
  if (line.speaker === 'ATC' &&
      /turn\s+heading/i.test(line.text) &&
      !/turn\s+(left|right)\s+heading/i.test(line.text)) {
    errors.push({
      line: line.lineNumber,
      original: line.rawText,
      issue: 'Missing turn direction',
      suggestion: 'Specify "TURN LEFT HEADING" or "TURN RIGHT HEADING"',
      weight: 'medium',
      category: 'procedure',
      safetyImpact: 'clarity',
      icaoReference: 'ICAO Doc 4444 §12.3.2',
      explanation: 'Without left/right, the turn direction is ambiguous. Standard phraseology requires "TURN LEFT/RIGHT HEADING".',
    })
  }

  // Check for "fly heading" without direction (ATCOSIM shows this is acceptable)
  if (/fly\s+heading\s+\d/i.test(line.text)) {
    // This is acceptable per ATCOSIM corpus - no error
  }

  // Check for heading value format (should be 3 digits)
  const headingMatch = line.text.match(/heading\s+(\d{1,3})/i)
  if (headingMatch) {
    const heading = headingMatch[1]
    if (heading.length < 3 && parseInt(heading) < 100) {
      errors.push({
        line: line.lineNumber,
        original: line.rawText,
        issue: `Heading "${heading}" should be expressed as 3 digits`,
        suggestion: `Use "${heading.padStart(3, '0')}" for clarity (e.g., "HEADING ZERO ${heading.padStart(2, '0')}")`,
        weight: 'low',
        category: 'procedure',
        safetyImpact: 'clarity',
      })
    }
  }

  // ============================================================================
  // ENHANCED CALLSIGN DETECTION
  // ============================================================================

  // Check if a recognized callsign is present
  for (const callsignPrefix of ENHANCED_CALLSIGNS) {
    const pattern = new RegExp(`\\b${callsignPrefix}\\s*\\d{2,4}\\b`, 'i')
    if (pattern.test(line.text)) {
      // Callsign detected - check for proper positioning
      const callsignMatch = line.text.match(pattern)
      if (callsignMatch) {
        const callsign = callsignMatch[0]
        const position = line.text.indexOf(callsign)
        const textLength = line.text.length

        // If callsign is in the middle (not start or end), flag it
        if (position > 5 && position < textLength - callsign.length - 5) {
          // Only flag if this looks like it should be at the end (pilot response)
          if (line.speaker === 'PILOT' && !line.text.endsWith(callsign)) {
            errors.push({
              line: line.lineNumber,
              original: line.rawText,
              issue: 'Callsign position may be non-standard',
              suggestion: 'Pilots typically place callsign at the END of transmissions',
              weight: 'low',
              category: 'procedure',
              safetyImpact: 'clarity',
              explanation: 'Standard practice: Pilot callsigns appear at transmission end.',
            })
          }
        }
      }
      break
    }
  }

  return errors
}

function detectGndSpecificErrors(line: ParsedLine): PhraseologyError[] {
  const errors: PhraseologyError[] = []

  // 1. Deprecated phrase: "taxi into position and hold" (replaced by "line up and wait" in 2012)
  if (line.speaker === 'ATC' && /taxi\s+into\s+position\s+and\s+hold/i.test(line.text)) {
    errors.push({
      line: line.lineNumber,
      original: line.rawText,
      issue: 'Deprecated: "taxi into position and hold"',
      suggestion: 'Use "LINE UP AND WAIT" — ICAO standard since 2012',
      weight: 'medium',
      category: 'procedure',
      safetyImpact: 'clarity',
      icaoReference: 'ICAO Doc 9432 §7.1.3 (2012 amendment)',
      explanation: '"Taxi into position and hold" was retired globally to harmonise with ICAO phraseology. Current standard is "line up and wait".',
    })
  }

  // 2. Pilot uses "roger" or "wilco" alone (≤3 words) as GND readback for safety-critical instruction
  if (line.speaker === 'PILOT' && /\b(roger|wilco|copy)\b/i.test(line.text)) {
    const wordCount = line.text.trim().split(/\s+/).length
    if (wordCount <= 3) {
      errors.push({
        line: line.lineNumber,
        original: line.rawText,
        issue: '"Roger/Wilco" alone is insufficient for GND readbacks',
        suggestion: 'Read back the full instruction including runway, taxiway, and callsign',
        weight: 'medium',
        category: 'procedure',
        safetyImpact: 'safety',
        icaoReference: 'ICAO Doc 4444 §7.11.2',
        explanation: 'Ground instructions affecting runway movements must be fully read back to prevent runway incursions.',
      })
    }
  }

  // 3. ATC line contains BOTH "line up and wait" AND "cleared for takeoff" — ambiguous
  if (
    line.speaker === 'ATC' &&
    /line\s*up\s*(and\s*)?wait/i.test(line.text) &&
    /cleared\s+(for\s+)?take\s*off/i.test(line.text)
  ) {
    errors.push({
      line: line.lineNumber,
      original: line.rawText,
      issue: 'Ambiguous: message contains both "line up and wait" and "cleared for takeoff"',
      suggestion: 'Issue only one instruction to avoid takeoff without clearance',
      weight: 'high',
      category: 'procedure',
      safetyImpact: 'safety',
      icaoReference: 'ICAO Doc 4444 §7.11.3',
      explanation: 'Combining LUAW and takeoff clearance risks pilot commencing takeoff prematurely.',
    })
  }

  return errors
}

// ============================================================================
// READBACK ANALYSIS (Enhanced with ATCO2/ATCOSIM validation)
// ============================================================================

function analyzeReadbacks(lines: ParsedLine[]): ReadbackAnalysis {
  let totalInstructions = 0
  let completeReadbacks = 0
  let incompleteReadbacks = 0
  const missingElements: MissingElement[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.speaker !== 'ATC') continue

    // Check if this is an instruction requiring readback
    const requiresReadback = READBACK_REQUIREMENTS.some(req => req.instruction.test(line.text))
    if (!requiresReadback) continue

    totalInstructions++

    // Find pilot response (only within same conversation group)
    const currentGroup = line.conversationGroup
    const pilotResponse = lines.find((l, idx) => {
      if (idx <= i) return false
      if (l.speaker !== 'PILOT') return false
      // Don't cross conversation boundaries (same fix as buildExchangePairs)
      if (currentGroup !== l.conversationGroup) return false
      return true
    })
    if (!pilotResponse) {
      incompleteReadbacks++
      continue
    }

    // Use the semantic-analyzer-backed evaluateReadbackQuality for accurate scoring.
    // This is the same function used by buildExchangePairs — both now produce consistent
    // results. The old validateReadback/hasElement pipeline has been removed because it
    // did not call the semantic analyzer and produced systematically wrong scores.
    const quality = evaluateReadbackQuality(line, pilotResponse, detectInstructionType(line.text))
    if (quality === 'complete') {
      completeReadbacks++
    } else {
      incompleteReadbacks++
      missingElements.push({
        line: pilotResponse.lineNumber,
        instruction: line.text.substring(0, 50),
        missing: [quality === 'partial' ? 'Incomplete readback' : 'Missing readback'],
        weight: 'recommended',
      })
    }
  }

  const completenessScore = totalInstructions > 0
    ? Math.round((completeReadbacks / totalInstructions) * 100)
    : 100

  return {
    totalInstructions,
    completeReadbacks,
    incompleteReadbacks,
    missingElements,
    completenessScore,
  }
}


// ============================================================================
// SAFETY METRICS
// ============================================================================

function calculateSafetyMetrics(lines: ParsedLine[], errors: PhraseologyError[], exchangeCount: number): SafetyMetrics {
  const safetyCriticalPhrases: SafetyCriticalDetection[] = []

  for (const line of lines) {
    for (const safetyPattern of SAFETY_CRITICAL_PATTERNS) {
      if (safetyPattern.pattern.test(line.text)) {
        safetyCriticalPhrases.push({
          line: line.lineNumber,
          text: line.rawText,
          type: safetyPattern.weight,
          description: safetyPattern.description,
        })
      }
    }
  }

  const criticalIssues = errors.filter(e => e.weight === 'high' && e.safetyImpact === 'safety').length
  // Non-critical highs only — criticalIssues already counted separately above to avoid double-penalizing
  const highWeightIssues = errors.filter(e => e.weight === 'high' && e.safetyImpact !== 'safety').length
  const mediumWeightIssues = errors.filter(e => e.weight === 'medium').length
  const lowWeightIssues = errors.filter(e => e.weight === 'low').length

  // Calculate safety score (0-100) — density-based to prevent long transcripts from flooring at 0.
  // Low errors don't affect safety; only critical/high/medium errors are weighted.
  const n = Math.max(exchangeCount, 1)
  const safetyFactor = Math.min(1.0,
    (criticalIssues  / n) * 2.0 +
    (highWeightIssues / n) * 1.2 +
    (mediumWeightIssues / n) * 0.3
  )
  const overallSafetyScore = Math.round(Math.max(0, (1 - safetyFactor) * 100))

  return {
    criticalIssues,
    highWeightIssues,
    mediumWeightIssues,
    lowWeightIssues,
    safetyCriticalPhrases,
    overallSafetyScore,
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function countExchanges(lines: ParsedLine[]): number {
  let exchanges = 0
  let lastSpeaker: 'ATC' | 'PILOT' | 'UNKNOWN' | null = null

  for (const line of lines) {
    if (line.speaker !== 'UNKNOWN' && line.speaker !== lastSpeaker) {
      exchanges++
      lastSpeaker = line.speaker
    }
  }

  return Math.ceil(exchanges / 2)
}

function countClarifications(text: string): number {
  const patterns = [
    /say\s+again/gi,
    /confirm/gi,
    /verify/gi,
    /clarify/gi,
    /\?\s*$/gm,
  ]

  let count = 0
  for (const pattern of patterns) {
    const matches = text.match(pattern)
    if (matches) count += matches.length
  }

  return count
}

function calculateRiskLevel(
  errors: PhraseologyError[],
  safetyMetrics: SafetyMetrics,
  readbackAnalysis: ReadbackAnalysis
): 'low' | 'medium' | 'high' {
  if (safetyMetrics.criticalIssues > 0 || safetyMetrics.highWeightIssues >= 5) {
    return 'high'
  }

  if (safetyMetrics.highWeightIssues >= 2 || readbackAnalysis.completenessScore < 50) {
    return 'medium'
  }

  // Exclude low-weight errors (e.g. number-pronunciation) from this threshold —
  // 102 pronunciation flags shouldn't elevate risk when there are no real errors.
  const significantErrors = errors.filter(e => e.weight !== 'low')
  if (significantErrors.length > 10 || readbackAnalysis.completenessScore < 75) {
    return 'medium'
  }

  return 'low'
}

// ============================================================================
// ERROR CATEGORIZATION
// ============================================================================

function categorizeLanguageErrors(errors: PhraseologyError[]): ErrorDetail[] {
  const categories: Record<string, { count: number; examples: string[] }> = {
    'Incomplete phraseology': { count: 0, examples: [] },
    'Wrong terminology': { count: 0, examples: [] },
    'Missing elements': { count: 0, examples: [] },
    'Syntax errors': { count: 0, examples: [] },
  }

  for (const error of errors) {
    if (error.category === 'language' || error.category === 'procedure') {
      if (error.issue.includes('Incomplete') || error.issue.includes('Missing')) {
        categories['Incomplete phraseology'].count++
        if (categories['Incomplete phraseology'].examples.length < 3) {
          categories['Incomplete phraseology'].examples.push(error.original.substring(0, 40))
        }
      } else if (error.issue.includes('Non-standard') || error.issue.includes('Incorrect')) {
        categories['Wrong terminology'].count++
        if (categories['Wrong terminology'].examples.length < 3) {
          categories['Wrong terminology'].examples.push(error.original.substring(0, 40))
        }
      } else {
        categories['Syntax errors'].count++
        if (categories['Syntax errors'].examples.length < 3) {
          categories['Syntax errors'].examples.push(error.original.substring(0, 40))
        }
      }
    } else if (error.category === 'structure') {
      categories['Missing elements'].count++
      if (categories['Missing elements'].examples.length < 3) {
        categories['Missing elements'].examples.push(error.original.substring(0, 40))
      }
    }
  }

  const total = Object.values(categories).reduce((a, b) => a + b.count, 0) || 1

  return Object.entries(categories).map(([type, data]) => ({
    type,
    count: data.count,
    percentage: Math.round((data.count / total) * 100),
    examples: data.examples,
  }))
}

function categorizeNumberErrors(errors: PhraseologyError[], _text: string): ErrorDetail[] {
  const categories: Record<string, number> = {
    'Altitude mismatch': 0,
    'Heading errors': 0,
    'Speed discrepancy': 0,
    'Pronunciation notes': 0,
    'Squawk errors': 0,
  }

  for (const error of errors) {
    if (error.category === 'number') {
      if (error.issue.toLowerCase().includes('altitude') || error.issue.toLowerCase().includes('flight level')) {
        categories['Altitude mismatch']++
      } else if (error.issue.toLowerCase().includes('heading')) {
        categories['Heading errors']++
      } else if (error.issue.toLowerCase().includes('speed')) {
        categories['Speed discrepancy']++
      } else if (error.issue.toLowerCase().includes('squawk')) {
        categories['Squawk errors']++
      } else if (
        error.issue.toLowerCase().includes('pronunciation') ||
        error.issue.toLowerCase().includes('pronounced') ||
        error.issue.toLowerCase().includes('niner') ||
        error.issue.toLowerCase().includes('tree') ||
        error.issue.toLowerCase().includes('fife') ||
        error.issue.toLowerCase().includes('fow-er')
      ) {
        categories['Pronunciation notes']++
      }
    }
  }

  const total = Object.values(categories).reduce((a, b) => a + b, 0) || 1

  return Object.entries(categories).map(([type, count]) => ({
    type,
    count,
    percentage: Math.round((count / total) * 100),
  }))
}

// ============================================================================
// SUMMARY GENERATION
// ============================================================================

function generateComprehensiveSummary(
  errors: PhraseologyError[],
  readbackAnalysis: ReadbackAnalysis,
  safetyMetrics: SafetyMetrics,
  corpusType: string,
  totalWords: number,
  exchangeCount: number
): AnalysisSummary {
  const keyFindings: string[] = []
  const recommendations: string[] = []
  const criticalIssues: string[] = []
  const strengthAreas: string[] = []

  // Analyze high-weight issues
  if (safetyMetrics.criticalIssues > 0) {
    keyFindings.push(`${safetyMetrics.criticalIssues} high-weight phraseology issue${safetyMetrics.criticalIssues === 1 ? '' : 's'} detected`)
    // GND corpus: the ground analyzer handles hold/taxi readback checking with higher
    // accuracy than the base engine's generic READBACK_REQUIREMENTS matching.
    // Suppress base-engine hold/taxi structure errors from Issues Detected to prevent
    // contradictions with "Hold Short Compliance: 100" from the ground analyzer.
    const issueFilter = (e: PhraseologyError) =>
      e.weight === 'high' && e.safetyImpact === 'safety' &&
      !(corpusType === 'GND' && e.category === 'structure' &&
        /hold|taxi/i.test(e.issue))
    criticalIssues.push(...errors
      .filter(issueFilter)
      .slice(0, 3)
      .map(e => e.issue))
  }

  // Analyze readback completeness
  if (readbackAnalysis.totalInstructions > 0) {
    keyFindings.push(`Readback completeness: ${readbackAnalysis.completenessScore}% (${readbackAnalysis.completeReadbacks}/${readbackAnalysis.totalInstructions})`)

    if (readbackAnalysis.completenessScore < 70) {
      recommendations.push('Focus on complete readbacks: include altitude, heading, runway, and callsign')
    } else if (readbackAnalysis.completenessScore >= 90) {
      strengthAreas.push('Excellent readback completeness')
    }
  }

  // Analyze non-standard phraseology
  const nonStandardErrors = errors.filter(e => e.category === 'language')
  if (nonStandardErrors.length > 0) {
    const rate = ((nonStandardErrors.length / (totalWords / 1000)) || 0).toFixed(1)
    keyFindings.push(`Non-standard phraseology rate: ${rate} per 1,000 words`)

    // Find most common issues
    const issueCounts = new Map<string, number>()
    for (const error of nonStandardErrors) {
      const key = error.issue.split('.')[0]
      issueCounts.set(key, (issueCounts.get(key) || 0) + 1)
    }

    const sortedIssues = Array.from(issueCounts.entries()).sort((a, b) => b[1] - a[1])
    if (sortedIssues.length > 0) {
      recommendations.push(`Address most common issue: ${sortedIssues[0][0]}`)
    }
  }

  // Analyze number errors
  const numberErrors = errors.filter(e => e.category === 'number')
  if (numberErrors.length > 0) {
    keyFindings.push(`${numberErrors.length} number-related errors detected`)
    recommendations.push('Review ICAO number pronunciation (NINER, TREE, FIFE, FOW-ER)')
  } else {
    strengthAreas.push('Number pronunciation follows ICAO standards')
  }

  // Corpus-specific recommendations
  if (corpusType === 'APP/DEP') {
    recommendations.push('Review APP/DEP procedures: climb/descend phraseology, approach clearances, vectoring')
  } else if (corpusType === 'GND') {
    recommendations.push('Review GND procedures: hold short phraseology, taxi route readbacks, line up and wait vs takeoff clearance')
  }

  // Calculate compliance score — density-based formula to normalize for transcript length.
  // Absolute error counts are divided by exchange count before weighting, so a 30-exchange
  // transcript with 100 number-pronunciation flags doesn't score worse than a 3-exchange one.
  const ec = Math.max(exchangeCount, 1)
  const complianceFactor = Math.min(1.0,
    (safetyMetrics.criticalIssues  / ec) * 1.5 +
    (safetyMetrics.highWeightIssues / ec) * 1.0 +
    (safetyMetrics.mediumWeightIssues / ec) * 0.4 +
    (safetyMetrics.lowWeightIssues / ec) * 0.1
  )
  const readbackComponent = readbackAnalysis.completenessScore / 100
  const overallCompliance = Math.round(
    Math.max(0, (1 - complianceFactor) * 70 + readbackComponent * 30)
  )

  // Default findings if none detected
  if (keyFindings.length === 0) {
    keyFindings.push('Communication patterns generally follow ICAO standard phraseology')
  }

  if (recommendations.length === 0) {
    recommendations.push('Continue practicing standard ICAO phraseology')
  }

  if (strengthAreas.length === 0 && overallCompliance >= 80) {
    strengthAreas.push('Overall good adherence to standard phraseology')
  }

  return {
    overallCompliance,
    keyFindings,
    recommendations,
    criticalIssues,
    strengthAreas,
  }
}

function generateDetailedFindings(errors: PhraseologyError[], readbackAnalysis: ReadbackAnalysis): DetailedFinding[] {
  const findingsMap = new Map<string, { count: number; impact: 'safety' | 'efficiency' | 'clarity'; examples: string[] }>()

  for (const error of errors) {
    const key = error.issue
    const existing = findingsMap.get(key)

    const impact = error.safetyImpact || (
      error.weight === 'high' ? 'safety' :
      error.category === 'structure' ? 'clarity' : 'efficiency'
    )

    if (existing) {
      existing.count++
      if (existing.examples.length < 3) {
        existing.examples.push(error.original.substring(0, 50))
      }
    } else {
      findingsMap.set(key, { count: 1, impact, examples: [error.original.substring(0, 50)] })
    }
  }

  // Add readback findings
  if (readbackAnalysis.missingElements.length > 0) {
    const elementCounts = new Map<string, number>()
    for (const me of readbackAnalysis.missingElements) {
      for (const element of me.missing) {
        elementCounts.set(element, (elementCounts.get(element) || 0) + 1)
      }
    }

    Array.from(elementCounts.entries()).forEach(([element, count]) => {
      findingsMap.set(`Missing ${element} in readback`, {
        count,
        impact: 'safety',
        examples: readbackAnalysis.missingElements
          .filter(me => me.missing.includes(element))
          .slice(0, 3)
          .map(me => me.instruction),
      })
    })
  }

  return Array.from(findingsMap.entries())
    .map(([description, data]) => ({
      category: getCategoryFromDescription(description),
      description,
      occurrences: data.count,
      impact: data.impact,
      examples: data.examples,
    }))
    .sort((a, b) => {
      // Sort by impact first (safety > clarity > efficiency), then by occurrences
      const impactOrder = { safety: 0, clarity: 1, efficiency: 2 }
      const impactDiff = impactOrder[a.impact] - impactOrder[b.impact]
      if (impactDiff !== 0) return impactDiff
      return b.occurrences - a.occurrences
    })
}

function getCategoryFromDescription(description: string): string {
  const lowerDesc = description.toLowerCase()
  if (lowerDesc.includes('altitude') || lowerDesc.includes('heading') || lowerDesc.includes('speed') || lowerDesc.includes('squawk')) {
    return 'Number/Data Errors'
  }
  if (lowerDesc.includes('readback') || lowerDesc.includes('missing')) {
    return 'Readback Issues'
  }
  if (lowerDesc.includes('non-standard') || lowerDesc.includes('incorrect') || lowerDesc.includes('informal')) {
    return 'Phraseology'
  }
  if (lowerDesc.includes('safety') || lowerDesc.includes('critical')) {
    return 'Safety'
  }
  return 'General'
}
