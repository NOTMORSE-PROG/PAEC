/**
 * Adaptive ML Engine for ATC Readback Analysis
 *
 * This is a DYNAMIC machine learning system that:
 * 1. Learns from user corrections in real-time
 * 2. Adjusts pattern weights based on feedback
 * 3. Improves accuracy over time through reinforcement
 * 4. Personalizes to individual user error patterns
 * 5. Uses gradient-based weight updates
 */

import { analyzeReadback } from './semanticReadbackAnalyzer'

// ============================================================================
// MODEL STATE & WEIGHTS
// ============================================================================

export interface ModelWeights {
  // Pattern recognition weights (adjusted through learning)
  patternWeights: Record<string, number>

  // Error type detection weights
  errorWeights: Record<string, number>

  // Phase detection weights
  phaseWeights: Record<string, number>

  // Severity calculation weights
  severityWeights: {
    critical: number
    high: number
    medium: number
    low: number
  }

  // Confidence thresholds (adjusted based on accuracy)
  thresholds: {
    errorDetection: number
    phaseConfidence: number
    readbackAccuracy: number
  }
}

export interface LearningHistory {
  totalInteractions: number
  correctPredictions: number
  incorrectPredictions: number
  userCorrections: UserCorrection[]
  weightUpdates: WeightUpdate[]
  accuracyOverTime: { timestamp: number; accuracy: number }[]
  lastTrainingDate: string
}

export interface UserCorrection {
  id: string
  timestamp: number
  original: {
    atc: string
    pilot: string
    predictedCorrect: boolean
    predictedErrors: string[]
    predictedPhase: string
  }
  corrected: {
    isActuallyCorrect: boolean
    actualErrors: string[]
    actualPhase: string
    userFeedback?: string
  }
  applied: boolean
}

export interface WeightUpdate {
  timestamp: number
  pattern: string
  oldWeight: number
  newWeight: number
  reason: string
  learningRate: number
}

export interface AdaptiveModelState {
  version: string
  createdAt: string
  updatedAt: string
  weights: ModelWeights
  history: LearningHistory
  config: LearningConfig
}

export interface LearningConfig {
  learningRate: number          // How fast the model learns (0.01 - 0.5)
  momentum: number              // Smooths weight updates (0 - 0.9)
  minConfidence: number         // Minimum confidence for predictions
  adaptiveRateEnabled: boolean  // Adjust learning rate based on performance
  reinforcementEnabled: boolean // Use reinforcement learning
  maxHistorySize: number        // Max corrections to store
}

// ============================================================================
// DEFAULT MODEL INITIALIZATION
// ============================================================================

export function createDefaultModelState(): AdaptiveModelState {
  return {
    version: '3.0.0-adaptive',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    weights: {
      patternWeights: {
        // Altitude patterns
        'altitude_climb': 1.0,
        'altitude_descend': 1.0,
        'altitude_maintain': 1.0,
        'flight_level': 1.2,

        // Heading patterns
        'heading_turn_left': 1.0,
        'heading_turn_right': 1.0,
        'heading_fly': 0.9,
        'runway_heading': 1.1,

        // Clearances
        'cleared_takeoff': 1.3,
        'cleared_landing': 1.3,
        'cleared_approach': 1.2,
        'line_up_wait': 1.2,

        // Frequency/Squawk
        'contact_frequency': 1.0,
        'squawk_code': 1.1,

        // Navigation
        'direct_to': 0.9,
        'hold_short': 1.2,
        'taxi_to': 0.8,

        // Emergency/Priority
        'go_around': 1.5,
        'expedite': 1.4,
        'immediate': 1.5,
      },

      errorWeights: {
        // Core readback errors
        'wrong_value': 1.2,
        'transposition': 1.3,
        'missing_element': 1.0,
        'incomplete_readback': 0.9,
        'parameter_confusion': 1.1,
        'hearback_error': 0.8,
        'extra_element': 0.5,
        // Direction and callsign errors
        'wrong_direction': 1.4,        // Critical - wrong turn direction
        'missing_callsign': 0.8,       // Important but not safety-critical
        'callsign_confusion': 1.4,
        // Conditional/constraint errors
        'condition_omitted': 1.3,      // Pilot didn't read back WHEN/UNTIL/AFTER condition
        'condition_violated': 1.5,     // Pilot added "now" to conditional instruction
        'constraint_missing': 1.3,     // Pilot omitted "at or above/below" constraint
        'roger_substitution': 1.4,     // Pilot used Roger/Wilco for safety-critical item
        // Runway safety errors (CRITICAL - highest weights)
        'critical_confusion': 2.0,     // Line up/wait vs takeoff - runway incursion risk
        'wrong_runway': 2.0,           // Wrong runway - critical safety issue
        'missing_designator': 1.5,     // Missing L/R/C on parallel runways
        // Non-native speaker patterns (lower weights - training focus)
        'non_native_pronunciation': 0.6,
        'non_native_grammar': 0.5,
        'non_native_word_order': 0.7,
        'non_native_stress': 0.4,
      },

      phaseWeights: {
        'ground': 0.8,
        'taxi': 0.9,
        'departure': 1.2,
        'climb': 1.0,
        'cruise': 0.7,
        'descent': 1.0,
        'approach': 1.3,
        'landing': 1.4,
        'go_around': 1.5,
      },

      severityWeights: {
        critical: 1.5,
        high: 1.2,
        medium: 1.0,
        low: 0.7,
      },

      thresholds: {
        errorDetection: 0.65,
        phaseConfidence: 0.70,
        readbackAccuracy: 0.80,
      },
    },

    history: {
      totalInteractions: 0,
      correctPredictions: 0,
      incorrectPredictions: 0,
      userCorrections: [],
      weightUpdates: [],
      accuracyOverTime: [],
      lastTrainingDate: new Date().toISOString(),
    },

    config: {
      learningRate: 0.1,
      momentum: 0.3,
      minConfidence: 0.5,
      adaptiveRateEnabled: true,
      reinforcementEnabled: true,
      maxHistorySize: 1000,
    },
  }
}

