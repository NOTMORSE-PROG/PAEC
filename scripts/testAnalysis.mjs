/**
 * testAnalysis.mjs
 * Verifies analysis-engine logic (normalizeSpelledNumbers, detectInstructionType,
 * extractAltitude/Speed/Heading/Altimeter, callsign detection) against real
 * ATC-pilot test cases from web research.
 *
 * Run: node scripts/testAnalysis.mjs
 */

// ── Colour helpers ─────────────────────────────────────────────────────────────
const G = s => `\x1b[32m  ✓\x1b[0m ${s}`
const R = s => `\x1b[31m  ✗\x1b[0m ${s}`
const H = s => `\x1b[1m\x1b[36m══ ${s} ══\x1b[0m`

let passed = 0, failed = 0
function ok(msg)   { console.log(G(msg)); passed++ }
function fail(msg) { console.log(R(msg)); failed++ }
function assert(cond, msg) { cond ? ok(msg) : fail(msg) }

// ── Replicate normalizeSpelledNumbers ─────────────────────────────────────────
const WORD_TO_NUM = {
  zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,
  niner:9,tree:3,fife:5,fower:4,
  ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,
  sixteen:16,seventeen:17,eighteen:18,nineteen:19,
  twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,
}
function parseSubHundred(s) {
  const parts = s.trim().toLowerCase().split(/[\s-]+/).filter(Boolean)
  const v0 = WORD_TO_NUM[parts[0]]
  if (parts.length === 1) return isNaN(v0) ? 0 : v0
  const v1 = WORD_TO_NUM[parts[1]] ?? 0
  if (v0 !== undefined && v0 >= 10 && v0 < 100 && v1 >= 0 && v1 < 10) return v0 + v1
  return 0
}
function normalizeSpelledNumbers(text) {
  let s = text.toLowerCase()

  const ONES_TENS = '(?:zero|one|two|three|four|five|six|seven|eight|nine|niner|' +
                    'ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|' +
                    'twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)'
  const SUB100 = `(?:(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\\s-]+)?${ONES_TENS}`

  // Phase A1: "X thousand [Y hundred [and Z]]"
  s = s.replace(
    new RegExp(
      `\\b(${SUB100})\\s+thousand` +
      `(?:\\s+(?:and\\s+)?(${ONES_TENS})\\s+hundred(?:\\s+(?:and\\s+)?(${SUB100}))?)?` +
      `(?:\\s+(?:and\\s+)?(${SUB100})(?!\\s+hundred))?\\b`,
      'gi',
    ),
    (_m, th, hun, afterHun, noHun) => {
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

  // Phase A2: "X hundred [and Y]"
  s = s.replace(
    new RegExp(
      `\\b(zero|one|two|three|four|five|six|seven|eight|nine|niner)\\s+hundred` +
      `(?:\\s+(?:and\\s+)?(${SUB100}))?\\b`,
      'gi',
    ),
    (_m, hun, rest) => {
      const hV = WORD_TO_NUM[hun.toLowerCase()] ?? 0
      if (!hV || hV > 9) return _m
      let total = hV * 100
      if (rest) { const rV = parseSubHundred(rest); if (rV > 0 && rV < 100) total += rV }
      return String(total)
    },
  )

  // Phase B: individual phonetic digits
  const PHONETIC = { zero:'0',one:'1',two:'2',three:'3',four:'4',five:'5',
    six:'6',seven:'7',eight:'8',nine:'9',niner:'9',tree:'3',fife:'5',fower:'4' }
  for (const [word, digit] of Object.entries(PHONETIC)) {
    s = s.replace(new RegExp(`\\b${word}\\b`, 'gi'), digit)
  }
  // Loop until stable: "1 8 0" → "18 0" → "180"
  let prev
  do {
    prev = s
    s = s.replace(/(\d)\s+(\d)/g, '$1$2')
  } while (s !== prev)
  return s
}

// ── Replicate extraction helpers ───────────────────────────────────────────────
function extractAltitude(text) {
  const n = normalizeSpelledNumbers(text)
  const fl = n.match(/flight\s*level\s*(\d{2,3})/i) || n.match(/FL\s*(\d{2,3})/i)
  if (fl) return fl[1]
  const alt = n.match(/(\d{3,5})\s*(feet|ft)?/i)
  return alt ? alt[1] : null
}
function extractHeading(text) {
  const n = normalizeSpelledNumbers(text)
  const m = n.match(/heading\s*(\d{1,3})/i) ||
            n.match(/turn\s+(?:left|right)\s+(?:heading\s+)?(\d{1,3})/i)
  return m ? m[1].padStart(3, '0') : null
}
function extractSpeed(text) {
  const n = normalizeSpelledNumbers(text)
  const m = n.match(/speed\s*(?:to\s+)?(\d{2,3})\s*(?:knots)?/i) ||
            n.match(/(\d{2,3})\s*knots/i) ||
            n.match(/(?:reduce|increase|maintain)\s+(?:speed\s+)?(?:to\s+)?(\d{2,3})/i)
  return m ? m[1] : null
}
function extractAltimeter(text) {
  const n = normalizeSpelledNumbers(text)
  const m = n.match(/(?:altimeter|qnh)\s*(\d{4})/i)
  return m ? m[1] : null
}

// ── Replicate detectInstructionType ───────────────────────────────────────────
function detectInstructionType(text) {
  const n = normalizeSpelledNumbers(text)
  const patterns = [
    ['altitude', /(climb|descend)\s+(and\s+)?maintain/i],
    ['altitude', /(climb|descend)\s+(to\s+|and\s+maintain\s+)?(flight\s+level|FL|\d)/i],
    ['speed',    /maintain\s+\d+\s*knots/i],  // before altitude-maintain
    ['altitude', /maintain\s+(flight\s+level|FL|\d)/i],
    ['altitude', /(climb|descend)\s+.{0,30}(flight\s+level|\d{3,5})/i],
    ['heading',  /turn\s+(left|right)/i],
    ['heading',  /heading\s+\d/i],
    ['heading',  /fly\s+heading\s+\d/i],
    ['speed',    /(reduce|increase)\s+speed\s+(to\s+)?\d/i],
    ['speed',    /maintain\s+(\d+\s*knots|speed)/i],
    ['speed',    /speed\s+\d+\s*knots/i],
    ['speed',    /\d+\s*knots/i],
    ['altimeter',/altimeter\s+\d/i],
    ['altimeter',/qnh\s+\d/i],
    ['squawk',   /squawk\s+\d/i],
    ['frequency',/contact\s+\w+(?:\s+\w+)?\s+(on\s+)?\d/i],
    ['frequency',/monitor\s+\w+/i],
    ['approach', /cleared\s+(ils|rnav|vor|visual|ndb)\s+(?:runway\s+\S+\s+)?approach/i],
    ['approach', /cleared\s+(?:for\s+)?(?:the\s+)?(ils|rnav|vor|visual|ndb)\s+approach/i],
    ['takeoff',  /cleared\s+(for\s+)?take\s*off/i],
    ['landing',  /cleared\s+to\s+land/i],
    ['hold',     /\bhold\b/i],
    ['lineup',   /line\s+up\s+and\s+wait/i],
    ['direct',   /proceed\s+direct|direct\s+(to\s+)?\w+/i],
  ]
  for (const [type, pat] of patterns) {
    if (pat.test(n)) return type
  }
  return 'other'
}

// ── Spoken callsign detection ──────────────────────────────────────────────────
const _spokenDigitAlt =
  '(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|' +
  'zero|one|two|three|four|five|six|seven|eight|nine|niner)'
const _callsigns = ['PHILIPPINE','PAL','CEBU','CEB','AIRPHIL','COOLRED','EMIRATES','CATHAY',
  'SINGAPORE','MALAYSIA','GARUDA','LUFTHANSA','JETSTAR','SCOOT','QATARI']
const _callsignsAlt = _callsigns.join('|')
const CALLSIGN_AT_END_RE = new RegExp(
  `,\\s*(${_callsignsAlt})(?:\\s*\\d+|(?:\\s+${_spokenDigitAlt}){1,4})\\.?$`, 'i',
)
const CALLSIGN_SPOKEN_RE = new RegExp(
  `\\b(${_callsignsAlt})(?:\\s+${_spokenDigitAlt}){1,4}\\b`, 'i',
)

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ══════════════════════════════════════════════════════════════════════════════

// ── 1. normalizeSpelledNumbers ─────────────────────────────────────────────────
console.log(H('normalizeSpelledNumbers'))
const normCases = [
  // Altitudes
  ['five thousand',              '5000'],
  ['seven thousand',             '7000'],
  ['three thousand five hundred','3500'],
  ['twelve thousand',            '12000'],
  ['flight level two four zero', 'flight level 240'],
  ['flight level one eight zero','flight level 180'],
  // Speeds
  ['two hundred',                '200'],
  ['two hundred and ten',        '210'],
  ['two hundred fifty',          '250'],
  ['one eight zero',             '180'],  // phonetic individual digits
  ['one six zero',               '160'],
  // QNH (always individual phonetic digits)
  ['one zero one three',         '1013'],
  ['one zero zero eight',        '1008'],
  // Headings (always individual phonetic)
  ['zero six zero',              '060'],
  ['one three zero',             '130'],
  ['two eight zero',             '280'],
  // Frequencies
  ['one one eight decimal one',  '118 decimal 1'],
  ['one two eight decimal seven','128 decimal 7'],
]
for (const [input, expected] of normCases) {
  const got = normalizeSpelledNumbers(input)
  assert(got === expected,
    `normalize("${input}") → "${got}" (expected "${expected}")`)
}

// ── 2. detectInstructionType ───────────────────────────────────────────────────
console.log(H('detectInstructionType'))
const instCases = [
  // Altitude
  ['Philippine one eighty niner, Manila Approach, radar contact, descend to five thousand feet, QNH one zero one three.', 'altitude'],
  ['descend and maintain flight level two four zero', 'altitude'],
  ['climb and maintain seven thousand',               'altitude'],
  ['maintain five thousand until MABIX',              'altitude'],
  // Heading
  ['turn left heading zero six zero',                 'heading'],
  ['turn right heading one three zero, reduce speed to two hundred and ten knots', 'heading'],
  ['fly heading two seven zero',                      'heading'],
  // Speed
  ['reduce speed to two hundred and ten knots',       'speed'],
  ['maintain one six zero knots until four-mile final','speed'],
  // Frequency
  ['contact Manila Tower one one eight decimal one',  'frequency'],
  ['contact Manila Control one three two decimal four','frequency'],
  ['contact control one two eight decimal seven',     'frequency'],
  // QNH standalone
  ['QNH one zero one three',                          'altimeter'],
  // Approach
  ['cleared ILS approach runway zero six',            'approach'],
  ['cleared ILS runway zero six approach',            'approach'],
  ['cleared RNAV runway two four approach',           'approach'],
  // Other critical
  ['squawk four five six one',                        'squawk'],
  ['cleared to land runway zero six, wind calm',      'landing'],
  ['go around, climb straight ahead to three thousand','altitude'],
  ['hold over LARON, inbound track two two zero, right turns', 'hold'],
]
for (const [input, expected] of instCases) {
  const got = detectInstructionType(input)
  assert(got === expected,
    `detectType("${input.substring(0,60)}...") → "${got}" (expected "${expected}")`)
}

// ── 3. Value extraction ────────────────────────────────────────────────────────
console.log(H('value extraction'))
const altCases = [
  ['descend to five thousand feet',                   '5000'],
  ['climb and maintain seven thousand',               '7000'],
  ['descend and maintain flight level two four zero', '240'],
  ['maintain three thousand',                         '3000'],
  ['go around, climb straight ahead to three thousand','3000'],
  ['descend to three thousand five hundred',          '3500'],
]
for (const [atc, expected] of altCases) {
  const got = extractAltitude(atc)
  assert(got === expected,
    `extractAltitude("${atc}") → "${got}" (expected "${expected}")`)
}

const spdCases = [
  ['reduce speed to two hundred and ten knots',       '210'],
  ['reduce speed to one eight zero knots',            '180'],
  ['maintain one six zero knots until four-mile final','160'],
  ['speed two hundred knots',                        '200'],
  ['two hundred fifty knots',                        '250'],
]
for (const [text, expected] of spdCases) {
  const got = extractSpeed(text)
  assert(got === expected,
    `extractSpeed("${text}") → "${got}" (expected "${expected}")`)
}

const hdgCases = [
  ['turn left heading zero six zero',                 '060'],
  ['turn right heading one three zero',               '130'],
  ['fly heading two seven zero',                      '270'],
  ['heading zero nine zero',                         '090'],
]
for (const [text, expected] of hdgCases) {
  const got = extractHeading(text)
  assert(got === expected,
    `extractHeading("${text}") → "${got}" (expected "${expected}")`)
}

const qnhCases = [
  ['QNH one zero one three',                          '1013'],
  ['altimeter one zero zero eight',                  '1008'],
  ['descend to five thousand, QNH one zero one three','1013'],
]
for (const [text, expected] of qnhCases) {
  const got = extractAltimeter(text)
  assert(got === expected,
    `extractAltimeter("${text}") → "${got}" (expected "${expected}")`)
}

// ── 4. Callsign detection ──────────────────────────────────────────────────────
console.log(H('callsign detection'))
const csEndCases = [
  // Readback with spoken callsign at end — strongest pilot indicator
  'Descending to five thousand, QNH one zero one three, Philippine one eighty niner.',
  'Left heading zero six zero, speed two hundred and ten knots, Philippine one eighty niner.',
  'Descending to three thousand feet, Philippine one eighty niner.',
  'Cleared ILS approach runway zero six, wilco, Philippine one eighty niner.',
  'Speed one eight zero knots, Philippine one eighty niner.',
  'One one eight decimal one, Philippine one eighty niner.',
  'Cleared to land runway zero six, Philippine one eighty niner.',
]
for (const text of csEndCases) {
  const matched = CALLSIGN_AT_END_RE.test(text) || CALLSIGN_SPOKEN_RE.test(text)
  assert(matched,
    `callsign detected at end of: "${text.substring(0,70)}"`)
}

// ── 5. Full exchange correctness simulation ────────────────────────────────────
console.log(H('exchange simulation (readback correctness)'))

function simulateReadback(atcInstruction, pilotReadback) {
  const type = detectInstructionType(atcInstruction)
  const atcN = normalizeSpelledNumbers(atcInstruction)
  const pilN = normalizeSpelledNumbers(pilotReadback)
  let quality = 'complete'
  const issues = []

  if (type === 'altitude') {
    const atcAlt = extractAltitude(atcN)
    const pilAlt = extractAltitude(pilN)
    const pilHasAlt = /\b(climb|descend|maintain|flight\s*level|\d{3,5}|thousand|hundred)\b/i.test(pilN)
    if (!pilHasAlt && !pilAlt) { quality = 'missing'; issues.push('missing altitude') }
    else if (atcAlt && pilAlt && atcAlt !== pilAlt) { quality = 'incorrect'; issues.push(`alt mismatch: ATC=${atcAlt} pilot=${pilAlt}`) }
    const atcQnh = extractAltimeter(atcN)
    if (atcQnh) {
      const pilQnh = extractAltimeter(pilN)
      if (!pilQnh) { quality = 'partial'; issues.push('missing QNH') }
      else if (pilQnh !== atcQnh) { quality = 'incorrect'; issues.push(`QNH mismatch: ATC=${atcQnh} pilot=${pilQnh}`) }
    }
  } else if (type === 'heading') {
    const atcHdg = extractHeading(atcN)
    const pilHdg = extractHeading(pilN)
    if (!pilHdg) { quality = 'partial'; issues.push('missing heading') }
    else if (atcHdg && pilHdg && atcHdg !== pilHdg) { quality = 'incorrect'; issues.push(`hdg mismatch: ATC=${atcHdg} pilot=${pilHdg}`) }
    const atcDir = /\b(left|right)\b/i.exec(atcN)
    const pilDir = /\b(left|right)\b/i.exec(pilN)
    if (atcDir && !pilDir) { quality = 'partial'; issues.push('missing direction') }
    else if (atcDir && pilDir && atcDir[1].toLowerCase() !== pilDir[1].toLowerCase()) { quality = 'incorrect'; issues.push(`direction mismatch`) }
  } else if (type === 'speed') {
    const atcSpd = extractSpeed(atcN)
    const pilSpd = extractSpeed(pilN)
    if (!pilSpd) { quality = 'partial'; issues.push('missing speed') }
    else if (atcSpd && pilSpd && atcSpd !== pilSpd) { quality = 'incorrect'; issues.push(`spd mismatch: ATC=${atcSpd} pilot=${pilSpd}`) }
  } else if (type === 'frequency') {
    const atcFreq = atcN.match(/(\d{3,4})\s*(?:decimal\s*\d+)?/)?.[1]
    const pilFreq = pilN.match(/(\d{3,4})\s*(?:decimal\s*\d+)?/)?.[1]
    if (!pilFreq) { quality = 'missing'; issues.push('missing frequency') }
    else if (atcFreq && pilFreq && atcFreq !== pilFreq) { quality = 'incorrect'; issues.push(`freq mismatch`) }
  }

  return { type, quality, issues }
}

const exchanges = [
  // Correct readbacks — should all score 'complete'
  {
    atc: 'Philippine one eighty niner, Manila Approach, radar contact, descend to five thousand feet, QNH one zero one three.',
    pilot: 'Descending to five thousand, QNH one zero one three, Philippine one eighty niner.',
    expectedType: 'altitude', expectedQuality: 'complete',
  },
  {
    atc: 'Philippine one eighty niner, turn left heading zero six zero, reduce speed to two hundred and ten knots.',
    pilot: 'Left heading zero six zero, speed two hundred and ten knots, Philippine one eighty niner.',
    expectedType: 'heading', expectedQuality: 'complete',
  },
  {
    atc: 'Philippine one eighty niner, descend to three thousand feet.',
    pilot: 'Descending to three thousand feet, Philippine one eighty niner.',
    expectedType: 'altitude', expectedQuality: 'complete',
  },
  {
    atc: 'Philippine one eighty niner, reduce speed to one eight zero knots.',
    pilot: 'Speed one eight zero knots, Philippine one eighty niner.',
    expectedType: 'speed', expectedQuality: 'complete',
  },
  {
    atc: 'Philippine one eighty niner, contact Manila Tower on one one eight decimal one.',
    pilot: 'One one eight decimal one, Philippine one eighty niner.',
    expectedType: 'frequency', expectedQuality: 'complete',
  },
  // ERROR cases — should score 'incorrect' or 'partial'
  {
    atc: 'Philippine one eighty niner, descend to five thousand feet.',
    pilot: 'Descending to seven thousand feet, Philippine one eighty niner.',
    expectedType: 'altitude', expectedQuality: 'incorrect',
  },
  {
    atc: 'Philippine one eighty niner, turn right heading one three zero.',
    pilot: 'Left heading one three zero, Philippine one eighty niner.',
    expectedType: 'heading', expectedQuality: 'incorrect',
  },
  {
    atc: 'Philippine one eighty niner, reduce speed to two hundred and ten knots.',
    pilot: 'Speed one eight zero knots, Philippine one eighty niner.',
    expectedType: 'speed', expectedQuality: 'incorrect',
  },
  {
    atc: 'Philippine one eighty niner, descend to five thousand feet, QNH one zero one three.',
    pilot: 'Descending to five thousand feet, Philippine one eighty niner.',  // missing QNH
    expectedType: 'altitude', expectedQuality: 'partial',
  },
]

for (const { atc, pilot, expectedType, expectedQuality } of exchanges) {
  const { type, quality, issues } = simulateReadback(atc, pilot)
  const typeOk    = type === expectedType
  const qualityOk = quality === expectedQuality
  const label = atc.substring(0, 65)
  assert(typeOk && qualityOk,
    `[${expectedType}/${expectedQuality}] "${label}"\n       got type="${type}" quality="${quality}"${issues.length ? ' issues='+issues.join(','): ''}`)
}

// ── Summary ────────────────────────────────────────────────────────────────────
console.log()
if (failed === 0) {
  console.log(`\x1b[32m\x1b[1mAll ${passed} tests passed.\x1b[0m`)
} else {
  console.log(`\x1b[31m\x1b[1m${failed} test(s) failed.\x1b[0m`)
}
process.exit(failed > 0 ? 1 : 0)
