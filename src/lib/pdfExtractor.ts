import {
  CALLSIGN_LABEL_RE,
  PH_REGISTRATION_RE,
  FACILITY_LABEL_RE,
  ATC_ROLE_LABEL_RE,
  PILOT_ROLE_LABEL_RE,
  CALLSIGN_IN_TEXT_RE,
  READBACK_REQUIREMENTS,
  SAFETY_CRITICAL_PATTERNS,
  ALTITUDE_FORMATS,
  HEADING_FORMAT,
} from './atcData'

// ── Shared output type ──────────────────────────────────────────────────────
// Single authoritative shape used by both extractTextFromPDF and extractTextFromDOCX.
// page.tsx and all callers should type against this interface.
export interface FileExtractionResult {
  success: boolean
  text: string
  rawText: string
  metadata: {
    pageCount: number
    extractedLines: number
    wordCount: number
    formatQuality: 'good' | 'fair' | 'poor'
    fileType: 'pdf' | 'docx'
  }
  errors: string[]
}

// ── PDF.js type stubs ───────────────────────────────────────────────────────
type PDFDocumentProxy = {
  numPages: number
  getPage: (pageNum: number) => Promise<PDFPageProxy>
}

type PDFPageProxy = {
  getTextContent: () => Promise<TextContent>
}

type TextContent = {
  items: TextItem[]
}

type PDFLib = {
  getDocument: (options: { data: ArrayBuffer }) => { promise: Promise<PDFDocumentProxy> }
  GlobalWorkerOptions: { workerSrc: string }
  version: string
}

interface TextItem {
  str: string
  transform: number[]
  width: number
  height: number
  dir: string
}

interface ExtractedLine {
  text: string
  y: number
  x: number
}

// ── Dynamic aviation keyword set ───────────────────────────────────────────
// Built once at module load from atcData constants so it stays in sync with
// the analysis engine's vocabulary — no hardcoded keyword lists here.
const AVIATION_KEYWORD_RES: RegExp[] = [
  // Instruction triggers from READBACK_REQUIREMENTS (altitude, heading, squawk, …)
  ...READBACK_REQUIREMENTS.map(r => r.instruction),
  // Safety-critical terms (runway, hold short, go around, cleared to land, …)
  ...SAFETY_CRITICAL_PATTERNS.map(p => p.pattern),
  // Altitude and heading format patterns
  ALTITUDE_FORMATS.flightLevel,
  ALTITUDE_FORMATS.feet,
  HEADING_FORMAT,
  // Core ICAO acknowledgment vocabulary
  /\b(roger|wilco|affirm|negative|standby)\b/i,
]

// ── Speaker detection helpers ───────────────────────────────────────────────
// Built dynamically from atcData constants — add new airlines/facilities there.

// PAEC corpus speaker-label prefixes (e.g. GND_PAEC12_C001_Phi_MNL, Pilot_PAEC12_...)
// These never appear in the role-label regexes because the role abbreviation is
// immediately followed by an underscore + corpus ID, not a colon or space.
const PAEC_ATC_LABEL_RE   = /^(?:APP[-/]?DEP|APPDEP|DEP|TWR|GND|RAMP)_PAEC\d/i
const PAEC_PILOT_LABEL_RE = /^PILOT_PAEC\d/i

function isATCLine(text: string): boolean {
  return ATC_ROLE_LABEL_RE.test(text) || FACILITY_LABEL_RE.test(text) || PAEC_ATC_LABEL_RE.test(text)
}

function isPilotLine(text: string): boolean {
  return (
    PILOT_ROLE_LABEL_RE.test(text) ||
    /^P[:\s]/i.test(text) ||
    CALLSIGN_LABEL_RE.test(text) ||
    /^[A-Z]{2,3}\d{2,4}[:\s]/i.test(text) ||
    PH_REGISTRATION_RE.test(text) ||
    PAEC_PILOT_LABEL_RE.test(text)
  )
}

function hasSpeakerLabel(text: string): boolean {
  return isATCLine(text) || isPilotLine(text)
}

function identifySpeaker(text: string): 'ATC' | 'PILOT' | 'UNKNOWN' {
  if (isATCLine(text)) return 'ATC'
  if (isPilotLine(text)) return 'PILOT'
  return 'UNKNOWN'
}

// ── PDF extraction ──────────────────────────────────────────────────────────

/**
 * Extract plain text from a PDF file in the browser.
 *
 * Uses pdf.js (dynamic import — only loaded when the user actually triggers
 * an upload). The worker URL is resolved from the installed pdfjs-dist package
 * version so it always matches the locally installed library.
 */