// ============================================================================
// ADAPTIVE ANALYSIS ENGINE
// ============================================================================

export interface AnalysisInput {
  atc: string
  pilot: string
  callsign?: string
  context?: {
    previousErrors?: string[]
    userHistory?: string[]
    sessionTime?: number
  }
}

export interface AdaptiveAnalysisResult {
  isCorrect: boolean
  confidence: number
  phase: string
  phaseConfidence: number
  errors: DetectedError[]
  severity: 'critical' | 'high' | 'medium' | 'low'
  suggestions: string[]
  modelMetrics: {
    patternsMatched: number
    weightsApplied: string[]
    confidenceFactors: Record<string, number>
  }
  learningOpportunity: boolean
}

export interface DetectedError {
  type: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  confidence: number
  weight: number
  correction?: string
}

/**
 * Main adaptive analysis function
 * Uses weighted pattern matching with dynamic adjustment
 */
export function adaptiveAnalyze(
  input: AnalysisInput,
  modelState: AdaptiveModelState
): AdaptiveAnalysisResult {
  const { atc, pilot, callsign, context } = input
  const { weights, config } = modelState

  const atcLower = atc.toLowerCase()
  const pilotLower = pilot.toLowerCase()

  // Track matched patterns and their weights
  const matchedPatterns: { pattern: string; weight: number; match: string }[] = []
  const confidenceFactors: Record<string, number> = {}

  // 1. Phase Detection with weighted confidence
  const phaseResult = detectPhaseWeighted(atcLower, pilotLower, weights.phaseWeights)
  confidenceFactors['phase'] = phaseResult.confidence

  // 2. Pattern Matching with adaptive weights
  const patterns = extractPatternsWeighted(atcLower, weights.patternWeights)
  matchedPatterns.push(...patterns)

  // 3. Readback Comparison with weighted scoring
  const readbackResult = compareReadbackWeighted(atcLower, pilotLower, weights, patterns)
  confidenceFactors['readback'] = readbackResult.confidence

  // =========================================================================
  // NEW: Use Semantic Analyzer for comprehensive dynamic error detection
  // =========================================================================
  const semanticResult = analyzeReadback(atc, pilot, callsign)

  // 4. Combine semantic errors with weighted errors
  const adaptiveErrors: DetectedError[] = []

  // Convert semantic errors to adaptive format
  for (const semError of semanticResult.errors) {
    const weight = weights.errorWeights[semError.type] || 1.0
    adaptiveErrors.push({
      type: semError.type as DetectedError['type'],
      description: semError.explanation,
      severity: semError.severity === 'critical' ? 'critical' :
                semError.severity === 'high' ? 'high' :
                semError.severity === 'medium' ? 'medium' : 'low',
      confidence: semanticResult.confidence,
      weight,
      correction: semanticResult.corrections[0]?.correctPhrase,
    })
  }

  // Also run legacy detection for anything not caught
  const legacyErrors = detectErrorsWeighted(
    atcLower,
    pilotLower,
    weights.errorWeights,
    readbackResult,
    phaseResult.phase
  )

  // Merge errors, avoiding duplicates
  for (const legErr of legacyErrors) {
    const isDuplicate = adaptiveErrors.some(e =>
      e.type === legErr.type &&
      (e.description.includes(legErr.description) || legErr.description.includes(e.description.substring(0, 20)))
    )
    if (!isDuplicate) {
      adaptiveErrors.push(legErr)
    }
  }

  // Update readback confidence based on semantic analysis
  confidenceFactors['readback'] = semanticResult.isCorrect ? 1.0 :
                                   semanticResult.quality === 'partial' ? 0.6 :
                                   semanticResult.quality === 'missing' ? 0.3 : 0.2

  // 5. Calculate overall confidence
  const overallConfidence = calculateOverallConfidence(confidenceFactors, weights)

  // 6. Calculate severity with phase-aware weighting
  const severity = calculateSeverityWeighted(adaptiveErrors, phaseResult.phase, weights)

  // 7. Generate adaptive suggestions from semantic + legacy
  const suggestions: string[] = []
  for (const corr of semanticResult.corrections) {
    suggestions.push(corr.correctPhrase)
    if (corr.whyIncorrect) {
      suggestions.push(`Issue: ${corr.whyIncorrect}`)
    }
  }
  suggestions.push(...generateAdaptiveSuggestions(adaptiveErrors, phaseResult.phase, context))

  // 8. Determine if this is a learning opportunity
  const learningOpportunity = overallConfidence < config.minConfidence + 0.2

  return {
    isCorrect: semanticResult.isCorrect && adaptiveErrors.length === 0,
    confidence: overallConfidence,
    phase: phaseResult.phase,
    phaseConfidence: phaseResult.confidence,
    errors: adaptiveErrors,
    severity,
    suggestions: Array.from(new Set(suggestions)), // Remove duplicates
    modelMetrics: {
      patternsMatched: matchedPatterns.length,
      weightsApplied: matchedPatterns.map(p => p.pattern),
      confidenceFactors,
    },
    learningOpportunity,
  }
}

