'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import {
  BarChart3,
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  Info,
  TrendingUp,
  PieChart,
  Activity,
  Loader2,
  X,
  Download,
  FileUp,
  AlertCircle,
  FileWarning,
  ClipboardPaste,
  Eye,
  ChevronDown,
  ChevronUp,
  Shield,
  Radio,
  Target,
  Zap,
  MessageSquare,
  Maximize2,
  Minimize2,
  ArrowRight,
  BookOpen,
} from 'lucide-react'
import { extractTextFromPDF, validateATCDialogue } from '@/lib/pdfExtractor'
import { extractTextFromDOCX } from '@/lib/docxExtractor'
import { exportAnalysisToPDF, exportAnalysisToCSV } from '@/lib/reportExporter'
import { analyzeDialogue, parseLines, type AnalysisOutput, type PhraseologyError, type ParsedLine } from '@/lib/analysisEngine'
import { analyzeDepartureApproach, type DepartureApproachMLResult, type FlightPhase } from '@/lib/departureApproachAnalyzer'
import { analyzeGround, type GroundMLResult, type GroundPhase } from '@/lib/groundAnalyzer'
import { analyzeWithPhaseContext } from '@/lib/semanticReadbackAnalyzer'

type CorpusType = 'APP/DEP' | 'GND' | 'RAMP' | null
type UploadMethod = 'text' | 'pdf' | 'docx' | null

interface ExtractedPDFData {
  text: string
  metadata: {
    pageCount: number
    extractedLines: number
    wordCount: number
    formatQuality: 'good' | 'fair' | 'poor'
  }
  validation: {
    isValid: boolean
    confidence: number
    issues: string[]
  }
}

