/**
 * scripts/testParsing.mjs
 *
 * Tests the DOCX/PDF parsing pipeline against real APP-DEP PAEC files.
 * Run with: node scripts/testParsing.mjs
 *
 * Validates:
 *   1. Multi-exchange paragraphs are split into individual exchange lines
 *   2. PAEC metadata IDs are filtered (PAEC01_C001_0000Z, PAEC-COO1-0000Z)
 *   3. Anon tags are stripped and replaced with airline names
 *   4. Speaker labels are correctly classified (ATC / PILOT)
 *   5. "Philippine", > residue is removed
 */

import JSZip from 'jszip'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT  = join(__dir, '..')

// ── ANSI colours ─────────────────────────────────────────────────────────────
const C = { green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m', bold: '\x1b[1m' }
const ok   = msg => console.log(`${C.green}  ✓${C.reset} ${msg}`)
const fail = msg => { console.log(`${C.red}  ✗${C.reset} ${msg}`); failures++ }
const info = msg => console.log(`${C.cyan}  ·${C.reset} ${msg}`)

let failures = 0

// ── Replicate PARA_SPEAKER_SPLIT_RE (same as docxExtractor.ts) ───────────────
// Negative lookbehind on bare DEP prevents double-splitting "APP-DEP_PAEC1"
const PARA_SPEAKER_SPLIT_RE = /(?=(?:APP[-/]?DEP|APPDEP|(?<![A-Za-z/\-])DEP|TWR|GND|RAMP|PILOT)_PAEC\d)/i

// ── Replicate PAEC_ID_RE (same as pdfExtractor.ts) ───────────────────────────
// Only real metadata IDs: ends-in-Z forms or bare PAEC+digits
const PAEC_ID_RE = /^(?:PAEC[-_]?[A-Z0-9]+(?:[-_][A-Z0-9]+)*Z|PAEC\d+)$/i

// ── Replicate stripAnonTags (core logic from analysisEngine.ts) ───────────────
function stripAnonTags(text) {
  let r = text
  // Step 0: orphaned anon-attribute prefixes
  r = r.replace(/^type\s*=\s*["'][^"']*["']?[,]?\s*\/?>\s*/i, '')
  r = r.replace(/^["'][^"',]{0,40}["'][,]?\s*\/?>\s*/, '')
  r = r.replace(/^[A-Za-z][A-Za-z\s]{0,30}",\s*\/?>\s*/, '')   // Philippine", > etc.
  r = r.replace(/^>\s+/, '')
  // Steps 1-2: replace <anon type="X"/> with X
  r = r.replace(/<<+/g, '<').replace(/<\s+/g, '<')
  r = r.replace(/<?anon\s+type\s*=\s*["']?\s*([A-Za-z][A-Za-z ]*?)["']?\s*(?:\/?>|\/)/gi,
    (_m, val) => val.trim().toUpperCase().replace(/\s+/g, '') + ' ')
  // Step 2.5: strip remaining malformed anon tags
  r = r.replace(/<?anon\b[^>\n]*>?/gi, '')
  // Step 2.7: strip mid-line broken anon tag residue ("Cebu", > or "Delta", >)
  r = r.replace(/[""']([A-Za-z][A-Za-z ]{0,20})[""'][,]?\s*\/?>\s*/g,
    (_m, name) => name.trim().toUpperCase().replace(/\s+/g, '') + ' ')
  // Step 3: strip remaining XML tags
  r = r.replace(/<[^>]+>/g, '')
  // Step 4: normalise / separators
  r = r.replace(/\s*\/\s*/g, ', ')
  // Step 5: collapse artefacts
  r = r.replace(/,\s*,/g, ',').replace(/^[,\s]+|[,\s]+$/g, '').replace(/\s{2,}/g, ' ')
  return r.trim()
}

// ── Replicate classifyLabel (from analysisEngine.ts) ─────────────────────────
const ATC_KEYWORDS    = new Set(['ATC','ATCO','APP','APPDEP','APPROACH','DEPARTURE','DEP','TWR','TOWER','GND','GROUND','CTR','CENTER','CENTRE','RADAR','CONTROL','RAMP','CLEARANCE','DELIVERY','CLR','ATIS'])
const PILOT_KEYWORDS  = new Set(['PILOT','PLT','CREW','FO','CAPT','CAPTAIN','FIRST','OFFICER','PF','PM','PNF'])

function classifyLabel(label) {
  const parts = label.toUpperCase().split(/[\s_\-./]+/)
  for (const p of parts) if (ATC_KEYWORDS.has(p)) return 'ATC'
  for (const p of parts) if (PILOT_KEYWORDS.has(p)) return 'PILOT'
  return 'UNKNOWN'
}

// ── Replicate filterNonDialogueLines (from pdfExtractor.ts) ──────────────────
const METADATA_FILE_RE = /\.(mp3|wav|m4a|aac|ogg|pdf|docx|xlsx|txt|csv)$/i
const RPLL_FILE_RE     = /^RPLL[-_]/i

function filterNonDialogueLines(lines) {
  return lines.filter(line => {
    const t = line.trim()
    if (!t) return false
    if (METADATA_FILE_RE.test(t))          return false
    if (PAEC_ID_RE.test(t.split(/\s/)[0])) return false
    if (RPLL_FILE_RE.test(t))              return false
    return true
  })
}

// ── Node.js DOCX paragraph extractor (approximates DOMParser logic) ───────────
async function extractParagraphs(docxPath) {
  const buf = readFileSync(docxPath)
  const zip = await JSZip.loadAsync(buf)
  const xml = await zip.file('word/document.xml').async('string')

  // Regex extraction approximates DOMParser; decodes XML entities in text
  const paraMatches = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []
  const rawLines = []

  for (const para of paraMatches) {
    const tMatches = para.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []
    const text = tMatches
      .map(t => t.replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'").replace(/&amp;/g, '&'))
      .join('')
    const trimmed = text.trim()
    if (!trimmed) continue
    // Apply PARA_SPEAKER_SPLIT_RE (same as parseDocumentXml fix)
    const subLines = trimmed.split(PARA_SPEAKER_SPLIT_RE)
    subLines.forEach(sub => { if (sub.trim()) rawLines.push(sub.trim()) })
  }

  return rawLines
}

// ── Full pipeline: extract → filter → label → strip ─────────────────────────
// PAEC2 sometimes omits the colon: "App/Dep_Paec2_C001_Phi_Mnl <Anon .../> dialogue"
// Also occasionally has a spurious space: "App/Dep_Paec2_ C002_Phi_Mnl ..."
const PAEC_NO_COLON_RE = /^((?:APP[-/]?DEP|APPDEP|DEP|TWR|GND|RAMP|PILOT)_PAEC\d+[_\s][^\s<&:]+)\s+(.+)$/i
// Prefix-only check for lines where the label extension has spaces (can't parse label end precisely)
const PAEC_ATC_PREFIX_RE  = /^(?:APP[-/]?DEP|APPDEP|(?<![A-Za-z/-])DEP|TWR|GND|RAMP)_PAEC\d+/i
const PAEC_PILOT_PREFIX_RE = /^PILOT_PAEC\d+/i

function processLines(rawLines) {
  const labelRE = /^([^"":]+):\s*(.*)$/
  const filtered = filterNonDialogueLines(rawLines)
  return filtered.map(line => {
    const m = line.match(labelRE)
    let label, dialogue, speaker
    if (m && m[1].trim()) {
      label    = m[1].trim()
      dialogue = m[2].trim()
      speaker  = classifyLabel(label)
    } else {
      // Fallback 1: PAEC label without colon, clean label boundary
      const m2 = line.match(PAEC_NO_COLON_RE)
      if (m2) {
        label    = m2[1].trim()
        dialogue = m2[2].trim()
        speaker  = classifyLabel(label)
      } else {
        // Fallback 2: prefix-only for labels with spaces ("App/Dep_Paec2_ C002_Phi_Mnl ...")
        label    = ''
        dialogue = line
        speaker  = PAEC_ATC_PREFIX_RE.test(line) ? 'ATC'
                 : PAEC_PILOT_PREFIX_RE.test(line) ? 'PILOT'
                 : 'UNKNOWN'
      }
    }
    const text = stripAnonTags(dialogue)
    return { speaker, label, text, raw: line }
  }).filter(e => e.text.length >= 2)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function testFile(filename, checks) {
  const path = join(ROOT, 'APP-DEP', filename)
  console.log(`\n${C.bold}${C.cyan}══ ${filename} ══${C.reset}`)
  try {
    const rawLines = await extractParagraphs(path)
    const lines    = processLines(rawLines)

    checks(rawLines, lines)

    info(`Total raw paragraphs after split: ${rawLines.length}`)
    info(`Total dialogue lines after filter+strip: ${lines.length}`)
    info(`ATC: ${lines.filter(l => l.speaker === 'ATC').length}  PILOT: ${lines.filter(l => l.speaker === 'PILOT').length}  UNKNOWN: ${lines.filter(l => l.speaker === 'UNKNOWN').length}`)
    console.log(`\n  ${C.cyan}Sample (first 12 lines):${C.reset}`)
    lines.slice(0, 12).forEach((l, i) => {
      const spColor = l.speaker === 'ATC' ? C.yellow : l.speaker === 'PILOT' ? C.green : C.reset
      console.log(`  ${String(i+1).padStart(2)}  ${spColor}${l.speaker.padEnd(7)}${C.reset}  ${l.text.substring(0, 90)}`)
    })
  } catch (e) {
    fail(`Could not process ${filename}: ${e.message}`)
  }
}

// ── Test: APP_DEP 1.docx ─────────────────────────────────────────────────────
await testFile('APP_DEP 1.docx', (rawLines, lines) => {
  // 1. No multi-exchange mega-lines should remain
  const megaLines = rawLines.filter(l => {
    const m = l.match(/(?:APP[-/]?DEP|APPDEP|DEP|TWR|GND|RAMP|PILOT)_PAEC\d/gi)
    return m && m.length > 1
  })
  if (megaLines.length === 0)
    ok('No multi-exchange paragraphs remaining after split')
  else
    fail(`${megaLines.length} multi-exchange paragraphs still present`)

  // 2. PAEC metadata IDs filtered
  const paecIds = rawLines.filter(l => PAEC_ID_RE.test(l.split(/\s/)[0]))
  const paecInLines = lines.filter(l => /^PAEC[-_]/i.test(l.text))
  if (paecInLines.length === 0)
    ok(`PAEC metadata IDs filtered (${paecIds.length} raw IDs removed)`)
  else
    fail(`${paecInLines.length} PAEC IDs leaked into dialogue lines`)

  // 3. No anon-tag residue (Philippine", > or "Cebu", > mid-line)
  const residue = lines.filter(l => /[""]?[A-Za-z]+[""]?,\s*\/?>/i.test(l.text))
  if (residue.length === 0)
    ok('No anon-tag residue ("Philippine", > or "Cebu", > etc.) in output')
  else
    fail(`${residue.length} lines still contain anon-tag residue: ${residue.map(l=>l.text.substring(0,60)).join(' | ')}`)

  // 4. COOLRED is correctly attributed as a PILOT or ATC callsign (not swallowed)
  const coolredLines = lines.filter(l => /COOLRED/i.test(l.text))
  if (coolredLines.length >= 2)
    ok(`COOLRED callsign appears in ${coolredLines.length} lines (callsign recognised)`)
  else
    fail(`COOLRED only appeared in ${coolredLines.length} lines — possible parse failure`)

  // 5. Speaker classification sanity: at least 70% of lines are ATC or PILOT
  const classified = lines.filter(l => l.speaker !== 'UNKNOWN').length
  const ratio = classified / Math.max(lines.length, 1)
  if (ratio >= 0.7)
    ok(`Speaker classification: ${(ratio*100).toFixed(0)}% classified (ATC or PILOT)`)
  else
    fail(`Low speaker classification rate: ${(ratio*100).toFixed(0)}% — label patterns may be missing`)
})

// ── Test: APP_DEP 2.docx (different label format: App/Dep_Paec2_, / separators) ─
await testFile('APP_DEP 2.docx', (rawLines, lines) => {
  const megaLines = rawLines.filter(l => {
    const m = l.match(/(?:APP[-/]?DEP|APPDEP|DEP|TWR|GND|RAMP|PILOT)_PAEC\d/gi)
    return m && m.length > 1
  })
  if (megaLines.length === 0)
    ok('No multi-exchange paragraphs remaining after split')
  else
    fail(`${megaLines.length} multi-exchange paragraphs still present`)

  const classified = lines.filter(l => l.speaker !== 'UNKNOWN').length
  const ratio = classified / Math.max(lines.length, 1)
  if (ratio >= 0.7)
    ok(`Speaker classification: ${(ratio*100).toFixed(0)}% classified`)
  else
    fail(`Low classification rate: ${(ratio*100).toFixed(0)}%`)

  // App/Dep_Paec2_ labels should be classified as ATC
  const appDepLines = lines.filter(l => /App\/Dep_Paec2_/i.test(l.raw))
  const allATC = appDepLines.every(l => l.speaker === 'ATC')
  if (appDepLines.length > 0 && allATC)
    ok(`App/Dep_Paec2_ labels correctly classified as ATC (${appDepLines.length} lines)`)
  else if (appDepLines.length === 0)
    fail('No App/Dep_Paec2_ labels found — split may have failed')
  else
    fail('Some App/Dep_Paec2_ labels misclassified')

  // / separators should become , in stripped text (Step 4 of stripAnonTags)
  const slashInText = lines.filter(l => / \/ /.test(l.text))
  if (slashInText.length === 0)
    ok('PAEC2 "/" utterance separators normalised to ","')
  else
    fail(`${slashInText.length} lines still contain "/" separators`)
})

// ── Test: APP_DEP 3.docx ─────────────────────────────────────────────────────
await testFile('APP_DEP 3.docx', (rawLines, lines) => {
  const megaLines = rawLines.filter(l => {
    const m = l.match(/(?:APP[-/]?DEP|APPDEP|DEP|TWR|GND|RAMP|PILOT)_PAEC\d/gi)
    return m && m.length > 1
  })
  if (megaLines.length === 0)
    ok('No multi-exchange paragraphs remaining after split')
  else
    fail(`${megaLines.length} multi-exchange paragraphs still present (expected 0)`)

  const classified = lines.filter(l => l.speaker !== 'UNKNOWN').length
  const ratio = classified / Math.max(lines.length, 1)
  if (ratio >= 0.7)
    ok(`Speaker classification: ${(ratio*100).toFixed(0)}% classified`)
  else
    fail(`Low classification rate: ${(ratio*100).toFixed(0)}%`)
})

// ── Test: PAEC_ID_RE covers all metadata formats ─────────────────────────────
console.log(`\n${C.bold}${C.cyan}══ PAEC_ID_RE filter test ══${C.reset}`)
const metadataSamples = [
  ['PAEC-COO1-0000Z', true],
  ['PAEC-CO09-0400Z', true],
  ['PAEC01_C001_0000Z', true],
  ['PAEC02_C001_0000Z', true],
  ['PAEC06', true],
  ['PAEC03_C007_Phi_MNL', false],   // label prefix ending in location codes, not a timestamp → kept
]
for (const [sample, shouldFilter] of metadataSamples) {
  const firstWord = sample.split(/\s/)[0]
  const matches = PAEC_ID_RE.test(firstWord)
  if (matches === shouldFilter)
    ok(`${shouldFilter ? 'filters' : 'keeps  '} "${sample}"`)
  else
    fail(`Expected to ${shouldFilter ? 'filter' : 'keep'} "${sample}" but ${matches ? 'filtered' : 'kept'} it`)
}

// ── Test: stripAnonTags handles all known PAEC anon-tag variants ──────────────
console.log(`\n${C.bold}${C.cyan}══ stripAnonTags test ══${C.reset}`)
const anonCases = [
  ['<anon type="Philippine"/> four three eight', 'PHILIPPINE  four three eight'],
  ['<Anon Type = "Cool Red"/> Eight Four',         'COOLRED  Eight Four'],
  ['<anon type="Cathay"/>niner one two',           'CATHAY niner one two'],
  ['Philippine", > four three eight.',             'four three eight.'],
  ['Emirates", > three three seven.',              'three three seven.'],
  ['type="Philippine", /> four three eight.',      'four three eight.'],
  ['Climb level one five zero, <anon type="Emirates"/> three three seven', 'Climb level one five zero, EMIRATES  three three seven'],
  // Mid-line broken anon tag: PDF splits <anon type="Cebu"/> across y-positions
  // Both PDF and DOCX extractors normalise smart quotes → straight before stripAnonTags
  ['One two five decimal seven, "Cebu", > one zero eight five.', 'One two five decimal seven, CEBU one zero eight five.'],
  ['Roger, "Cebu", > eight one four.', 'Roger, CEBU eight one four.'],
]
for (const [input, expected] of anonCases) {
  const result = stripAnonTags(input)
  // Normalise spaces for comparison
  const norm = s => s.replace(/\s+/g, ' ').trim()
  if (norm(result) === norm(expected))
    ok(`strips: "${input.substring(0,50)}" → "${norm(result).substring(0,50)}"`)
  else
    fail(`input:    "${input}"\n     expected: "${norm(expected)}"\n     got:      "${norm(result)}"`)
}

// ── Final summary ─────────────────────────────────────────────────────────────
console.log('')
if (failures === 0) {
  console.log(`${C.bold}${C.green}All tests passed.${C.reset}`)
} else {
  console.log(`${C.bold}${C.red}${failures} test(s) failed.${C.reset}`)
  process.exit(1)
}
