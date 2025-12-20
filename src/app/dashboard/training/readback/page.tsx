'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Target,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Volume2,
  VolumeX,
  Eye,
  Lightbulb,
  Edit3
} from 'lucide-react'
import { useTextToSpeech } from '@/hooks/useTextToSpeech'

interface ReadbackExercise {
  id: number
  atcInstruction: string
  pilotReadback: string
  correctReadback: string
  errors: {
    type: string
    original: string
    incorrect: string
    correct: string
    position: number
  }[]
  difficulty: 'easy' | 'medium' | 'hard'
}

export default function ReadbackPage() {
  const [currentExercise, setCurrentExercise] = useState(0)
  const [userCorrection, setUserCorrection] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
  const [showHints, setShowHints] = useState(false)
  const [currentlyPlaying, setCurrentlyPlaying] = useState<'atc' | 'pilot' | null>(null)
  const { speak, isSpeaking, stop } = useTextToSpeech()

  // Reset currentlyPlaying when speech ends
  useEffect(() => {
    if (!isSpeaking) {
      setCurrentlyPlaying(null)
    }
  }, [isSpeaking])

  const speakATC = (text: string) => {
    if (isSpeaking && currentlyPlaying === 'atc') {
      stop()
      setCurrentlyPlaying(null)
    } else {
      stop()
      setCurrentlyPlaying('atc')
      // Slightly slower, professional ATC voice
      speak(text, { rate: 0.85, pitch: 1 })
    }
  }

  const speakPilot = (text: string) => {
    if (isSpeaking && currentlyPlaying === 'pilot') {
      stop()
      setCurrentlyPlaying(null)
    } else {
      stop()
      setCurrentlyPlaying('pilot')
      // Slightly different voice settings for pilot
      speak(text, { rate: 0.9, pitch: 1.1 })
    }
  }

  const exercises: ReadbackExercise[] = [
    {
      id: 1,
      atcInstruction: 'PAL456, descend and maintain flight level 250, turn left heading 180.',
      pilotReadback: 'Descend and maintain flight level 150, turn left heading 180, PAL456.',
      correctReadback: 'Descend and maintain flight level 250, turn left heading 180, PAL456.',
      errors: [
        {
          type: 'Number Error',
          original: 'flight level 250',
          incorrect: 'flight level 150',
          correct: 'flight level 250',
          position: 28,
        },
      ],
      difficulty: 'easy',
    },
    {
      id: 2,
      atcInstruction: 'CEB789, climb and maintain 10000 feet, reduce speed to 220 knots, contact approach 119.1.',
      pilotReadback: 'Climb maintain 10000 feet, speed 220 knots, contact approach 119.1, CEB789.',
      correctReadback: 'Climb and maintain 10000 feet, reduce speed to 220 knots, contact approach 119.1, CEB789.',
      errors: [
        {
          type: 'Missing Word',
          original: 'climb and maintain',
          incorrect: 'climb maintain',
          correct: 'climb and maintain',
          position: 0,
        },
        {
          type: 'Missing Word',
          original: 'reduce speed to',
          incorrect: 'speed',
          correct: 'reduce speed to',
          position: 29,
        },
      ],
      difficulty: 'medium',
    },
    {
      id: 3,
      atcInstruction: 'PAL123, hold short runway 24, give way to traffic on final, expect 3 minutes delay.',
      pilotReadback: 'Hold short runway 06, PAL123.',
      correctReadback: 'Hold short runway 24, give way to traffic on final, expect 3 minutes delay, PAL123.',
      errors: [
        {
          type: 'Runway Error',
          original: 'runway 24',
          incorrect: 'runway 06',
          correct: 'runway 24',
          position: 17,
        },
        {
          type: 'Missing Element',
          original: 'give way to traffic on final',
          incorrect: '(not mentioned)',
          correct: 'give way to traffic on final',
          position: 0,
        },
        {
          type: 'Missing Element',
          original: 'expect 3 minutes delay',
          incorrect: '(not mentioned)',
          correct: 'expect 3 minutes delay',
          position: 0,
        },
      ],
      difficulty: 'hard',
    },
    {
      id: 4,
      atcInstruction: 'CEB321, taxi to holding point Alpha 7, via taxiway Charlie, hold short of runway 13.',
      pilotReadback: 'Taxi to holding point Alpha 5, via taxiway Charlie, CEB321.',
      correctReadback: 'Taxi to holding point Alpha 7, via taxiway Charlie, hold short of runway 13, CEB321.',
      errors: [
        {
          type: 'Number Error',
          original: 'Alpha 7',
          incorrect: 'Alpha 5',
          correct: 'Alpha 7',
          position: 25,
        },
        {
          type: 'Missing Element',
          original: 'hold short of runway 13',
          incorrect: '(not mentioned)',
          correct: 'hold short of runway 13',
          position: 0,
        },
      ],
      difficulty: 'medium',
    },
  ]

  const exercise = exercises[currentExercise]

  // Initialize user correction with pilot's readback
  useEffect(() => {
    setUserCorrection(exercise.pilotReadback)
    setIsSubmitted(false)
    setShowAnswer(false)
    setShowHints(false)
  }, [currentExercise, exercise.pilotReadback])

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-100 text-green-700'
      case 'medium':
        return 'bg-amber-100 text-amber-700'
      case 'hard':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const handleSubmit = () => {
    setIsSubmitted(true)
  }

  const handleNext = () => {
    setCurrentExercise((prev) => (prev + 1) % exercises.length)
  }

  const handleReset = () => {
    setUserCorrection(exercise.pilotReadback)
    setIsSubmitted(false)
    setShowAnswer(false)
    setShowHints(false)
  }

  const calculateScore = () => {
    const userCorrectionLower = userCorrection.toLowerCase().trim()
    const correctReadbackLower = exercise.correctReadback.toLowerCase().trim()

    if (userCorrectionLower === correctReadbackLower) {
      return 100
    }

    // Calculate similarity based on error corrections
    let correctionsFound = 0
    exercise.errors.forEach(error => {
      const correctLower = error.correct.toLowerCase()
      if (userCorrectionLower.includes(correctLower)) {
        correctionsFound++
      }
    })

    return Math.round((correctionsFound / exercise.errors.length) * 100)
  }

  const getDetailedFeedback = () => {
    const feedback: { error: typeof exercise.errors[0], fixed: boolean }[] = []

    exercise.errors.forEach(error => {
      const userLower = userCorrection.toLowerCase()
      const correctLower = error.correct.toLowerCase()
      const incorrectLower = error.incorrect.toLowerCase()

      // Check if the user fixed this error
      const hasCorrectPhrase = userLower.includes(correctLower)
      const removedIncorrect = !userLower.includes(incorrectLower) || error.incorrect === '(not mentioned)'

      feedback.push({
        error,
        fixed: hasCorrectPhrase && removedIncorrect
      })
    })

    return feedback
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
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Readback/Hearback Correction</h1>
          <p className="text-gray-600">
            Exercise {currentExercise + 1} of {exercises.length}
          </p>
        </div>
        <span className={`badge ${getDifficultyColor(exercise.difficulty)}`}>
          {exercise.difficulty.charAt(0).toUpperCase() + exercise.difficulty.slice(1)}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        {exercises.map((_, index) => (
          <div
            key={index}
            className={`flex-1 h-2 rounded-full transition-all ${
              index < currentExercise
                ? 'bg-green-500'
                : index === currentExercise
                ? 'bg-primary-500'
                : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Exercise Card */}
      <div className="card overflow-hidden">
        {/* ATC Instruction */}
        <div className="p-6 bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-indigo-100">Original ATC Instruction</h3>
            <button
              onClick={() => speakATC(exercise.atcInstruction)}
              className={`p-2 rounded-lg transition-colors ${
                isSpeaking && currentlyPlaying === 'atc'
                  ? 'bg-white/30'
                  : 'hover:bg-white/10'
              }`}
              title="Listen to ATC instruction"
            >
              {isSpeaking && currentlyPlaying === 'atc' ? (
                <VolumeX className="w-5 h-5 animate-pulse" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-lg font-medium">{exercise.atcInstruction}</p>
        </div>

        {/* Pilot Readback */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Pilot&apos;s Incorrect Readback
            </h3>
            <button
              onClick={() => speakPilot(exercise.pilotReadback)}
              className={`p-2 rounded-lg transition-colors ${
                isSpeaking && currentlyPlaying === 'pilot'
                  ? 'bg-amber-100'
                  : 'hover:bg-gray-100'
              }`}
              title="Listen to pilot readback"
            >
              {isSpeaking && currentlyPlaying === 'pilot' ? (
                <VolumeX className="w-5 h-5 text-amber-600 animate-pulse" />
              ) : (
                <Volume2 className="w-5 h-5 text-gray-500" />
              )}
            </button>
          </div>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-lg text-amber-900">{exercise.pilotReadback}</p>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {exercise.errors.length} error{exercise.errors.length > 1 ? 's' : ''} to correct
          </p>
        </div>

        {/* Correction Input */}
        <div className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-primary-500" />
            Your Correction
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Edit the pilot&apos;s readback below to correct all errors:
          </p>

          <textarea
            value={userCorrection}
            onChange={(e) => setUserCorrection(e.target.value)}
            disabled={isSubmitted}
            className={`w-full h-32 p-4 rounded-xl border-2 text-gray-900 resize-none focus:outline-none transition-all ${
              isSubmitted
                ? 'bg-gray-50 border-gray-200 cursor-not-allowed'
                : 'bg-white border-primary-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100'
            }`}
            placeholder="Type the corrected readback here..."
          />

          {/* Hints Section */}
          <div className="mt-4">
            <button
              onClick={() => setShowHints(!showHints)}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1 mb-3"
            >
              <Lightbulb className="w-4 h-4" />
              {showHints ? 'Hide Hints' : 'Show Error Hints'}
            </button>

            {showHints && !isSubmitted && (
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 mb-4">
                <h4 className="font-medium text-blue-900 mb-3">Error Types Found:</h4>
                <ul className="space-y-2">
                  {exercise.errors.map((error, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-blue-800">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5"></span>
                      <span><strong>{error.type}:</strong> Check &quot;{error.incorrect !== '(not mentioned)' ? error.incorrect : 'missing elements'}&quot;</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Show Answer Button */}
          {!isSubmitted && (
            <button
              onClick={() => setShowAnswer(!showAnswer)}
              className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1 mb-4"
            >
              <Eye className="w-4 h-4" />
              {showAnswer ? 'Hide Correct Answer' : 'Show Correct Answer'}
            </button>
          )}

          {showAnswer && !isSubmitted && (
            <div className="p-4 bg-green-50 rounded-xl border border-green-200 mb-6">
              <h4 className="font-medium text-green-800 mb-2">Correct Readback:</h4>
              <p className="text-green-900">{exercise.correctReadback}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            {!isSubmitted ? (
              <>
                <button
                  onClick={handleSubmit}
                  disabled={!userCorrection.trim() || userCorrection === exercise.pilotReadback}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Target className="w-4 h-4 mr-2" />
                  Submit Correction
                </button>
                <button onClick={handleReset} className="btn-secondary px-4">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button onClick={handleNext} className="btn-primary flex-1">
                Next Exercise
                <ChevronRight className="w-4 h-4 ml-2" />
              </button>
            )}
          </div>
        </div>

        {/* Results Section */}
        {isSubmitted && (
          <div className="p-6 border-t bg-gray-50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Results</h3>
              <span className={`text-2xl font-bold ${
                calculateScore() >= 80 ? 'text-green-600' : calculateScore() >= 50 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {calculateScore()}%
              </span>
            </div>

            {/* User's Answer */}
            <div className="mb-4 p-4 bg-white rounded-xl border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Your Correction:</h4>
              <p className="text-gray-900">{userCorrection}</p>
            </div>

            {/* Correct Answer */}
            <div className="mb-4 p-4 bg-green-50 rounded-xl border border-green-200">
              <h4 className="text-sm font-medium text-green-800 mb-2">Correct Readback:</h4>
              <p className="text-green-900">{exercise.correctReadback}</p>
            </div>

            {/* Detailed Feedback */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Error Analysis:</h4>
              {getDetailedFeedback().map((item, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl ${item.fixed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}
                >
                  <div className="flex items-start gap-3">
                    {item.fixed ? (
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={`font-medium ${item.fixed ? 'text-green-800' : 'text-red-800'} mb-1`}>
                        {item.error.type}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="line-through text-red-600">{item.error.incorrect}</span>
                        <span className="mx-2">→</span>
                        <span className="text-green-600 font-medium">{item.error.correct}</span>
                      </p>
                      {!item.fixed && (
                        <p className="text-xs text-red-700 mt-2">
                          You need to replace &quot;{item.error.incorrect}&quot; with &quot;{item.error.correct}&quot;
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tips Card */}
      <div className="card p-6 bg-indigo-50 border-indigo-100">
        <h3 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-indigo-600" />
          Common Readback Errors
        </h3>
        <ul className="space-y-2 text-sm text-indigo-700">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
            Number transposition (e.g., 250 → 150)
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
            Missing mandatory words (and, maintain, to)
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
            Incomplete readback of all elements
          </li>
        </ul>
      </div>
    </div>
  )
}
