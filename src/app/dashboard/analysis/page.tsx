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
import { analyzeDialogue, parseLines, type AnalysisOutput, type PhraseologyError, type ParsedLine } from '@/lib/analysisEngine'
import { analyzeDepartureApproach, type DepartureApproachMLResult, type FlightPhase } from '@/lib/departureApproachML'
import { analyzeWithPhaseContext } from '@/lib/semanticReadbackAnalyzer'

type CorpusType = 'APP/DEP' | 'GND' | 'RAMP' | null
type UploadMethod = 'text' | 'pdf' | null

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
  const [selectedErrorIndex, setSelectedErrorIndex] = useState<number | null>(null)
  const [showFullTranscript, setShowFullTranscript] = useState(false)
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set())
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

  const fileInputRef = useRef<HTMLInputElement>(null)

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
    if (!file.type.includes('pdf')) {
      setPdfError('Please upload a PDF file')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setPdfError('File size must be less than 10MB')
      return
    }

    setIsExtracting(true)
    setPdfError(null)
    setPdfData(null)

    try {
      const result = await extractTextFromPDF(file)

      if (!result.success) {
        setPdfError(result.errors.join(', ') || 'Failed to extract text from PDF')
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
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'Failed to process PDF')
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
    setShowUploadModal(false)

    // Brief delay for UX
    await new Promise((resolve) => setTimeout(resolve, 500))

    const result = analyzeDialogue({
      text: uploadedText,
      corpusType: selectedCorpus,
    })

    // Enhanced ML analysis for APP/DEP corpus
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
          const mlResult = analyzeDepartureApproach(
            current.text,
            next.text,
            undefined, // callsign extracted automatically
            exchanges.slice(-3).map(e => ({
              type: e.errors[0]?.type || 'unknown',
              severity: e.contextualSeverity,
              timestamp: Date.now()
            }))
          )

          exchanges.push(mlResult)

          // Track phase
          phaseBreakdown[mlResult.phase] = (phaseBreakdown[mlResult.phase] || 0) + 1

          // Track completeness
          totalCompleteness += mlResult.multiPartAnalysis.readbackCompleteness

          // Track critical errors
          if (mlResult.contextualSeverity === 'critical') {
            criticalErrors++
          }

          // Track departure vs approach
          if (['initial_departure', 'departure_climb', 'takeoff_roll', 'lineup', 'taxi'].includes(mlResult.phase)) {
            departureCount++
          } else if (['approach', 'final_approach', 'go_around', 'descent', 'arrival'].includes(mlResult.phase)) {
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
    } else {
      setMlAnalysisResults(null)
    }

    setAnalysisResult(result)
    setIsAnalyzing(false)
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
    setUploadMethod(null)
    setSelectedErrorIndex(null)
    setShowFullTranscript(false)
    setExpandedLines(new Set())
    setMlAnalysisResults(null)
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
        errors,
        hasErrors: errors.length > 0,
        highestSeverity: errors.reduce((max, e) => {
          const severityOrder = { high: 3, medium: 2, low: 1 }
          return severityOrder[e.severity as keyof typeof severityOrder] > severityOrder[max as keyof typeof severityOrder] ? e.severity : max
        }, 'low' as string)
      }
    })
  }, [uploadedText, analysisResult])

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'high':
        return {
          bg: 'bg-red-50 hover:bg-red-100',
          border: 'border-l-red-500',
          highlight: 'bg-red-100',
          text: 'text-red-700'
        }
      case 'medium':
        return {
          bg: 'bg-amber-50 hover:bg-amber-100',
          border: 'border-l-amber-500',
          highlight: 'bg-amber-100',
          text: 'text-amber-700'
        }
      case 'low':
        return {
          bg: 'bg-blue-50 hover:bg-blue-100',
          border: 'border-l-blue-500',
          highlight: 'bg-blue-100',
          text: 'text-blue-700'
        }
      default:
        return {
          bg: 'bg-white hover:bg-gray-50',
          border: 'border-l-gray-200',
          highlight: 'bg-gray-100',
          text: 'text-gray-700'
        }
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
              <h3 className="font-medium text-gray-900 mb-1">Upload PDF</h3>
              <p className="text-sm text-gray-500">
                Upload a PDF document with ATC-Pilot dialogues
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
                {uploadMethod === 'pdf' ? 'Upload PDF Document' : 'Paste Dialogue Text'} - {selectedCorpus}
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
                      accept=".pdf"
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
                          Drag and drop your PDF here, or click to browse
                        </p>
                        <p className="text-sm text-gray-500">
                          Supports PDF documents with ATC-Pilot communications
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

      {/* Analysis Results */}
      {analysisResult && (
        <div className="space-y-6">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Analysis Results</h2>
              <p className="text-sm text-gray-500">Corpus: {analysisResult.corpusType}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={resetAnalysis}
                className="btn-secondary"
              >
                New Analysis
              </button>
              <button className="btn-primary">
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </button>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <FileText className="w-5 h-5 text-gray-400" />
                <span className="text-xs text-gray-500">Total</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{analysisResult.totalWords.toLocaleString()}</div>
              <div className="text-sm text-gray-500">Words Analyzed</div>
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <Activity className="w-5 h-5 text-gray-400" />
                <span className="text-xs text-gray-500">Exchanges</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{analysisResult.totalExchanges}</div>
              <div className="text-sm text-gray-500">Communication Turns</div>
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-5 h-5 text-amber-500" />
                <span className="text-xs text-gray-500">Per 1k words</span>
              </div>
              <div className="text-2xl font-bold text-amber-600">{analysisResult.nonStandardFreq}</div>
              <div className="text-sm text-gray-500">Non-standard Frequency</div>
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <span className={`badge text-xs ${getRiskColor(analysisResult.riskLevel)}`}>
                  {analysisResult.riskLevel.toUpperCase()}
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{analysisResult.clarificationCount}</div>
              <div className="text-sm text-gray-500">Clarification Sequences</div>
            </div>
          </div>

          {/* Compliance Score */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">ICAO Compliance Score</h3>
              <span className={`text-2xl font-bold ${
                analysisResult.summary.overallCompliance >= 80 ? 'text-green-600' :
                analysisResult.summary.overallCompliance >= 60 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {analysisResult.summary.overallCompliance}%
              </span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  analysisResult.summary.overallCompliance >= 80 ? 'bg-green-500' :
                  analysisResult.summary.overallCompliance >= 60 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${analysisResult.summary.overallCompliance}%` }}
              />
            </div>
          </div>

          {/* Annotated Transcript */}
          {annotatedLines.length > 0 && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Annotated Transcript</h3>
                    <p className="text-sm text-gray-500">
                      {annotatedLines.filter(l => l.hasErrors).length} lines with issues • Click to expand details
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Legend */}
                  <div className="hidden sm:flex items-center gap-3 mr-4 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      High
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                      Medium
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      Low
                    </span>
                  </div>
                  {/* Expand/Collapse All Button */}
                  {annotatedLines.filter(l => l.hasErrors).length > 0 && (
                    <button
                      onClick={() => {
                        const linesWithErrors = annotatedLines.filter(l => l.hasErrors)
                        if (expandedLines.size === linesWithErrors.length) {
                          // Collapse all
                          setExpandedLines(new Set())
                        } else {
                          // Expand all
                          setExpandedLines(new Set(linesWithErrors.map(l => l.lineNum)))
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                      title={expandedLines.size > 0 ? 'Collapse all errors' : 'Expand all errors'}
                    >
                      {expandedLines.size > 0 ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          Collapse All
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          Expand All
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setShowFullTranscript(!showFullTranscript)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title={showFullTranscript ? 'Collapse transcript' : 'Expand transcript'}
                  >
                    {showFullTranscript ? (
                      <Minimize2 className="w-4 h-4 text-gray-500" />
                    ) : (
                      <Maximize2 className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>

              <div className={`overflow-y-auto transition-all duration-300 ${showFullTranscript ? 'max-h-[600px]' : 'max-h-80'}`}>
                <div className="divide-y divide-gray-100">
                  {annotatedLines.map((line, idx) => {
                    const styles = line.hasErrors ? getSeverityStyles(line.highestSeverity) : getSeverityStyles('none')
                    const isExpanded = expandedLines.has(line.lineNum)

                    const toggleExpand = () => {
                      const newExpanded = new Set(expandedLines)
                      if (isExpanded) {
                        newExpanded.delete(line.lineNum)
                      } else {
                        newExpanded.add(line.lineNum)
                      }
                      setExpandedLines(newExpanded)
                    }

                    return (
                      <div
                        key={idx}
                        className={`relative transition-all duration-150 ${styles.bg} ${line.hasErrors ? `border-l-4 ${styles.border}` : 'border-l-4 border-l-transparent'}`}
                      >
                        <div
                          className={`flex items-start gap-3 p-3 ${line.hasErrors ? 'cursor-pointer hover:bg-opacity-80' : ''}`}
                          onClick={line.hasErrors ? toggleExpand : undefined}
                        >
                          {/* Line Number */}
                          <span className="flex-shrink-0 w-8 text-xs text-gray-400 font-mono text-right pt-0.5">
                            {line.lineNum}
                          </span>

                          {/* Speaker Badge */}
                          {line.speaker && line.speaker !== 'UNKNOWN' && (
                            <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded ${
                              line.speaker === 'ATC'
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {line.speaker === 'PILOT' ? 'PLT' : 'ATC'}
                            </span>
                          )}

                          {/* Text Content with Inline Highlighting */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${line.hasErrors ? styles.text : 'text-gray-700'} font-mono break-words`}>
                              {line.hasErrors ? (
                                // Highlight incorrect phrases inline
                                (() => {
                                  const highlights: { phrase: string; severity: string }[] = []

                                  // Collect all incorrect phrases from errors
                                  line.errors.forEach(err => {
                                    if (err.incorrectPhrase) {
                                      highlights.push({ phrase: err.incorrectPhrase, severity: err.severity })
                                    }
                                  })

                                  if (highlights.length === 0) {
                                    return line.text
                                  }

                                  // Build regex with word boundaries to match phrase within text
                                  const escapedPhrases = highlights.map(h => {
                                    const escaped = h.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                                    return escaped
                                  })
                                  // Use word boundary \b to match whole words
                                  const regex = new RegExp(`(\\b(?:${escapedPhrases.join('|')})\\b)`, 'gi')
                                  const parts = line.text.split(regex)

                                  return parts.map((part, i) => {
                                    // Check if this part matches any highlight phrase
                                    const matchedHighlight = highlights.find(
                                      h => h.phrase.toLowerCase() === part.toLowerCase()
                                    )
                                    if (matchedHighlight) {
                                      const bgColor = matchedHighlight.severity === 'high'
                                        ? 'bg-red-500 text-white'
                                        : matchedHighlight.severity === 'medium'
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-blue-500 text-white'
                                      return (
                                        <span
                                          key={i}
                                          className={`${bgColor} px-1 py-0.5 rounded font-bold`}
                                          title={`Error: ${matchedHighlight.phrase}`}
                                        >
                                          {part}
                                        </span>
                                      )
                                    }
                                    return part
                                  })
                                })()
                              ) : (
                                line.text
                              )}
                            </p>
                          </div>

                          {/* Error Count Badge + Expand Button */}
                          {line.hasErrors && (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                line.highestSeverity === 'high' ? 'bg-red-200 text-red-800' :
                                line.highestSeverity === 'medium' ? 'bg-amber-200 text-amber-800' :
                                'bg-blue-200 text-blue-800'
                              }`}>
                                {line.errors.length} {line.errors.length === 1 ? 'issue' : 'issues'}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleExpand()
                                }}
                                className={`p-1 rounded-lg transition-colors ${
                                  line.highestSeverity === 'high' ? 'hover:bg-red-100' :
                                  line.highestSeverity === 'medium' ? 'hover:bg-amber-100' :
                                  'hover:bg-blue-100'
                                }`}
                                title={isExpanded ? 'Collapse details' : 'Expand details'}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-gray-600" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-gray-600" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Inline Error Details - Enhanced */}
                        {line.hasErrors && isExpanded && (
                          <div className="px-3 pb-3 pl-14">
                            <div className="space-y-3 animate-fade-in">
                              {line.errors.map((error, errIdx) => (
                                  <div
                                    key={errIdx}
                                    className={`rounded-lg overflow-hidden border ${
                                      error.severity === 'high' ? 'border-red-300' :
                                      error.severity === 'medium' ? 'border-amber-300' :
                                      'border-blue-300'
                                    }`}
                                  >
                                    {/* Error Header */}
                                    <div className={`px-3 py-2 flex items-center justify-between ${
                                      error.severity === 'high' ? 'bg-red-100' :
                                      error.severity === 'medium' ? 'bg-amber-100' : 'bg-blue-100'
                                    }`}>
                                      <div className="flex items-center gap-2">
                                        <AlertTriangle className={`w-4 h-4 ${
                                          error.severity === 'high' ? 'text-red-600' :
                                          error.severity === 'medium' ? 'text-amber-600' : 'text-blue-600'
                                        }`} />
                                        <span className={`text-xs font-bold uppercase ${
                                          error.severity === 'high' ? 'text-red-700' :
                                          error.severity === 'medium' ? 'text-amber-700' : 'text-blue-700'
                                        }`}>
                                          {error.severity} severity - {error.category}
                                        </span>
                                      </div>
                                      {error.icaoReference && (
                                        <span className="text-xs text-gray-500 bg-white/50 px-2 py-0.5 rounded">
                                          {error.icaoReference.split(' ').slice(0, 3).join(' ')}
                                        </span>
                                      )}
                                    </div>

                                    {/* Error Content */}
                                    <div className="p-3 bg-white space-y-3">
                                      {/* Issue */}
                                      <div>
                                        <p className="text-sm font-semibold text-gray-900">{error.issue}</p>
                                      </div>

                                      {/* Incorrect vs Correct */}
                                      {error.incorrectPhrase && (
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                          <div className="p-2 bg-red-50 rounded border border-red-200">
                                            <span className="block text-red-600 font-medium mb-1">✗ You said:</span>
                                            <span className="font-mono text-red-800">{error.incorrectPhrase}</span>
                                          </div>
                                          <div className="p-2 bg-green-50 rounded border border-green-200">
                                            <span className="block text-green-600 font-medium mb-1">✓ Say instead:</span>
                                            <span className="font-mono text-green-800">{error.suggestion.replace('Use "', '').replace('" instead', '').split('"')[0]}</span>
                                          </div>
                                        </div>
                                      )}

                                      {/* Corrected Example */}
                                      {error.correctExample && (
                                        <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
                                          <span className="text-xs text-emerald-700 font-medium block mb-1">
                                            <CheckCircle className="w-3 h-3 inline mr-1" />
                                            Corrected transmission:
                                          </span>
                                          <p className="text-sm font-mono text-emerald-900">{error.correctExample}</p>
                                        </div>
                                      )}

                                      {/* Explanation */}
                                      {error.explanation && (
                                        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                          <BookOpen className="w-3 h-3 inline mr-1 text-gray-400" />
                                          {error.explanation}
                                        </div>
                                      )}

                                      {/* Why it matters */}
                                      {error.whyItMatters && (
                                        <div className={`text-xs p-2 rounded flex items-start gap-2 ${
                                          error.severity === 'high' ? 'bg-red-50 text-red-700' :
                                          error.severity === 'medium' ? 'bg-amber-50 text-amber-700' :
                                          'bg-blue-50 text-blue-700'
                                        }`}>
                                          <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                          <span><strong>Why it matters:</strong> {error.whyItMatters}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Footer with stats */}
              <div className="flex items-center justify-between p-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
                <span>{annotatedLines.length} lines total</span>
                <span className="flex items-center gap-4">
                  <span className="text-red-600">{annotatedLines.filter(l => l.highestSeverity === 'high').length} high</span>
                  <span className="text-amber-600">{annotatedLines.filter(l => l.highestSeverity === 'medium').length} medium</span>
                  <span className="text-blue-600">{annotatedLines.filter(l => l.highestSeverity === 'low' && l.hasErrors).length} low</span>
                </span>
              </div>
            </div>
          )}

          {/* Readback Analysis & Safety Metrics */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Readback Analysis */}
            {analysisResult.readbackAnalysis && (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Radio className="w-5 h-5 text-indigo-500" />
                    Readback Analysis
                  </h3>
                  <span className={`text-lg font-bold ${
                    analysisResult.readbackAnalysis.completenessScore >= 80 ? 'text-green-600' :
                    analysisResult.readbackAnalysis.completenessScore >= 60 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {analysisResult.readbackAnalysis.completenessScore}%
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-xl font-bold text-gray-900">{analysisResult.readbackAnalysis.totalInstructions}</div>
                    <div className="text-xs text-gray-500">Instructions</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-xl font-bold text-green-600">{analysisResult.readbackAnalysis.completeReadbacks}</div>
                    <div className="text-xs text-gray-500">Complete</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <div className="text-xl font-bold text-red-600">{analysisResult.readbackAnalysis.incompleteReadbacks}</div>
                    <div className="text-xs text-gray-500">Incomplete</div>
                  </div>
                </div>

                {analysisResult.readbackAnalysis.missingElements.length > 0 && (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    <p className="text-xs font-medium text-gray-500 uppercase">Missing Elements</p>
                    {analysisResult.readbackAnalysis.missingElements.slice(0, 3).map((me, idx) => (
                      <div key={idx} className="text-xs p-2 bg-amber-50 rounded border border-amber-100">
                        <span className="font-medium text-amber-700">Line {me.line}:</span>{' '}
                        <span className="text-amber-600">{me.missing.join(', ')}</span>
                      </div>
                    ))}
                    {analysisResult.readbackAnalysis.missingElements.length > 3 && (
                      <p className="text-xs text-gray-400">
                        +{analysisResult.readbackAnalysis.missingElements.length - 3} more issues
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Safety Metrics */}
            {analysisResult.safetyMetrics && (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-500" />
                    Safety Metrics
                  </h3>
                  <span className={`text-lg font-bold ${
                    analysisResult.safetyMetrics.overallSafetyScore >= 80 ? 'text-green-600' :
                    analysisResult.safetyMetrics.overallSafetyScore >= 60 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {analysisResult.safetyMetrics.overallSafetyScore}%
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-4">
                  <div className="text-center p-2 bg-red-50 rounded-lg border border-red-100">
                    <div className="text-lg font-bold text-red-600">{analysisResult.safetyMetrics.criticalIssues}</div>
                    <div className="text-xs text-red-500">Critical</div>
                  </div>
                  <div className="text-center p-2 bg-orange-50 rounded-lg border border-orange-100">
                    <div className="text-lg font-bold text-orange-600">{analysisResult.safetyMetrics.highSeverityIssues}</div>
                    <div className="text-xs text-orange-500">High</div>
                  </div>
                  <div className="text-center p-2 bg-amber-50 rounded-lg border border-amber-100">
                    <div className="text-lg font-bold text-amber-600">{analysisResult.safetyMetrics.mediumSeverityIssues}</div>
                    <div className="text-xs text-amber-500">Medium</div>
                  </div>
                  <div className="text-center p-2 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="text-lg font-bold text-blue-600">{analysisResult.safetyMetrics.lowSeverityIssues}</div>
                    <div className="text-xs text-blue-500">Low</div>
                  </div>
                </div>

                {analysisResult.safetyMetrics.safetyCriticalPhrases.length > 0 && (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    <p className="text-xs font-medium text-gray-500 uppercase">Safety-Critical Detections</p>
                    {analysisResult.safetyMetrics.safetyCriticalPhrases.slice(0, 3).map((sc, idx) => (
                      <div key={idx} className="text-xs p-2 bg-red-50 rounded border border-red-100">
                        <span className="font-medium text-red-700">{sc.type}:</span>{' '}
                        <span className="text-red-600">{sc.description}</span>
                      </div>
                    ))}
                  </div>
                )}

                {analysisResult.safetyMetrics.safetyCriticalPhrases.length === 0 && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-100">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-700">No safety-critical issues detected</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Enhanced ML Analysis for APP/DEP */}
          {mlAnalysisResults && mlAnalysisResults.exchanges.length > 0 && (
            <div className="card p-6 bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-500" />
                  Enhanced ML Analysis
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Departure/Approach</span>
                </h3>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${
                    mlAnalysisResults.summary.averageCompleteness >= 80 ? 'text-green-600' :
                    mlAnalysisResults.summary.averageCompleteness >= 60 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {mlAnalysisResults.summary.averageCompleteness}%
                  </span>
                  <span className="text-xs text-gray-500">Avg. Completeness</span>
                </div>
              </div>

              {/* ML Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="text-center p-3 bg-white/70 rounded-lg border border-indigo-100">
                  <div className="text-xl font-bold text-indigo-600">{mlAnalysisResults.summary.totalExchanges}</div>
                  <div className="text-xs text-gray-500">Exchanges Analyzed</div>
                </div>
                <div className="text-center p-3 bg-white/70 rounded-lg border border-blue-100">
                  <div className="text-xl font-bold text-blue-600">{mlAnalysisResults.summary.departureCount}</div>
                  <div className="text-xs text-gray-500">Departure Phase</div>
                </div>
                <div className="text-center p-3 bg-white/70 rounded-lg border border-purple-100">
                  <div className="text-xl font-bold text-purple-600">{mlAnalysisResults.summary.approachCount}</div>
                  <div className="text-xs text-gray-500">Approach Phase</div>
                </div>
                <div className="text-center p-3 bg-white/70 rounded-lg border border-red-100">
                  <div className="text-xl font-bold text-red-600">{mlAnalysisResults.summary.criticalErrors}</div>
                  <div className="text-xs text-gray-500">Critical Errors</div>
                </div>
              </div>

              {/* Phase Breakdown */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Flight Phase Distribution</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(mlAnalysisResults.summary.phaseBreakdown)
                    .filter(([, count]) => count > 0)
                    .sort(([, a], [, b]) => b - a)
                    .map(([phase, count]) => (
                      <span
                        key={phase}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          ['initial_departure', 'departure_climb', 'takeoff_roll'].includes(phase)
                            ? 'bg-blue-100 text-blue-700'
                            : ['approach', 'final_approach', 'go_around'].includes(phase)
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {phase.replace(/_/g, ' ')}: {count}
                      </span>
                    ))}
                </div>
              </div>

              {/* Detailed Exchange Analysis */}
              <div className="space-y-4 max-h-96 overflow-y-auto">
                <h4 className="text-sm font-medium text-gray-700 sticky top-0 bg-gradient-to-r from-indigo-50 to-purple-50 py-2">
                  Detailed Exchange Analysis
                </h4>
                {mlAnalysisResults.exchanges.map((exchange, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg overflow-hidden border ${
                      exchange.contextualSeverity === 'critical' ? 'border-red-300 bg-red-50' :
                      exchange.contextualSeverity === 'high' ? 'border-orange-300 bg-orange-50' :
                      exchange.contextualSeverity === 'medium' ? 'border-amber-300 bg-amber-50' :
                      'border-green-300 bg-green-50'
                    }`}
                  >
                    {/* Exchange Header */}
                    <div className={`px-4 py-2 flex items-center justify-between ${
                      exchange.contextualSeverity === 'critical' ? 'bg-red-100' :
                      exchange.contextualSeverity === 'high' ? 'bg-orange-100' :
                      exchange.contextualSeverity === 'medium' ? 'bg-amber-100' :
                      'bg-green-100'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-600">#{idx + 1}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          ['initial_departure', 'departure_climb', 'takeoff_roll'].includes(exchange.phase)
                            ? 'bg-blue-200 text-blue-800'
                            : ['approach', 'final_approach', 'go_around'].includes(exchange.phase)
                            ? 'bg-purple-200 text-purple-800'
                            : 'bg-gray-200 text-gray-800'
                        }`}>
                          {exchange.phase.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-gray-500">
                          Confidence: {Math.round(exchange.phaseConfidence * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          exchange.multiPartAnalysis.readbackCompleteness >= 80 ? 'bg-green-200 text-green-800' :
                          exchange.multiPartAnalysis.readbackCompleteness >= 60 ? 'bg-amber-200 text-amber-800' :
                          'bg-red-200 text-red-800'
                        }`}>
                          {exchange.multiPartAnalysis.readbackCompleteness}% complete
                        </span>
                      </div>
                    </div>

                    {/* Exchange Content */}
                    <div className="p-4 bg-white/50 space-y-3">
                      {/* Multi-part Analysis */}
                      {exchange.multiPartAnalysis.isMultiPart && exchange.multiPartAnalysis.parts.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-600 mb-2">Instruction Components:</p>
                          <div className="flex flex-wrap gap-1">
                            {exchange.multiPartAnalysis.parts.map((part, pIdx) => (
                              <span
                                key={pIdx}
                                className={`px-2 py-0.5 rounded text-xs ${
                                  part.isPresent
                                    ? 'bg-green-100 text-green-700'
                                    : part.isCritical
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {part.isPresent ? '✓' : '✗'} {part.type.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Missing Parts */}
                      {exchange.multiPartAnalysis.missingParts.length > 0 && (
                        <div className="p-2 bg-amber-50 rounded border border-amber-200">
                          <p className="text-xs text-amber-700">
                            <strong>Missing elements:</strong> {exchange.multiPartAnalysis.missingParts.join(', ')}
                          </p>
                        </div>
                      )}

                      {/* Departure-Specific Errors */}
                      {exchange.departureSpecificErrors.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-blue-700">Departure Issues:</p>
                          {exchange.departureSpecificErrors.map((err, eIdx) => (
                            <div key={eIdx} className="p-2 bg-blue-50 rounded border border-blue-200 text-xs">
                              <p className="font-medium text-blue-800">{err.description}</p>
                              <p className="text-blue-600 mt-1">
                                <ArrowRight className="w-3 h-3 inline mr-1" />
                                {err.correction}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Approach-Specific Errors */}
                      {exchange.approachSpecificErrors.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-purple-700">Approach Issues:</p>
                          {exchange.approachSpecificErrors.map((err, eIdx) => (
                            <div key={eIdx} className="p-2 bg-purple-50 rounded border border-purple-200 text-xs">
                              <p className="font-medium text-purple-800">{err.description}</p>
                              <p className="text-purple-600 mt-1">
                                <ArrowRight className="w-3 h-3 inline mr-1" />
                                {err.correction}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Training Recommendations */}
                      {exchange.trainingRecommendations.length > 0 && (
                        <div className="p-2 bg-indigo-50 rounded border border-indigo-200">
                          <p className="text-xs font-medium text-indigo-700 mb-1">
                            <BookOpen className="w-3 h-3 inline mr-1" />
                            Training Focus:
                          </p>
                          <ul className="text-xs text-indigo-600 space-y-0.5">
                            {exchange.trainingRecommendations.slice(0, 2).map((rec, rIdx) => (
                              <li key={rIdx}>• {rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Safety Vectors Summary */}
                      {exchange.safetyVectors.some(v => v.mitigationRequired) && (
                        <div className="flex items-center gap-2 p-2 bg-red-50 rounded border border-red-200">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          <span className="text-xs text-red-700">
                            Safety mitigation required for: {
                              exchange.safetyVectors
                                .filter(v => v.mitigationRequired)
                                .map(v => v.factor)
                                .join(', ')
                            }
                          </span>
                        </div>
                      )}

                      {/* All Clear */}
                      {exchange.isCorrect && exchange.contextualSeverity === 'low' && (
                        <div className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-200">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-xs text-green-700">Readback correct and complete</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strength Areas */}
          {analysisResult.summary.strengthAreas && analysisResult.summary.strengthAreas.length > 0 && (
            <div className="card p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
              <div className="flex items-start gap-3">
                <Target className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-800 mb-1">Areas of Strength</h4>
                  <ul className="space-y-1">
                    {analysisResult.summary.strengthAreas.map((strength, idx) => (
                      <li key={idx} className="text-sm text-green-700 flex items-center gap-2">
                        <Zap className="w-3 h-3" />
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Error Distribution */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Language-Based Errors */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-gray-900">Language-Based Errors</h3>
                <span className="badge-primary">
                  {analysisResult.languageErrors.reduce((a, b) => a + b.count, 0)} total
                </span>
              </div>
              <div className="space-y-4">
                {analysisResult.languageErrors.map((error, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-700">{error.type}</span>
                      <span className="font-medium text-gray-900">{error.count} ({error.percentage}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${error.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Number-Related Errors */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-gray-900">Number-Related Errors</h3>
                <span className="badge-warning">
                  {analysisResult.numberErrors.reduce((a, b) => a + b.count, 0)} total
                </span>
              </div>
              <div className="space-y-4">
                {analysisResult.numberErrors.map((error, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-700">{error.type}</span>
                      <span className="font-medium text-gray-900">{error.count} ({error.percentage}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                        style={{ width: `${error.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detailed Phraseology Errors */}
          {analysisResult.phraseologyErrors.length > 0 && (
            <div className="card p-6">
              <button
                onClick={() => setShowDetailedErrors(!showDetailedErrors)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-gray-900">Detailed Phraseology Issues</h3>
                  <span className="badge-error">
                    {analysisResult.phraseologyErrors.length} issues
                  </span>
                </div>
                {showDetailedErrors ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {showDetailedErrors && (
                <div className="mt-4 space-y-3 max-h-96 overflow-y-auto">
                  {analysisResult.phraseologyErrors.map((error, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border ${
                        error.severity === 'high'
                          ? 'bg-red-50 border-red-200'
                          : error.severity === 'medium'
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            error.severity === 'high'
                              ? 'bg-red-100 text-red-700'
                              : error.severity === 'medium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {error.severity.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500">Line {error.line}</span>
                        </div>
                        <span className="text-xs text-gray-500 capitalize">{error.category}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-800 mb-1">{error.issue}</p>
                      <p className="text-xs text-gray-600 font-mono bg-white/50 p-2 rounded mb-2">
                        &quot;{error.original.substring(0, 100)}{error.original.length > 100 ? '...' : ''}&quot;
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Suggestion:</span> {error.suggestion}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Summary & Recommendations */}
          <div className="card p-6 bg-gradient-to-br from-primary-50 to-white">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-primary-600" />
              Analysis Summary
            </h3>
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Key Findings</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  {analysisResult.summary.keyFindings.map((finding, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-primary-500 rounded-full mt-2 flex-shrink-0"></span>
                      {finding}
                    </li>
                  ))}
                </ul>

                {analysisResult.summary.criticalIssues.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-red-700 mb-2">Critical Issues</h4>
                    <ul className="space-y-1 text-sm text-red-600">
                      {analysisResult.summary.criticalIssues.map((issue, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Recommendations</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  {analysisResult.summary.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
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