export default function AnalysisPage() {
  const [selectedCorpus, setSelectedCorpus] = useState<CorpusType>(null)
  const [uploadMethod, setUploadMethod] = useState<UploadMethod>(null)
  const [uploadedText, setUploadedText] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisOutput | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [pdfData, setPdfData] = useState<ExtractedPDFData | null>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [showDetailedErrors, setShowDetailedErrors] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [selectedErrorIndex, setSelectedErrorIndex] = useState<number | null>(null)
  const [showFullTranscript, setShowFullTranscript] = useState(false)
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set())
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [mlAnalysisResults, setMlAnalysisResults] = useState<{
    exchanges: DepartureApproachMLResult[]
    summary: {
      totalExchanges: number
      departureCount: number
      approachCount: number
      averageCompleteness: number
      criticalErrors: number
      phaseBreakdown: Record<FlightPhase, number>
    }
  } | null>(null)

  const [groundAnalysisResults, setGroundAnalysisResults] = useState<{
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
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Close export dropdown when clicking outside
  const handleClickOutside = useCallback(() => setShowExportMenu(false), [])

  const corpusCategories = [
    {
      id: 'APP/DEP',
      name: 'Approach/Departure Control',
      shortName: 'APP/DEP',
      description: 'Communications between pilots and approach/departure control during climb-out and descent phases.',
      color: 'from-blue-500 to-indigo-500',
      bgColor: 'bg-blue-50',
      stats: { dialogues: 1250, words: 45000 },
    },
    {
      id: 'GND',
      name: 'Ground Control',
      shortName: 'GND',
      description: 'Ground movement communications including taxi instructions and runway crossings.',
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'bg-emerald-50',
      stats: { dialogues: 980, words: 32000 },
    },
    {
      id: 'RAMP',
      name: 'Ramp Control',
      shortName: 'RAMP',
      description: 'Ramp and apron communications for aircraft parking and push-back operations.',
      color: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-50',
      stats: { dialogues: 720, words: 24000 },
    },
  ]

  const handleFileSelect = useCallback(async (file: File) => {
    const isPDF  = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const isDOCX = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                   || file.name.toLowerCase().endsWith('.docx')

    if (!isPDF && !isDOCX) {
      setPdfError('Please upload a PDF or DOCX file')
      return
    }

    if (file.size > 20 * 1024 * 1024) {
      setPdfError('File size must be less than 20 MB')
      return
    }

    setIsExtracting(true)
    setPdfError(null)
    setPdfData(null)

    try {
      // Route to the right extractor based on file type
      const result = isPDF
        ? await extractTextFromPDF(file)
        : await extractTextFromDOCX(file)

      if (!result.success) {
        setPdfError(result.errors.join(', ') || `Failed to extract text from ${isPDF ? 'PDF' : 'DOCX'}`)
        setIsExtracting(false)
        return
      }

      const validation = validateATCDialogue(result.text)

      setPdfData({
        text: result.text,
        metadata: result.metadata,
        validation,
      })

      setUploadedText(result.text)
      setUploadMethod(isPDF ? 'pdf' : 'docx')
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'Failed to process file')
    } finally {
      setIsExtracting(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleAnalyze = async () => {
    if (!selectedCorpus || !uploadedText.trim()) return

    setIsAnalyzing(true)
    setAnalysisError(null)
    setShowUploadModal(false)

    // Brief delay for UX
    await new Promise((resolve) => setTimeout(resolve, 500))

    try {
      const result = analyzeDialogue({
        text: uploadedText,
        corpusType: selectedCorpus,
      })

      // Enhanced analysis for APP/DEP corpus
      if (selectedCorpus === 'APP/DEP') {
        const parsedLines = parseLines(uploadedText)
        const exchanges: DepartureApproachMLResult[] = []
        const phaseBreakdown: Record<FlightPhase, number> = {} as Record<FlightPhase, number>
        let totalCompleteness = 0
        let criticalErrors = 0
        let departureCount = 0
        let approachCount = 0

        // Pair ATC instructions with pilot readbacks
        for (let i = 0; i < parsedLines.length - 1; i++) {
          const current = parsedLines[i]
          const next = parsedLines[i + 1]

          // Look for ATC-Pilot pairs
          if (current.speaker === 'ATC' && next.speaker === 'PILOT') {
            const exchangeResult = analyzeDepartureApproach(
              current.text,
              next.text,
              undefined, // callsign extracted automatically
              exchanges.slice(-3).map(e => ({
                type: e.errors[0]?.type || 'unknown',
                weight: e.contextualWeight,
                timestamp: Date.now()
              }))
            )

            exchanges.push(exchangeResult)

            // Track phase
            phaseBreakdown[exchangeResult.phase] = (phaseBreakdown[exchangeResult.phase] || 0) + 1

            // Track completeness
            totalCompleteness += exchangeResult.multiPartAnalysis.readbackCompleteness

            // Track critical errors
            if (exchangeResult.contextualWeight === 'critical') {
              criticalErrors++
            }

            // Track departure vs approach
            if (['initial_departure', 'departure_climb', 'takeoff_roll', 'lineup', 'taxi'].includes(exchangeResult.phase)) {
              departureCount++
            } else if (['approach', 'final_approach', 'go_around', 'descent', 'arrival'].includes(exchangeResult.phase)) {
              approachCount++
            }

            i++ // Skip the pilot readback since we've processed it
          }
        }

        setMlAnalysisResults({
          exchanges,
          summary: {
            totalExchanges: exchanges.length,
            departureCount,
            approachCount,
            averageCompleteness: exchanges.length > 0 ? Math.round(totalCompleteness / exchanges.length) : 100,
            criticalErrors,
            phaseBreakdown,
          },
        })
        setGroundAnalysisResults(null)
      } else if (selectedCorpus === 'GND') {
        const parsedLines = parseLines(uploadedText)
        const exchanges: GroundMLResult[] = []
        const phaseBreakdown: Record<GroundPhase, number> = {} as Record<GroundPhase, number>
        let totalCompleteness = 0
        let criticalErrors = 0
        let taxiCount = 0
        let holdingCount = 0
        let crossingCount = 0

        for (let i = 0; i < parsedLines.length - 1; i++) {
          const current = parsedLines[i]
          const next = parsedLines[i + 1]

          if (current.speaker === 'ATC' && next.speaker === 'PILOT') {
            const exchangeResult = analyzeGround(
              current.text,
              next.text,
              undefined,
              exchanges.slice(-3).map(e => ({
                type: e.errors[0]?.type || 'unknown',
                weight: e.contextualWeight,
                timestamp: Date.now(),
              }))
            )

            exchanges.push(exchangeResult)
            phaseBreakdown[exchangeResult.phase] = (phaseBreakdown[exchangeResult.phase] || 0) + 1
            totalCompleteness += exchangeResult.multiPartAnalysis.readbackCompleteness
            if (exchangeResult.contextualWeight === 'critical') criticalErrors++
            if (['taxi', 'ground', 'pushback'].includes(exchangeResult.phase)) taxiCount++
            if (exchangeResult.phase === 'holding') holdingCount++
            if (exchangeResult.phase === 'crossing') crossingCount++
            i++
          }
        }

        setGroundAnalysisResults({
          exchanges,
          summary: {
            totalExchanges: exchanges.length,
            taxiCount,
            holdingCount,
            crossingCount,
            averageCompleteness: exchanges.length > 0
              ? Math.round(totalCompleteness / exchanges.length)
              : 100,
            criticalErrors,
            phaseBreakdown,
          },
        })
        setMlAnalysisResults(null)
      } else {
        setMlAnalysisResults(null)
        setGroundAnalysisResults(null)
      }

      setAnalysisResult(result)
    } catch (err) {
      console.error('Analysis failed:', err)
      setAnalysisError(
        err instanceof Error
          ? `Analysis failed: ${err.message}`
          : 'An unexpected error occurred during analysis. Please check your input and try again.'
      )
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'text-green-600 bg-green-100'
      case 'medium':
        return 'text-amber-600 bg-amber-100'
      case 'high':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'good':
        return 'text-green-600 bg-green-100'
      case 'fair':
        return 'text-amber-600 bg-amber-100'
      case 'poor':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const resetAnalysis = () => {
    setAnalysisResult(null)
    setUploadedText('')
    setPdfData(null)
    setPdfError(null)
    setAnalysisError(null)
    setUploadMethod(null)
    setSelectedErrorIndex(null)
    setShowFullTranscript(false)
    setExpandedLines(new Set())
    setMlAnalysisResults(null)
    setGroundAnalysisResults(null)
  }

  // Build annotated transcript with error highlighting
  const annotatedLines = useMemo(() => {
    if (!uploadedText || !analysisResult) return []

    // Use the smart parser instead of simple split
    const parsedLines = parseLines(uploadedText)
    const errorsByLine = new Map<number, PhraseologyError[]>()

    // Group errors by line number
    analysisResult.phraseologyErrors.forEach(error => {
      const existing = errorsByLine.get(error.line) || []
      existing.push(error)
      errorsByLine.set(error.line, existing)
    })

    return parsedLines.map((parsed) => {
      const errors = errorsByLine.get(parsed.lineNumber) || []

      return {
        lineNum: parsed.lineNumber,
        text: parsed.text,
        speaker: parsed.speaker,
        conversationGroup: parsed.conversationGroup ?? 0,
        errors,
        hasErrors: errors.length > 0,
        highestWeight: errors.reduce((max, e) => {
          const weightOrder = { high: 3, medium: 2, low: 1 }
          return weightOrder[e.weight as keyof typeof weightOrder] > weightOrder[max as keyof typeof weightOrder] ? e.weight : max
        }, 'low' as string)
      }
    })
  }, [uploadedText, analysisResult])

  const getErrorStyles = (weight: string) => {
    if (weight !== 'none') {
      return {
        bg: 'bg-amber-50 hover:bg-amber-100',
        border: 'border-l-amber-400',
        highlight: 'bg-amber-100',
        text: 'text-amber-800'
      }
    }
    return {
      bg: 'bg-white hover:bg-gray-50',
      border: 'border-l-gray-200',
      highlight: 'bg-gray-100',
      text: 'text-gray-700'
    }
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Analysis Mode
        </h1>
        <p className="text-gray-600">
          Analyze aviation communication patterns from the Philippine Aeronautical English Corpus.
        </p>
      </div>

      {/* Corpus Selection */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Corpus Category</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {corpusCategories.map((corpus) => (
            <button
              key={corpus.id}
              onClick={() => {
                setSelectedCorpus(corpus.id as CorpusType)
                if (analysisResult) resetAnalysis()
              }}
              className={`card p-6 text-left transition-all ${
                selectedCorpus === corpus.id
                  ? 'ring-2 ring-primary-500 border-primary-200'
                  : 'hover:border-gray-300'
              }`}
            >
              <div className={`w-12 h-12 bg-gradient-to-br ${corpus.color} rounded-xl flex items-center justify-center mb-4`}>
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{corpus.name}</h3>
              <p className="text-sm text-gray-500 mb-4">{corpus.description}</p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{corpus.stats.dialogues.toLocaleString()} dialogues</span>
                <span>{corpus.stats.words.toLocaleString()} words</span>
              </div>
              {selectedCorpus === corpus.id && (
                <div className="mt-4 flex items-center gap-2 text-sm text-primary-600">
                  <CheckCircle className="w-4 h-4" />
                  Selected
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Upload Section */}
      {selectedCorpus && !analysisResult && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Dialogue Data</h2>

          {/* Upload Method Selection */}
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => {
                setUploadMethod('pdf')
                setShowUploadModal(true)
              }}
              className={`p-6 border-2 border-dashed rounded-xl text-center transition-all ${
                uploadMethod === 'pdf'
                  ? 'border-primary-400 bg-primary-50'
                  : 'border-gray-300 hover:border-primary-300 hover:bg-gray-50'
              }`}
            >
              <FileUp className="w-10 h-10 text-primary-500 mx-auto mb-3" />
              <h3 className="font-medium text-gray-900 mb-1">Upload PDF or DOCX</h3>
              <p className="text-sm text-gray-500">
                Upload a PDF or Word document with ATC-Pilot dialogues
              </p>
              <span className="inline-block mt-3 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                Recommended
              </span>
            </button>

            <button
              onClick={() => {
                setUploadMethod('text')
                setShowUploadModal(true)
              }}
              className={`p-6 border-2 border-dashed rounded-xl text-center transition-all ${
                uploadMethod === 'text'
                  ? 'border-primary-400 bg-primary-50'
                  : 'border-gray-300 hover:border-primary-300 hover:bg-gray-50'
              }`}
            >
              <ClipboardPaste className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <h3 className="font-medium text-gray-900 mb-1">Paste Text</h3>
              <p className="text-sm text-gray-500">
                Paste dialogue text directly into the editor
              </p>
            </button>
          </div>

          {/* Show preview if data is loaded */}
          {uploadedText && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="font-medium text-gray-900">Data Loaded</span>
                  {pdfData && (
                    <span className={`text-xs px-2 py-1 rounded-full ${getQualityColor(pdfData.metadata.formatQuality)}`}>
                      {pdfData.metadata.formatQuality} quality
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setUploadedText('')
                    setPdfData(null)
                    setUploadMethod(null)
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              </div>

              {pdfData && (
                <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                  <div className="text-center p-3 bg-white rounded-lg border border-gray-100">
                    <div className="text-2xl font-bold text-gray-900">{pdfData.metadata.pageCount}</div>
                    <div className="text-gray-500">Pages</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border border-gray-100">
                    <div className="text-2xl font-bold text-gray-900">{pdfData.metadata.wordCount}</div>
                    <div className="text-gray-500">Words</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border border-gray-100">
                    <div className="text-2xl font-bold text-gray-900">{pdfData.metadata.extractedLines}</div>
                    <div className="text-gray-500">Lines</div>
                  </div>
                </div>
              )}

              {pdfData?.validation && !pdfData.validation.isValid && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800">Format Issues Detected</p>
                      <ul className="text-sm text-amber-700 mt-1 space-y-1">
                        {pdfData.validation.issues.map((issue, i) => (
                          <li key={i}>- {issue}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="max-h-32 overflow-y-auto text-sm text-gray-600 font-mono bg-white p-3 rounded-lg border border-gray-100">
                {uploadedText.slice(0, 500)}
                {uploadedText.length > 500 && '...'}
              </div>

              <button
                onClick={handleAnalyze}
                disabled={!uploadedText.trim()}
                className="btn-primary w-full mt-4 disabled:opacity-50"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Analyze Dialogue
              </button>
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-2xl shadow-elevated max-w-2xl w-full max-h-[90vh] overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                {uploadMethod === 'text' ? 'Paste Dialogue Text' : 'Upload PDF / DOCX'} — {selectedCorpus}
              </h3>
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  setPdfError(null)
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6">
              {uploadMethod === 'pdf' ? (
                <>
                  {/* PDF Upload Area */}
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                      isDragging
                        ? 'border-primary-500 bg-primary-50'
                        : pdfData
                        ? 'border-green-400 bg-green-50'
                        : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50/50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFileSelect(file)
                      }}
                      className="hidden"
                    />

                    {isExtracting ? (
                      <>
                        <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
                        <p className="text-gray-600 font-medium">Extracting text from PDF...</p>
                        <p className="text-sm text-gray-500 mt-2">
                          Processing and normalizing document format
                        </p>
                      </>
                    ) : pdfData ? (
                      <>
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                        <p className="text-green-600 font-medium">PDF Processed Successfully</p>
                        <p className="text-sm text-gray-500 mt-2">
                          Extracted {pdfData.metadata.wordCount} words from {pdfData.metadata.pageCount} page(s)
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Click to upload a different file
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-2">
                          Drag and drop a PDF or DOCX file here, or click to browse
                        </p>
                        <p className="text-sm text-gray-500">
                          Supports PDF and Word (.docx) documents — up to 20 MB
                        </p>
                      </>
                    )}
                  </div>

                  {pdfError && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-red-800">Error Processing PDF</p>
                        <p className="text-sm text-red-600 mt-1">{pdfError}</p>
                      </div>
                    </div>
                  )}

                  {pdfData && (
                    <>
                      {/* Validation Status */}
                      <div className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
                        pdfData.validation.isValid
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-amber-50 border border-amber-200'
                      }`}>
                        {pdfData.validation.isValid ? (
                          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        ) : (
                          <FileWarning className="w-5 h-5 text-amber-500 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className={`font-medium ${pdfData.validation.isValid ? 'text-green-800' : 'text-amber-800'}`}>
                              {pdfData.validation.isValid
                                ? 'Valid ATC Dialogue Detected'
                                : 'Document Format May Need Review'}
                            </p>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              pdfData.validation.confidence >= 70
                                ? 'bg-green-100 text-green-700'
                                : pdfData.validation.confidence >= 40
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {pdfData.validation.confidence}% confidence
                            </span>
                          </div>
                          {pdfData.validation.issues.length > 0 && (
                            <ul className="text-sm text-amber-700 mt-2 space-y-1">
                              {pdfData.validation.issues.map((issue, i) => (
                                <li key={i} className="flex items-start gap-1">
                                  <span className="text-amber-400">-</span> {issue}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>

                      {/* Preview */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Extracted Text Preview</span>
                          <button
                            onClick={() => setShowUploadModal(false)}
                            className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            Preview Full Text
                          </button>
                        </div>
                        <div className="max-h-40 overflow-y-auto text-sm text-gray-600 font-mono bg-gray-50 p-3 rounded-lg border border-gray-200">
                          {pdfData.text.slice(0, 800)}
                          {pdfData.text.length > 800 && '...'}
                        </div>
                      </div>
                    </>
                  )}

                  <p className="text-sm text-gray-500 mt-4 flex items-start gap-2">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      The system will automatically extract and normalize text from your PDF, handling various formats and layouts.
                      For best results, use documents with clear ATC/Pilot speaker labels.
                    </span>
                  </p>
                </>
              ) : (
                <>
                  {/* Text Input */}
                  <textarea
                    value={uploadedText}
                    onChange={(e) => setUploadedText(e.target.value)}
                    placeholder="Paste your ATC-pilot dialogue text here...

Example:
ATC: PAL456, descend and maintain flight level 250.
Pilot: Descend maintain flight level 250, PAL456.
ATC: PAL456, turn left heading 180.
Pilot: Left heading 180, PAL456."
                    className="input-field min-h-[300px] resize-none font-mono text-sm"
                  />
                  <p className="text-sm text-gray-500 mt-2 flex items-start gap-2">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      Format: Label each line with speaker (ATC/Pilot) followed by the message.
                      You can also use controller positions (TOWER, APPROACH, GROUND) or airline callsigns (PAL, CEB).
                    </span>
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  setPdfError(null)
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleAnalyze}
                disabled={!uploadedText.trim() || isExtracting}
                className="btn-primary disabled:opacity-50"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Analyze Dialogue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isAnalyzing && (
        <div className="card p-12 text-center">
          <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Analyzing Dialogue...</h3>
          <p className="text-gray-500">Processing phraseology patterns and detecting errors</p>
        </div>
      )}

      {/* Analysis Error */}
      {analysisError && !isAnalyzing && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-red-800">Analysis Error</p>
            <p className="text-sm text-red-600 mt-1">{analysisError}</p>
          </div>
          <button
            onClick={() => setAnalysisError(null)}
            className="text-red-400 hover:text-red-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Analysis Results */}
      {analysisResult && (
        <div className="space-y-6">
          {/* Results Header */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Analysis Results</h2>
                  <p className="text-sm text-gray-500">{analysisResult.corpusType} Corpus</p>
                </div>
              </div>
              <div className="flex gap-2 relative">
                <button onClick={resetAnalysis} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                  New Analysis
                </button>
                {/* Export dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(m => !m)}
                    disabled={isExporting}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2"
                  >
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Export
                    <ChevronDown className="w-3 h-3 ml-0.5" />
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                      <button
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 transition-colors"
                        onClick={async () => {
                          setShowExportMenu(false)
                          setIsExporting(true)
                          try { await exportAnalysisToPDF(analysisResult) }
                          finally { setIsExporting(false) }
                        }}
                      >
                        <FileText className="w-4 h-4 text-red-500" />
                        Export as PDF
                      </button>
                      <button
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 transition-colors border-t border-gray-100"
                        onClick={() => {
                          setShowExportMenu(false)
                          exportAnalysisToCSV(analysisResult)
                        }}
                      >
                        <BarChart3 className="w-4 h-4 text-green-500" />
                        Export as CSV
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Score ring + key stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* ICAO Compliance — big circle */}
              <div className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center py-2">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                    <circle cx="50" cy="50" r="42" fill="none"
                      stroke={analysisResult.summary.overallCompliance >= 80 ? '#22c55e' : analysisResult.summary.overallCompliance >= 60 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${analysisResult.summary.overallCompliance * 2.64} 264`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-2xl font-bold ${
                      analysisResult.summary.overallCompliance >= 80 ? 'text-green-600' :
                      analysisResult.summary.overallCompliance >= 60 ? 'text-amber-600' : 'text-red-600'
                    }`}>{analysisResult.summary.overallCompliance}%</span>
                  </div>
                </div>
                <span className="text-xs text-gray-500 mt-1 font-medium">ICAO Score</span>
              </div>

              {/* Stat cards */}
              <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
                <div className="text-2xl font-bold text-gray-900">{analysisResult.totalWords.toLocaleString()}</div>
                <div className="text-xs text-gray-500 font-medium">Words</div>
              </div>
              <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
                <div className="text-2xl font-bold text-gray-900">{analysisResult.totalExchanges}</div>
                <div className="text-xs text-gray-500 font-medium">Exchanges</div>
              </div>
              <div className="rounded-xl bg-amber-50 p-4 border border-amber-100">
                <div className="text-2xl font-bold text-amber-700">{analysisResult.nonStandardFreq}</div>
                <div className="text-xs text-amber-600 font-medium">Non-std / 1k</div>
              </div>
            </div>
          </div>

          {/* Readback + Error Breakdown side-by-side */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Readback Analysis */}
            {analysisResult.readbackAnalysis && (
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <Radio className="w-4 h-4 text-indigo-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm">Readback Analysis</h3>
                  </div>
                  <span className={`text-lg font-bold ${
                    analysisResult.readbackAnalysis.completenessScore >= 80 ? 'text-green-600' :
                    analysisResult.readbackAnalysis.completenessScore >= 60 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {analysisResult.readbackAnalysis.completenessScore}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
                  <div className={`h-full rounded-full transition-all duration-700 ${
                    analysisResult.readbackAnalysis.completenessScore >= 80 ? 'bg-green-500' :
                    analysisResult.readbackAnalysis.completenessScore >= 60 ? 'bg-amber-500' : 'bg-red-500'
                  }`} style={{ width: `${analysisResult.readbackAnalysis.completenessScore}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="py-2 rounded-lg bg-gray-50">
                    <div className="text-lg font-bold text-gray-900">{analysisResult.readbackAnalysis.totalInstructions}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">Total</div>
                  </div>
                  <div className="py-2 rounded-lg bg-green-50">
                    <div className="text-lg font-bold text-green-600">{analysisResult.readbackAnalysis.completeReadbacks}</div>
                    <div className="text-[10px] text-green-600 uppercase tracking-wide">Complete</div>
                  </div>
                  <div className="py-2 rounded-lg bg-red-50">
                    <div className="text-lg font-bold text-red-600">{analysisResult.readbackAnalysis.incompleteReadbacks}</div>
                    <div className="text-[10px] text-red-600 uppercase tracking-wide">Incomplete</div>
                  </div>
                </div>
              </div>
            )}

            {/* Error Breakdown by Category */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-violet-600" />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">Error Breakdown</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { cat: 'language',  bg: 'bg-blue-50',  text: 'text-blue-600',  bar: 'bg-blue-400'  },
                  { cat: 'number',    bg: 'bg-amber-50', text: 'text-amber-600', bar: 'bg-amber-400' },
                  { cat: 'procedure', bg: 'bg-green-50', text: 'text-green-600', bar: 'bg-green-400' },
                  { cat: 'structure', bg: 'bg-slate-50', text: 'text-slate-600', bar: 'bg-slate-400' },
                ] as const).map(({ cat, bg, text, bar }) => {
                  const count = analysisResult.phraseologyErrors.filter(e => e.category === cat).length
                  const total = analysisResult.phraseologyErrors.length
                  const pct   = total > 0 ? Math.round(count / total * 100) : 0
                  return (
                    <div key={cat} className={`p-3 rounded-lg ${bg}`}>
                      <div className={`text-xl font-bold ${text}`}>{count}</div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">{cat}</div>
                      <div className="h-1 bg-white/70 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-[11px] text-gray-400 mt-3 text-right">
                {analysisResult.phraseologyErrors.length} total errors
              </p>
            </div>
          </div>

          {/* Annotated Transcript — main panel */}
          {annotatedLines.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
              {/* Transcript header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Annotated Transcript</h3>
                    <p className="text-xs text-gray-500">
                      {annotatedLines.filter(l => l.hasErrors).length} issues found
                      {(() => {
                        const gc = new Set(annotatedLines.map(l => l.conversationGroup)).size
                        return gc > 1 ? ` across ${gc} conversations` : ''
                      })()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-3 mr-3 text-[10px] font-medium">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>High</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>Med</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>Low</span>
                  </div>
                  {annotatedLines.filter(l => l.hasErrors).length > 0 && (
                    <button
                      onClick={() => {
                        const linesWithErrors = annotatedLines.filter(l => l.hasErrors)
                        setExpandedLines(expandedLines.size === linesWithErrors.length ? new Set() : new Set(linesWithErrors.map(l => l.lineNum)))
                      }}
                      className="px-2.5 py-1 text-[11px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                    >
                      {expandedLines.size > 0 ? 'Collapse All' : 'Expand All'}
                    </button>
                  )}
                  <button
                    onClick={() => setShowFullTranscript(!showFullTranscript)}
                    className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    {showFullTranscript ? <Minimize2 className="w-4 h-4 text-gray-400" /> : <Maximize2 className="w-4 h-4 text-gray-400" />}
                  </button>
                </div>
              </div>

              {/* Transcript body */}
              <div className={`overflow-y-auto transition-all duration-300 ${showFullTranscript ? 'max-h-[700px]' : 'max-h-96'}`}>
                {annotatedLines.map((line, idx) => {
                  const styles = line.hasErrors ? getErrorStyles(line.highestWeight) : getErrorStyles('none')
                  const isExpanded = expandedLines.has(line.lineNum)
                  const prevGroup = idx > 0 ? annotatedLines[idx - 1].conversationGroup : line.conversationGroup
                  const isNewConversation = idx > 0 && line.conversationGroup !== prevGroup
                  const totalGroups = new Set(annotatedLines.map(l => l.conversationGroup)).size

                  const toggleExpand = () => {
                    const newExpanded = new Set(expandedLines)
                    if (isExpanded) newExpanded.delete(line.lineNum)
                    else newExpanded.add(line.lineNum)
                    setExpandedLines(newExpanded)
                  }

                  return (
                    <div key={idx}>
                      {/* Conversation divider */}
                      {isNewConversation && totalGroups > 1 && (
                        <div className="flex items-center gap-3 px-5 py-2.5 bg-slate-50/80">
                          <div className="flex-1 h-px bg-slate-200"></div>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                            Conversation {line.conversationGroup + 1}
                          </span>
                          <div className="flex-1 h-px bg-slate-200"></div>
                        </div>
                      )}
                      <div className={`border-b border-gray-50 transition-colors ${line.hasErrors ? styles.bg : 'hover:bg-gray-50/50'} ${line.hasErrors ? `border-l-[3px] ${styles.border}` : 'border-l-[3px] border-l-transparent'}`}>
                        <div
                          className={`flex items-start gap-2.5 px-4 py-2.5 ${line.hasErrors ? 'cursor-pointer' : ''}`}
                          onClick={line.hasErrors ? toggleExpand : undefined}
                        >
                          <span className="flex-shrink-0 w-7 text-[10px] text-gray-400 font-mono text-right pt-1">{line.lineNum}</span>

                          {line.speaker && line.speaker !== 'UNKNOWN' && (
                            <span className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded ${
                              line.speaker === 'ATC' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {line.speaker === 'PILOT' ? 'PLT' : 'ATC'}
                            </span>
                          )}

                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] leading-relaxed ${line.hasErrors ? styles.text : 'text-gray-700'} font-mono break-words`}>
                              {line.hasErrors ? (
                                (() => {
                                  const highlights: { phrase: string }[] = []
                                  line.errors.forEach(err => { if (err.incorrectPhrase) highlights.push({ phrase: err.incorrectPhrase }) })
                                  if (highlights.length === 0) return line.text
                                  const escapedPhrases = highlights.map(h => h.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                                  const regex = new RegExp(`(\\b(?:${escapedPhrases.join('|')})\\b)`, 'gi')
                                  const parts = line.text.split(regex)
                                  return parts.map((part, i) => {
                                    const matched = highlights.find(h => h.phrase.toLowerCase() === part.toLowerCase())
                                    if (matched) {
                                      return <span key={i} className="bg-amber-400 text-white px-1 py-0.5 rounded text-[12px] font-bold">{part}</span>
                                    }
                                    return part
                                  })
                                })()
                              ) : line.text}
                            </p>
                          </div>

                          {line.hasErrors && (
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700">
                                {line.errors.length}
                              </span>
                              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          )}
                        </div>

                        {/* Error details */}
                        {line.hasErrors && isExpanded && (
                          <div className="px-4 pb-3 pl-[4.5rem]">
                            <div className="space-y-2">
                              {line.errors.map((error, errIdx) => (
                                <div key={errIdx} className="rounded-lg overflow-hidden border border-amber-200">
                                  <div className="px-3 py-1.5 flex items-center justify-between bg-amber-50">
                                    <div className="flex items-center gap-2">
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                      <span className="text-[11px] font-bold uppercase text-amber-700">
                                        {error.category}
                                      </span>
                                    </div>
                                    {error.icaoReference && (
                                      <span className="text-[10px] text-gray-400">{error.icaoReference.split(' ').slice(0, 3).join(' ')}</span>
                                    )}
                                  </div>
                                  <div className="p-3 bg-white space-y-2">
                                    <p className="text-sm font-medium text-gray-900">{error.issue}</p>
                                    {error.incorrectPhrase && (
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="p-2 bg-red-50 rounded border border-red-100">
                                          <span className="block text-red-500 font-medium text-[10px] mb-0.5">YOU SAID</span>
                                          <span className="font-mono text-red-800">{error.incorrectPhrase}</span>
                                        </div>
                                        <div className="p-2 bg-green-50 rounded border border-green-100">
                                          <span className="block text-green-500 font-medium text-[10px] mb-0.5">SAY INSTEAD</span>
                                          <span className="font-mono text-green-800">{error.suggestion.replace('Use "', '').replace('" instead', '').split('"')[0]}</span>
                                        </div>
                                      </div>
                                    )}
                                    {error.correctExample && (
                                      <div className="p-2 bg-emerald-50 rounded border border-emerald-100">
                                        <span className="text-[10px] text-emerald-600 font-medium block mb-0.5">CORRECTED TRANSMISSION</span>
                                        <p className="text-xs font-mono text-emerald-900">{error.correctExample}</p>
                                      </div>
                                    )}
                                    {error.explanation && (
                                      <p className="text-[11px] text-gray-500"><BookOpen className="w-3 h-3 inline mr-1" />{error.explanation}</p>
                                    )}
                                    {error.whyItMatters && (
                                      <p className="text-[11px] p-1.5 rounded bg-amber-50 text-amber-700"><strong>Why it matters:</strong> {error.whyItMatters}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Transcript footer */}
              <div className="flex items-center justify-between px-5 py-2.5 border-t border-gray-100 bg-gray-50/50 text-[11px] text-gray-500">
                <span>
                  {annotatedLines.length} lines
                  {(() => {
                    const gc = new Set(annotatedLines.map(l => l.conversationGroup)).size
                    return gc > 1 ? ` / ${gc} conversations` : ''
                  })()}
                </span>
                <span className="text-amber-600 font-medium">{annotatedLines.filter(l => l.hasErrors).length} lines with errors</span>
              </div>
            </div>
          )}

          {/* ML Analysis — compact, no separate section feel */}
          {mlAnalysisResults && mlAnalysisResults.exchanges.length > 0 && (
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 overflow-hidden">
              <div className="px-5 py-4 border-b border-indigo-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Exchange Analysis</h3>
                    <p className="text-[11px] text-gray-500">{mlAnalysisResults.summary.totalExchanges} exchanges analyzed</p>
                  </div>
                </div>
                <span className={`text-lg font-bold ${
                  mlAnalysisResults.summary.averageCompleteness >= 80 ? 'text-green-600' :
                  mlAnalysisResults.summary.averageCompleteness >= 60 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {mlAnalysisResults.summary.averageCompleteness}%
                </span>
              </div>

              {/* Compact stat row */}
              <div className="grid grid-cols-4 divide-x divide-indigo-100 border-b border-indigo-100 bg-white/50">
                {[
                  { value: mlAnalysisResults.summary.totalExchanges, label: 'Total', color: 'text-indigo-600' },
                  { value: mlAnalysisResults.summary.departureCount, label: 'Departure', color: 'text-blue-600' },
                  { value: mlAnalysisResults.summary.approachCount, label: 'Approach', color: 'text-purple-600' },
                  { value: mlAnalysisResults.summary.criticalErrors, label: 'Critical', color: 'text-red-600' },
                ].map((s) => (
                  <div key={s.label} className="text-center py-3">
                    <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Phase chips */}
              <div className="px-5 py-3 border-b border-indigo-100 bg-white/30">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(mlAnalysisResults.summary.phaseBreakdown)
                    .filter(([, count]) => count > 0)
                    .sort(([, a], [, b]) => b - a)
                    .map(([phase, count]) => (
                      <span key={phase} className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        ['initial_departure', 'departure_climb', 'takeoff_roll'].includes(phase)
                          ? 'bg-blue-100 text-blue-700' : ['approach', 'final_approach', 'go_around'].includes(phase)
                          ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                      }`}>{phase.replace(/_/g, ' ')} ({count})</span>
                    ))}
                </div>
              </div>

              {/* Exchange list */}
              <div className="max-h-[500px] overflow-y-auto divide-y divide-indigo-50">
                {mlAnalysisResults.exchanges.map((exchange, idx) => {
                  const sevClasses = exchange.contextualWeight === 'critical' ? 'bg-red-100 text-red-700' :
                    exchange.contextualWeight === 'high' ? 'bg-orange-100 text-orange-700' :
                    exchange.contextualWeight === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'

                  return (
                    <div key={idx} className="px-5 py-3 hover:bg-white/60 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">{idx + 1}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            ['initial_departure', 'departure_climb', 'takeoff_roll'].includes(exchange.phase)
                              ? 'bg-blue-100 text-blue-700' : ['approach', 'final_approach', 'go_around'].includes(exchange.phase)
                              ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                          }`}>{exchange.phase.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sevClasses}`}>
                            {exchange.multiPartAnalysis.readbackCompleteness}%
                          </span>
                        </div>
                      </div>

                      {/* Component chips */}
                      {exchange.multiPartAnalysis.isMultiPart && exchange.multiPartAnalysis.parts.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {exchange.multiPartAnalysis.parts.map((part, pIdx) => (
                            <span key={pIdx} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              part.isPresent ? 'bg-green-50 text-green-700 border border-green-200' :
                              part.isCritical ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>{part.isPresent ? '✓' : '✗'} {part.type.replace(/_/g, ' ')}</span>
                          ))}
                        </div>
                      )}

                      {/* Inline errors */}
                      {[...exchange.departureSpecificErrors, ...exchange.approachSpecificErrors].map((err, eIdx) => (
                        <div key={eIdx} className="text-[11px] text-gray-600 flex items-start gap-1.5 mb-1">
                          <ArrowRight className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                          <span><strong className="text-gray-800">{err.description}</strong> — {err.correction}</span>
                        </div>
                      ))}

                      {exchange.isCorrect && exchange.contextualWeight === 'low' && (
                        <div className="flex items-center gap-1.5 text-[11px] text-green-600">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Correct and complete
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* GND Exchange Analysis Panel */}
          {groundAnalysisResults && groundAnalysisResults.exchanges.length > 0 && (
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-teal-50/50 overflow-hidden">

              {/* Header */}
              <div className="px-5 py-4 border-b border-emerald-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Radio className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Ground Operations Analysis</h3>
                    <p className="text-[11px] text-gray-500">{groundAnalysisResults.summary.totalExchanges} exchanges analyzed</p>
                  </div>
                </div>
                <span className={`text-lg font-bold ${
                  groundAnalysisResults.summary.averageCompleteness >= 80 ? 'text-green-600' :
                  groundAnalysisResults.summary.averageCompleteness >= 60 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {groundAnalysisResults.summary.averageCompleteness}%
                </span>
              </div>

              {/* Stat row */}
              <div className="grid grid-cols-4 divide-x divide-emerald-100 border-b border-emerald-100 bg-white/50">
                {[
                  { value: groundAnalysisResults.summary.totalExchanges, label: 'Total',      color: 'text-emerald-600' },
                  { value: groundAnalysisResults.summary.taxiCount,      label: 'Taxi',       color: 'text-teal-600'    },
                  { value: groundAnalysisResults.summary.holdingCount,   label: 'Hold Short', color: 'text-amber-600'   },
                  { value: groundAnalysisResults.summary.criticalErrors, label: 'Critical',   color: 'text-red-600'     },
                ].map((s) => (
                  <div key={s.label} className="text-center py-3">
                    <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Phase chips */}
              <div className="px-5 py-3 border-b border-emerald-100 bg-white/30">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(groundAnalysisResults.summary.phaseBreakdown)
                    .filter(([, count]) => count > 0)
                    .sort(([, a], [, b]) => b - a)
                    .map(([phase, count]) => (
                      <span key={phase} className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        ['taxi', 'ground', 'pushback'].includes(phase) ? 'bg-emerald-100 text-emerald-700' :
                        phase === 'holding' ? 'bg-amber-100 text-amber-700' :
                        ['crossing', 'lineup'].includes(phase) ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{phase.replace(/_/g, ' ')} ({count})</span>
                    ))}
                </div>
              </div>

              {/* Exchange list */}
              <div className="max-h-[500px] overflow-y-auto divide-y divide-emerald-50">
                {groundAnalysisResults.exchanges.map((exchange, idx) => {
                  const sevClasses = exchange.contextualWeight === 'critical' ? 'bg-red-100 text-red-700' :
                    exchange.contextualWeight === 'high'   ? 'bg-orange-100 text-orange-700' :
                    exchange.contextualWeight === 'medium' ? 'bg-amber-100 text-amber-700'  : 'bg-green-100 text-green-700'

                  return (
                    <div key={idx} className="px-5 py-3 hover:bg-white/60 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">{idx + 1}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            ['taxi', 'ground', 'pushback'].includes(exchange.phase) ? 'bg-emerald-100 text-emerald-700' :
                            exchange.phase === 'holding' ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700'
                          }`}>{exchange.phase.replace(/_/g, ' ')}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sevClasses}`}>
                          {exchange.multiPartAnalysis.readbackCompleteness}%
                        </span>
                      </div>

                      {/* Multi-part component chips */}
                      {exchange.multiPartAnalysis.isMultiPart && exchange.multiPartAnalysis.parts.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {exchange.multiPartAnalysis.parts.map((part, pIdx) => (
                            <span key={pIdx} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              part.isPresent ? 'bg-green-50 text-green-700 border border-green-200' :
                              part.isCritical ? 'bg-red-50 text-red-700 border border-red-200' :
                              'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>{part.isPresent ? '✓' : '✗'} {part.type.replace(/_/g, ' ')}</span>
                          ))}
                        </div>
                      )}

                      {/* GND-specific errors */}
                      {exchange.groundSpecificErrors.map((err, eIdx) => (
                        <div key={eIdx} className="text-[11px] text-gray-600 flex items-start gap-1.5 mb-1">
                          <ArrowRight className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                          <span><strong className="text-gray-800">{err.description}</strong> — {err.correction}</span>
                        </div>
                      ))}

                      {exchange.isCorrect && exchange.contextualWeight === 'low' && (
                        <div className="flex items-center gap-1.5 text-[11px] text-green-600">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Correct and complete
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Strengths banner */}
          {analysisResult.summary.strengthAreas && analysisResult.summary.strengthAreas.length > 0 && (
            <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-emerald-600" />
                <h4 className="text-sm font-semibold text-emerald-800">Areas of Strength</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {analysisResult.summary.strengthAreas.map((s, idx) => (
                  <span key={idx} className="px-3 py-1 bg-white/70 rounded-full text-xs text-emerald-700 border border-emerald-200">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Error distribution — horizontal bars */}
          <div className="grid lg:grid-cols-2 gap-4">
            {[
              { title: 'Language-Based Errors', data: analysisResult.languageErrors, gradient: 'from-blue-500 to-indigo-500' },
              { title: 'Number-Related Errors', data: analysisResult.numberErrors, gradient: 'from-amber-500 to-orange-500' },
            ].map(({ title, data, gradient }) => (
              <div key={title} className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                  <span className="text-xs font-medium text-gray-500">{data.reduce((a, b) => a + b.count, 0)} total</span>
                </div>
                <div className="space-y-3">
                  {data.map((error, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-600">{error.type}</span>
                        <span className="font-medium text-gray-900">{error.count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full bg-gradient-to-r ${gradient} rounded-full`} style={{ width: `${error.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Summary & Recommendations — side by side clean cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-indigo-500" />
                Key Findings
              </h4>
              <ul className="space-y-2 text-xs text-gray-600">
                {analysisResult.summary.keyFindings.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1 h-1 bg-indigo-400 rounded-full mt-1.5 flex-shrink-0"></span>
                    {f}
                  </li>
                ))}
              </ul>
              {analysisResult.summary.criticalIssues.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-100">
                  <h5 className="text-[11px] font-bold text-red-700 uppercase mb-1.5">Critical Issues</h5>
                  {analysisResult.summary.criticalIssues.map((issue, i) => (
                    <p key={i} className="text-xs text-red-600 flex items-start gap-1.5 mb-1">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      {issue}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Recommendations
              </h4>
              <ul className="space-y-2">
                {analysisResult.summary.recommendations.map((rec, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                    <ArrowRight className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Empty State when no corpus selected */}
      {!selectedCorpus && !analysisResult && (
        <div className="card p-12 text-center bg-gray-50">
          <div className="w-16 h-16 bg-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Corpus Category</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Choose from APP/DEP, GND, or RAMP corpus to begin analyzing aviation communication patterns.
          </p>
        </div>
      )}
    </div>
  )
}
