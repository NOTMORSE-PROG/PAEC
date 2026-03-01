/**
 * Browser-native DOCX text extraction.
 *
 * A DOCX file is a ZIP archive containing an XML file at word/document.xml.
 * This module uses JSZip to unpack the archive and a lightweight XML parser
 * to pull out the text nodes, returning the same FileExtractionResult shape as
 * pdfExtractor.ts so the rest of the app is format-agnostic.
 *
 * No server round-trip required — runs entirely in the browser.
 */

import { validateATCDialogue, filterNonDialogueLines, type FileExtractionResult } from './pdfExtractor'
import {
  ATC_ROLE_LABEL_RE,
  FACILITY_LABEL_RE,
  CALLSIGN_LABEL_RE,
  PILOT_ROLE_LABEL_RE,
  PH_REGISTRATION_RE,
} from './atcData'

// FileExtractionResult is the single shared output type defined in pdfExtractor.ts.
// Re-exported here so callers can import from either extractor.
export type { FileExtractionResult }

// ── DOCX XML helpers ──────────────────────────────────────────────────────────

// PAEC DOCX files often place multiple ATC-pilot exchanges inside a single
// <w:p> element, concatenating them with inline speaker labels, e.g.:
//   "APP-DEP_PAEC1_C001_Phi_MNL:textA.Pilot_PAEC1_C001_Phi_MNL:textB."
// Split on any PAEC speaker-label boundary so each exchange gets its own line.
// The `_PAEC\d` anchor prevents accidental splits on mid-sentence words
// like "DEP" in "DEP clearance" or "TWR" in "TWR frequency".
// Covers all label variants found across the PAEC corpus (files 01–31+):
//   APP-DEP_  App/Dep_  APPDEP_  DEP_  Pilot_  PILOT_  TWR_  GND_  RAMP_
// Negative lookbehind on bare `DEP` prevents double-splitting "APP-DEP_PAEC1"
// at both position 0 (on APP-DEP) and position 4 (on DEP), which leaves orphaned
// "APP-" / "App/" fragments that can't be speaker-classified.
const PARA_SPEAKER_SPLIT_RE = /(?=(?:APP[-/]?DEP|APPDEP|(?<![A-Za-z/\-])DEP|TWR|GND|RAMP|PILOT)_PAEC\d)/i

/**
 * Extract all text from word/document.xml using a DOMParser.
 * Handles <w:t>, <w:br> (line break → newline), and <w:p> (paragraph → newline).
 * Splits paragraphs that contain multiple inline PAEC speaker labels so that
 * each ATC-pilot exchange becomes its own line.
 */
function parseDocumentXml(xml: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')

  // DOMParser does not throw on malformed XML — it returns a document whose root
  // is <parsererror>. Detect this early and surface a useful error to the caller.
  if (doc.documentElement.nodeName === 'parsererror') {
    throw new Error('word/document.xml is malformed XML — the DOCX file may be corrupt.')
  }

  const NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  const paragraphs = doc.getElementsByTagNameNS(NS, 'p')
  const lines: string[] = []

  for (const para of Array.from(paragraphs)) {
    const runs = para.getElementsByTagNameNS(NS, 'r')
    let line = ''
    for (const run of Array.from(runs)) {
      const tNodes = run.getElementsByTagNameNS(NS, 't')
      for (const t of Array.from(tNodes)) {
        line += t.textContent ?? ''
      }
      // <w:br> inside run → treat as space
      const brNodes = run.getElementsByTagNameNS(NS, 'br')
      if (brNodes.length > 0) line += ' '
    }
    const trimmedLine = line.trim()
    if (!trimmedLine) continue
    // Split multi-exchange paragraphs into individual exchange lines
    const subLines = trimmedLine.split(PARA_SPEAKER_SPLIT_RE)
    subLines.forEach(sub => { if (sub.trim()) lines.push(sub.trim()) })
  }

  // ── Table cell extraction ──────────────────────────────────────────────────
  // getElementsByTagNameNS('p') on the document root can miss paragraphs inside
  // table cells (<w:tbl>→<w:tr>→<w:tc>→<w:p>) in some browser DOMParser
  // implementations. Explicitly walk table cells so table-formatted transcripts
  // (two-column ATC/Pilot layout) are not silently dropped.
  const tables = doc.getElementsByTagNameNS(NS, 'tbl')
  for (const table of Array.from(tables)) {
    const cells = table.getElementsByTagNameNS(NS, 'tc')
    for (const cell of Array.from(cells)) {
      const cellParas = cell.getElementsByTagNameNS(NS, 'p')
      for (const para of Array.from(cellParas)) {
        const runs = para.getElementsByTagNameNS(NS, 'r')
        let cellLine = ''
        for (const run of Array.from(runs)) {
          const tNodes = run.getElementsByTagNameNS(NS, 't')
          for (const t of Array.from(tNodes)) cellLine += t.textContent ?? ''
          if (run.getElementsByTagNameNS(NS, 'br').length > 0) cellLine += ' '
        }
        const trimmedCell = cellLine.trim()
        if (!trimmedCell) continue
        trimmedCell.split(PARA_SPEAKER_SPLIT_RE).forEach(sub => {
          if (sub.trim()) lines.push(sub.trim())
        })
      }
    }
  }

  return lines.join('\n')
}

