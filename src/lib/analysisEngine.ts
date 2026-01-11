/**
 * Enhanced Aviation Communication Analysis Engine
 * Analyzes ATC-Pilot dialogues for ICAO compliance and error detection
 * Focused on APP/DEP (Approach/Departure) Control communications
 */

// Consolidated ATC data
import {
  NON_STANDARD_PHRASES,
  NUMBER_PRONUNCIATION_ERRORS,
  APP_DEP_CLEARANCE_PATTERNS,
  READBACK_REQUIREMENTS,
  PHILIPPINE_CALLSIGNS,
  PHILIPPINE_FACILITIES,
  PHILIPPINE_WAYPOINTS,
  SAFETY_CRITICAL_PATTERNS,
  ALTITUDE_FORMATS,
  HEADING_FORMAT,
  SQUAWK_CODES,
  DEPARTURE_COMMANDS,
  ENHANCED_CALLSIGNS,
  ENHANCED_SIDS,
  ENHANCED_STARS,
  NON_NATIVE_ERROR_PATTERNS,
  READBACK_VALIDATIONS,
  DEPARTURE_APPROACH_CORPUS,
  extractCommandsFromText,
  validateReadback,
  calculateEnhancedSeverity,
  type PhraseCorrection,
  type ReadbackRequirement,
  type ATCTrainingExample,
} from './atcData'

// Semantic readback analyzer with ML-based understanding
import {
  analyzeReadback as semanticAnalyzeReadback,
  detectInstructionType as semanticDetectInstructionType,
  generateExpectedReadback,
  normalizeToDigits,
  extractNumericValue,
  type SemanticAnalysisResult,
  type ReadbackError,
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
  contextualSeverity: 'low' | 'medium' | 'high' | 'critical'
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
  severity: 'low' | 'medium' | 'high'
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
  severity: 'mandatory' | 'recommended'
}

export interface SafetyMetrics {
  criticalIssues: number
  highSeverityIssues: number
  mediumSeverityIssues: number
  lowSeverityIssues: number
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
  contextualSeverity: 'low' | 'medium' | 'high' | 'critical'
}

interface IssueAccumulator {
  recentIssues: { line: number; severity: string; timestamp: number }[]
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
    /\b(PAL|CEB|APG|GAP|RPC|SRQ)\s*\d{2,4}\b/gi,
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
        // Look for pilot response within next 3 lines
        let pilotResponse: ParsedLine | null = null
        let responseDelay = 0

        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
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

        // Calculate contextual severity based on phase and instruction type
        const contextualSeverity = calculateContextualSeverity(
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
          contextualSeverity,
        })
      }
    }
  }

  return pairs
}

// Detect what type of instruction an ATC message contains
function detectInstructionType(text: string): string {
  const instructionPatterns: { type: string; pattern: RegExp }[] = [
    // Altitude instructions - critical
    { type: 'altitude', pattern: /(climb|descend)\s+(and\s+)?maintain/i },
    { type: 'altitude', pattern: /(climb|descend)\s+(to\s+)?(flight\s+level|FL|\d)/i },
    { type: 'altitude', pattern: /maintain\s+(flight\s+level|FL|\d)/i },

    // Heading instructions - critical
    { type: 'heading', pattern: /turn\s+(left|right)\s+(heading\s+)?\d/i },
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
    { type: 'frequency', pattern: /contact\s+\w+\s+(on\s+)?\d/i },
    { type: 'frequency', pattern: /monitor\s+\w+/i },
    { type: 'approach', pattern: /cleared\s+(ils|rnav|vor|visual|ndb)\s+approach/i },
    { type: 'takeoff', pattern: /cleared\s+(for\s+)?take\s*off/i },
    { type: 'landing', pattern: /cleared\s+to\s+land/i },
    { type: 'taxi', pattern: /taxi\s+(to|via)/i },
    { type: 'hold', pattern: /hold\s+(short|position|at)/i },
    { type: 'lineup', pattern: /line\s+up\s+and\s+wait/i },
    { type: 'direct', pattern: /proceed\s+direct|direct\s+(to\s+)?\w+/i },

    // Information only (no readback required)
    { type: 'information', pattern: /traffic\s+\d+\s+o'?clock|weather|wind\s+\d/i },
  ]

  for (const { type, pattern } of instructionPatterns) {
    if (pattern.test(text)) {
      return type
    }
  }

  return 'other'
}

// Helper: Convert spelled-out numbers to digits for comparison
function normalizeSpelledNumbers(text: string): string {
  const numberWords: Record<string, string> = {
    'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
    'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
    'niner': '9', 'tree': '3', 'fife': '5', 'fower': '4',
  }

  let normalized = text.toLowerCase()
  for (const [word, digit] of Object.entries(numberWords)) {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'gi'), digit)
  }
  // Remove spaces between consecutive digits
  normalized = normalized.replace(/(\d)\s+(\d)/g, '$1$2')
  return normalized
}

