'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Plane,
  Cloud,
  Navigation,
  Send,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronRight,
  Clock,
  AlertTriangle,
  Volume2,
  HelpCircle
} from 'lucide-react'
import { useTextToSpeech } from '@/hooks/useTextToSpeech'

interface Scenario {
  id: number
  callSign: string
  aircraftType: string
  flightPhase: string
  weather: string
  atcClearance: string
  correctResponse: string
  hints: string[]
}

export default function ScenarioPage() {
  const [currentScenario, setCurrentScenario] = useState(0)
  const [userResponse, setUserResponse] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [feedback, setFeedback] = useState<{
    correct: boolean
    score: number
    corrections: string[]
    suggestion: string
  } | null>(null)
  const [showHint, setShowHint] = useState(false)
  const { speakATCClearance, isSpeaking, stop } = useTextToSpeech()

  const scenarios: Scenario[] = [
    {
      id: 1,
      callSign: 'PAL456',
      aircraftType: 'Airbus A320',
      flightPhase: 'Departure',
      weather: 'CAVOK',
      atcClearance: 'PAL456, climb and maintain flight level 350, turn right heading 090.',
      correctResponse: 'Climb and maintain flight level 350, turn right heading 090, PAL456.',
      hints: [
        'Start with the instruction, not the call sign',
        'Include altitude in the format "flight level XXX"',
        'End with your call sign',
      ],
    },
    {
      id: 2,
      callSign: 'CEB789',
      aircraftType: 'Airbus A330',
      flightPhase: 'Approach',
      weather: 'Visibility 5000m, light rain',
      atcClearance: 'CEB789, descend and maintain 5000 feet, reduce speed to 180 knots.',
      correctResponse: 'Descend and maintain 5000 feet, reduce speed 180 knots, CEB789.',
      hints: [
        'Include altitude with "feet" for levels below transition',
        'Speed is typically stated without "to"',
        'Call sign goes at the end',
      ],
    },
    {
      id: 3,
      callSign: 'PAL123',
      aircraftType: 'Boeing 777',
      flightPhase: 'Cruise',
      weather: 'CB ahead',
      atcClearance: 'PAL123, turn left heading 270, weather deviation approved.',
      correctResponse: 'Turn left heading 270, weather deviation approved, PAL123.',
      hints: [
        'Acknowledge the heading instruction',
        'Confirm the weather deviation approval',
        'End with call sign',
      ],
    },
  ]

  const scenario = scenarios[currentScenario]

  const handleSubmit = () => {
    if (!userResponse.trim()) return

    // Simulate validation
    const isCorrect = userResponse.toLowerCase().includes(scenario.callSign.toLowerCase()) &&
      userResponse.toLowerCase().includes('heading') &&
      (userResponse.toLowerCase().includes('flight level') || userResponse.toLowerCase().includes('feet'))

    const score = isCorrect ? 92 : 65

    setFeedback({
      correct: isCorrect,
      score,
      corrections: isCorrect
        ? []
        : [
            'Missing call sign at the end of readback',
            'Altitude format should be "flight level XXX"',
          ],
      suggestion: scenario.correctResponse,
    })
    setIsSubmitted(true)
  }

  const handleNext = () => {
    setCurrentScenario((prev) => (prev + 1) % scenarios.length)
    setUserResponse('')
    setIsSubmitted(false)
    setFeedback(null)
    setShowHint(false)
  }

  const handleReset = () => {
    setUserResponse('')
    setIsSubmitted(false)
    setFeedback(null)
    setShowHint(false)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/training"
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scenario-Based Simulation</h1>
          <p className="text-gray-600">
            Scenario {currentScenario + 1} of {scenarios.length}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        {scenarios.map((_, index) => (
          <div
            key={index}
            className={`flex-1 h-2 rounded-full transition-all ${
              index < currentScenario
                ? 'bg-green-500'
                : index === currentScenario
                ? 'bg-primary-500'
                : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Scenario Card */}
      <div className="card overflow-hidden">
        {/* Scenario Header */}
        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Plane className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-lg font-bold">{scenario.callSign}</div>
                <div className="text-sm text-blue-100">{scenario.aircraftType}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-blue-100">Flight Phase</div>
              <div className="font-semibold">{scenario.flightPhase}</div>
            </div>
          </div>

          {/* Flight Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-blue-200" />
              <span className="text-sm">{scenario.weather}</span>
            </div>
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-blue-200" />
              <span className="text-sm">En Route</span>
            </div>
          </div>
        </div>

        {/* ATC Clearance */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">ATC Clearance</h3>
            <button
              onClick={() => isSpeaking ? stop() : speakATCClearance(scenario.atcClearance)}
              className={`p-2 hover:bg-gray-100 rounded-lg transition-colors ${
                isSpeaking ? 'bg-primary-100 text-primary-600' : ''
              }`}
              title={isSpeaking ? 'Stop audio' : 'Play audio'}
            >
              <Volume2 className={`w-5 h-5 ${isSpeaking ? 'animate-pulse' : 'text-gray-500'}`} />
            </button>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl border-l-4 border-primary-500">
            <p className="text-lg text-gray-800 font-medium">{scenario.atcClearance}</p>
          </div>
        </div>

        {/* Response Input */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Your Response</h3>
            <button
              onClick={() => setShowHint(!showHint)}
              className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
            >
              <HelpCircle className="w-4 h-4" />
              {showHint ? 'Hide Hints' : 'Show Hints'}
            </button>
          </div>

          {/* Hints */}
          {showHint && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <h4 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Hints
              </h4>
              <ul className="space-y-1">
                {scenario.hints.map((hint, index) => (
                  <li key={index} className="text-sm text-amber-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                    {hint}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <textarea
            value={userResponse}
            onChange={(e) => setUserResponse(e.target.value)}
            disabled={isSubmitted}
            placeholder="Type your readback response here..."
            className="input-field min-h-[120px] resize-none text-lg disabled:bg-gray-100"
          />

          {/* Action Buttons */}
          <div className="flex gap-3 mt-4">
            {!isSubmitted ? (
              <>
                <button
                  onClick={handleSubmit}
                  disabled={!userResponse.trim()}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Submit Response
                </button>
                <button onClick={handleReset} className="btn-secondary px-4">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button onClick={handleNext} className="btn-primary flex-1">
                Next Scenario
                <ChevronRight className="w-4 h-4 ml-2" />
              </button>
            )}
          </div>
        </div>

        {/* Feedback Section */}
        {feedback && (
          <div className={`p-6 border-t ${feedback.correct ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                feedback.correct ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {feedback.correct ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h4 className={`font-semibold ${feedback.correct ? 'text-green-800' : 'text-red-800'}`}>
                    {feedback.correct ? 'Excellent Response!' : 'Needs Improvement'}
                  </h4>
                  <span className={`text-2xl font-bold ${feedback.correct ? 'text-green-600' : 'text-red-600'}`}>
                    {feedback.score}%
                  </span>
                </div>

                {!feedback.correct && feedback.corrections.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-red-700 mb-2">Corrections needed:</p>
                    <ul className="space-y-1">
                      {feedback.corrections.map((correction, index) => (
                        <li key={index} className="text-sm text-red-600 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                          {correction}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="p-4 bg-white rounded-xl border border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-1">Suggested Response:</p>
                  <p className="text-gray-900">{feedback.suggestion}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tips Card */}
      <div className="card p-6 bg-primary-50 border-primary-100">
        <h3 className="font-semibold text-primary-900 mb-2">ICAO Phraseology Tip</h3>
        <p className="text-sm text-primary-700">
          Always end your readback with your call sign. This confirms to ATC that the correct
          aircraft received and understood the instruction.
        </p>
      </div>
    </div>
  )
}