/**
 * Normalise common Unicode artefacts produced by Word.
 */
function normaliseDocxText(text: string): string {
  return text
    .replace(/\u2018|\u2019/g, "'")            // smart single quotes
    .replace(/\u201C|\u201D/g, '"')            // smart double quotes
    .replace(/\u2013/g, '-')                   // en-dash → hyphen
    .replace(/\u2014/g, '-')                   // em-dash → single hyphen (consistent with PDF + engine)
    .replace(/\u00A0/g, ' ')                   // non-breaking space → regular space
    .replace(/[\u200B-\u200D\uFEFF]/g, '')     // zero-width chars (ZWSP, ZWNJ, ZWJ) and BOM
    .replace(/\r\n?/g, '\n')                   // CRLF / CR → LF
    .replace(/\n{3,}/g, '\n\n')               // collapse excessive blank lines
    .trim()
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Extract plain text from a .docx file in the browser.
 *
 * @param file  A File object whose name ends with ".docx"
 * @returns     FileExtractionResult (same shape as PDF extraction)
 */
export async function extractTextFromDOCX(file: File): Promise<FileExtractionResult> {
  const errors: string[] = []

  try {
    // Dynamic import keeps jszip out of the initial bundle
    const JSZip = (await import('jszip')).default

    const arrayBuffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)

    // word/document.xml is mandatory in every valid DOCX
    const docXmlFile = zip.file('word/document.xml')
    if (!docXmlFile) {
      return {
        success: false,
        text: '',
        rawText: '',
        metadata: { pageCount: 0, extractedLines: 0, wordCount: 0, formatQuality: 'poor', fileType: 'docx' },
        errors: ['word/document.xml not found — file may be corrupt or not a valid DOCX'],
      }
    }

    const xmlContent = await docXmlFile.async('string')
    const rawText = parseDocumentXml(xmlContent)
    const normalised = normaliseDocxText(rawText)

    // Remove metadata/filename lines (audio files, PAEC IDs, RPLL prefixes)
    // using the same shared filter as the PDF pipeline.
    const lines = filterNonDialogueLines(
      normalised.split('\n').filter(l => l.trim().length > 0)
    )

    // Reassemble clean text from the filtered lines
    const text = lines.join('\n')
    const wordCount = text.split(/\s+/).filter(Boolean).length

    // Approximate "pages" as every ~50 non-blank lines (Word default ~50 lines/page)
    const approxPages = Math.max(1, Math.ceil(lines.length / 50))

    // Quality heuristic: how many lines look like speaker labels.
    // Uses the same dynamic regexes as pdfExtractor — no hardcoded role list.
    const speakerLines = lines.filter(l =>
      ATC_ROLE_LABEL_RE.test(l) || FACILITY_LABEL_RE.test(l) ||
      CALLSIGN_LABEL_RE.test(l) || PILOT_ROLE_LABEL_RE.test(l) ||
      PH_REGISTRATION_RE.test(l)
    ).length
    const ratio = speakerLines / Math.max(lines.length, 1)
    const formatQuality: 'good' | 'fair' | 'poor' =
      ratio >= 0.3 ? 'good' : ratio >= 0.1 ? 'fair' : 'poor'

    return {
      success: true,
      text,
      rawText,
      metadata: {
        pageCount: approxPages,
        extractedLines: lines.length,
        wordCount,
        formatQuality,
        fileType: 'docx',
      },
      errors,
    }
  } catch (err) {
    return {
      success: false,
      text: '',
      rawText: '',
      metadata: { pageCount: 0, extractedLines: 0, wordCount: 0, formatQuality: 'poor', fileType: 'docx' },
      errors: [err instanceof Error ? err.message : 'Unknown error reading DOCX file'],
    }
  }
}

// Re-export validateATCDialogue so callers can use a single import
export { validateATCDialogue }
