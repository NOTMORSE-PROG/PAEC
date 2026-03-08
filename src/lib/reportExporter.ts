/**
 * Analysis Report Exporter
 *
 * Generates downloadable PDF and CSV reports from PAEC analysis results.
 * All generation is client-side — no server round-trip required.
 *
 * PDF: uses jsPDF (programmatic layout, no html2canvas)
 * CSV: pure string building, no extra library needed
 */

import type { jsPDF as JsPDF } from 'jspdf'
import type { AnalysisOutput } from './analysisEngine'
import type { GroundMLResult, GroundPhase } from './groundAnalyzer'

interface GroundExportData {
  exchanges: GroundMLResult[]
  summary: {
    totalExchanges: number
    taxiCount: number
    holdingCount: number
    crossingCount: number
    averageCompleteness: number
    criticalErrors: number
    phaseBreakdown: Record<GroundPhase, number>
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function today(): string {
  return new Date().toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function slug(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── PDF Content Builder ───────────────────────────────────────────────────────

interface BatchInfo { fileIndex: number; totalFiles: number; fileLabel: string }

/**
 * Renders one file's full analysis content onto `doc` starting at a fresh page.
 * Returns the updated page number so the caller can chain multiple files.
 */
function buildFilePDF(
  doc: JsPDF,
  result: AnalysisOutput,
  groundResults: GroundExportData | undefined,
  pageW: number,
  pageH: number,
  M: number,
  cW: number,
  startPageNum: number,
  batchInfo?: BatchInfo,
): number {
  const BANNER_H = batchInfo ? 44 : 38
  let y = M
  let pageNum = startPageNum

  // ── Colour palette ────────────────────────────────────────────────────────
  type RGB = [number, number, number]
  const INDIGO: RGB = [79,  70,  229]
  const GREEN:  RGB = [22,  163, 74]
  const AMBER:  RGB = [217, 119, 6]
  const RED:    RGB = [220, 38,  38]
  const GRAY:   RGB = [100, 116, 139]
  const LIGHT:  RGB = [248, 250, 252]
  const DARK:   RGB = [15,  23,  42]
  const WHITE:  RGB = [255, 255, 255]
  const STRIPE: RGB = [241, 245, 249]

  function scoreColour(score: number): RGB {
    return score >= 80 ? GREEN : score >= 60 ? AMBER : RED
  }

  function addFooter() {
    doc.setFontSize(7.5)
    doc.setTextColor(...GRAY)
    doc.text(`PAEC Analysis Report  •  ${today()}`, M, pageH - 7)
    doc.text(`Page ${pageNum}`, pageW - M, pageH - 7, { align: 'right' })
    pageNum++
  }

  function checkPage(needed = 14) {
    if (y + needed > pageH - 14) {
      addFooter()
      doc.addPage()
      y = M
    }
  }

  function sectionHeader(title: string) {
    checkPage(14)
    doc.setFillColor(...INDIGO)
    doc.roundedRect(M, y, cW, 8, 1.5, 1.5, 'F')
    doc.setFontSize(9.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...WHITE)
    doc.text(title.toUpperCase(), M + 4, y + 5.5)
    y += 12
    doc.setTextColor(...DARK)
  }

  function bodyText(text: string, indent = 0) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...DARK)
    const lines = doc.splitTextToSize(text, cW - indent)
    checkPage(lines.length * 5 + 2)
    doc.text(lines, M + indent, y)
    y += lines.length * 5 + 1
  }

  function bullet(text: string, colour: RGB = DARK) {
    checkPage(8)
    doc.setFillColor(...colour)
    doc.circle(M + 2, y - 1, 1, 'F')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...DARK)
    const lines = doc.splitTextToSize(text, cW - 8)
    doc.text(lines, M + 6, y)
    y += lines.length * 5 + 1
  }

  function metricRow(items: Array<{ label: string; value: string; colour?: RGB }>) {
    checkPage(24)
    const colW = cW / items.length
    items.forEach((item, i) => {
      const x = M + i * colW
      doc.setFillColor(...LIGHT)
      doc.roundedRect(x, y, colW - 2, 18, 2, 2, 'F')
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...(item.colour ?? INDIGO))
      doc.text(item.value, x + (colW - 2) / 2, y + 10, { align: 'center' })
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...GRAY)
      doc.text(item.label.toUpperCase(), x + (colW - 2) / 2, y + 15.5, { align: 'center' })
    })
    y += 22
  }

  // ── Header banner ─────────────────────────────────────────────────────────
  doc.setFillColor(...INDIGO)
  doc.rect(0, 0, pageW, BANNER_H, 'F')
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  doc.text('PAEC Analysis Report', M, batchInfo ? 14 : 18)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(199, 210, 254)
  doc.text(`${result.corpusType} Corpus  •  ${today()}`, M, batchInfo ? 23 : 28)
  if (batchInfo) {
    doc.setFontSize(8.5)
    doc.text(`File ${batchInfo.fileIndex} of ${batchInfo.totalFiles}: ${batchInfo.fileLabel}`, M, 34)
  }
  y = BANNER_H + 8

  // ── Score cards ───────────────────────────────────────────────────────────
  const compliance = result.summary.overallCompliance
  const rbScore    = result.readbackAnalysis?.completenessScore ?? 0
  const CARD_W = 82, CARD_H = 28, CARD_GAP = 8
  ;[
    { score: compliance, label: 'ICAO COMPLIANCE', x: M },
    { score: rbScore,    label: 'READBACK SCORE',  x: M + CARD_W + CARD_GAP },
  ].forEach(({ score, label, x }) => {
    doc.setFillColor(...LIGHT)
    doc.roundedRect(x, y, CARD_W, CARD_H, 3, 3, 'F')
    doc.setFontSize(26)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...scoreColour(score))
    doc.text(`${score}%`, x + CARD_W / 2, y + 16, { align: 'center' })
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text(label, x + CARD_W / 2, y + 24, { align: 'center' })
  })
  y += CARD_H + 6

  // ── Volume metrics ────────────────────────────────────────────────────────
  metricRow([
    { label: 'Total words',       value: result.totalWords.toLocaleString() },
    { label: 'Exchanges',         value: result.totalExchanges.toString() },
    { label: 'Non-standard uses', value: result.nonStandardFreq.toString(),
      colour: result.nonStandardFreq > 5 ? AMBER : GREEN },
    { label: 'Clarifications',    value: result.clarificationCount.toString() },
  ])

  // ── Analysis Summary ──────────────────────────────────────────────────────
  sectionHeader('Analysis Summary')

  const criticals = result.summary?.criticalIssues ?? []
  if (criticals.length > 0) {
    checkPage(12)
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...AMBER)
    doc.text('Critical Issues', M, y); y += 6
    criticals.slice(0, 6).forEach(c => bullet(c, AMBER))
    y += 2
  }

  const strengths = result.summary?.strengthAreas ?? []
  if (strengths.length > 0) {
    checkPage(12)
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREEN)
    doc.text('Strengths', M, y); y += 6
    strengths.slice(0, 5).forEach(s => bullet(s, GREEN))
    y += 2
  }

  checkPage(12)
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK)
  doc.text('Key Findings', M, y); y += 6
  const findings = result.summary?.keyFindings ?? []
  if (findings.length === 0) { bodyText('No key findings recorded.') }
  else { findings.slice(0, 8).forEach(f => bullet(f)) }
  y += 3

  // ── Error Table ───────────────────────────────────────────────────────────
  const allErrors = result.phraseologyErrors ?? []
  if (allErrors.length > 0) {
    sectionHeader(`Error Summary  (${allErrors.length} issues detected)`)
    const TC = { issue: { x: 0, w: 122 }, category: { x: 122, w: 34 }, line: { x: 156, w: 18 } }

    checkPage(10)
    doc.setFillColor(226, 232, 240)
    doc.roundedRect(M, y, cW, 7, 1, 1, 'F')
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK)
    doc.text('Issue',    M + TC.issue.x    + 2, y + 4.8)
    doc.text('Category', M + TC.category.x + 2, y + 4.8)
    doc.text('Line',     M + TC.line.x + TC.line.w - 2, y + 4.8, { align: 'right' })
    y += 8

    allErrors.slice(0, 20).forEach((err, idx) => {
      doc.setFontSize(8); doc.setFont('helvetica', 'normal')
      const issueLines = doc.splitTextToSize(err.issue ?? '', TC.issue.w - 4) as string[]
      const ROW_H = Math.max(9, issueLines.length * 4.5 + 4)
      checkPage(ROW_H + 2)
      if (idx % 2 === 0) { doc.setFillColor(...STRIPE); doc.rect(M, y, cW, ROW_H, 'F') }
      doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.2)
      ;[TC.category.x, TC.line.x].forEach(cx => doc.line(M + cx, y, M + cx, y + ROW_H))
      const midY = y + ROW_H / 2 + 1.5
      const textStartY = issueLines.length === 1 ? midY : y + 4
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
      doc.text(issueLines, M + TC.issue.x + 2, textStartY)
      doc.setFontSize(7.5); doc.setTextColor(...GRAY)
      doc.text(doc.splitTextToSize(err.category ?? '', TC.category.w - 4) as string[], M + TC.category.x + 2, midY)
      doc.setFontSize(8); doc.setTextColor(...DARK)
      doc.text(String(err.line ?? ''), M + TC.line.x + TC.line.w - 2, midY, { align: 'right' })
      y += ROW_H
    })

    doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3); doc.line(M, y, M + cW, y); y += 3
    if (allErrors.length > 20) {
      doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(...GRAY)
      doc.text(`…and ${allErrors.length - 20} more issues. Export CSV for full list.`, M + 2, y + 4)
      y += 8
    }
    y += 3
  }

  // ── Annotated Transcript ──────────────────────────────────────────────────
  const transcriptLines = result.parsedLines ?? []
  if (transcriptLines.length > 0) {
    sectionHeader('Annotated Transcript')
    const errorsByLine = new Map<number, typeof allErrors>()
    allErrors.forEach(err => {
      const ln = err.line ?? 0
      if (!errorsByLine.has(ln)) errorsByLine.set(ln, [])
      errorsByLine.get(ln)!.push(err)
    })
    const SPEAKER_W = 14, TEXT_X = M + SPEAKER_W + 2

    transcriptLines.forEach(pl => {
      const errs = errorsByLine.get(pl.lineNumber) ?? []
      const speakerLabel = pl.speaker === 'ATC' ? 'ATC' : pl.speaker === 'PILOT' ? 'PILOT' : '?'
      const speakerColour: RGB = pl.speaker === 'ATC' ? INDIGO : pl.speaker === 'PILOT' ? GREEN : GRAY
      const textLines = doc.splitTextToSize(pl.text, cW - SPEAKER_W - 4) as string[]
      const rowH = Math.max(7, textLines.length * 4.5 + 2)
      checkPage(rowH + errs.length * 6 + 2)
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...speakerColour)
      doc.text(speakerLabel, M, y + 4.5)
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
      doc.text(textLines, TEXT_X, y + 4.5)
      y += rowH
      errs.forEach(err => {
        checkPage(7)
        doc.setFontSize(7); doc.setFont('helvetica', 'italic'); doc.setTextColor(...AMBER)
        const errLines = doc.splitTextToSize(`⚠ [${err.category}] ${err.issue}`, cW - SPEAKER_W - 6) as string[]
        doc.text(errLines, TEXT_X + 2, y + 4)
        y += errLines.length * 4 + 1
      })
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.15); doc.line(M, y, M + cW, y); y += 1.5
    })
    y += 3
  }

  // ── Recommendations ───────────────────────────────────────────────────────
  const recs = result.summary?.recommendations ?? []
  if (recs.length > 0) {
    sectionHeader('Recommendations')
    const NUM_W = 8
    recs.forEach((r, i) => {
      const lines = doc.splitTextToSize(r, cW - NUM_W - 2) as string[]
      checkPage(lines.length * 5 + 4)
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...INDIGO)
      doc.text(`${i + 1}.`, M, y)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
      doc.text(lines, M + NUM_W, y)
      y += lines.length * 5 + 3
    })
  }

  // ── Ground Operations Analysis ────────────────────────────────────────────
  if (groundResults && groundResults.exchanges.length > 0) {
    const gEx = groundResults.exchanges
    sectionHeader(`Ground Operations Analysis  (${gEx.length} exchanges)`)
    metricRow([
      { label: 'Total Exchanges',    value: String(gEx.length) },
      { label: 'Maneuvering',        value: String(gEx.filter(e => ['taxi','ground','pushback'].includes(e.phase)).length), colour: GREEN },
      { label: 'Hold Short',         value: String(gEx.filter(e => e.phase === 'holding').length), colour: AMBER },
      { label: 'High-Weight Errors', value: String(gEx.filter(e => e.contextualWeight === 'high').length),
        colour: gEx.some(e => e.contextualWeight === 'high') ? AMBER : GREEN },
    ])

    const withVectors = gEx.filter(e => e.safetyVectors?.length)
    if (withVectors.length > 0) {
      checkPage(12)
      doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK)
      doc.text('Readback Vectors (average across all exchanges)', M, y); y += 6
      const BAR_LABEL_W = 60, BAR_W = cW - BAR_LABEL_W - 12
      ;[
        { factor: 'Parameter Readback Accuracy', label: 'Parameter Readback Accuracy' },
        { factor: 'Hold Short Compliance',        label: 'Hold Short Compliance' },
        { factor: 'Readback Completeness',        label: 'Readback Completeness' },
        { factor: 'Callsign Compliance',          label: 'Callsign Compliance' },
      ].forEach(({ factor, label }) => {
        const exWithF = withVectors.filter(e => e.safetyVectors.some(v => v.factor === factor))
        const avg = exWithF.length === 0 ? 0 : Math.round(
          exWithF.reduce((s, e) => s + (e.safetyVectors.find(v => v.factor === factor)?.score ?? 0), 0) / exWithF.length
        )
        const barColour: RGB = avg >= 80 ? GREEN : avg >= 60 ? AMBER : RED
        checkPage(10)
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
        doc.text(label, M, y + 3.5)
        doc.setFillColor(226, 232, 240); doc.roundedRect(M + BAR_LABEL_W, y, BAR_W, 4.5, 1, 1, 'F')
        doc.setFillColor(...barColour); doc.roundedRect(M + BAR_LABEL_W, y, Math.max(2, BAR_W * avg / 100), 4.5, 1, 1, 'F')
        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...barColour)
        doc.text(`${avg}%`, M + cW, y + 3.5, { align: 'right' })
        y += 8
      })
      y += 3
    }

    type GndErrRow = { exchangeIdx: number; phase: string; description: string; correction: string }
    const allGndErrors: GndErrRow[] = []
    gEx.forEach((ex, idx) => {
      ;(ex.groundSpecificErrors ?? []).forEach(ge => allGndErrors.push({
        exchangeIdx: idx + 1, phase: ex.phase, description: ge.description, correction: ge.correction ?? '',
      }))
    })

    if (allGndErrors.length > 0) {
      sectionHeader(`GND Error Summary  (${allGndErrors.length} issues detected)`)
      const GTC = { num: { x: 0, w: 12 }, phase: { x: 12, w: 22 }, desc: { x: 34, w: 88 }, fix: { x: 122, w: 52 } }
      checkPage(9)
      doc.setFillColor(226, 232, 240); doc.roundedRect(M, y, cW, 7, 1, 1, 'F')
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK)
      doc.text('#', M + GTC.num.x + 2, y + 4.5); doc.text('Phase', M + GTC.phase.x + 2, y + 4.5)
      doc.text('Description', M + GTC.desc.x + 2, y + 4.5); doc.text('Correction', M + GTC.fix.x + 2, y + 4.5)
      y += 8

      allGndErrors.slice(0, 15).forEach((ge, idx) => {
        const descLines = doc.splitTextToSize(ge.description, GTC.desc.w - 4) as string[]
        const fixLines  = doc.splitTextToSize(ge.correction,  GTC.fix.w  - 4) as string[]
        const ROW_H = Math.max(9, Math.max(descLines.length, fixLines.length) * 4.5 + 4)
        checkPage(ROW_H + 2)
        if (idx % 2 === 0) { doc.setFillColor(...STRIPE); doc.rect(M, y, cW, ROW_H, 'F') }
        doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.2)
        ;[GTC.phase.x, GTC.desc.x, GTC.fix.x].forEach(cx => doc.line(M + cx, y, M + cx, y + ROW_H))
        const midY = y + ROW_H / 2 + 1.5
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
        doc.text(String(ge.exchangeIdx), M + GTC.num.x + 2, midY)
        doc.text(ge.phase.toUpperCase(), M + GTC.phase.x + 2, midY)
        doc.text(descLines, M + GTC.desc.x + 2, y + 4)
        doc.setTextColor(...GRAY); doc.text(fixLines, M + GTC.fix.x + 2, y + 4)
        y += ROW_H
      })
      doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3); doc.line(M, y, M + cW, y); y += 3
      if (allGndErrors.length > 15) {
        doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(...GRAY)
        doc.text(`…and ${allGndErrors.length - 15} more GND errors. Export CSV for full list.`, M + 2, y + 4)
        y += 8
      }
      y += 3
    }

    const seen = new Set<string>()
    const gndRecs: string[] = []
    gEx.forEach(ex => { ;(ex.trainingRecommendations ?? []).forEach(r => { if (!seen.has(r)) { seen.add(r); gndRecs.push(r) } }) })
    if (gndRecs.length > 0) {
      sectionHeader('GND Recommendations')
      const NUM_W = 8
      gndRecs.slice(0, 5).forEach((r, i) => {
        const lines = doc.splitTextToSize(r, cW - NUM_W - 2) as string[]
        checkPage(lines.length * 5 + 4)
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...INDIGO)
        doc.text(`${i + 1}.`, M, y)
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
        doc.text(lines, M + NUM_W, y); y += lines.length * 5 + 3
      })
    }
  }

  addFooter()
  return pageNum
}