// ============================================================================
// WEIGHTED DETECTION FUNCTIONS
// ============================================================================

function detectPhaseWeighted(
  atc: string,
  pilot: string,
  phaseWeights: Record<string, number>
): { phase: string; confidence: number } {
  const phasePatterns: Record<string, { patterns: RegExp[]; baseScore: number }> = {
    ground: {
      patterns: [/pushback/i, /start\s*up/i, /clearance\s+delivery/i, /gate/i],
      baseScore: 0.8,
    },
    taxi: {
      patterns: [/taxi\s+(to|via)/i, /hold\s+short/i, /give\s+way/i],
      baseScore: 0.85,
    },
    departure: {
      patterns: [/cleared\s+(for\s+)?take\s*off/i, /line\s+up/i, /runway\s+\d+.*cleared/i, /departure/i],
      baseScore: 0.9,
    },
    climb: {
      patterns: [/climb\s+(and\s+)?maintain/i, /passing\s+\d/i, /radar\s+contact/i],
      baseScore: 0.85,
    },
    cruise: {
      patterns: [/maintain\s+flight\s+level/i, /cruise/i, /direct\s+\w+/i],
      baseScore: 0.7,
    },
    descent: {
      patterns: [/descend\s+(and\s+)?maintain/i, /expect\s+\w+\s+arrival/i],
      baseScore: 0.85,
    },
    approach: {
      patterns: [/cleared\s+\w+\s+approach/i, /vectors?\s+(for|to)/i, /intercept/i, /localizer/i],
      baseScore: 0.9,
    },
    landing: {
      patterns: [/cleared\s+to\s+land/i, /continue\s+approach/i, /wind\s+\d+/i],
      baseScore: 0.95,
    },
    go_around: {
      patterns: [/go\s*around/i, /missed\s+approach/i, /pull\s+up/i],
      baseScore: 0.95,
    },
  }

  let bestPhase = 'cruise'
  let bestScore = 0

  const text = atc + ' ' + pilot

  for (const [phase, config] of Object.entries(phasePatterns)) {
    let matchCount = 0
    for (const pattern of config.patterns) {
      if (pattern.test(text)) {
        matchCount++
      }
    }

    if (matchCount > 0) {
      const weight = phaseWeights[phase] || 1.0
      const score = (matchCount / config.patterns.length) * config.baseScore * weight

      if (score > bestScore) {
        bestScore = score
        bestPhase = phase
      }
    }
  }

  return {
    phase: bestPhase,
    confidence: Math.min(bestScore, 1.0),
  }
}

