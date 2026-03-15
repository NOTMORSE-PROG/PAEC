import {
  ENHANCED_CALLSIGNS,
  PHILIPPINE_WAYPOINTS,
  ENHANCED_SIDS,
  ENHANCED_STARS,
  PHILIPPINE_FACILITIES,
} from '@/lib/atcData'

// ── Digit-to-word normalization ───────────────────────────────────────────────

const DIGIT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

/**
 * Converts digit sequences in a speech transcript to spelled-out ICAO words.
 *   "FL350"   → "flight level three five zero"
 *   "121.5"   → "one two one decimal five"
 *   "2201"    → "two two zero one"
 *   "220"     → "two two zero"
 */
export function normalizeDigits(text: string): string {
  // 1. Flight level: FL350 / FL 35 → "flight level three five zero"
  text = text.replace(/\bfl\s*(\d{2,3})\b/gi, (_, d: string) =>
    'flight level ' + [...d].map(n => DIGIT_WORDS[+n]).join(' ')
  )

  // 2. Radio frequencies: 121.5 / 121.525 → "one two one decimal five two five"
  text = text.replace(/\b(\d{3})\.(\d{1,3})\b/g, (_, int: string, dec: string) =>
    [...int].map(n => DIGIT_WORDS[+n]).join(' ') +
    ' decimal ' +
    [...dec].map(n => DIGIT_WORDS[+n]).join(' ')
  )

  // 3. Any remaining digit run → digit-by-digit words
  text = text.replace(/\d+/g, (d: string) => [...d].map(n => DIGIT_WORDS[+n]).join(' '))

  return text.replace(/\s+/g, ' ').trim()
}

// ── Aviation vocabulary (dynamic from paecCorpus.json via atcData.ts) ─────────

/**
 * Combined aviation vocabulary list used for:
 * 1. SpeechGrammarList hints — biases the recognizer toward these terms
 * 2. Future post-processing normalization
 *
 * Automatically includes any new callsigns/waypoints added to paecCorpus.json.
 */
export const AVIATION_VOCABULARY: string[] = [
  ...ENHANCED_CALLSIGNS,
  ...PHILIPPINE_WAYPOINTS,
  ...ENHANCED_SIDS,
  ...ENHANCED_STARS,
  ...PHILIPPINE_FACILITIES,
  // Core ATC phraseology that recognizers sometimes mangle
  'niner', 'wilco', 'affirm', 'negative', 'standby', 'roger',
  'squawk', 'ident', 'cleared', 'maintain', 'descend', 'climb',
  'heading', 'direct', 'approach', 'departure', 'tower', 'ground',
  'frequency', 'contact', 'report', 'traffic', 'runway', 'readback',
  'altimeter', 'transition', 'expedite', 'immediately', 'hold', 'short',
]

/**
 * Builds a JSGF grammar string from the vocabulary list for use with
 * SpeechGrammarList (Chrome/Edge only — ignored gracefully elsewhere).
 */
export function buildAviationGrammar(vocabulary: string[]): string {
  const terms = [...new Set(vocabulary.map(v => v.toLowerCase()))].join(' | ')
  return `#JSGF V1.0;\ngrammar aviation;\npublic <aviation> = ${terms};`
}