// Helper: Extract altitude value (handles both digits and spelled-out)
function extractAltitude(text: string): string | null {
  const normalized = normalizeSpelledNumbers(text)

  // Try to find flight level
  const flMatch = normalized.match(/flight\s*level\s*(\d{2,3})/i) ||
                  normalized.match(/FL\s*(\d{2,3})/i)
  if (flMatch) return flMatch[1]

  // Try to find altitude in feet
  const altMatch = normalized.match(/(\d{3,5})\s*(feet|ft)?/i)
  if (altMatch) return altMatch[1]

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

  // If semantic analysis found errors, use those results
  if (!semanticResult.isCorrect && semanticResult.errors.length > 0) {
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

    // Map semantic quality to our quality type
    return { quality: semanticResult.quality, mismatchDetails }
  }

  // ==========================================================================
  // FALLBACK: Original logic for cases not caught by semantic analyzer
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
      // These require specific phraseology readback
      const requiredPhrases: Record<string, RegExp> = {
        takeoff: /cleared\s+(for\s+)?take\s*off/i,
        landing: /cleared\s+(to\s+)?land/i,
        lineup: /line\s*up\s*(and\s+)?wait/i,
        hold: /hold\s*short/i,
      }
      if (!requiredPhrases[instructionType]?.test(pilotText)) {
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

// Calculate severity dynamically based on context
function calculateContextualSeverity(
  instructionType: string,
  readbackQuality: string,
  flightPhase: FlightPhase,
  emergencyDeclared: boolean
): 'low' | 'medium' | 'high' | 'critical' {
  // Emergency always escalates severity
  if (emergencyDeclared) {
    if (readbackQuality === 'missing' || readbackQuality === 'incorrect') {
      return 'critical'
    }
    return 'high'
  }

  // Phase-based severity adjustment
  const criticalPhases: FlightPhase[] = ['approach', 'landing', 'departure']
  const isPhraseCritical = criticalPhases.includes(flightPhase)

  // Instruction type severity
  const criticalInstructions = ['altitude', 'takeoff', 'landing', 'lineup', 'hold']
  const isInstructionCritical = criticalInstructions.includes(instructionType)

  // Calculate final severity
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
  newIssue: { line: number; severity: string }
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

  // Calculate escalation level
  const issueCount = updated.recentIssues.length
  if (issueCount >= 4) {
    updated.escalationLevel = 3
    updated.patternDetected = 'Multiple consecutive errors detected - systematic issue'
  } else if (issueCount >= 3) {
    updated.escalationLevel = 2
    updated.patternDetected = 'Error pattern emerging - attention required'
  } else if (issueCount >= 2) {
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

export function analyzeDialogue(input: AnalysisInput): AnalysisOutput {
  const { text, corpusType } = input

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
  const safetyMetrics = calculateSafetyMetrics(parsedLines, phraseologyErrors)

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
    totalWords
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
      contextualSeverity: pair.contextualSeverity,
      issue,
      dynamicFeedback,
    }
  })

  // Identify situational factors that affect analysis
  const situationalFactors: string[] = []

  if (context.emergencyDeclared) {
    situationalFactors.push('⚠️ EMERGENCY DECLARED - All communications are safety-critical')
  }
  if (context.tcasActive) {
    situationalFactors.push('⚠️ TCAS RA Active - Pilot must follow TCAS, not ATC')
  }
  if (context.flightPhase === 'approach' || context.flightPhase === 'landing') {
    situationalFactors.push('📍 Critical flight phase - Extra attention to readbacks required')
  }
  if (context.flightPhase === 'departure') {
    situationalFactors.push('📍 Departure phase - Altitude and heading readbacks are critical')
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
      return `CRITICAL: Incorrect readback for ${pair.instructionType} - values don't match`
    default:
      return null
  }
}

// Generate dynamic, context-aware feedback
function generateDynamicFeedback(pair: ExchangePair, flightPhase: FlightPhase): string {
  const { instructionType, readbackQuality, contextualSeverity } = pair

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
      feedback += 'takeoff clearances MUST be read back verbatim with runway. This is one of the most critical communications in aviation.'
      break
    case 'landing':
      feedback += 'landing clearances require full readback with runway. Runway confusion is a leading cause of runway incursions.'
      break
    case 'hold':
      feedback += 'hold short instructions are safety-critical. Failure to properly acknowledge can result in runway incursions.'
      break
    case 'squawk':
      feedback += 'squawk codes must be read back to ensure correct radar identification.'
      break
    case 'frequency':
      feedback += 'frequency changes must be read back to prevent loss of communication.'
      break
    default:
      feedback += 'this instruction requires proper acknowledgment for safety.'
  }

  // Severity-specific addition
  if (contextualSeverity === 'critical') {
    feedback += ' ⚠️ This is a CRITICAL issue in the current context.'
  } else if (contextualSeverity === 'high') {
    feedback += ' This requires immediate attention.'
  }

  return feedback
}

// ============================================================================
// LINE PARSING - Smart multi-format parser
// ============================================================================