// ── PDF Export ────────────────────────────────────────────────────────────────

export async function exportAnalysisToPDF(
  result: AnalysisOutput,
  filename?: string,
  groundResults?: GroundExportData,
): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const M = 18, cW = pageW - M * 2
  buildFilePDF(doc, result, groundResults, pageW, pageH, M, cW, 1)
  doc.save(`${filename ?? `PAEC-report-${slug()}`}.pdf`)
}

// ── CSV Export ────────────────────────────────────────────────────────────────

/** Build the CSV rows for a single file's analysis result. */
function buildCSVRows(result: AnalysisOutput, groundResults?: GroundExportData): string[] {
  const esc = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`
  const trunc = (s: string, max = 150) => s.length > max ? s.slice(0, max).trimEnd() + '...' : s
  const SEP = '='.repeat(60)
  const rows: string[] = []

  rows.push(SEP)
  rows.push('FILE SUMMARY')
  rows.push(SEP)
  rows.push(`Corpus Type,${esc(result.corpusType)}`)
  rows.push(`Date,${esc(today())}`)
  rows.push(`ICAO Compliance,${result.summary.overallCompliance}%`)
  rows.push(`Readback Score,${result.readbackAnalysis?.completenessScore ?? 0}%`)
  rows.push(`Total Words,${result.totalWords}`)
  rows.push(`Total Exchanges,${result.totalExchanges}`)
  rows.push(`Non-Standard Uses,${result.nonStandardFreq}`)
  rows.push(`Total Errors Detected,${(result.phraseologyErrors ?? []).length}`)
  rows.push(`High-Weight Issues,${result.safetyMetrics?.highWeightIssues ?? 0}`)
  rows.push(`Medium-Weight Issues,${result.safetyMetrics?.mediumWeightIssues ?? 0}`)
  rows.push(`Low-Weight Issues,${result.safetyMetrics?.lowWeightIssues ?? 0}`)
  rows.push('')

  rows.push(SEP)
  rows.push('ANALYSIS SUMMARY')
  rows.push(SEP)

  const criticals = result.summary?.criticalIssues ?? []
  if (criticals.length > 0) {
    rows.push('Critical Issues')
    criticals.forEach((c, i) => rows.push(`${i + 1},${esc(c)}`))
    rows.push('')
  }

  const strengths = result.summary?.strengthAreas ?? []
  if (strengths.length > 0) {
    rows.push('Strengths')
    strengths.forEach((s, i) => rows.push(`${i + 1},${esc(s)}`))
    rows.push('')
  }

  const topFindings = result.summary?.keyFindings ?? []
  if (topFindings.length > 0) {
    rows.push('Key Findings')
    topFindings.forEach((f, i) => rows.push(`${i + 1},${esc(f)}`))
  }
  rows.push('')

  rows.push(SEP)
  rows.push('ERROR SUMMARY')
  rows.push(SEP)
  rows.push(['Line', 'Issue', 'Original Text', 'Suggestion', 'Weight', 'Category', 'Explanation'].map(esc).join(','))
  ;(result.phraseologyErrors ?? []).forEach(err => {
    rows.push([
      String(err.line ?? ''),
      trunc(err.issue ?? '', 100),
      trunc(err.original ?? '', 80),
      trunc(err.suggestion ?? '', 80),
      err.weight ?? '',
      err.category ?? '',
      trunc(err.explanation ?? '', 150),
    ].map(esc).join(','))
  })

  rows.push('')
  rows.push(SEP)
  rows.push('RECOMMENDATIONS')
  rows.push(SEP)
  ;(result.summary?.recommendations ?? []).forEach(r => rows.push(esc(r)))

  // Annotated transcript
  const csvLines = result.parsedLines ?? []
  if (csvLines.length > 0) {
    const csvErrors = result.phraseologyErrors ?? []
    const csvErrorsByLine = new Map<number, typeof csvErrors>()
    csvErrors.forEach(err => {
      const ln = err.line ?? 0
      if (!csvErrorsByLine.has(ln)) csvErrorsByLine.set(ln, [])
      csvErrorsByLine.get(ln)!.push(err)
    })

    rows.push('')
    rows.push(SEP)
    rows.push('ANNOTATED TRANSCRIPT')
    rows.push(SEP)
    rows.push(['Line', 'Speaker', 'Text', 'Error Count', 'Errors'].map(esc).join(','))
    csvLines.forEach(pl => {
      const errs = csvErrorsByLine.get(pl.lineNumber) ?? []
      const errSummary = trunc(errs.map(e => `[${e.category}] ${e.issue}`).join(' | '), 200)
      rows.push([String(pl.lineNumber), pl.speaker, trunc(pl.text, 200), String(errs.length), errSummary].map(esc).join(','))
    })
  }

  // Ground Operations Analysis block
  if (groundResults && groundResults.exchanges.length > 0) {
    const gEx = groundResults.exchanges

    rows.push('')
    rows.push(SEP)
    rows.push('GROUND OPERATIONS ANALYSIS')
    rows.push(SEP)
    rows.push(`Total GND Exchanges,${gEx.length}`)
    rows.push(`Maneuvering Exchanges,${gEx.filter(e => ['taxi','ground','pushback'].includes(e.phase)).length}`)
    rows.push(`Hold Short Exchanges,${gEx.filter(e => e.phase === 'holding').length}`)
    rows.push(`High-Weight Errors,${gEx.filter(e => e.contextualWeight === 'high').length}`)
    rows.push('')

    rows.push(['Exchange #', 'Phase', 'Error Type', 'Description', 'Weight', 'Correction', 'ICAO Reference', 'Safety Impact'].map(esc).join(','))
    gEx.forEach((ex, idx) => {
      ;(ex.groundSpecificErrors ?? []).forEach(ge => {
        rows.push([
          String(idx + 1), ex.phase, ge.type ?? '', trunc(ge.description ?? '', 120),
          ge.weight ?? '', trunc(ge.correction ?? '', 120), ge.icaoReference ?? '', trunc(ge.safetyImpact ?? '', 100),
        ].map(esc).join(','))
      })
    })

    rows.push('')
    rows.push(SEP)
    rows.push('GND READBACK VECTORS')
    rows.push(SEP)
    rows.push(['Exchange #', 'Phase', 'Completeness %', 'Param Readback Accuracy', 'Hold Short Compliance', 'Readback Completeness', 'Callsign Compliance'].map(esc).join(','))
    gEx.forEach((ex, idx) => {
      const vec = ex.safetyVectors ?? []
      const fv  = (factor: string) => String(vec.find(v => v.factor === factor)?.score ?? 0)
      rows.push([
        String(idx + 1), ex.phase, String(ex.multiPartAnalysis?.readbackCompleteness ?? 0),
        fv('Parameter Readback Accuracy'), fv('Hold Short Compliance'),
        fv('Readback Completeness'), fv('Callsign Compliance'),
      ].map(esc).join(','))
    })

    rows.push('')
    rows.push(SEP)
    rows.push('GND RECOMMENDATIONS')
    rows.push(SEP)
    const gndSeen = new Set<string>()
    gEx.forEach(ex => {
      ;(ex.trainingRecommendations ?? []).forEach(r => {
        if (!gndSeen.has(r)) { gndSeen.add(r); rows.push(esc(r)) }
      })
    })
  }

  return rows
}

export function exportAnalysisToCSV(
  result: AnalysisOutput,
  filename?: string,
  groundResults?: GroundExportData,
): void {
  const rows = [
    'PAEC Analysis Report - CSV Export',
    ...buildCSVRows(result, groundResults),
  ]
  const blob = new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, `${filename ?? `PAEC-report-${slug()}`}.csv`)
}

// ── Batch Export ──────────────────────────────────────────────────────────────

export interface BatchExportItem {
  name: string
  result: AnalysisOutput
  groundResults?: GroundExportData
}

interface BatchSummary {
  totalHighWeight: number
  readbackPct: number
  readbackLabel: string       // e.g. "61% (3507/5720)"
  nonStandardRate: number     // per 1,000 words
  totalNumberErrors: number
  fileCount: number
}

function buildBatchSummary(items: BatchExportItem[]): BatchSummary {
  let totalHighWeight = 0
  let totalCompleteReadbacks = 0
  let totalInstructions = 0
  let totalNonStandardCount = 0
  let totalWords = 0
  let totalNumberErrors = 0

  for (const { result } of items) {
    totalHighWeight      += result.safetyMetrics?.highWeightIssues ?? 0
    totalCompleteReadbacks += result.readbackAnalysis?.completeReadbacks ?? 0
    totalInstructions    += result.readbackAnalysis?.totalInstructions ?? 0
    // back-calculate raw count from rate × words (rate is per 1,000 words)
    totalNonStandardCount += Math.round((result.nonStandardFreq ?? 0) * (result.totalWords ?? 0) / 1000)
    totalWords           += result.totalWords ?? 0
    totalNumberErrors    += (result.numberErrors ?? []).length
  }

  const readbackPct = totalInstructions > 0
    ? Math.round(totalCompleteReadbacks / totalInstructions * 100)
    : 0
  const nonStandardRate = totalWords > 0
    ? Math.round(totalNonStandardCount / totalWords * 1000 * 10) / 10
    : 0

  return {
    totalHighWeight,
    readbackPct,
    readbackLabel: `${readbackPct}% (${totalCompleteReadbacks.toLocaleString()}/${totalInstructions.toLocaleString()})`,
    nonStandardRate,
    totalNumberErrors,
    fileCount: items.length,
  }
}

/** Render a batch summary cover page onto `doc` (page 1). Returns next pageNum. */
function buildSummaryPagePDF(
  doc: JsPDF,
  items: BatchExportItem[],
  summary: BatchSummary,
  pageW: number,
  pageH: number,
  M: number,
  cW: number,
): number {
  type RGB = [number, number, number]
  const INDIGO: RGB = [79, 70, 229]
  const DARK:   RGB = [15, 23, 42]
  const GRAY:   RGB = [100, 116, 139]
  const LIGHT:  RGB = [248, 250, 252]
  const AMBER:  RGB = [217, 119, 6]
  const WHITE:  RGB = [255, 255, 255]

  let y = M

  // ── Banner ────────────────────────────────────────────────────────────────
  doc.setFillColor(...INDIGO)
  doc.roundedRect(M, y, cW, 38, 3, 3, 'F')
  doc.setTextColor(...WHITE)
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.text('PAEC Batch Analysis Report', M + 6, y + 13)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`${summary.fileCount} files  ·  Generated ${today()}`, M + 6, y + 22)
  doc.text('Philippine Aeronautical English Corpus', M + 6, y + 30)
  y += 48

  // ── Batch Key Findings ────────────────────────────────────────────────────
  doc.setFillColor(...LIGHT)
  doc.roundedRect(M, y, cW, 8, 2, 2, 'F')
  doc.setTextColor(...DARK)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Batch Summary — Key Findings', M + 4, y + 5.5)
  y += 12

  const findings: string[] = [
    `${summary.totalHighWeight.toLocaleString()} high-weight phraseology issues detected`,
    `Readback completeness: ${summary.readbackLabel}`,
    `Non-standard phraseology rate: ${summary.nonStandardRate} per 1,000 words`,
    `${summary.totalNumberErrors.toLocaleString()} number-related errors detected`,
  ]

  findings.forEach((f, i) => {
    // Numbered bullet background (alternating)
    if (i % 2 === 0) {
      doc.setFillColor(245, 247, 255)
      doc.rect(M, y - 1, cW, 9, 'F')
    }
    doc.setTextColor(...AMBER)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(`${i + 1}.`, M + 3, y + 5)
    doc.setTextColor(...DARK)
    doc.setFont('helvetica', 'normal')
    doc.text(f, M + 10, y + 5)
    y += 10
  })
  y += 6

  // ── Files analyzed list ───────────────────────────────────────────────────
  doc.setFillColor(...LIGHT)
  doc.roundedRect(M, y, cW, 8, 2, 2, 'F')
  doc.setTextColor(...DARK)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Files Analyzed', M + 4, y + 5.5)
  y += 12

  items.forEach(({ name }, i) => {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text(`${i + 1}.`, M + 3, y)
    doc.setTextColor(...DARK)
    doc.text(name, M + 10, y)
    y += 7
    if (y > pageH - M - 10) {
      doc.addPage()
      y = M
    }
  })

  return 1 // summary page is page 1; file pages start at page 2
}

/** Download a single PDF containing all files, each on its own pages. */
export async function exportAllToPDF(items: BatchExportItem[]): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const M = 18, cW = pageW - M * 2

  const summary = buildBatchSummary(items)

  // Page 1: summary cover
  buildSummaryPagePDF(doc, items, summary, pageW, pageH, M, cW)

  // Subsequent pages: one full report per file
  let pageNum = doc.internal.pages.length  // pages added so far + 1
  for (let i = 0; i < items.length; i++) {
    doc.addPage()
    pageNum = buildFilePDF(
      doc, items[i].result, items[i].groundResults,
      pageW, pageH, M, cW, pageNum,
      { fileIndex: i + 1, totalFiles: items.length, fileLabel: items[i].name },
    )
  }
  doc.save(`PAEC-batch-report-${slug()}.pdf`)
}

/** Download a single combined CSV with a summary header then one section per file. */
export function exportAllToCSV(items: BatchExportItem[]): void {
  const summary = buildBatchSummary(items)
  const esc = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`

  const sections: string[] = [
    'PAEC Batch Analysis Report - CSV Export',
    `Date,${esc(today())}`,
    `Files,${summary.fileCount}`,
    '',
    '='.repeat(60),
    'BATCH SUMMARY - KEY FINDINGS',
    '='.repeat(60),
    `Total High-Weight Phraseology Issues,${summary.totalHighWeight.toLocaleString()}`,
    `Readback Completeness,${esc(summary.readbackLabel)}`,
    `Non-Standard Phraseology Rate,${esc(`${summary.nonStandardRate} per 1,000 words`)}`,
    `Total Number-Related Errors,${summary.totalNumberErrors.toLocaleString()}`,
    '',
  ]

  items.forEach(({ name, result, groundResults }, i) => {
    sections.push('='.repeat(60))
    sections.push(`FILE ${i + 1}: ${name}`)
    sections.push('='.repeat(60))
    sections.push(...buildCSVRows(result, groundResults))
    sections.push('')
  })

  const blob = new Blob(['\uFEFF' + sections.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, `PAEC-batch-report-${slug()}.csv`)
}
