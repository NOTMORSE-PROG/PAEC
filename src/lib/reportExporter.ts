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
  const safetyScore = result.safetyMetrics?.overallSafetyScore  ?? 0
  const CARD_W      = 50
  const CARD_H      = 28
  const CARD_GAP    = 4

  ;[
    { score: compliance,  label: 'ICAO COMPLIANCE', x: M },
    { score: rbScore,     label: 'READBACK SCORE',  x: M + CARD_W + CARD_GAP },
    { score: safetyScore, label: 'SAFETY SCORE',    x: M + (CARD_W + CARD_GAP) * 2 },
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
  // SECTION — CRITICAL ISSUES
  // ════════════════════════════════════════════════════════════════════════════
  const criticals = result.summary?.criticalIssues ?? []
  if (criticals.length > 0) {
    sectionHeader('Critical Issues')
    criticals.forEach(c => bullet(c, RED))
    y += 3
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION — ERROR TABLE
  // Redesigned with proper column proportions and dynamic row heights.
  // No more text overflow — issue text wraps within its column, weight
  // is a coloured pill badge so it never bleeds into adjacent cells.
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

  // ── Final footer ──────────────────────────────────────────────────────────
  addFooter()

  const base = filename ?? `PAEC-report-${slug()}`
  doc.save(`${base}.pdf`)
}

// ── CSV Export ────────────────────────────────────────────────────────────────

export function exportAnalysisToCSV(
  result: AnalysisOutput,
  filename?: string,
): void {
  const esc = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`

  const rows: string[] = []

  rows.push('PAEC Analysis Report — CSV Export')
  rows.push(`Corpus Type,${esc(result.corpusType)}`)
  rows.push(`Date,${esc(today())}`)
  rows.push(`ICAO Compliance,${result.summary.overallCompliance}%`)
  rows.push(`Readback Score,${result.readbackAnalysis?.completenessScore ?? 0}%`)
  rows.push(`Safety Score,${result.safetyMetrics?.overallSafetyScore ?? 0}%`)
  rows.push(`Total Words,${result.totalWords}`)
  rows.push(`Total Exchanges,${result.totalExchanges}`)
  rows.push(`Non-Standard Uses,${result.nonStandardFreq}`)
  rows.push('')

  rows.push(['Line', 'Issue', 'Original Text', 'Suggestion', 'Weight', 'Category', 'Safety Impact', 'Explanation'].map(esc).join(','))

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

  const csv  = rows.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const base = filename ?? `PAEC-report-${slug()}`
  triggerDownload(blob, `${base}.csv`)
}
