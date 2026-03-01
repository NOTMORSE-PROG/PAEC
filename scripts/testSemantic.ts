import { analyzeReadback, detectInstructionType } from '../src/lib/semanticReadbackAnalyzer'

const exchanges = [
  { id:1, atc:'Philippine one eighty niner, Manila Approach, radar contact, descend to five thousand feet, QNH one zero one three.', pilot:'Descending to five thousand, QNH one zero one three, Philippine one eighty niner.' },
  { id:2, atc:'Philippine one eighty niner, turn left heading zero six zero, reduce speed to two hundred and ten knots.', pilot:'Left heading zero six zero, speed two hundred and ten knots, Philippine one eighty niner.' },
  { id:3, atc:'Philippine one eighty niner, descend to three thousand feet.', pilot:'Descending to three thousand feet, Philippine one eighty niner.' },
  { id:4, atc:'Philippine one eighty niner, cleared ILS approach runway zero six, report established on localizer.', pilot:'Cleared ILS approach runway zero six, wilco, Philippine one eighty niner.' },
  { id:5, atc:'Philippine one eighty niner, reduce speed to one eight zero knots.', pilot:'Speed one eight zero knots, Philippine one eighty niner.' },
  { id:6, atc:'Philippine one eighty niner, contact Manila Tower on one one eight decimal one.', pilot:'One one eight decimal one, Philippine one eighty niner.' },
  { id:7, atc:'Philippine one eighty niner, wind zero three zero degrees, one five knots, cleared to land runway zero six.', pilot:'Cleared to land runway zero six, Philippine one eighty niner.' },
]

for (const { id, atc, pilot } of exchanges) {
  const type = detectInstructionType(atc.toLowerCase())
  const result = analyzeReadback(atc, pilot)
  const status = result.isCorrect ? '✓' : '✗'
  console.log(`${status} Ex${id} type=${type} quality=${result.quality} errors=${result.errors.length}`)
  for (const e of result.errors) {
    console.log(`    [${e.type}] param=${e.parameter} exp="${e.expectedValue}" act="${e.actualValue}"`)
  }
}