export async function extractTextFromPDF(file: File): Promise<FileExtractionResult> {
  const errors: string[] = []

  try {
    // Dynamic import — avoids SSR issues and keeps pdfjs out of the initial bundle
    const pdfjsLib = (await import('pdfjs-dist')) as unknown as PDFLib

    // Worker URL resolved dynamically from the installed package version.
    // Uses unpkg so the version always matches the local install (no CDN drift).
    // Extension is .mjs — required for pdfjs-dist v4+.
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    const allLines: ExtractedLine[] = []

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      allLines.push(...groupTextByLines(textContent.items as TextItem[]))
    }

    const { formattedText, rawText, quality } = reconstructText(allLines)

    // If no text was extracted at all, the PDF is likely a scanned image with no
    // text layer. Return a descriptive error rather than silently returning success
    // with an empty string, which would cause analysis to fail with no explanation.
    if (!formattedText.trim()) {
      return {
        success: false,
        text: '',
        rawText: '',
        metadata: { pageCount: pdf.numPages, extractedLines: 0, wordCount: 0, formatQuality: 'poor', fileType: 'pdf' },
        errors: [
          pdf.numPages > 0
            ? 'No text could be extracted — the PDF may be a scanned image without a text layer. Please use a text-based PDF or paste the transcript manually.'
            : 'PDF appears to be empty.',
        ],
      }
    }

    const lines = formattedText.split('\n').filter(l => l.trim().length > 0)
    const wordCount = rawText.split(/\s+/).filter(Boolean).length

    return {
      success: true,
      text: formattedText,
      rawText,
      metadata: {
        pageCount: pdf.numPages,
        extractedLines: lines.length,
        wordCount,
        formatQuality: quality,
        fileType: 'pdf',
      },
      errors,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error during PDF extraction'
    return {
      success: false,
      text: '',
      rawText: '',
      metadata: { pageCount: 0, extractedLines: 0, wordCount: 0, formatQuality: 'poor', fileType: 'pdf' },
      errors: [msg],
    }
  }
}

// ── PDF.js text layout helpers ──────────────────────────────────────────────

// Horizontal gap (in PDF user units) below which two consecutive text items
// are treated as parts of the same word (no space inserted between them).
// PDF fonts typically leave 2–8 units between words; intra-word fragments
// produced by font subsetting or ligature splitting are ≤ 1 unit apart.
const X_GAP_THRESHOLD = 1.5

/**
 * Join a group of same-line text segments into a single string.
 * Inserts a space between segments only when the horizontal gap between
 * them is ≥ X_GAP_THRESHOLD, preventing artefacts like "t wo" → "two".
 */
function joinSegments(segments: { str: string; startX: number; endX: number }[]): string {
  return segments.reduce((acc, seg, i) => {
    if (i === 0) return seg.str
    const gap = seg.startX - segments[i - 1].endX
    return acc + (gap < X_GAP_THRESHOLD ? '' : ' ') + seg.str
  }, '').trim()
}

/**
 * Group scattered PDF text items into logical lines by y-position.
 * Uses per-segment x-tracking so adjacent word-fragments are joined
 * without a space (fixes "t wo" → "two" artefacts).
 */
function groupTextByLines(items: TextItem[]): ExtractedLine[] {
  if (items.length === 0) return []

  // Y_THRESHOLD is declared first so the sort callback and the grouping loop
  // both reference the same constant (avoids the temporal dead zone issue of
  // declaring it after the sort call, which forced a separate hardcoded value).
  const Y_THRESHOLD = 8

  // PDF coordinates increase bottom→top; sort descending so first line = top of page.
  // Items within Y_THRESHOLD vertical distance are on the same visual line → sort
  // them left-to-right (by x). Items further apart → sort top-to-bottom (by y).
  const sorted = [...items].sort((a, b) => {
    const dy = b.transform[5] - a.transform[5]
    return Math.abs(dy) < Y_THRESHOLD ? a.transform[4] - b.transform[4] : dy
  })

  const lines: ExtractedLine[] = []
  let cur: { segments: { str: string; startX: number; endX: number }[]; y: number; x: number } | null = null

  for (const item of sorted) {
    if (!item.str.trim()) continue
    const y = item.transform[5]
    const x = item.transform[4]
    const endX = x + (item.width ?? 0)

    if (cur === null) {
      cur = { segments: [{ str: item.str, startX: x, endX }], y, x }
    } else if (Math.abs(y - cur.y) < Y_THRESHOLD) {
      cur.segments.push({ str: item.str, startX: x, endX })
    } else {
      lines.push({ text: joinSegments(cur.segments), y: cur.y, x: cur.x })
      cur = { segments: [{ str: item.str, startX: x, endX }], y, x }
    }
  }
  if (cur) lines.push({ text: joinSegments(cur.segments), y: cur.y, x: cur.x })

  return lines
}

