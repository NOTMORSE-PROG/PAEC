'use client'

import { useState } from 'react'
import {
  BarChart3,
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  Info,
  TrendingUp,
  TrendingDown,
  PieChart,
  Activity,
  Loader2,
  X,
  Download,
  Filter
} from 'lucide-react'

type CorpusType = 'APP/DEP' | 'GND' | 'RAMP' | null

interface AnalysisResult {
  corpusType: string
  totalWords: number
  totalExchanges: number
  nonStandardFreq: number
  clarificationCount: number
  languageErrors: {
    type: string
    count: number
    percentage: number
  }[]
  numberErrors: {
    type: string
    count: number
    percentage: number
  }[]
  riskLevel: 'low' | 'medium' | 'high'
}

export default function AnalysisPage() {
  const [selectedCorpus, setSelectedCorpus] = useState<CorpusType>(null)
  const [uploadedText, setUploadedText] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)

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

  const handleAnalyze = async () => {
    if (!selectedCorpus || !uploadedText.trim()) return

    setIsAnalyzing(true)
    setShowUploadModal(false)

    // Simulate analysis
    await new Promise((resolve) => setTimeout(resolve, 2000))

    setAnalysisResult({
      corpusType: selectedCorpus,
      totalWords: 1250,
      totalExchanges: 48,
      nonStandardFreq: 12.4,
      clarificationCount: 23,
      languageErrors: [
        { type: 'Incomplete phraseology', count: 18, percentage: 35 },
        { type: 'Wrong terminology', count: 12, percentage: 24 },
        { type: 'Missing words', count: 15, percentage: 29 },
        { type: 'Syntax errors', count: 6, percentage: 12 },
      ],
      numberErrors: [
        { type: 'Altitude mismatch', count: 8, percentage: 32 },
        { type: 'Heading errors', count: 6, percentage: 24 },
        { type: 'Speed discrepancy', count: 5, percentage: 20 },
        { type: 'Call sign variation', count: 6, percentage: 24 },
      ],
      riskLevel: 'medium',
    })

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
              onClick={() => setSelectedCorpus(corpus.id as CorpusType)}
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Dialogue Text</h2>
          <div
            onClick={() => setShowUploadModal(true)}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 transition-all"
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Click to upload or paste dialogue text</p>
            <p className="text-sm text-gray-500">
              Paste ATC-pilot communications from {selectedCorpus} corpus
            </p>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-2xl shadow-elevated max-w-2xl w-full max-h-[90vh] overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                Upload Dialogue Text - {selectedCorpus}
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
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
              <p className="text-sm text-gray-500 mt-2">
                <Info className="w-4 h-4 inline mr-1" />
                Format: Label each line with speaker (ATC/Pilot) followed by the message.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setShowUploadModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleAnalyze}
                disabled={!uploadedText.trim()}
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
                onClick={() => {
                  setAnalysisResult(null)
                  setUploadedText('')
                }}
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
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-primary-500 rounded-full mt-2"></span>
                    Non-standard phraseology rate is above average for this corpus type
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-primary-500 rounded-full mt-2"></span>
                    Incomplete phraseology is the most common language error
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-primary-500 rounded-full mt-2"></span>
                    Altitude mismatches pose highest miscommunication risk
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Recommendations</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    Focus training on complete readback elements
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    Practice altitude and flight level pronunciation
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    Review ICAO standard phraseology for {selectedCorpus}
                  </li>
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