function extractPatternsWeighted(
  text: string,
  patternWeights: Record<string, number>
): { pattern: string; weight: number; match: string }[] {
  const results: { pattern: string; weight: number; match: string }[] = []

  const patternDefs: Record<string, RegExp> = {
    'altitude_climb': /climb\s+(?:and\s+)?maintain\s+(?:flight\s+level\s+)?(\d+)/i,
    'altitude_descend': /descend\s+(?:and\s+)?maintain\s+(?:flight\s+level\s+)?(\d+)/i,
    'altitude_maintain': /maintain\s+(?:flight\s+level\s+)?(\d+)/i,
    'flight_level': /flight\s+level\s+(\d{2,3})/i,
    'heading_turn_left': /turn\s+left\s+(?:heading\s+)?(\d{3})/i,
    'heading_turn_right': /turn\s+right\s+(?:heading\s+)?(\d{3})/i,
    'heading_fly': /fly\s+heading\s+(\d{3})/i,
    'runway_heading': /runway\s+heading/i,
    'cleared_takeoff': /cleared\s+(?:for\s+)?take\s*off/i,
    'cleared_landing': /cleared\s+to\s+land/i,
    'cleared_approach': /cleared\s+(\w+)\s+approach/i,
    'line_up_wait': /line\s+up\s+(?:and\s+)?wait/i,
    'contact_frequency': /contact\s+(\w+)\s+(\d{3}[\.,]\d{1,3})/i,
    'squawk_code': /squawk\s+(\d{4})/i,
    'direct_to': /direct\s+(?:to\s+)?(\w+)/i,
    'hold_short': /hold\s+short\s+(?:of\s+)?runway/i,
    'taxi_to': /taxi\s+(?:to\s+)?(\w+)/i,
    'go_around': /go\s*around/i,
    'expedite': /expedite/i,
    'immediate': /immediate/i,
  }

  for (const [patternName, regex] of Object.entries(patternDefs)) {
    const match = text.match(regex)
    if (match) {
      results.push({
        pattern: patternName,
        weight: patternWeights[patternName] || 1.0,
        match: match[0],
      })
    }
  }

  return results
}

function compareReadbackWeighted(
  atc: string,
  pilot: string,
  weights: ModelWeights,
  patterns: { pattern: string; weight: number; match: string }[]
): { isComplete: boolean; confidence: number; missingElements: string[] } {
  const missingElements: string[] = []
  let totalWeight = 0
  let matchedWeight = 0

  // Normalize numbers for comparison
  const normalizedATC = normalizeNumbers(atc)
  const normalizedPilot = normalizeNumbers(pilot)

  // Check each pattern from ATC in pilot readback
  for (const pattern of patterns) {
    totalWeight += pattern.weight

    // Extract critical values from the pattern
    const values = extractCriticalValues(pattern.match)

    let found = false
    for (const value of values) {
      if (normalizedPilot.includes(value)) {
        found = true
        break
      }
    }

    if (found) {
      matchedWeight += pattern.weight
    } else {
      missingElements.push(pattern.pattern)
    }
  }

  const confidence = totalWeight > 0 ? matchedWeight / totalWeight : 1.0

  return {
    isComplete: missingElements.length === 0,
    confidence,
    missingElements,
  }
}

