// PDF.js types
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

interface ExtractionResult {
  success: boolean
  text: string
  rawText: string
  dialogues: DialogueEntry[]
  metadata: {
    pageCount: number
    extractedLines: number
    wordCount: number
    formatQuality: 'good' | 'fair' | 'poor'
  }
  errors: string[]
}

interface DialogueEntry {
  speaker: 'ATC' | 'PILOT' | 'UNKNOWN'
  message: string
  lineNumber: number
}

// Constants for format detection
const ATC_PATTERNS = [
  /^ATC[:\s]/i,
  /^TOWER[:\s]/i,
  /^GROUND[:\s]/i,
  /^APPROACH[:\s]/i,
  /^DEPARTURE[:\s]/i,
  /^CONTROL[:\s]/i,
  /^RADAR[:\s]/i,
  /^CENTER[:\s]/i,
  /^MANILA\s*(APP|DEP|TWR|GND|CTR)/i,
  /^CEBU\s*(APP|DEP|TWR|GND)/i,
  /^CLARK\s*(APP|DEP|TWR|GND)/i,
  /^DAVAO\s*(APP|DEP|TWR|GND)/i,
]

const PILOT_PATTERNS = [
  /^PILOT[:\s]/i,
  /^P[:\s]/i,
  /^(PAL|CEB|AXN|APG)\d+/i, // Philippine airline callsigns
  /^[A-Z]{2,3}\d{2,4}[:\s]/i, // Generic callsign pattern
  /^RP-C?\d+/i, // Philippine aircraft registration
]

/**
 * Extract text from a PDF file with position-aware formatting
 */
export async function extractTextFromPDF(file: File): Promise<ExtractionResult> {
  const errors: string[] = []

  try {
    // Dynamic import to avoid SSR issues
    const pdfjsLib = await import('pdfjs-dist') as unknown as PDFLib

    // Configure worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    const allLines: ExtractedLine[] = []

    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()

      // Group text items by their y-position to form lines
      const pageLines = groupTextByLines(textContent.items as TextItem[])
      allLines.push(...pageLines)
    }

    // Reconstruct formatted text
    const { formattedText, rawText, quality } = reconstructText(allLines)

    // Parse dialogues
    const dialogues = parseDialogues(formattedText)

    return {
      success: true,
      text: formattedText,
      rawText: rawText,
      dialogues,
      metadata: {
        pageCount: pdf.numPages,
        extractedLines: allLines.length,
        wordCount: rawText.split(/\s+/).filter(w => w.length > 0).length,
        formatQuality: quality,
      },
      errors,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during PDF extraction'
    errors.push(errorMessage)

    return {
      success: false,
      text: '',
      rawText: '',
      dialogues: [],
      metadata: {
        pageCount: 0,
        extractedLines: 0,
        wordCount: 0,
        formatQuality: 'poor',
      },
      errors,
    }
  }
}

/**
 * Group text items by their y-position to form logical lines
 * This handles PDFs with misaligned or scattered text
 */
function groupTextByLines(items: TextItem[]): ExtractedLine[] {
  if (items.length === 0) return []

  // Sort by y-position (descending, as PDF coordinates start from bottom)
  // then by x-position (ascending)
  const sortedItems = [...items].sort((a, b) => {
    const yA = a.transform[5]
    const yB = b.transform[5]
    const yDiff = yB - yA

    // If y-positions are similar (within threshold), sort by x
    if (Math.abs(yDiff) < 5) {
      return a.transform[4] - b.transform[4]
    }
    return yDiff
  })

  const lines: ExtractedLine[] = []
  let currentLine: { texts: string[]; y: number; x: number } | null = null
  const Y_THRESHOLD = 8 // Pixels threshold for same line

  for (const item of sortedItems) {
    if (!item.str.trim()) continue

    const y = item.transform[5]
    const x = item.transform[4]

    if (currentLine === null) {
      currentLine = { texts: [item.str], y, x }
    } else if (Math.abs(y - currentLine.y) < Y_THRESHOLD) {
      // Same line - add text
      currentLine.texts.push(item.str)
    } else {
      // New line
      lines.push({
        text: currentLine.texts.join(' ').trim(),
        y: currentLine.y,
        x: currentLine.x,
      })
      currentLine = { texts: [item.str], y, x }
    }
  }

  // Don't forget the last line
  if (currentLine) {
    lines.push({
      text: currentLine.texts.join(' ').trim(),
      y: currentLine.y,
      x: currentLine.x,
    })
  }

  return lines
}

/**
 * Reconstruct readable text from extracted lines
 * Handles poor formatting by detecting patterns and normalizing
 */
function reconstructText(lines: ExtractedLine[]): {
  formattedText: string
  rawText: string
  quality: 'good' | 'fair' | 'poor'
} {
  if (lines.length === 0) {
    return { formattedText: '', rawText: '', quality: 'poor' }
  }

  const processedLines: string[] = []
  let qualityScore = 0
  let speakerLabelsFound = 0

  for (const line of lines) {
    let text = line.text

    // Normalize common OCR/format issues
    text = normalizeText(text)

    if (!text) continue

    // Check for speaker labels
    if (hasSpeakerLabel(text)) {
      speakerLabelsFound++
    }

    processedLines.push(text)
  }

  // Calculate format quality
  const labelRatio = processedLines.length > 0
    ? speakerLabelsFound / processedLines.length
    : 0

  if (labelRatio > 0.4) {
    qualityScore = 3 // Good - most lines have speaker labels
  } else if (labelRatio > 0.2) {
    qualityScore = 2 // Fair - some speaker labels found
  } else {
    qualityScore = 1 // Poor - few or no speaker labels
  }

  const rawText = processedLines.join('\n')
  const formattedText = formatAsDialogue(processedLines)

  const quality: 'good' | 'fair' | 'poor' =
    qualityScore >= 3 ? 'good' : qualityScore >= 2 ? 'fair' : 'poor'

  return { formattedText, rawText, quality }
}