export function parseLines(text: string): ParsedLine[] {
  const parsedLines: ParsedLine[] = []

  // First, try to extract quoted dialogues (handles "quote1" "quote2" format)
  const quotedSegments = extractQuotedSegments(text)

  // Debug log (remove in production)
  console.log('[Parser] Input text:', text.substring(0, 100))
  console.log('[Parser] Extracted segments:', quotedSegments.length, quotedSegments)

  if (quotedSegments.length >= 2) {
    // Multiple quotes found - treat as separate exchanges
    quotedSegments.forEach((segment, index) => {
      const speaker = inferSpeakerFromContent(segment, index)
      parsedLines.push({
        lineNumber: index + 1,
        text: cleanText(segment),
        speaker,
        rawText: segment,
      })
    })
  } else {
    // Fall back to line-by-line parsing
    const lines = text.split('\n').filter(l => l.trim())

    lines.forEach((line, index) => {
      // Check if line contains multiple quoted segments
      const lineQuotes = extractQuotedSegments(line)
      if (lineQuotes.length >= 2) {
        lineQuotes.forEach((segment) => {
          const speaker = inferSpeakerFromContent(segment, parsedLines.length)
          parsedLines.push({
            lineNumber: parsedLines.length + 1,
            text: cleanText(segment),
            speaker,
            rawText: segment,
          })
        })
      } else {
        // Single line - use traditional parsing
        const speaker = identifySpeaker(line)
        const cleanedText = cleanSpeakerLabel(line)
        parsedLines.push({
          lineNumber: index + 1,
          text: cleanedText,
          speaker,
          rawText: line.trim(),
        })
      }
    })
  }

  // If speakers are all UNKNOWN, try to infer from content patterns
  const unknownCount = parsedLines.filter(l => l.speaker === 'UNKNOWN').length
  if (unknownCount > parsedLines.length / 2) {
    inferSpeakersFromContext(parsedLines)
  }

  console.log('[Parser] Final parsed lines:', parsedLines.length, parsedLines.map(l => ({ speaker: l.speaker, text: l.text })))

  return parsedLines
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

  console.log('[Parser] Normalized text:', normalized)

  // Method 1: Split by quote character and filter meaningful parts
  const splitParts = normalized.split('"')
  console.log('[Parser] Split by quote:', splitParts)

  for (const part of splitParts) {
    const cleaned = part.trim()

    // Skip if too short or doesn't have meaningful content
    if (cleaned.length <= 10) continue

    // Skip speaker labels (ATC:, Pilot:, PLT:, etc.)
    if (/^(ATC|Pilot|PLT|ATCO|Tower|Ground|Approach|Departure|Center)[\s:]*$/i.test(cleaned)) continue

    // Skip "Expected:" text or purely parenthetical content
    if (/^\(Expected:/i.test(cleaned) || /^\([^)]*\)$/.test(cleaned)) continue

    // Must have some alphabetic content (not just punctuation/numbers)
    if (!/[a-zA-Z]{3,}/.test(cleaned)) continue

    const withoutBrackets = cleaned.replace(/\[\[|\]\]/g, '')
    segments.push(withoutBrackets)
  }

  if (segments.length >= 2) {
    console.log('[Parser] Method 1 success:', segments)
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
    console.log('[Parser] Method 2 success:', segments)
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
    console.log('[Parser] Method 3 (callsign) success:', segments)
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

  console.log('[Parser] Final result:', segments.length, 'segments')
  return segments
}

// Infer speaker from content (ATC gives instructions, Pilot responds)
function inferSpeakerFromContent(text: string, index: number): 'ATC' | 'PILOT' | 'UNKNOWN' {
  // PRIORITY 1: Callsign at END is the strongest pilot indicator
  // Pilots always end readbacks with their callsign, ATC starts with it
  const callsignAtEnd = /,\s*[A-Z]{2,4}\s*\d{2,4}\.?$/i.test(text) ||
                        /,\s*(PAL|CEB|APG|GAP|RPC|SRQ|UAL|AAL|DAL|SWA|JBU)\s*\d+\.?$/i.test(text)
  if (callsignAtEnd) {
    return 'PILOT'
  }

  // PRIORITY 2: Callsign at START is a strong ATC indicator (ATC addressing aircraft)
  const callsignAtStart = /^[A-Z]{2,4}\s*\d{2,4}[,\s]/i.test(text) ||
                          /^(PAL|CEB|APG|GAP|RPC|SRQ|UAL|AAL|DAL|SWA|JBU)\s*\d+[,\s]/i.test(text)
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
  return text
    .replace(/\[\[|\]\]/g, '') // Remove [[ and ]] markers
    .replace(/^["'""\s]+|["'""\s]+$/g, '') // Remove surrounding quotes
    .replace(/^(ATC|PILOT|PLT|TOWER|GROUND|APPROACH|DEPARTURE|CONTROL|RADAR|CENTER|P)[:\s]*/i, '') // Remove speaker labels
    .replace(/^(MANILA|CEBU|CLARK|DAVAO)\s*(APP|DEP|TWR|GND|CTR|APPROACH|DEPARTURE|TOWER|GROUND)[:\s]*/i, '')
    .replace(/^(PAL|CEB|AXN|APG|GAP|RPC|SRQ)\s*\d+[:\s]*/i, '') // Remove callsign labels
    .replace(/^RP-?C?\d+[:\s]*/i, '')
    .trim()
}

function identifySpeaker(line: string): 'ATC' | 'PILOT' | 'UNKNOWN' {
  // Explicit label patterns
  const atcLabelPatterns = [
    /^ATC[:\s]/i,
    /^TOWER[:\s]/i,
    /^GROUND[:\s]/i,
    /^APPROACH[:\s]/i,
    /^DEPARTURE[:\s]/i,
    /^CONTROL[:\s]/i,
    /^RADAR[:\s]/i,
    /^CENTER[:\s]/i,
    /^MANILA\s*(APP|DEP|TWR|GND|CTR|APPROACH|DEPARTURE|TOWER|GROUND)/i,
    /^CEBU\s*(APP|DEP|TWR|GND)/i,
    /^CLARK\s*(APP|DEP|TWR|GND)/i,
    /^DAVAO\s*(APP|DEP|TWR|GND)/i,
  ]

  const pilotLabelPatterns = [
    /^PILOT[:\s]/i,
    /^P[:\s]/i,
    /^(PAL|CEB|AXN|APG|GAP|RPC|SRQ)\s*\d+[:\s]/i,
    /^RP-?C?\d+[:\s]/i,
  ]

  if (atcLabelPatterns.some(p => p.test(line))) return 'ATC'
  if (pilotLabelPatterns.some(p => p.test(line))) return 'PILOT'

  // No explicit label - try to infer from content
  return inferSpeakerFromContent(line, 0)
}

function cleanSpeakerLabel(line: string): string {
  return line
    .replace(/^(ATC|PILOT|TOWER|GROUND|APPROACH|DEPARTURE|CONTROL|RADAR|CENTER|P)[:\s]*/i, '')
    .replace(/^(MANILA|CEBU|CLARK|DAVAO)\s*(APP|DEP|TWR|GND|CTR|APPROACH|DEPARTURE|TOWER|GROUND)[:\s]*/i, '')
    .replace(/^(PAL|CEB|AXN|APG|GAP|RPC|SRQ)\s*\d+[:\s]*/i, '')
    .replace(/^RP-?C?\d+[:\s]*/i, '')
    .replace(/\[\[|\]\]/g, '') // Remove [[ and ]] markers
    .replace(/^["'""\s]+|["'""\s]+$/g, '') // Remove surrounding quotes
    .trim()
}

// ============================================================================
// ERROR DETECTION
// ============================================================================

// Context-aware error detection with dynamic severity adjustment
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
    lineErrors.push(...detectStructuralIssues(line, lines))

    // Check safety-critical patterns
    lineErrors.push(...detectSafetyCriticalIssues(line))

    // Corpus-specific checks
    if (corpusType === 'APP/DEP') {
      lineErrors.push(...detectAppDepSpecificErrors(line))
    }

    // Apply dynamic severity adjustment based on context
    for (const error of lineErrors) {
      const adjustedError = adjustErrorSeverity(error, context)

      // Update issue accumulator for pattern detection
      issueAccumulator = updateIssueAccumulator(issueAccumulator, {
        line: error.line,
        severity: adjustedError.severity,
      })

      // Add escalation warning if pattern detected
      if (issueAccumulator.escalationLevel >= 2 && issueAccumulator.patternDetected) {
        adjustedError.whyItMatters = `${adjustedError.whyItMatters || ''}\n\n🔴 ${issueAccumulator.patternDetected}`
      }

      errors.push(adjustedError)
    }
  }

  // Add context-based errors from exchange pair analysis
  errors.push(...generateExchangePairErrors(context))

  // Update context with final accumulator state
  context.issueAccumulator = issueAccumulator

  return errors
}

// Adjust error severity based on flight phase and context
function adjustErrorSeverity(
  error: PhraseologyError,
  context: ConversationContext
): PhraseologyError {
  const adjusted = { ...error }

  // Emergency context - escalate everything
  if (context.emergencyDeclared) {
    if (adjusted.severity === 'low') adjusted.severity = 'medium'
    if (adjusted.severity === 'medium') adjusted.severity = 'high'
    adjusted.whyItMatters = `⚠️ EMERGENCY CONTEXT: ${adjusted.whyItMatters || 'Critical attention required during emergency.'}`
  }

  // TCAS active - altitude errors are critical
  if (context.tcasActive && error.category === 'number') {
    if (/altitude|flight\s+level|FL/i.test(error.issue)) {
      adjusted.severity = 'high'
      adjusted.whyItMatters = `⚠️ TCAS ACTIVE: ${adjusted.whyItMatters || 'Altitude accuracy is critical during TCAS RA.'}`
    }
  }

  // Critical flight phases - escalate procedural errors
  if (context.flightPhase === 'approach' || context.flightPhase === 'landing') {
    if (error.category === 'procedure' || error.category === 'structure') {
      if (adjusted.severity === 'low') adjusted.severity = 'medium'
      if (adjusted.severity === 'medium' && error.safetyImpact === 'safety') {
        adjusted.severity = 'high'
      }
      adjusted.explanation = `[APPROACH/LANDING PHASE] ${adjusted.explanation || ''}`
    }
  }

  if (context.flightPhase === 'departure') {
    // Altitude and heading errors are more critical during departure
    if (/altitude|heading|climb/i.test(error.issue)) {
      if (adjusted.severity === 'low') adjusted.severity = 'medium'
      adjusted.explanation = `[DEPARTURE PHASE] ${adjusted.explanation || ''}`
    }
  }

  if (context.flightPhase === 'ground') {
    // Runway and taxi instructions are critical on ground
    if (/runway|taxi|hold\s+short/i.test(error.issue)) {
      if (adjusted.severity === 'medium') adjusted.severity = 'high'
      adjusted.explanation = `[GROUND PHASE] ${adjusted.explanation || ''}`
    }
  }

  return adjusted
}

// Generate errors from exchange pair analysis
function generateExchangePairErrors(context: ConversationContext): PhraseologyError[] {
  const errors: PhraseologyError[] = []

  for (const pair of context.exchangePairs) {
    // Skip if readback was complete
    if (pair.readbackQuality === 'complete') continue

    // Generate error based on exchange pair analysis
    const dynamicFeedback = generateDynamicFeedback(pair, context.flightPhase)

    // Map contextual severity to standard severity
    const severityMap: Record<string, 'low' | 'medium' | 'high'> = {
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
    const trainingMatch = findMatchingTrainingExample(atcText, pilotText)

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
        severity: 'high',
        category: 'safety',
        safetyImpact: 'safety',
        icaoReference: semanticResult.errors[0]?.icaoReference || 'ICAO Doc 4444 Section 12.3.1.5',
        explanation: errorDetails || `The pilot's readback contained incorrect values for ${pair.instructionType}. This is a critical error that could lead to the pilot executing the wrong instruction.`,
        whyItMatters: trainingMatch
          ? `${dynamicFeedback}\n\n📚 Training Note: ${trainingMatch.explanation}`
          : dynamicFeedback,
        incorrectPhrase: pair.pilotLine?.text || '',
        correctExample: `Should be: "${expectedReadback}"`,
      })
    } else if (pair.readbackQuality === 'missing' && pair.contextualSeverity !== 'low') {
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
        severity: severityMap[pair.contextualSeverity],
        category: 'structure',
        safetyImpact: pair.contextualSeverity === 'critical' || pair.contextualSeverity === 'high' ? 'safety' : 'clarity',
        icaoReference: 'ICAO Doc 4444 Section 12.3.1.5',
        explanation: improperAck
          ? `"${improperAck.toUpperCase()}" only indicates message received. It does NOT confirm understanding of ${pair.instructionType}. ATC needs verbal confirmation of the specific values.`
          : dynamicFeedback,
        incorrectPhrase: improperAck || undefined,
        correctExample: `Should be: "${expectedReadback}"`,
        whyItMatters: trainingMatch
          ? `${trainingMatch.explanation}`
          : `In the current ${context.flightPhase} phase, proper readback of ${pair.instructionType} is essential for flight safety.`,
      })
    } else if (pair.readbackQuality === 'partial') {
      const expectedReadback = semanticResult.expectedResponse

      errors.push({
        line: pair.pilotLine?.lineNumber || pair.atcLine.lineNumber,
        original: pair.pilotLine?.rawText || '',
        issue: `Incomplete readback for ${pair.instructionType}`,
        suggestion: `Complete readback: "${expectedReadback}"`,
        severity: severityMap[pair.contextualSeverity],
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
function findMatchingTrainingExample(atcInstruction: string, pilotReadback: string): { explanation: string } | null {
  const atcLower = atcInstruction.toLowerCase()
  const pilotLower = pilotReadback.toLowerCase()

  // Extract the actual values from the current instruction for comparison
  const atcNorm = normalizeSpelledNumbers(atcLower)
  const pilotNorm = normalizeSpelledNumbers(pilotLower)

  for (const example of DEPARTURE_APPROACH_CORPUS) {
    if (!example.isCorrect || !example.explanation) continue

    // Only match if the error type is specifically demonstrated
    // For parameter confusion: pilot mistook heading for altitude or vice versa
    if (example.errorType === 'parameter_confusion') {
      const atcHasHeading = /heading\s*\d+/.test(atcNorm)
      const pilotHasAltitude = /flight\s*level|FL\s*\d|climb|descend/.test(pilotNorm)
      const atcHasAltitude = /flight\s*level|FL\s*\d|climb|descend/.test(atcNorm)
      const pilotHasHeading = /heading\s*\d+/.test(pilotNorm)

      if ((atcHasHeading && pilotHasAltitude && !atcHasAltitude) ||
          (atcHasAltitude && pilotHasHeading && !atcHasHeading)) {
        return { explanation: example.explanation }
      }
    }

    // For wrong direction: pilot said left when ATC said right, or vice versa
    if (example.errorType === 'wrong_direction') {
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

// Legacy function for backward compatibility
function detectAllErrors(lines: ParsedLine[], corpusType: string): PhraseologyError[] {
  const errors: PhraseologyError[] = []

  for (const line of lines) {
    // Check non-standard phrases
    errors.push(...detectNonStandardPhrases(line))

    // Check number errors
    errors.push(...detectNumberErrors(line))

    // Check structural issues
    errors.push(...detectStructuralIssues(line, lines))

    // Check safety-critical patterns
    errors.push(...detectSafetyCriticalIssues(line))

    // Corpus-specific checks
    if (corpusType === 'APP/DEP') {
      errors.push(...detectAppDepSpecificErrors(line))
    }
  }

  return errors
}

function detectNonStandardPhrases(line: ParsedLine): PhraseologyError[] {
  const errors: PhraseologyError[] = []

  for (const phrase of NON_STANDARD_PHRASES) {
    const match = line.text.match(phrase.nonStandard)
    if (match) {
      const incorrectPhrase = match[0]
      const severity = phrase.severity === 'critical' ? 'high' : phrase.severity
      errors.push({
        line: line.lineNumber,
        original: line.rawText,
        issue: phrase.explanation,
        suggestion: `Use "${phrase.standard}" instead`,
        severity: severity as 'low' | 'medium' | 'high',
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
  // Replace the non-standard phrase with the standard one in context
  return originalText.replace(phrase.nonStandard, phrase.standard)
}

function getWhyItMatters(impact?: string, category?: string): string {
  if (impact === 'safety') {
    // Add incident context for safety-critical issues
    if (category === 'instruction') {
      return 'This directly impacts flight safety. The 1977 Tenerife disaster (583 deaths) was partly caused by non-standard phraseology and miscommunication. Clear, standard language saves lives.'
    }
    return 'This directly impacts flight safety. Miscommunication could lead to loss of separation, runway incursions, or altitude deviations.'
  } else if (impact === 'clarity') {
    return 'Clear communication prevents misunderstandings that could require additional clarification, wasting valuable radio time and potentially causing confusion.'
  } else if (impact === 'efficiency') {
    return 'Standard phraseology is more concise and efficient, reducing radio congestion and ensuring timely communication in busy airspace.'
  }
  return 'Using standard ICAO phraseology ensures your communications are understood universally by aviation professionals worldwide.'
}

function detectNumberErrors(line: ParsedLine): PhraseologyError[] {
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

      // Map severity
      const severity = numError.severity === 'critical' ? 'high' : numError.severity

      errors.push({
        line: line.lineNumber,
        original: line.rawText,
        issue: numError.issue || numError.explanation,
        suggestion: `Use "${numError.correct}" for ICAO standard pronunciation`,
        severity: severity as 'low' | 'medium' | 'high',
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
        severity: 'low',
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
        severity: 'high',
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
        severity: 'low',
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
        severity: 'medium',
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
        severity: 'high',
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

function detectStructuralIssues(line: ParsedLine, allLines: ParsedLine[]): PhraseologyError[] {
  const errors: PhraseologyError[] = []

  // Check for missing callsign in pilot responses
  if (line.speaker === 'PILOT' && line.text.length > 15) {
    const hasCallsign = PHILIPPINE_CALLSIGNS.some(cs => line.text.toUpperCase().includes(cs))
    if (!hasCallsign && !/RP-?C?\d+/i.test(line.text)) {
      errors.push({
        line: line.lineNumber,
        original: line.rawText,
        issue: 'Missing callsign in pilot transmission',
        suggestion: 'Always include aircraft callsign at the end of readback',
        severity: 'medium',
        category: 'structure',
        safetyImpact: 'clarity',
      })
    }
  }

  // Check for incomplete readbacks
  if (line.speaker === 'PILOT') {
    const atcInstruction = findPrecedingATCInstruction(line.lineNumber, allLines)
    if (atcInstruction) {
      const readbackErrors = checkReadbackCompleteness(atcInstruction, line)
      errors.push(...readbackErrors)
    }
  }

  return errors
}

function findPrecedingATCInstruction(pilotLineNum: number, lines: ParsedLine[]): ParsedLine | null {
  for (let i = pilotLineNum - 2; i >= 0; i--) {
    if (lines[i]?.speaker === 'ATC') {
      return lines[i]
    }
  }
  return null
}

function checkReadbackCompleteness(atcLine: ParsedLine, pilotLine: ParsedLine): PhraseologyError[] {
  const errors: PhraseologyError[] = []

  // NOTE: "Roger" detection is now handled by generateExchangePairErrors()
  // This function only checks for missing specific elements in otherwise valid readbacks

  // Skip if pilot only used improper acknowledgment without actual readback content
  // Simple check: if response is very short (≤4 words), it's likely just "Roger" or "Roger, callsign"
  const hasImproperAck = /\b(roger|copied|copy|ok|okay|understood|got\s+it|wilco)\b/i.test(pilotLine.text)
  const wordCount = pilotLine.text.trim().split(/\s+/).length
  const isShortResponse = wordCount <= 4

  if (hasImproperAck && isShortResponse) {
    return errors // Exchange pair analysis will handle improper acknowledgments
  }

  for (const req of READBACK_REQUIREMENTS) {
    if (req.instruction.test(atcLine.text)) {
      const missingElements: string[] = []
      const atcInstruction = atcLine.text

      // Check altitude readback - now handles spelled-out numbers
      if (req.mustReadback.includes('altitude/FL')) {
        const atcHasAltitude = /\b(flight\s+level|FL\s*\d|\d{3,5}|one\s+zero\s+zero|two\s+zero\s+zero|three\s+zero\s+zero|one\s+one\s+zero|niner\s+zero|eight\s+zero|seven\s+zero|six\s+zero|five\s+zero|four\s+zero|altitude\s+\d)/i.test(atcInstruction)
        if (atcHasAltitude) {
          const pilotHasAltitude = /\b(flight\s+level|FL\s*\d|\d{3,5}|one\s+zero\s+zero|two\s+zero\s+zero|three\s+zero\s+zero|one\s+one\s+zero|niner\s+zero|eight\s+zero|seven\s+zero|six\s+zero|five\s+zero|four\s+zero|level|altitude)/i.test(pilotLine.text)
          if (!pilotHasAltitude) {
            missingElements.push('altitude/flight level')
          }
        }
      }

      // Check heading readback - handles spelled-out numbers
      if (req.mustReadback.includes('heading')) {
        const atcHasHeading = /\bheading\s+(\d{1,3}|zero|one|two|three|four|five|six|seven|eight|niner)/i.test(atcInstruction)
        if (atcHasHeading) {
          const pilotHasHeading = /\bheading\s+(\d{1,3}|zero|one|two|three|four|five|six|seven|eight|niner)/i.test(pilotLine.text)
          if (!pilotHasHeading) {
            missingElements.push('heading')
          }
        }
      }

      // Check turn direction
      if (req.mustReadback.includes('direction')) {
        const atcHasDirection = /\b(turn\s+)?(left|right)\b/i.test(atcInstruction)
        if (atcHasDirection) {
          const pilotHasDirection = /\b(left|right)\b/i.test(pilotLine.text)
          if (!pilotHasDirection) {
            missingElements.push('turn direction')
          }
        }
      }

      // Check runway readback
      if (req.mustReadback.includes('runway')) {
        const atcRunwayMatch = atcLine.text.match(/runway\s+(\d{1,2}[LRC]?)/i)
        if (atcRunwayMatch && !pilotLine.text.match(/runway\s+\d{1,2}[LRC]?/i)) {
          missingElements.push('runway')
        }
      }

      // Check frequency readback
      if (req.mustReadback.includes('frequency')) {
        const atcFreqMatch = atcLine.text.match(/(\d{3}\.\d{1,3})/i)
        if (atcFreqMatch && !pilotLine.text.match(/\d{3}\.\d{1,3}/i)) {
          missingElements.push('frequency')
        }
      }

      if (missingElements.length > 0) {
        const expectedReadback = buildCorrectReadback(atcInstruction, pilotLine.text)
        errors.push({
          line: pilotLine.lineNumber,
          original: pilotLine.rawText,
          issue: `Incomplete readback - missing: ${missingElements.join(', ')}`,
          suggestion: `${req.severity === 'mandatory' ? 'MANDATORY' : 'Recommended'}: Read back ${missingElements.join(', ')} to confirm instructions`,
          severity: req.severity === 'mandatory' ? 'high' : 'medium',
          category: 'structure',
          safetyImpact: 'safety',
          icaoReference: 'ICAO Doc 4444 Section 12.3.1.5 (Readback Requirements)',
          explanation: `ATC instructions containing ${missingElements.join(', ')} MUST be read back to ensure the pilot understood correctly. "${req.description}"`,
          whyItMatters: 'Incomplete readbacks prevent controllers from catching misunderstandings before they become dangerous situations.',
          correctExample: expectedReadback,
        })
      }
    }
  }

  return errors
}

// Build a correct readback example from ATC instruction
function buildCorrectReadback(atcInstruction: string, pilotResponse: string): string {
  const parts: string[] = []

  // Extract climb/descend
  const climbDescend = atcInstruction.match(/\b(climb|descend)\s+(and\s+)?maintain\b/i)
  if (climbDescend) {
    parts.push(climbDescend[0])
  }

  // Extract flight level/altitude
  const flMatch = atcInstruction.match(/\bflight\s+level\s+(one|two|three|four|five|six|seven|eight|niner|zero|\d)+(\s+(one|two|three|four|five|six|seven|eight|niner|zero|\d)+)*/i)
  const altMatch = atcInstruction.match(/\b\d{3,5}\s*(feet|ft)?\b/i)
  if (flMatch) {
    parts.push(flMatch[0])
  } else if (altMatch) {
    parts.push(altMatch[0])
  }

  // Extract turn direction and heading
  const turnMatch = atcInstruction.match(/\bturn\s+(left|right)\b/i)
  const headingMatch = atcInstruction.match(/\bheading\s+(one|two|three|four|five|six|seven|eight|niner|zero|\d)+(\s+(one|two|three|four|five|six|seven|eight|niner|zero|\d)+)*/i)
  if (turnMatch) {
    parts.push(turnMatch[0])
  }
  if (headingMatch) {
    parts.push(headingMatch[0])
  }

  // Extract callsign from pilot response or ATC instruction
  const callsignMatch = pilotResponse.match(/\b(PAL|CEB|AXN|APG)\s*\d+\b/i) || atcInstruction.match(/\b(PAL|CEB|AXN|APG)\s*\d+\b/i)
  const callsign = callsignMatch ? callsignMatch[0] : '[CALLSIGN]'

  if (parts.length === 0) {
    return `"[Read back all instructions], ${callsign}"`
  }

  return `"${parts.join(', ')}, ${callsign}"`
}

function normalizeAltitude(alt: string): string {
  return alt.replace(/\s+/g, '').toUpperCase()
}

function detectSafetyCriticalIssues(line: ParsedLine): PhraseologyError[] {
  const errors: PhraseologyError[] = []

  for (const pattern of SAFETY_CRITICAL_PATTERNS) {
    if (pattern.pattern.test(line.text)) {
      errors.push({
        line: line.lineNumber,
        original: line.rawText,
        issue: pattern.description,
        suggestion: 'Safety-critical phrase detected - verify proper handling',
        severity: pattern.severity === 'critical' ? 'high' : 'medium',
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

  // Check for altitude transposition risks
  if (extractedCommands.some(cmd => cmd.includes('climb') || cmd.includes('descend'))) {
    const altMatch = line.text.match(/(\d)\s*(\d)\s*(thousand|hundred)/i)
    if (altMatch) {
      // Flag potential transposition risk
      errors.push({
        line: line.lineNumber,
        original: line.rawText,
        issue: 'Altitude readback requires careful verification',
        suggestion: 'Verify altitude digits are in correct order',
        severity: 'low',
        category: 'procedure',
        safetyImpact: 'clarity',
        explanation: 'Altitude transpositions are a common error in ATC communications',
      })
    }
  }

  // Check for proper descent/climb phraseology
  if (/descend\s+to\b/i.test(line.text) && !/descend\s+(and\s+)?maintain/i.test(line.text)) {
    errors.push({
      line: line.lineNumber,
      original: line.rawText,
      issue: 'Incomplete descent instruction',
      suggestion: 'Use "DESCEND AND MAINTAIN [altitude]" for standard phraseology',
      severity: 'medium',
      category: 'procedure',
      safetyImpact: 'clarity',
      icaoReference: 'ICAO Doc 4444 Section 12.3.1',
      explanation: 'Based on ATCO2 corpus analysis: Standard phraseology requires explicit "AND MAINTAIN" to confirm target altitude.',
    })
  }

  if (/climb\s+to\b/i.test(line.text) && !/climb\s+(and\s+)?maintain/i.test(line.text)) {
    errors.push({
      line: line.lineNumber,
      original: line.rawText,
      issue: 'Incomplete climb instruction',
      suggestion: 'Use "CLIMB AND MAINTAIN [altitude]" for standard phraseology',
      severity: 'medium',
      category: 'procedure',
      safetyImpact: 'clarity',
      icaoReference: 'ICAO Doc 4444 Section 12.3.1',
      explanation: 'ATCOSIM corpus pattern: European ATC consistently uses "CLIMB FLIGHT LEVEL [XXX]" format.',
    })
  }

  // Check for missing "and maintain" in altitude instructions
  if (/(descend|climb)\s+\d+/i.test(line.text) && !/maintain/i.test(line.text)) {
    errors.push({
      line: line.lineNumber,
      original: line.rawText,
      issue: 'Missing "MAINTAIN" in altitude instruction',
      suggestion: 'Standard phraseology requires "AND MAINTAIN" after climb/descend',
      severity: 'medium',
      category: 'procedure',
    })
  }

  // ============================================================================
  // ENHANCED SEPARATION INSTRUCTION DETECTION (From ATCOSIM)
  // ============================================================================

  // Check for separation instructions (common in ATCOSIM dataset)
  if (/for\s+separation/i.test(line.text)) {
    // Verify complete separation instruction format
    if (!/turn\s+(left|right).*for\s+separation/i.test(line.text) &&
        !/for\s+separation\s+turn\s+(left|right)/i.test(line.text)) {
      errors.push({
        line: line.lineNumber,
        original: line.rawText,
        issue: 'Incomplete separation instruction format',
        suggestion: 'Use "TURN LEFT/RIGHT HEADING [XXX] FOR SEPARATION"',
        severity: 'medium',
        category: 'procedure',
        safetyImpact: 'safety',
        icaoReference: 'ICAO Doc 4444 Chapter 8',
        explanation: 'ATCOSIM analysis shows separation instructions require explicit direction and heading.',
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
        severity: 'low',
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
        const severity = errorPattern.severity === 'critical' ? 'high' : errorPattern.severity
        errors.push({
          line: line.lineNumber,
          original: line.rawText,
          issue: errorPattern.issue,
          suggestion: errorPattern.correction,
          severity: severity as 'low' | 'medium' | 'high',
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

  // Check for proper approach clearance format
  if (/cleared\s+(ils|rnav|vor|visual|ndb)/i.test(line.text) && !/approach/i.test(line.text)) {
    errors.push({
      line: line.lineNumber,
      original: line.rawText,
      issue: 'Incomplete approach clearance',
      suggestion: 'Include "APPROACH" after the approach type (e.g., "CLEARED ILS APPROACH")',
      severity: 'low',
      category: 'procedure',
    })
  }

  // Check for vectoring phraseology
  if (/vector/i.test(line.text) && !/vectoring\s+(for|to)/i.test(line.text)) {
    errors.push({
      line: line.lineNumber,
      original: line.rawText,
      issue: 'Incomplete vectoring instruction',
      suggestion: 'Use "VECTORING FOR [approach type] APPROACH" or "VECTORING TO [waypoint]"',
      severity: 'low',
      category: 'procedure',
    })
  }

  // Check Philippine waypoint usage
  const waypointMentioned = PHILIPPINE_WAYPOINTS.some(wp =>
    new RegExp(`\\b${wp}\\b`, 'i').test(line.text)
  )

  // ============================================================================
  // ENHANCED HEADING INSTRUCTION DETECTION
  // ============================================================================

  // Check for direction in turn instructions
  if (/turn\s+heading/i.test(line.text) && !/turn\s+(left|right)\s+heading/i.test(line.text)) {
    errors.push({
      line: line.lineNumber,
      original: line.rawText,
      issue: 'Missing turn direction',
      suggestion: 'Specify "TURN LEFT HEADING" or "TURN RIGHT HEADING"',
      severity: 'medium',
      category: 'procedure',
      safetyImpact: 'clarity',
      icaoReference: 'ICAO Doc 4444 Section 12.3.2',
      explanation: 'ATCOSIM patterns show all heading instructions include explicit LEFT/RIGHT direction.',
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
        severity: 'low',
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
              severity: 'low',
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

    // Find pilot response
    const pilotResponse = lines.find((l, idx) => idx > i && l.speaker === 'PILOT')
    if (!pilotResponse) {
      incompleteReadbacks++
      continue
    }

    // =========================================================================
    // ENHANCED VALIDATION
    // =========================================================================

    // Extract command type from ATC instruction
    const extractedCmds = extractCommandsFromText(line.text)
    let isComplete = true
    const missing: string[] = []

    // Use enhanced validation if we detected a command type
    if (extractedCmds.length > 0) {
      for (const cmd of extractedCmds) {
        // Determine instruction type from command string
        let instructionType = 'unknown'
        if (cmd.includes('climb') || cmd.includes('descend')) instructionType = 'altitude'
        else if (cmd.includes('heading')) instructionType = 'heading'
        else if (cmd.includes('squawk')) instructionType = 'squawk'
        else if (cmd.includes('contact')) instructionType = 'frequency'

        // Use the validateReadback function
        const validation = validateReadback(line.text, pilotResponse.text, instructionType)

        if (!validation.isValid) {
          isComplete = false
          missing.push(...validation.errors)

          // Calculate enhanced severity based on context
          const context = { phase: 'departure' }
          const enhancedSeverity = calculateEnhancedSeverity(context, instructionType)

          // Use enhanced severity to add context to missing elements
          if (enhancedSeverity === 'critical' || enhancedSeverity === 'high') {
            missing.push(`[${enhancedSeverity.toUpperCase()}] Readback validation failed`)
          }

          // Check against READBACK_REQUIREMENTS for more specific feedback
          const validationRule = READBACK_REQUIREMENTS.find(v => v.instructionType === instructionType)
          if (validationRule) {
            // Check if required elements are present
            for (const element of validationRule.requiredElements) {
              if (!pilotResponse.text.toLowerCase().includes(element.toLowerCase())) {
                missing.push(`Missing: ${element}`)
              }
            }
          }
        }
      }
    }

    // Fall back to original validation if no commands extracted
    if (extractedCmds.length === 0) {
      for (const req of READBACK_REQUIREMENTS) {
        if (req.instruction.test(line.text)) {
          for (const element of req.mustReadback) {
            if (!hasElement(pilotResponse.text, element, line.text)) {
              isComplete = false
              missing.push(element)
            }
          }
        }
      }
    }

    if (missing.length > 0) {
      missingElements.push({
        line: pilotResponse.lineNumber,
        instruction: line.text.substring(0, 50),
        missing: Array.from(new Set(missing)), // Remove duplicates
        severity: isComplete ? 'recommended' : 'mandatory',
      })
    }

    if (isComplete) {
      completeReadbacks++
    } else {
      incompleteReadbacks++
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

function hasElement(text: string, element: string, atcInstruction: string): boolean {
  // Normalize spelled-out numbers for better matching
  const normalizedText = normalizeSpelledNumbers(text)
  const spelledNumberPattern = /\b(one|two|three|four|five|six|seven|eight|nine|niner|zero)\b/i

  switch (element) {
    case 'altitude/FL':
      // Check for digits, FL, flight level, or spelled-out numbers in altitude context
      return /\d{3,5}|FL\s*\d{2,3}|flight\s*level/i.test(text) ||
             /flight\s*level/i.test(text) ||
             (/\b(climb|descend|maintain|altitude|level)\b/i.test(text) && spelledNumberPattern.test(text))
    case 'heading':
      // Check for "heading" followed by digits OR spelled numbers
      return /heading\s+\d{1,3}/i.test(text) ||
             /heading\s+(one|two|three|four|five|six|seven|eight|nine|niner|zero)/i.test(text) ||
             (/heading/i.test(normalizedText) && /\d{1,3}/.test(normalizedText))
    case 'direction':
      return /(left|right)/i.test(text)
    case 'runway':
      return /runway\s+\d{1,2}/i.test(text) ||
             /runway\s+(one|two|three|four|five|six|seven|eight|nine|niner|zero)/i.test(text)
    case 'callsign':
      return PHILIPPINE_CALLSIGNS.some(cs => text.toUpperCase().includes(cs)) ||
             /RP-?C?\d+/i.test(text) ||
             /\b(PAL|CEB|APG|GAP|RPC|SRQ)\s*\d{2,4}\b/i.test(text)
    case 'frequency':
      return /\d{3}[.\s]\d{1,3}/i.test(text) ||
             /\d{3}/.test(normalizedText)
    case 'squawk code':
      return /squawk\s+\d{4}/i.test(text) ||
             /\d{4}/.test(normalizedText) ||
             (/squawk/i.test(text) && spelledNumberPattern.test(text))
    case 'approach type':
      return /(ils|rnav|vor|visual|ndb)/i.test(text)
    case 'cleared for takeoff':
      return /cleared\s+(for\s+)?take\s*off/i.test(text)
    case 'cleared to land':
      return /cleared\s+(to\s+)?land/i.test(text)
    case 'hold short':
      return /hold\s*short/i.test(text)
    case 'line up and wait':
      return /line\s*up\s*(and\s+)?wait/i.test(text)
    case 'cross':
      return /cross/i.test(text)
    case 'facility':
      return PHILIPPINE_FACILITIES.some(f => text.toLowerCase().includes(f.toLowerCase())) ||
             /\w+\s+(approach|tower|ground|departure)/i.test(text)
    case 'altimeter setting':
      return /\d{4}/i.test(text) ||
             /altimeter/i.test(text) ||
             spelledNumberPattern.test(text)
    case 'speed':
      return /\d+\s*knots?/i.test(text) ||
             (spelledNumberPattern.test(text) && /knots?/i.test(text))
    default:
      return true
  }
}

// ============================================================================
// SAFETY METRICS
// ============================================================================

function calculateSafetyMetrics(lines: ParsedLine[], errors: PhraseologyError[]): SafetyMetrics {
  const safetyCriticalPhrases: SafetyCriticalDetection[] = []

  for (const line of lines) {
    for (const safetyPattern of SAFETY_CRITICAL_PATTERNS) {
      if (safetyPattern.pattern.test(line.text)) {
        safetyCriticalPhrases.push({
          line: line.lineNumber,
          text: line.rawText,
          type: safetyPattern.severity,
          description: safetyPattern.description,
        })
      }
    }
  }

  const criticalIssues = errors.filter(e => e.severity === 'high' && e.safetyImpact === 'safety').length
  const highSeverityIssues = errors.filter(e => e.severity === 'high').length
  const mediumSeverityIssues = errors.filter(e => e.severity === 'medium').length
  const lowSeverityIssues = errors.filter(e => e.severity === 'low').length

  // Calculate safety score (0-100)
  const totalErrors = errors.length
  const weightedScore = (criticalIssues * 20) + (highSeverityIssues * 10) + (mediumSeverityIssues * 5) + (lowSeverityIssues * 2)
  const overallSafetyScore = Math.max(0, 100 - weightedScore)

  return {
    criticalIssues,
    highSeverityIssues,
    mediumSeverityIssues,
    lowSeverityIssues,
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
  if (safetyMetrics.criticalIssues > 0 || safetyMetrics.highSeverityIssues >= 5) {
    return 'high'
  }

  if (safetyMetrics.highSeverityIssues >= 2 || readbackAnalysis.completenessScore < 50) {
    return 'medium'
  }

  if (errors.length > 10 || readbackAnalysis.completenessScore < 75) {
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

function categorizeNumberErrors(errors: PhraseologyError[], text: string): ErrorDetail[] {
  const categories: Record<string, number> = {
    'Altitude mismatch': 0,
    'Heading errors': 0,
    'Speed discrepancy': 0,
    'Callsign variation': 0,
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
      } else if (error.issue.toLowerCase().includes('pronunciation')) {
        categories['Callsign variation']++
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
  totalWords: number
): AnalysisSummary {
  const keyFindings: string[] = []
  const recommendations: string[] = []
  const criticalIssues: string[] = []
  const strengthAreas: string[] = []

  // Analyze safety-critical issues
  if (safetyMetrics.criticalIssues > 0) {
    keyFindings.push(`${safetyMetrics.criticalIssues} critical safety issues detected requiring immediate attention`)
    criticalIssues.push(...errors
      .filter(e => e.severity === 'high' && e.safetyImpact === 'safety')
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
  }

  // Calculate compliance score
  const errorPenalty =
    (safetyMetrics.criticalIssues * 15) +
    (safetyMetrics.highSeverityIssues * 8) +
    (safetyMetrics.mediumSeverityIssues * 3) +
    (safetyMetrics.lowSeverityIssues * 1)

  const readbackPenalty = readbackAnalysis.totalInstructions > 0
    ? Math.max(0, (100 - readbackAnalysis.completenessScore) / 2)
    : 0

  const overallCompliance = Math.max(0, Math.round(100 - errorPenalty - readbackPenalty))

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
      error.severity === 'high' ? 'safety' :
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
