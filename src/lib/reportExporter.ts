/**
 * Analysis Report Exporter
 *
 * Generates downloadable PDF and CSV reports from PAEC analysis results.
 * All generation is client-side — no server round-trip required.
 *
 * PDF: uses jsPDF (programmatic layout, no html2canvas)
 * CSV: pure string building, no extra library needed
 */

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
  const M     = 18          // left/right margin
  const cW    = pageW - M * 2   // usable content width  (≈ 174 mm)
  let y       = M

  // ── Colour palette ────────────────────────────────────────────────────────
  type RGB = [number, number, number]
  const INDIGO: RGB = [79,  70,  229]
  const GREEN:  RGB = [22,  163, 74]
  const AMBER:  RGB = [217, 119, 6]
  const RED:    RGB = [220, 38,  38]
  const TEAL:   RGB = [13,  148, 136]
  const GRAY:   RGB = [100, 116, 139]
  const LIGHT:  RGB = [248, 250, 252]
  const DARK:   RGB = [15,  23,  42]
  const WHITE:  RGB = [255, 255, 255]
  const STRIPE: RGB = [241, 245, 249]  // alternating row tint

  function scoreColour(score: number): RGB {
    return score >= 80 ? GREEN : score >= 60 ? AMBER : RED
  }

  // ── Pagination ────────────────────────────────────────────────────────────
  let pageNum = 1

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

  // ── Layout helpers ────────────────────────────────────────────────────────

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

  function metricRow(
    items: Array<{ label: string; value: string; colour?: RGB }>
  ) {
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

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 1 — HEADER BANNER
  // ════════════════════════════════════════════════════════════════════════════

  doc.setFillColor(...INDIGO)
  doc.rect(0, 0, pageW, 38, 'F')

  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  doc.text('PAEC Analysis Report', M, 18)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(199, 210, 254)
  doc.text(`${result.corpusType} Corpus  •  ${today()}`, M, 28)

  y = 46

  // ── Score cards ───────────────────────────────────────────────────────────
  const compliance  = result.summary.overallCompliance
  const rbScore     = result.readbackAnalysis?.completenessScore ?? 0
  const CARD_W      = 82
  const CARD_H      = 28
  const CARD_GAP    = 8

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

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION — KEY FINDINGS
  // ════════════════════════════════════════════════════════════════════════════
  sectionHeader('Key Findings')

  const findings = result.summary?.keyFindings ?? []
  if (findings.length === 0) {
    bodyText('No key findings recorded.')
  } else {
    findings.slice(0, 8).forEach(f => bullet(f))
  }
  y += 3

  if ((result.summary?.strengthAreas ?? []).length > 0) {
    checkPage(12)
    doc.setFontSize(9.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...GREEN)
    doc.text('Strengths', M, y)
    y += 6
    result.summary.strengthAreas.slice(0, 5).forEach(s => bullet(s, GREEN))
    y += 3
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION — ISSUES DETECTED
  // ════════════════════════════════════════════════════════════════════════════
  const criticals = result.summary?.criticalIssues ?? []
  if (criticals.length > 0) {
    sectionHeader('Issues Detected')
    criticals.forEach(c => bullet(c, AMBER))
    y += 3
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION — ERROR TABLE
  // Redesigned with proper column proportions and dynamic row heights.
  // No more text overflow — issue text wraps within its column.
  // ════════════════════════════════════════════════════════════════════════════
  const allErrors = result.phraseologyErrors ?? []
  if (allErrors.length > 0) {
    sectionHeader(`Error Summary  (${allErrors.length} issues detected)`)

    // Column layout (relative to M):
    //  Issue    0   → 122 mm  (122 mm, ~68 chars at 8pt — wraps if longer)
    //  Category 122 → 156 mm  (34 mm)
    //  Line     156 → 174 mm  (18 mm, right-aligned)
    const TC = {
      issue:    { x: 0,   w: 122 },
      category: { x: 122, w: 34 },
      line:     { x: 156, w: 18 },
    }

    // Table header row
    checkPage(10)
    doc.setFillColor(226, 232, 240)
    doc.roundedRect(M, y, cW, 7, 1, 1, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...DARK)
    doc.text('Issue',    M + TC.issue.x    + 2, y + 4.8)
    doc.text('Category', M + TC.category.x + 2, y + 4.8)
    doc.text('Line',     M + TC.line.x     + TC.line.w - 2, y + 4.8, { align: 'right' })
    y += 8

    const shownErrors = allErrors.slice(0, 20)

    shownErrors.forEach((err, idx) => {
      // Wrap issue text to fit its column
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      const issueLines = doc.splitTextToSize(
        err.issue ?? '',
        TC.issue.w - 4,   // 4mm inner padding
      ) as string[]
      const ROW_H = Math.max(9, issueLines.length * 4.5 + 4)

      checkPage(ROW_H + 2)

      // Alternating row background
      if (idx % 2 === 0) {
        doc.setFillColor(...STRIPE)
        doc.rect(M, y, cW, ROW_H, 'F')
      }

      // Draw thin vertical dividers between columns
      doc.setDrawColor(203, 213, 225)
      doc.setLineWidth(0.2)
      ;[TC.category.x, TC.line.x].forEach(cx => {
        doc.line(M + cx, y, M + cx, y + ROW_H)
      })

      const midY = y + ROW_H / 2 + 1.5   // vertical centre of row

      // Issue text (multi-line, vertically centred for single-line rows)
      const textStartY = issueLines.length === 1
        ? midY
        : y + 4
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...DARK)
      doc.text(issueLines, M + TC.issue.x + 2, textStartY)

      // Category
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...GRAY)
      const catLines = doc.splitTextToSize(err.category ?? '', TC.category.w - 4) as string[]
      doc.text(catLines, M + TC.category.x + 2, midY)

      // Line number (right-aligned)
      doc.setFontSize(8)
      doc.setTextColor(...DARK)
      doc.text(String(err.line ?? ''), M + TC.line.x + TC.line.w - 2, midY, { align: 'right' })

      y += ROW_H
    })

    // Horizontal bottom border
    doc.setDrawColor(203, 213, 225)
    doc.setLineWidth(0.3)
    doc.line(M, y, M + cW, y)
    y += 3

    if (allErrors.length > 20) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(...GRAY)
      doc.text(`…and ${allErrors.length - 20} more issues. Export CSV for full list.`, M + 2, y + 4)
      y += 8
    }
    y += 3
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION — ANNOTATED TRANSCRIPT
  // ════════════════════════════════════════════════════════════════════════════
  const transcriptLines = result.parsedLines ?? []
  if (transcriptLines.length > 0) {
    sectionHeader('Annotated Transcript')

    // Build a lookup: lineNumber → errors
    const errorsByLine = new Map<number, typeof allErrors>()
    allErrors.forEach(err => {
      const ln = err.line ?? 0
      if (!errorsByLine.has(ln)) errorsByLine.set(ln, [])
      errorsByLine.get(ln)!.push(err)
    })

    const SPEAKER_W = 14   // mm for "ATC" / "PILOT" label
    const TEXT_X    = M + SPEAKER_W + 2

    transcriptLines.forEach(pl => {
      const errs = errorsByLine.get(pl.lineNumber) ?? []
      const speakerLabel = pl.speaker === 'ATC' ? 'ATC' : pl.speaker === 'PILOT' ? 'PILOT' : '?'
      const speakerColour: RGB = pl.speaker === 'ATC' ? INDIGO : pl.speaker === 'PILOT' ? GREEN : GRAY

      // Wrap transcript text
      const textLines = doc.splitTextToSize(pl.text, cW - SPEAKER_W - 4) as string[]
      const rowH = Math.max(7, textLines.length * 4.5 + 2)
      checkPage(rowH + errs.length * 6 + 2)

      // Speaker badge
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...speakerColour)
      doc.text(speakerLabel, M, y + 4.5)

      // Transcript text
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...DARK)
      doc.text(textLines, TEXT_X, y + 4.5)

      y += rowH

      // Errors indented below the line
      errs.forEach(err => {
        checkPage(7)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(...AMBER)
        const errText = `⚠ [${err.category}] ${err.issue}`
        const errLines = doc.splitTextToSize(errText, cW - SPEAKER_W - 6) as string[]
        doc.text(errLines, TEXT_X + 2, y + 4)
        y += errLines.length * 4 + 1
      })

      // Light divider between lines
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.15)
      doc.line(M, y, M + cW, y)
      y += 1.5
    })
    y += 3
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION — RECOMMENDATIONS
  // ════════════════════════════════════════════════════════════════════════════
  const recs = result.summary?.recommendations ?? []
  if (recs.length > 0) {
    sectionHeader('Recommendations')
    const NUM_W = 8  // reserved width for "1."
    recs.forEach((r, i) => {
      const lines = doc.splitTextToSize(r, cW - NUM_W - 2) as string[]
      checkPage(lines.length * 5 + 4)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...INDIGO)
      doc.text(`${i + 1}.`, M, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...DARK)
      doc.text(lines, M + NUM_W, y)
      y += lines.length * 5 + 3
    })
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION — GROUND OPERATIONS ANALYSIS
  // ════════════════════════════════════════════════════════════════════════════
  if (groundResults && groundResults.exchanges.length > 0) {
    const gExchanges  = groundResults.exchanges
    const total       = gExchanges.length
    const maneuvering = gExchanges.filter(e => ['taxi', 'ground', 'pushback'].includes(e.phase)).length
    const holdingCnt  = gExchanges.filter(e => e.phase === 'holding').length
    const criticalCnt = gExchanges.filter(e => e.contextualWeight === 'high').length

    sectionHeader(`Ground Operations Analysis  (${total} exchanges)`)

    // ── Phase stat grid ──────────────────────────────────────────────────
    metricRow([
      { label: 'Total Exchanges',    value: String(total) },
      { label: 'Maneuvering',        value: String(maneuvering), colour: GREEN },
      { label: 'Hold Short',         value: String(holdingCnt),  colour: AMBER },
      { label: 'High-Weight Errors', value: String(criticalCnt), colour: criticalCnt > 0 ? AMBER : GREEN },
    ])

    // ── Safety vectors — avg across exchanges ────────────────────────────
    const withVectors = gExchanges.filter(e => e.safetyVectors?.length)
    if (withVectors.length > 0) {
      const vectorFactors = [
        { factor: 'Parameter Readback Accuracy', label: 'Parameter Readback Accuracy' },
        { factor: 'Hold Short Compliance',        label: 'Hold Short Compliance' },
        { factor: 'Readback Completeness',        label: 'Readback Completeness' },
        { factor: 'Callsign Compliance',          label: 'Callsign Compliance' },
      ]

      checkPage(12)
      doc.setFontSize(9.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...DARK)
      doc.text('Readback Vectors (average across all exchanges)', M, y)
      y += 6

      const BAR_LABEL_W = 60
      const BAR_W       = cW - BAR_LABEL_W - 12

      vectorFactors.forEach(({ factor, label }) => {
        const exWithFactor = withVectors.filter(e => e.safetyVectors.some(v => v.factor === factor))
        const avg = exWithFactor.length === 0 ? 0 : Math.round(
          exWithFactor.reduce((sum, e) => {
            const vec = e.safetyVectors.find(v => v.factor === factor)
            return sum + (vec?.score ?? 0)
          }, 0) / exWithFactor.length
        )
        const barColour: RGB = avg >= 80 ? GREEN : avg >= 60 ? AMBER : RED
        const BAR_H = 4.5

        checkPage(10)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...DARK)
        doc.text(label, M, y + 3.5)

        doc.setFillColor(226, 232, 240)
        doc.roundedRect(M + BAR_LABEL_W, y, BAR_W, BAR_H, 1, 1, 'F')
        doc.setFillColor(...barColour)
        doc.roundedRect(M + BAR_LABEL_W, y, Math.max(2, (BAR_W * avg) / 100), BAR_H, 1, 1, 'F')
        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...barColour)
        doc.text(`${avg}%`, M + cW, y + 3.5, { align: 'right' })

        y += 8
      })
      y += 3
    }

    // ── Ground-specific errors table ─────────────────────────────────────
    type GndErrRow = { exchangeIdx: number; phase: string; description: string; correction: string }
    const allGndErrors: GndErrRow[] = []
    gExchanges.forEach((ex, idx) => {
      ;(ex.groundSpecificErrors ?? []).forEach(ge => {
        allGndErrors.push({
          exchangeIdx: idx + 1,
          phase:       ex.phase,
          description: ge.description,
          correction:  ge.correction ?? '',
        })
      })
    })

    if (allGndErrors.length > 0) {
      sectionHeader(`GND Error Summary  (${allGndErrors.length} issues detected)`)

      const GTC = {
        num:   { x: 0,   w: 12 },
        phase: { x: 12,  w: 22 },
        desc:  { x: 34,  w: 88 },
        fix:   { x: 122, w: 52 },
      }

      checkPage(9)
      doc.setFillColor(226, 232, 240)
      doc.roundedRect(M, y, cW, 7, 1, 1, 'F')
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...DARK)
      doc.text('#',           M + GTC.num.x   + 2, y + 4.5)
      doc.text('Phase',       M + GTC.phase.x + 2, y + 4.5)
      doc.text('Description', M + GTC.desc.x  + 2, y + 4.5)
      doc.text('Correction',  M + GTC.fix.x   + 2, y + 4.5)
      y += 8

      allGndErrors.slice(0, 15).forEach((ge, idx) => {
        const descLines = doc.splitTextToSize(ge.description, GTC.desc.w - 4) as string[]
        const fixLines  = doc.splitTextToSize(ge.correction,  GTC.fix.w  - 4) as string[]
        const ROW_H = Math.max(9, Math.max(descLines.length, fixLines.length) * 4.5 + 4)

        checkPage(ROW_H + 2)
        if (idx % 2 === 0) {
          doc.setFillColor(...STRIPE)
          doc.rect(M, y, cW, ROW_H, 'F')
        }
        doc.setDrawColor(203, 213, 225)
        doc.setLineWidth(0.2)
        ;[GTC.phase.x, GTC.desc.x, GTC.fix.x].forEach(cx => {
          doc.line(M + cx, y, M + cx, y + ROW_H)
        })

        const midY = y + ROW_H / 2 + 1.5
        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...DARK)
        doc.text(String(ge.exchangeIdx), M + GTC.num.x   + 2, midY)
        doc.text(ge.phase.toUpperCase(), M + GTC.phase.x + 2, midY)
        doc.text(descLines,              M + GTC.desc.x  + 2, y + 4)
        doc.setTextColor(...GRAY)
        doc.text(fixLines,               M + GTC.fix.x   + 2, y + 4)

        y += ROW_H
      })

      doc.setDrawColor(203, 213, 225)
      doc.setLineWidth(0.3)
      doc.line(M, y, M + cW, y)
      y += 3

      if (allGndErrors.length > 15) {
        doc.setFontSize(8)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(...GRAY)
        doc.text(`…and ${allGndErrors.length - 15} more GND errors. Export CSV for full list.`, M + 2, y + 4)
        y += 8
      }
      y += 3
    }

    // ── GND training recommendations ─────────────────────────────────────
    const seen = new Set<string>()
    const gndRecs: string[] = []
    gExchanges.forEach(ex => {
      ;(ex.trainingRecommendations ?? []).forEach(r => {
        if (!seen.has(r)) { seen.add(r); gndRecs.push(r) }
      })
    })

    if (gndRecs.length > 0) {
      sectionHeader('GND Recommendations')
      const NUM_W = 8
      gndRecs.slice(0, 5).forEach((r, i) => {
        const lines = doc.splitTextToSize(r, cW - NUM_W - 2) as string[]
        checkPage(lines.length * 5 + 4)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...INDIGO)
        doc.text(`${i + 1}.`, M, y)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...DARK)
        doc.text(lines, M + NUM_W, y)
        y += lines.length * 5 + 3
      })
    }
  }

  // ── Final footer ──────────────────────────────────────────────────────────
  addFooter()

  const base = filename ?? `PAEC-report-${slug()}`
  doc.save(`${base}.pdf`)
}