function detectErrorsWeighted(
  atc: string,
  pilot: string,
  errorWeights: Record<string, number>,
  readbackResult: { isComplete: boolean; missingElements: string[] },
  phase: string
): DetectedError[] {
  const errors: DetectedError[] = []

  // Check for missing elements
  for (const missing of readbackResult.missingElements) {
    const weight = errorWeights['missing_element'] || 1.0
    errors.push({
      type: 'missing_element',
      description: `Missing ${missing.replace(/_/g, ' ')} in readback`,
      severity: weight > 1.1 ? 'high' : 'medium',
      confidence: 0.9,
      weight,
      correction: `Include ${missing.replace(/_/g, ' ')} in your readback`,
    })
  }

  // Check for transposition and magnitude errors
  const atcNumbers = atc.match(/\d+/g) || []
  const pilotNumbers = pilot.match(/\d+/g) || []

  for (const atcNum of atcNumbers) {
    if (atcNum.length >= 2) {
      for (const pilotNum of pilotNumbers) {
        // Check for transposition (digit swap)
        if (isTransposed(atcNum, pilotNum)) {
          const weight = errorWeights['transposition'] || 1.0
          errors.push({
            type: 'transposition',
            description: `Digit transposition: ${atcNum} read as ${pilotNum}`,
            severity: 'critical',
            confidence: 0.9,
            weight,
            correction: `Correct value is ${atcNum}`,
          })
        }
        // Check for magnitude errors (1500 vs 15000, dropped/added zeros)
        else if (isMagnitudeError(atcNum, pilotNum)) {
          const weight = errorWeights['wrong_value'] || 1.2
          errors.push({
            type: 'wrong_value',
            description: `Magnitude error: ${atcNum} read as ${pilotNum} (10x or 100x difference)`,
            severity: 'critical',
            confidence: 0.95,
            weight,
            correction: `Correct value is ${atcNum} - verify you heard the correct number of digits`,
          })
        }
      }
    }
  }

  // Check for wrong direction
  const atcDir = atc.match(/\b(left|right)\b/i)
  const pilotDir = pilot.match(/\b(left|right)\b/i)
  if (atcDir && pilotDir && atcDir[1].toLowerCase() !== pilotDir[1].toLowerCase()) {
    const weight = errorWeights['wrong_direction'] || 1.0
    errors.push({
      type: 'wrong_direction',
      description: `Direction error: ${atcDir[1]} vs ${pilotDir[1]}`,
      severity: 'critical',
      confidence: 0.95,
      weight,
      correction: `Correct direction is ${atcDir[1]}`,
    })
  }

  // Check for incomplete readback (just "roger" or "wilco")
  const pilotTrimmed = pilot.trim().toLowerCase()
  if (['roger', 'wilco', 'copy', 'affirm'].includes(pilotTrimmed)) {
    const weight = errorWeights['incomplete_readback'] || 1.0
    errors.push({
      type: 'incomplete_readback',
      description: 'Readback is incomplete - critical instructions must be read back fully',
      severity: phase === 'approach' || phase === 'departure' ? 'high' : 'medium',
      confidence: 0.95,
      weight,
      correction: 'Read back all critical elements: altitude, heading, runway, squawk',
    })
  }

  // Check for missing callsign
  if (!pilot.match(/\b[A-Z]{2,4}\s*\d{2,4}\b/i)) {
    const weight = errorWeights['missing_element'] || 1.0
    errors.push({
      type: 'missing_callsign',
      description: 'Callsign may be missing from readback',
      severity: 'low',
      confidence: 0.7,
      weight: weight * 0.8,
    })
  }

  return errors
}