// ── Non-dialogue line filter ────────────────────────────────────────────────
// Shared constants used by both PDF and DOCX extraction paths.
// Keep them here as the single source of truth.

const METADATA_FILE_RE = /\.(mp3|wav|m4a|aac|ogg|pdf|docx|xlsx|txt|csv)$/i
// Matches PAEC metadata-only ID formats (not speaker label prefixes).
// Real metadata IDs are either:
//   • ending in a 4-digit timestamp + Z  (PAEC-COO1-0000Z, PAEC01_C001_0000Z)
//   • bare PAEC + digits only            (PAEC06, PAEC01)
// Speaker-label prefixes like PAEC03_C007_Phi_MNL end in alphabetic location
// codes and must NOT be filtered here — they carry dialogue text after ":".
export const PAEC_ID_RE = /^(?:PAEC[-_]?[A-Z0-9]+(?:[-_][A-Z0-9]+)*Z|PAEC\d+)$/i
const RPLL_FILE_RE     = /^RPLL[-_]/i

/**
 * Remove lines that are clearly non-dialogue metadata:
 *   • audio/document filenames  (e.g. RPLL-App-Dep-124800-Feb-1-2025-0030Z.mp3)
 *   • PAEC corpus identifiers   (e.g. PAEC-COO1-0000Z, PAEC01_C001_0000Z)
 *
 * Accepts any array of plain-text lines (already normalised/trimmed by the
 * caller) and returns only the lines that look like real dialogue content.
 * Works for both PDF and DOCX extraction pipelines.
 */
export function filterNonDialogueLines(lines: string[]): string[] {
  return lines.filter(line => {
    const t = line.trim()
    if (!t) return false
    if (METADATA_FILE_RE.test(t))          return false   // filename with extension
    if (PAEC_ID_RE.test(t.split(/\s/)[0])) return false   // PAEC corpus ID prefix
    if (RPLL_FILE_RE.test(t))              return false   // RPLL recording prefix
    return true
  })
}

/**
 * Normalize text to fix common PDF extraction artefacts.
 */
function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[—–]/g, '-')
    .replace(/\u00A0/g, ' ')              // non-breaking space → regular space (Word-generated PDFs)
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width chars and BOM
    .replace(/\s*:\s*/g, ': ')
    .trim()
}

/**
 * Reconstruct readable dialogue text and assess format quality.
 */
function reconstructText(lines: ExtractedLine[]): {
  formattedText: string
  rawText: string
  quality: 'good' | 'fair' | 'poor'
} {
  if (lines.length === 0) return { formattedText: '', rawText: '', quality: 'poor' }

  const processed: string[] = []
  let speakerLabels = 0

  // Normalise all lines, capture rawText before the metadata filter, then apply
  // the shared non-dialogue filter to get clean dialogue-only lines.
  const normalized = lines.map(l => normalizeText(l.text)).filter(Boolean)
  const rawText    = normalized.join('\n')
  const dialogue   = filterNonDialogueLines(normalized)

  for (const text of dialogue) {
    if (hasSpeakerLabel(text)) speakerLabels++
    processed.push(text)
  }

  const ratio = processed.length > 0 ? speakerLabels / processed.length : 0
  const quality: 'good' | 'fair' | 'poor' =
    ratio > 0.4 ? 'good' : ratio > 0.2 ? 'fair' : 'poor'

  return {
    formattedText: processed.join('\n'),
    rawText,
    quality,
  }
}

// ── Dialogue structure parser (internal — not exported) ─────────────────────

interface DialogueEntry {
  speaker: 'ATC' | 'PILOT' | 'UNKNOWN'
  message: string
  lineNumber: number
}

