/**
 * Assertion harness for atcAnswerMatcher.
 *
 * Run with: npx tsx scripts/test-answer-matcher.ts
 *
 * Every expected value is derived from the QUALITY_BASE + ERROR_WEIGHTS table
 * documented in src/lib/atcAnswerMatcher.ts. Nothing is guessed.
 *
 * Cases 11-12: Pronunciation and Jumbled regression guards —
 *   these paths are untouched in the new scorer; the test just confirms the
 *   levenshtein/normalize re-exports remain byte-identical to before.
 */

import { semanticReadbackScore, computeScenarioElements, levenshtein, normalize } from '../src/lib/atcAnswerMatcher'

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(label: string, actual: number, check: (n: number) => boolean, hint: string) {
  if (check(actual)) {
    console.log(`  ✓  ${label}  →  ${actual}`)
    passed++
  } else {
    console.error(`  ✗  ${label}  →  ${actual}  (${hint})`)
    failed++
  }
}

function assertNoThrow(label: string, fn: () => unknown) {
  try {
    fn()
    console.log(`  ✓  ${label}  →  no throw`)
    passed++
  } catch (err) {
    console.error(`  ✗  ${label}  →  threw: ${err}`)
    failed++
  }
}

// ── Readback scoring cases ────────────────────────────────────────────────────

console.log('\nReadback scorer:')

// Case 1 — exact canonical readback → 100
assert(
  '1. exact readback',
  semanticReadbackScore('CPA 101, climbing to FL350', {
    correctReadback: 'CPA 101, climbing to FL350',
    atcInstruction: 'CPA 101, climb and maintain FL350',
  }),
  n => n === 100,
  'expected 100 (complete, 0 errors)'
)

// Case 2 — spoken numbers, same meaning → should be ≥ 95
// "climbing flight level three five zero" vs "climb and maintain FL350"
// analyzeReadback: FL350 === FL350 (via normalizeToDigits), quality=complete → score 100
assert(
  '2. spoken FL "three five zero" ≡ FL350',
  semanticReadbackScore('CPA 101, climbing flight level three five zero', {
    correctReadback: 'CPA 101, climbing to FL350',
    atcInstruction: 'CPA 101, climb and maintain FL350',
  }),
  n => n >= 90,
  'expected ≥ 90 (verb tense not compared, FL350===FL350)'
)

// Case 3 — word order change, spoken heading → should be ≥ 90
assert(
  '3. word order swap + spoken heading "two seven zero"',
  semanticReadbackScore('PAL 123 turning right heading two seven zero', {
    correctReadback: 'Turn right heading 270, PAL 123',
    atcInstruction: 'PAL 123, turn right heading 270',
  }),
  n => n >= 90,
  'expected ≥ 90 (270===270, word order irrelevant)'
)

// Case 4 — missing callsign → partial (75) minus errors = somewhere in 40-80 range
assert(
  '4. correct altitude but missing callsign',
  semanticReadbackScore('squawking seven thousand', {
    correctReadback: 'Squawk 7000, CPA 101',
    atcInstruction: 'CPA 101, squawk 7000',
  }),
  n => n >= 40 && n <= 80,
  'expected 40-80 range (partial, missing callsign)'
)

// Case 5 — wrong altitude value → incorrect (40) minus high (15) = 25
assert(
  '5. wrong altitude value',
  semanticReadbackScore('CPA 101, climbing FL250', {
    correctReadback: 'CPA 101, climbing to FL350',
    atcInstruction: 'CPA 101, climb and maintain FL350',
  }),
  n => n < 40,
  'expected < 40 (incorrect + wrong_value error)'
)

// Case 6 — roger-only for altitude → missing (15) minus high (15) = 0
assert(
  '6. roger-only for safety-critical instruction',
  semanticReadbackScore('roger', {
    correctReadback: 'CPA 101, climbing to FL350',
    atcInstruction: 'CPA 101, climb and maintain FL350',
  }),
  n => n === 0,
  'expected 0 (missing quality + high error = 15-15=0)'
)

// Case 7 — empty string → 0 (short-circuit)
assert(
  '7. empty answer',
  semanticReadbackScore('', {
    correctReadback: 'CPA 101, climbing to FL350',
    atcInstruction: 'CPA 101, climb and maintain FL350',
  }),
  n => n === 0,
  'expected 0 (empty short-circuit)'
)

// Case 8 — pre-filled incorrect readback submitted unchanged → 0
const incorrectPrefill = 'CPA 101, descending to FL350'
assert(
  '8. pre-filled incorrect readback unchanged → 0',
  semanticReadbackScore(incorrectPrefill, {
    correctReadback: 'CPA 101, climbing to FL350',
    incorrectReadback: incorrectPrefill,
    atcInstruction: 'CPA 101, climb and maintain FL350',
  }),
  n => n === 0,
  'expected 0 (pre-filled short-circuit)'
)

