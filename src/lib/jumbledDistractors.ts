/**
 * Distractor-word generation for the Jumbled Clearance exercise.
 *
 * Distractors are sampled from words that already appear in OTHER active jumbled
 * questions in the corpus. They are attached to the API response only — never
 * written back to the DB — so the admin upload flow stays untouched.
 */

import { getRandomActiveQuestions } from '@/lib/database'
import { levenshtein, normalize } from '@/lib/atcAnswerMatcher'

const POOL_SAMPLE_SIZE = 30

export async function buildJumbledDistractorPool(): Promise<string[]> {
  const rows = await getRandomActiveQuestions('jumbled', POOL_SAMPLE_SIZE)
  const seen = new Set<string>()
  for (const q of rows) {
    const data = q.question_data as Record<string, unknown>
    const words = (data.correctOrder as string[] | undefined) ?? []
    for (const w of words) {
      const n = normalize(String(w))
      if (n) seen.add(n)
    }
  }
  return [...seen]
}

export function pickDistractorsForQuestion(
  correctOrder: string[],
  pool: string[],
  count: number,
): string[] {
  if (count <= 0 || pool.length === 0) return []

  const correctNorm = correctOrder.map(normalize).filter(Boolean)
  const eligible = pool.filter(word => {
    if (!word) return false
    return !correctNorm.some(cw => word === cw || levenshtein(word, cw) <= 1)
  })

  const shuffled = [...eligible]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, count)
}

export function distractorCount(correctLength: number): number {
  const proportional = Math.round(correctLength * 0.3)
  return Math.min(4, Math.max(2, proportional))
}