/**
 * Normalize text to fix common formatting issues
 */
function normalizeText(text: string): string {
  return text
    // Fix multiple spaces
    .replace(/\s+/g, ' ')
    // Fix common OCR issues
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    // Normalize dashes
    .replace(/[—–]/g, '-')
    // Remove invisible characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Fix colon spacing
    .replace(/\s*:\s*/g, ': ')
    // Trim
    .trim()
}

/**
 * Check if a line has a speaker label
 */
function hasSpeakerLabel(text: string): boolean {
  return (
    ATC_PATTERNS.some(p => p.test(text)) ||
    PILOT_PATTERNS.some(p => p.test(text))
  )
}

/**
 * Identify the speaker from a line of text
 */
function identifySpeaker(text: string): 'ATC' | 'PILOT' | 'UNKNOWN' {
  if (ATC_PATTERNS.some(p => p.test(text))) {
    return 'ATC'
  }
  if (PILOT_PATTERNS.some(p => p.test(text))) {
    return 'PILOT'
  }
  return 'UNKNOWN'
}

/**
 * Format lines as proper dialogue
 */
function formatAsDialogue(lines: string[]): string {
  const formattedLines: string[] = []

  for (const line of lines) {
    if (!line) continue

    // If line already has a speaker label, keep it
    if (hasSpeakerLabel(line)) {
      formattedLines.push(line)
    } else {
      // Try to infer speaker from content or just add as-is
      formattedLines.push(line)
    }
  }

  return formattedLines.join('\n')
}

/**
 * Parse the formatted text into structured dialogue entries
 */
function parseDialogues(text: string): DialogueEntry[] {
  const dialogues: DialogueEntry[] = []
  const lines = text.split('\n').filter(l => l.trim())

  let currentSpeaker: 'ATC' | 'PILOT' | 'UNKNOWN' = 'UNKNOWN'
  let currentMessage = ''
  let lineNumber = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    lineNumber++
    const speaker = identifySpeaker(line)

    if (speaker !== 'UNKNOWN') {
      // Save previous dialogue if exists
      if (currentMessage) {
        dialogues.push({
          speaker: currentSpeaker,
          message: currentMessage.trim(),
          lineNumber: lineNumber - 1,
        })
      }

      // Start new dialogue
      currentSpeaker = speaker
      // Remove the speaker label from the message
      currentMessage = line
        .replace(/^(ATC|PILOT|TOWER|GROUND|APPROACH|DEPARTURE|CONTROL|RADAR|CENTER|P)[:\s]*/i, '')
        .replace(/^(MANILA|CEBU|CLARK|DAVAO)\s*(APP|DEP|TWR|GND|CTR)[:\s]*/i, '')
        .replace(/^[A-Z]{2,3}\d{2,4}[:\s]*/i, '')
        .trim()
    } else {
      // Continue previous dialogue or start as unknown
      if (currentMessage) {
        currentMessage += ' ' + line
      } else {
        currentMessage = line
        currentSpeaker = 'UNKNOWN'
      }
    }
  }

  // Don't forget the last dialogue
  if (currentMessage) {
    dialogues.push({
      speaker: currentSpeaker,
      message: currentMessage.trim(),
      lineNumber,
    })
  }

  return dialogues
}

/**
 * Validate if the extracted text looks like ATC dialogue
 */
export function validateATCDialogue(text: string): {
  isValid: boolean
  confidence: number
  issues: string[]
} {
  const issues: string[] = []
  let score = 0

  const lines = text.split('\n').filter(l => l.trim())

  if (lines.length === 0) {
    return { isValid: false, confidence: 0, issues: ['No text content found'] }
  }

  // Check for speaker labels
  const linesWithSpeakers = lines.filter(l => hasSpeakerLabel(l))
  const speakerRatio = linesWithSpeakers.length / lines.length

  if (speakerRatio > 0.5) {
    score += 40
  } else if (speakerRatio > 0.2) {
    score += 20
    issues.push('Some lines are missing speaker labels')
  } else {
    issues.push('Most lines are missing speaker labels (ATC/Pilot)')
  }

  // Check for aviation keywords
  const aviationKeywords = [
    /flight\s*level/i,
    /altitude/i,
    /heading/i,
    /cleared/i,
    /runway/i,
    /descend/i,
    /climb/i,
    /maintain/i,
    /squawk/i,
    /contact/i,
    /roger/i,
    /wilco/i,
    /affirm/i,
    /negative/i,
  ]

  const textLower = text.toLowerCase()
  const keywordsFound = aviationKeywords.filter(kw => kw.test(textLower)).length

  if (keywordsFound >= 5) {
    score += 40
  } else if (keywordsFound >= 2) {
    score += 20
  } else {
    issues.push('Few aviation-specific terms detected')
  }

  // Check for callsigns
  const callsignPattern = /\b(PAL|CEB|AXN|APG|RP-?C?)\s*\d+/i
  if (callsignPattern.test(text)) {
    score += 20
  } else {
    issues.push('No Philippine callsigns detected (PAL, CEB, etc.)')
  }

  return {
    isValid: score >= 40,
    confidence: Math.min(score, 100),
    issues,
  }
}