function parseDialogues(text: string): DialogueEntry[] {
  const dialogues: DialogueEntry[] = []
  const lines = text.split('\n').filter(l => l.trim())
  let currentSpeaker: DialogueEntry['speaker'] = 'UNKNOWN'
  let currentMessage = ''
  let lineNumber = 0

  for (const line of lines) {
    lineNumber++
    const speaker = identifySpeaker(line)

    if (speaker !== 'UNKNOWN') {
      if (currentMessage) {
        dialogues.push({ speaker: currentSpeaker, message: currentMessage.trim(), lineNumber: lineNumber - 1 })
      }
      currentSpeaker = speaker
      currentMessage = line
        .replace(/^(ATC|PILOT|TOWER|GROUND|APPROACH|DEPARTURE|CONTROL|RADAR|CENTER|P)[:\s]*/i, '')
        .replace(FACILITY_LABEL_RE, '')
        .replace(CALLSIGN_LABEL_RE, '')
        .replace(/^[A-Z]{2,3}\d{2,4}[:\s]*/i, '')
        .trim()
    } else {
      currentMessage = currentMessage ? currentMessage + ' ' + line : line
      if (!currentMessage) currentSpeaker = 'UNKNOWN'
    }
  }
  if (currentMessage) {
    dialogues.push({ speaker: currentSpeaker, message: currentMessage.trim(), lineNumber })
  }
  return dialogues
}

// ── Public validation helper ────────────────────────────────────────────────

/**
 * Validate whether extracted text looks like an ATC dialogue.
 *
 * Scoring (0–100, continuous — not coarse step jumps):
 *   • Speaker label ratio   0–40 pts  proportional to how labelled the file is
 *   • Dialogue balance      0–10 pts  penalises files with only ATC or only pilot turns
 *   • Aviation vocabulary   0–35 pts  unique keyword-pattern matches from atcData
 *   • Philippine callsigns  0–15 pts  presence of PAL/CEB/RP-registration marks
 *
 * isValid requires BOTH structural labels AND aviation vocabulary — a file with
 * speaker labels but no aviation terms (or vice-versa) is treated as invalid.
 */
export function validateATCDialogue(text: string): {
  isValid: boolean
  confidence: number
  issues: string[]
} {
  const issues: string[] = []

  const lines = text.split('\n').filter(l => l.trim())

  if (lines.length === 0) {
    return { isValid: false, confidence: 0, issues: ['No text content found'] }
  }

  // ── Speaker label ratio (0–40 pts, continuous) ───────────────────────────
  const atcLines   = lines.filter(l => isATCLine(l)).length
  const pilotLines = lines.filter(l => isPilotLine(l)).length
  const labelledLines = atcLines + pilotLines
  const speakerRatio  = labelledLines / lines.length

  // Proportional: 0% → 0 pts, ≥50% labelled → full 40 pts.
  // Most valid PAEC transcripts sit in the 50–80% range.
  const speakerScore = Math.round(Math.min(speakerRatio / 0.5, 1) * 40)

  if (speakerRatio < 0.15) {
    issues.push('Most lines are missing speaker labels (ATC/Pilot)')
  } else if (speakerRatio < 0.35) {
    issues.push('Some lines are missing speaker labels')
  }

  // ── Dialogue balance (0–10 pts) ──────────────────────────────────────────
  // A valid transcript needs BOTH ATC and pilot turns.
  // Score = ratio of the smaller count to the larger count.
  const balanceScore = atcLines > 0 && pilotLines > 0
    ? Math.round((Math.min(atcLines, pilotLines) / Math.max(atcLines, pilotLines)) * 10)
    : 0

  if (atcLines === 0) {
    issues.push('No ATC speaker turns detected')
  } else if (pilotLines === 0) {
    issues.push('No pilot speaker turns detected')
  }

  // ── Aviation keyword density (0–35 pts, continuous) ──────────────────────
  // Count how many distinct keyword patterns from atcData match the document.
  // ≥8 unique pattern matches → full 35 pts.
  const keywordsFound = AVIATION_KEYWORD_RES.filter(kw => kw.test(text)).length
  const keywordScore  = Math.round(Math.min(keywordsFound / 8, 1) * 35)

  if (keywordsFound === 0) {
    issues.push('No aviation-specific terms detected')
  } else if (keywordsFound < 3) {
    issues.push('Few aviation-specific terms detected')
  }

  // ── Philippine callsign presence (0–15 pts) ──────────────────────────────
  const hasCallsign = CALLSIGN_IN_TEXT_RE.test(text) || PH_REGISTRATION_RE.test(text)
  const callsignScore = hasCallsign ? 15 : 0

  if (!hasCallsign) {
    issues.push('No Philippine callsigns detected (PAL, CEB, etc.)')
  }

  const confidence = Math.min(speakerScore + balanceScore + keywordScore + callsignScore, 100)

  // Valid = has meaningful speaker structure AND aviation content.
  // Neither alone is sufficient — prevents false positives on generic documents.
  const isValid = speakerRatio >= 0.15 && keywordsFound >= 2

  return { isValid, confidence, issues }
}

// Re-export parseDialogues so tests/callers can use it if needed
export { parseDialogues }