// ── CSV Export ────────────────────────────────────────────────────────────────

export function exportAnalysisToCSV(
  result: AnalysisOutput,
  filename?: string,
  groundResults?: GroundExportData,
): void {
  const esc = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`

  const rows: string[] = []

  rows.push('PAEC Analysis Report — CSV Export')
  rows.push(`Corpus Type,${esc(result.corpusType)}`)
  rows.push(`Date,${esc(today())}`)
  rows.push(`ICAO Compliance,${result.summary.overallCompliance}%`)
  rows.push(`Readback Score,${result.readbackAnalysis?.completenessScore ?? 0}%`)
  rows.push(`Total Words,${result.totalWords}`)
  rows.push(`Total Exchanges,${result.totalExchanges}`)
  rows.push(`Non-Standard Uses,${result.nonStandardFreq}`)
  rows.push('')

  rows.push(['Line', 'Issue', 'Original Text', 'Suggestion', 'Weight', 'Category', 'Impact Type', 'Explanation'].map(esc).join(','))

  ;(result.phraseologyErrors ?? []).forEach(err => {
    rows.push([
      String(err.line ?? ''),
      err.issue ?? '',
      err.original ?? '',
      err.suggestion ?? '',
      err.weight ?? '',
      err.category ?? '',
      err.safetyImpact ?? '',
      err.explanation ?? '',
    ].map(esc).join(','))
  })

  rows.push('')
  rows.push('Key Findings')
  ;(result.summary?.keyFindings ?? []).forEach(f => rows.push(esc(f)))

  rows.push('')
  rows.push('Recommendations')
  ;(result.summary?.recommendations ?? []).forEach(r => rows.push(esc(r)))

  // Annotated transcript
  const csvLines = result.parsedLines ?? []
  if (csvLines.length > 0) {
    // Build error lookup
    const csvErrorsByLine = new Map<number, typeof csvErrors>()
    const csvErrors = result.phraseologyErrors ?? []
    csvErrors.forEach(err => {
      const ln = err.line ?? 0
      if (!csvErrorsByLine.has(ln)) csvErrorsByLine.set(ln, [])
      csvErrorsByLine.get(ln)!.push(err)
    })

    rows.push('')
    rows.push('ANNOTATED TRANSCRIPT')
    rows.push(['Line', 'Speaker', 'Text', 'Error Count', 'Errors'].map(esc).join(','))
    csvLines.forEach(pl => {
      const errs = csvErrorsByLine.get(pl.lineNumber) ?? []
      const errSummary = errs.map(e => `[${e.category}] ${e.issue}`).join(' | ')
      rows.push([
        String(pl.lineNumber),
        pl.speaker,
        pl.text,
        String(errs.length),
        errSummary,
      ].map(esc).join(','))
    })
  }

  // Ground Operations Analysis block
  if (groundResults && groundResults.exchanges.length > 0) {
    const gEx = groundResults.exchanges

    rows.push('')
    rows.push('GROUND OPERATIONS ANALYSIS')
    rows.push(`Total GND Exchanges,${gEx.length}`)
    rows.push(`Maneuvering Exchanges,${gEx.filter(e => ['taxi','ground','pushback'].includes(e.phase)).length}`)
    rows.push(`Hold Short Exchanges,${gEx.filter(e => e.phase === 'holding').length}`)
    rows.push(`High-Weight Errors,${gEx.filter(e => e.contextualWeight === 'high').length}`)
    rows.push('')

    // GND error rows — same column style as phraseology error table
    rows.push(['Exchange #', 'Phase', 'Error Type', 'Description', 'Weight', 'Correction', 'ICAO Reference', 'Safety Impact'].map(esc).join(','))
    gEx.forEach((ex, idx) => {
      ;(ex.groundSpecificErrors ?? []).forEach(ge => {
        rows.push([
          String(idx + 1),
          ex.phase,
          ge.type ?? '',
          ge.description ?? '',
          ge.weight ?? '',
          ge.correction ?? '',
          ge.icaoReference ?? '',
          ge.safetyImpact ?? '',
        ].map(esc).join(','))
      })
    })

    rows.push('')
    rows.push('GND Readback Vectors')
    rows.push(['Exchange #', 'Phase', 'Completeness %', 'Param Readback Accuracy', 'Hold Short Compliance', 'Readback Completeness', 'Callsign Compliance'].map(esc).join(','))
    gEx.forEach((ex, idx) => {
      const vec = ex.safetyVectors ?? []
      const fv  = (factor: string) => String(vec.find(v => v.factor === factor)?.score ?? 0)
      rows.push([
        String(idx + 1),
        ex.phase,
        String(ex.multiPartAnalysis?.readbackCompleteness ?? 0),
        fv('Parameter Readback Accuracy'),
        fv('Hold Short Compliance'),
        fv('Readback Completeness'),
        fv('Callsign Compliance'),
      ].map(esc).join(','))
    })

    rows.push('')
    rows.push('GND Recommendations')
    const gndSeen = new Set<string>()
    gEx.forEach(ex => {
      ;(ex.trainingRecommendations ?? []).forEach(r => {
        if (!gndSeen.has(r)) { gndSeen.add(r); rows.push(esc(r)) }
      })
    })
  }

  const csv  = rows.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const base = filename ?? `PAEC-report-${slug()}`
  triggerDownload(blob, `${base}.csv`)
}