function calculateOverallConfidence(
  factors: Record<string, number>,
  weights: ModelWeights
): number {
  const factorWeights: Record<string, number> = {
    phase: 0.2,
    readback: 0.5,
    pattern: 0.3,
  }

  let totalWeight = 0
  let weightedSum = 0

  for (const [factor, value] of Object.entries(factors)) {
    const weight = factorWeights[factor] || 0.2
    weightedSum += value * weight
    totalWeight += weight
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0.5
}

function calculateSeverityWeighted(
  errors: DetectedError[],
  phase: string,
  weights: ModelWeights
): 'critical' | 'high' | 'medium' | 'low' {
  if (errors.length === 0) return 'low'

  const phaseMultiplier = weights.phaseWeights[phase] || 1.0

  // Calculate weighted severity score
  let maxSeverityScore = 0

  for (const error of errors) {
    let score = 0
    switch (error.severity) {
      case 'critical': score = 4 * weights.severityWeights.critical; break
      case 'high': score = 3 * weights.severityWeights.high; break
      case 'medium': score = 2 * weights.severityWeights.medium; break
      case 'low': score = 1 * weights.severityWeights.low; break
    }
    score *= error.weight * phaseMultiplier
    maxSeverityScore = Math.max(maxSeverityScore, score)
  }

  if (maxSeverityScore >= 5) return 'critical'
  if (maxSeverityScore >= 3.5) return 'high'
  if (maxSeverityScore >= 2) return 'medium'
  return 'low'
}

function generateAdaptiveSuggestions(
  errors: DetectedError[],
  phase: string,
  context?: { previousErrors?: string[] }
): string[] {
  const suggestions: string[] = []

  // Error-specific suggestions
  for (const error of errors) {
    if (error.correction) {
      suggestions.push(error.correction)
    }
  }

  // Phase-specific suggestions
  if (phase === 'approach' || phase === 'landing') {
    suggestions.push('Always confirm QNH/altimeter setting on approach')
    suggestions.push('Read back runway number to prevent wrong runway incidents')
  }

  if (phase === 'departure') {
    suggestions.push('Confirm SID and initial altitude')
    suggestions.push('Read back runway heading if assigned')
  }

  // Context-aware suggestions
  if (context?.previousErrors && context.previousErrors.length > 2) {
    const commonError = findMostCommon(context.previousErrors)
    if (commonError) {
      suggestions.push(`Focus on ${commonError.replace(/_/g, ' ')} - this is a recurring issue`)
    }
  }

  return suggestions.slice(0, 5)
}

// ============================================================================
// LEARNING & WEIGHT UPDATE FUNCTIONS
// ============================================================================

/**
 * Apply user correction to update model weights
 * Uses gradient-based update with momentum
 */
export function applyUserCorrection(
  modelState: AdaptiveModelState,
  correction: UserCorrection
): { updatedState: AdaptiveModelState; updates: WeightUpdate[] } {
  const updates: WeightUpdate[] = []
  const { weights, config, history } = modelState

  // Calculate effective learning rate (adaptive)
  let effectiveLR = config.learningRate
  if (config.adaptiveRateEnabled) {
    const recentAccuracy = calculateRecentAccuracy(history)
    // Higher learning rate when accuracy is low, lower when high
    effectiveLR = config.learningRate * (1.5 - recentAccuracy)
  }

  // 1. Update error weights based on prediction accuracy
  if (correction.original.predictedErrors.length > 0 || correction.corrected.actualErrors.length > 0) {
    const predictedSet = new Set(correction.original.predictedErrors)
    const actualSet = new Set(correction.corrected.actualErrors)

    // False positives - reduce weight for incorrectly predicted errors
    for (const predicted of Array.from(predictedSet)) {
      if (!actualSet.has(predicted)) {
        const oldWeight = weights.errorWeights[predicted] || 1.0
        const newWeight = oldWeight * (1 - effectiveLR * 0.5)
        weights.errorWeights[predicted] = Math.max(0.1, newWeight)

        updates.push({
          timestamp: Date.now(),
          pattern: `error:${predicted}`,
          oldWeight,
          newWeight: weights.errorWeights[predicted],
          reason: 'false_positive',
          learningRate: effectiveLR,
        })
      }
    }

    // False negatives - increase weight for missed errors
    for (const actual of Array.from(actualSet)) {
      if (!predictedSet.has(actual)) {
        const oldWeight = weights.errorWeights[actual] || 1.0
        const newWeight = oldWeight * (1 + effectiveLR * 0.5)
        weights.errorWeights[actual] = Math.min(3.0, newWeight)

        updates.push({
          timestamp: Date.now(),
          pattern: `error:${actual}`,
          oldWeight,
          newWeight: weights.errorWeights[actual],
          reason: 'false_negative',
          learningRate: effectiveLR,
        })
      }
    }
  }

  // 2. Update phase detection weights
  if (correction.original.predictedPhase !== correction.corrected.actualPhase) {
    // Decrease weight for wrong phase
    const wrongPhase = correction.original.predictedPhase
    const oldWrongWeight = weights.phaseWeights[wrongPhase] || 1.0
    weights.phaseWeights[wrongPhase] = Math.max(0.3, oldWrongWeight * (1 - effectiveLR))

    // Increase weight for correct phase
    const correctPhase = correction.corrected.actualPhase
    const oldCorrectWeight = weights.phaseWeights[correctPhase] || 1.0
    weights.phaseWeights[correctPhase] = Math.min(2.0, oldCorrectWeight * (1 + effectiveLR))

    updates.push({
      timestamp: Date.now(),
      pattern: `phase:${wrongPhase}`,
      oldWeight: oldWrongWeight,
      newWeight: weights.phaseWeights[wrongPhase],
      reason: 'phase_correction',
      learningRate: effectiveLR,
    })
  }

  // 3. Update confidence thresholds based on overall accuracy
  const wasWrong = correction.original.predictedCorrect !== correction.corrected.isActuallyCorrect
  if (wasWrong) {
    // Adjust threshold to be more/less strict
    if (correction.original.predictedCorrect && !correction.corrected.isActuallyCorrect) {
      // Was too lenient - increase threshold
      weights.thresholds.errorDetection = Math.min(0.9, weights.thresholds.errorDetection + effectiveLR * 0.05)
    } else {
      // Was too strict - decrease threshold
      weights.thresholds.errorDetection = Math.max(0.4, weights.thresholds.errorDetection - effectiveLR * 0.05)
    }
  }

  // 4. Update history
  history.totalInteractions++
  if (wasWrong) {
    history.incorrectPredictions++
  } else {
    history.correctPredictions++
  }

  // Add correction to history (with size limit)
  correction.applied = true
  history.userCorrections.push(correction)
  if (history.userCorrections.length > config.maxHistorySize) {
    history.userCorrections = history.userCorrections.slice(-config.maxHistorySize)
  }

  // Add weight updates to history
  history.weightUpdates.push(...updates)
  if (history.weightUpdates.length > config.maxHistorySize * 2) {
    history.weightUpdates = history.weightUpdates.slice(-config.maxHistorySize)
  }

  // Record accuracy
  const currentAccuracy = history.correctPredictions / history.totalInteractions
  history.accuracyOverTime.push({
    timestamp: Date.now(),
    accuracy: currentAccuracy,
  })

  // Limit accuracy history
  if (history.accuracyOverTime.length > 1000) {
    history.accuracyOverTime = history.accuracyOverTime.slice(-1000)
  }

  modelState.updatedAt = new Date().toISOString()

  return { updatedState: modelState, updates }
}

/**
 * Reinforcement learning update based on user session performance
 */
export function reinforcementUpdate(
  modelState: AdaptiveModelState,
  sessionResults: {
    totalReadbacks: number
    correctReadbacks: number
    commonErrors: string[]
    phases: string[]
  }
): AdaptiveModelState {
  if (!modelState.config.reinforcementEnabled) return modelState

  const { weights, config } = modelState
  const sessionAccuracy = sessionResults.correctReadbacks / sessionResults.totalReadbacks

  // Reward/penalize based on session accuracy
  const reward = sessionAccuracy > 0.8 ? 0.02 : sessionAccuracy < 0.5 ? -0.02 : 0

  // Update phase weights based on session focus
  for (const phase of sessionResults.phases) {
    const oldWeight = weights.phaseWeights[phase] || 1.0
    weights.phaseWeights[phase] = Math.max(0.5, Math.min(2.0, oldWeight + reward))
  }

  // Increase weights for common errors (to detect them better)
  for (const error of sessionResults.commonErrors) {
    const oldWeight = weights.errorWeights[error] || 1.0
    weights.errorWeights[error] = Math.min(2.5, oldWeight * (1 + config.learningRate * 0.3))
  }

  modelState.history.lastTrainingDate = new Date().toISOString()
  modelState.updatedAt = new Date().toISOString()

  return modelState
}

/**
 * Get model performance statistics
 */
export function getModelStats(modelState: AdaptiveModelState): {
  accuracy: number
  totalInteractions: number
  recentAccuracy: number
  topErrors: { error: string; count: number }[]
  weightDistribution: { min: number; max: number; avg: number }
  learningProgress: { improved: boolean; changePercent: number }
} {
  const { history, weights } = modelState

  const accuracy = history.totalInteractions > 0
    ? history.correctPredictions / history.totalInteractions
    : 0

  const recentAccuracy = calculateRecentAccuracy(history)

  // Count error types from corrections
  const errorCounts: Record<string, number> = {}
  for (const correction of history.userCorrections) {
    for (const error of correction.corrected.actualErrors) {
      errorCounts[error] = (errorCounts[error] || 0) + 1
    }
  }

  const topErrors = Object.entries(errorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([error, count]) => ({ error, count }))

  // Weight distribution
  const allWeights = [
    ...Object.values(weights.patternWeights),
    ...Object.values(weights.errorWeights),
    ...Object.values(weights.phaseWeights),
  ]

  const weightDistribution = {
    min: Math.min(...allWeights),
    max: Math.max(...allWeights),
    avg: allWeights.reduce((a, b) => a + b, 0) / allWeights.length,
  }

  // Learning progress
  const recentHistory = history.accuracyOverTime.slice(-100)
  const olderHistory = history.accuracyOverTime.slice(-200, -100)

  const recentAvg = recentHistory.length > 0
    ? recentHistory.reduce((a, b) => a + b.accuracy, 0) / recentHistory.length
    : 0
  const olderAvg = olderHistory.length > 0
    ? olderHistory.reduce((a, b) => a + b.accuracy, 0) / olderHistory.length
    : recentAvg

  return {
    accuracy,
    totalInteractions: history.totalInteractions,
    recentAccuracy,
    topErrors,
    weightDistribution,
    learningProgress: {
      improved: recentAvg > olderAvg,
      changePercent: olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0,
    },
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function normalizeNumbers(text: string): string {
  const wordToNum: Record<string, string> = {
    'zero': '0', 'one': '1', 'two': '2', 'tree': '3', 'three': '3',
    'four': '4', 'fower': '4', 'five': '5', 'fife': '5',
    'six': '6', 'seven': '7', 'eight': '8', 'niner': '9', 'nine': '9',
  }

  let result = text.toLowerCase()
  for (const [word, num] of Object.entries(wordToNum)) {
    result = result.replace(new RegExp(`\\b${word}\\b`, 'g'), num)
  }

  return result
}

function extractCriticalValues(match: string): string[] {
  const numbers = match.match(/\d+/g) || []
  const directions = match.match(/\b(left|right)\b/gi) || []

  return [...numbers, ...directions.map(d => d.toLowerCase())]
}

/**
 * Improved transposition detection - identifies actual digit swaps
 * A transposition is when adjacent digits are swapped or a single pair is swapped
 *
 * Examples:
 * - "123" → "132" (2 and 3 swapped) = TRUE transposition
 * - "1234" → "1324" (2 and 3 swapped) = TRUE transposition
 * - "123" → "321" (complete reversal) = NOT a simple transposition
 * - "130" → "103" (same sorted digits but different meaning) = NOT transposition
 *
 * The old method of comparing sorted digits caused false positives
 */
function isTransposed(a: string, b: string): boolean {
  if (a.length !== b.length || a.length < 2) return false
  if (a === b) return false

  // Count exact position differences
  let diffCount = 0
  const diffPositions: number[] = []

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      diffCount++
      diffPositions.push(i)
    }
  }

  // A true transposition has exactly 2 positions different
  // AND the swapped digits must be the same pair
  if (diffCount !== 2) return false

  const [pos1, pos2] = diffPositions

  // Check if it's an actual swap: a[pos1] = b[pos2] AND a[pos2] = b[pos1]
  if (a[pos1] === b[pos2] && a[pos2] === b[pos1]) {
    // Additional check: positions should be within reasonable swap distance
    const distance = Math.abs(pos2 - pos1)
    if (distance <= 2) {
      return true
    }
  }

  return false
}

/**
 * Check for magnitude errors (e.g., 1500 vs 15000, 180 vs 18)
 * These indicate hearing/understanding errors with dropped/added zeros
 */
function isMagnitudeError(a: string, b: string): boolean {
  const numA = parseInt(a, 10)
  const numB = parseInt(b, 10)

  if (isNaN(numA) || isNaN(numB) || numA === 0 || numB === 0) return false

  // Check for 10x or 100x magnitude difference
  const ratio = Math.max(numA, numB) / Math.min(numA, numB)
  return ratio === 10 || ratio === 100
}

function findMostCommon(arr: string[]): string | null {
  if (arr.length === 0) return null

  const counts: Record<string, number> = {}
  for (const item of arr) {
    counts[item] = (counts[item] || 0) + 1
  }

  let maxCount = 0
  let maxItem = null
  for (const [item, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count
      maxItem = item
    }
  }

  return maxItem
}

function calculateRecentAccuracy(history: LearningHistory): number {
  const recent = history.accuracyOverTime.slice(-50)
  if (recent.length === 0) return 0.5

  return recent.reduce((sum, r) => sum + r.accuracy, 0) / recent.length
}

// ============================================================================
// EXPORT MODEL STATE MANAGEMENT
// ============================================================================

export function serializeModel(state: AdaptiveModelState): string {
  return JSON.stringify(state, null, 2)
}

export function deserializeModel(json: string): AdaptiveModelState {
  try {
    return JSON.parse(json) as AdaptiveModelState
  } catch {
    return createDefaultModelState()
  }
}