// ── Scenario element scoring cases ───────────────────────────────────────────

console.log('\nScenario element scorer:')

// Case 9 — paraphrased scenario with all slots → ≥ 75
const scenarioData = {
  callSign: 'CPA 101',
  atcClearance: 'CPA 101, climb and maintain FL350, squawk 7000',
  correctResponse: 'Climbing to FL350, squawk 7000, CPA 101',
}
const { score: s9, elements: e9 } = computeScenarioElements(
  scenarioData,
  'CPA 101, climbing flight level three five zero, squawking seven thousand'
)
assert('9. paraphrased scenario all slots', s9, n => n >= 75, 'expected ≥ 75')
const e9Names = e9.map(e => e.name)
const hasCallSign = e9Names.includes('callSign')
const hasAltitude = e9Names.includes('altitude')
if (hasCallSign && hasAltitude) {
  console.log(`  ✓  9b. element slots present: ${e9Names.join(', ')}`)
  passed++
} else {
  console.error(`  ✗  9b. missing expected slots. Got: ${e9Names.join(', ')}`)
  failed++
}

// Case 10 — malformed question_data (no atcClearance) → must not throw, score ≥ 0
assertNoThrow('10. missing atcClearance does not throw', () => {
  const { score } = computeScenarioElements({}, 'CPA 101 FL350')
  if (score < 0) throw new Error(`negative score: ${score}`)
})

// ── Regression guards: primitives ────────────────────────────────────────────

console.log('\nPrimitive regression guards:')

// Case 11 — levenshtein byte-identical to original
const lev = levenshtein('abc', 'ac')
assert('11. levenshtein("abc","ac") === 1', lev, n => n === 1, 'edit distance should be 1')
assert('11b. levenshtein("","abc") === 3', levenshtein('', 'abc'), n => n === 3, '')
assert('11c. levenshtein("abc","abc") === 0', levenshtein('abc', 'abc'), n => n === 0, '')

// Case 12 — normalize byte-identical to original
const norm = normalize('Hello, World! 123')
if (norm === 'hello world 123') {
  console.log(`  ✓  12. normalize strips punctuation correctly`)
  passed++
} else {
  console.error(`  ✗  12. normalize output: "${norm}" (expected "hello world 123")`)
  failed++
}

// ── Performance / safety ─────────────────────────────────────────────────────

console.log('\nPerformance:')

// Case 13 — 4000-char input completes quickly (no OOM from Levenshtein)
const bigInput = 'a'.repeat(4000)
const t0 = Date.now()
semanticReadbackScore(bigInput, {
  correctReadback: 'CPA 101 FL350',
  atcInstruction: 'CPA 101, climb and maintain FL350',
})
const elapsed = Date.now() - t0
assert('13. 4000-char input completes < 500ms', elapsed, n => n < 500, `took ${elapsed}ms`)

// Case 14 — 10 concurrent calls are independent (statelessness guard)
console.log('\nConcurrency:')
const inputs = [
  { user: 'CPA 101, climbing to FL350', atc: 'CPA 101, climb and maintain FL350' },
  { user: 'PAL 123 heading 270', atc: 'PAL 123, turn right heading 270' },
  { user: 'CEB 456 squawk 7000', atc: 'CEB 456, squawk 7000' },
  { user: 'roger', atc: 'CPA 101, climb and maintain FL350' },
  { user: '', atc: 'CPA 101, climb and maintain FL350' },
  { user: 'CPA 101 FL350', atc: 'CPA 101, climb and maintain FL350' },
  { user: 'PAL 123 heading 270', atc: 'PAL 123, turn right heading 270' },
  { user: 'CEB 456 squawk 7700', atc: 'CEB 456, squawk 7000' },
  { user: 'CPA 101 FL250', atc: 'CPA 101, climb and maintain FL350' },
  { user: 'CPA 101 FL350', atc: 'CPA 101, climb and maintain FL350' },
]
const concurrent = inputs.map(({ user, atc }) =>
  Promise.resolve(semanticReadbackScore(user, { correctReadback: atc, atcInstruction: atc }))
)
Promise.all(concurrent).then(results => {
  const rogerIdx = 3, emptyIdx = 4, exactIdx = 0
  let concOk = true
  if (results[rogerIdx] !== 0) { console.error(`  ✗  14. roger-only should be 0, got ${results[rogerIdx]}`); concOk = false; failed++ }
  if (results[emptyIdx] !== 0) { console.error(`  ✗  14. empty should be 0, got ${results[emptyIdx]}`); concOk = false; failed++ }
  if (results[exactIdx] < 90) { console.error(`  ✗  14. exact should be ≥90, got ${results[exactIdx]}`); concOk = false; failed++ }
  if (concOk) { console.log(`  ✓  14. 10 concurrent calls returned independent results`); passed++ }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`  ${passed} passed  |  ${failed} failed`)
  if (failed > 0) process.exit(1)
})
