// Scenario Response Validator
export function validateScenarioResponse(
  userResponse: string,
  correctResponse: string,
  scenario: {
    callSign: string
    atcClearance: string
  }
): {
  correct: boolean
  score: number
  corrections: string[]
  suggestion: string
} {
  const userLower = userResponse.toLowerCase().trim()
  const correctLower = correctResponse.toLowerCase().trim()

  const corrections: string[] = []
  let score = 100

  // Check for call sign at the end
  if (!userLower.endsWith(scenario.callSign.toLowerCase())) {
    corrections.push('Call sign should be at the end of the readback')
    score -= 20
  }

  // Check for key phrases from ATC clearance
  const keyPhrases = extractKeyPhrases(scenario.atcClearance)

  for (const phrase of keyPhrases) {
    if (!userLower.includes(phrase.toLowerCase())) {
      corrections.push(`Missing element: "${phrase}"`)
      score -= 15
    }
  }

  // Check for common readback errors
  if (userLower.includes('maintain') && !userLower.includes('and maintain')) {
    corrections.push('Use complete phraseology: "and maintain" instead of just "maintain"')
    score -= 10
  }

  const correct = corrections.length === 0
  return {
    correct,
    score: Math.max(0, score),
    corrections,
    suggestion: correctResponse,
  }
}

function extractKeyPhrases(atcClearance: string): string[] {
  const phrases: string[] = []

  // Extract flight level
  const flMatch = atcClearance.match(/flight level (\d+)/i)
  if (flMatch) phrases.push(`flight level ${flMatch[1]}`)

  // Extract altitude in feet
  const feetMatch = atcClearance.match(/(\d+) feet/i)
  if (feetMatch) phrases.push(`${feetMatch[1]} feet`)

  // Extract heading
  const headingMatch = atcClearance.match(/heading (\d+)/i)
  if (headingMatch) phrases.push(`heading ${headingMatch[1]}`)

  // Extract speed
  const speedMatch = atcClearance.match(/(\d+) knots/i)
  if (speedMatch) phrases.push(`${speedMatch[1]} knots`)

  // Extract runway
  const runwayMatch = atcClearance.match(/runway (\d+[LCR]?)/i)
  if (runwayMatch) phrases.push(`runway ${runwayMatch[1]}`)

  return phrases
}

// Readback Error Validator
export function validateReadbackCorrection(
  selectedErrors: string[],
  actualErrors: { incorrect: string }[]
): {
  score: number
  foundCount: number
  totalErrors: number
} {
  const incorrectValues = actualErrors.map(e => e.incorrect.toLowerCase())
  const correctSelections = selectedErrors.filter(sel =>
    incorrectValues.includes(sel.toLowerCase())
  )

  const foundCount = correctSelections.length
  const totalErrors = actualErrors.length
  const score = Math.round((foundCount / totalErrors) * 100)

  return { score, foundCount, totalErrors }
}

// Jumbled Clearance Validator
export function validateJumbledSequence(
  arrangedWords: string[],
  correctOrder: string[]
): {
  score: number
  correctPositions: number
  totalWords: number
} {
  let correctPositions = 0

  for (let i = 0; i < correctOrder.length; i++) {
    if (arrangedWords[i] === correctOrder[i]) {
      correctPositions++
    }
  }

  const totalWords = correctOrder.length
  const score = Math.round((correctPositions / totalWords) * 100)

  return { score, correctPositions, totalWords }
}

// Pronunciation Validator
export function validatePronunciation(
  selectedOption: string,
  correctPronunciation: string
): {
  correct: boolean
  score: number
} {
  const correct = selectedOption === correctPronunciation
  return {
    correct,
    score: correct ? 100 : 0,
  }
}

// Calculate improvement based on previous scores
export function calculateImprovement(
  currentScore: number,
  previousScore: number | null
): number | null {
  if (previousScore === null) return null
  return Math.round(currentScore - previousScore)
}
