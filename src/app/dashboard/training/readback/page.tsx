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
  Lightbulb
} from 'lucide-react'
import { useTextToSpeech } from '@/hooks/useTextToSpeech'

interface ReadbackExercise {
  id: number
  atcInstruction: string
  pilotReadback: string
  errors: {
    type: string
    original: string
    incorrect: string
    correct: string
  }[]
  difficulty: 'easy' | 'medium' | 'hard'
}

export default function ReadbackPage() {
  const [currentExercise, setCurrentExercise] = useState(0)
  const [selectedErrors, setSelectedErrors] = useState<string[]>([])
  const [corrections, setCorrections] = useState<Record<string, string>>({})
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
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
      errors: [
        {
          type: 'Number Error',
          original: 'flight level 250',
          incorrect: 'flight level 150',
          correct: 'flight level 250',
        },
      ],
      difficulty: 'easy',
    },
    {
      id: 2,
      atcInstruction: 'CEB789, climb and maintain 10000 feet, reduce speed to 220 knots, contact approach 119.1.',
      pilotReadback: 'Climb maintain 10000 feet, speed 220 knots, contact approach 119.1, CEB789.',
      errors: [
        {
          type: 'Missing Word',
          original: 'climb and maintain',
          incorrect: 'climb maintain',
          correct: 'climb and maintain',
        },
        {
          type: 'Missing Word',
          original: 'reduce speed to',
          incorrect: 'speed',
          correct: 'reduce speed to',
        },
      ],
      difficulty: 'medium',
    },
    {
      id: 3,
      atcInstruction: 'PAL123, hold short runway 24, give way to traffic on final, expect 3 minutes delay.',
      pilotReadback: 'Hold short runway 06, PAL123.',
      errors: [
        {
          type: 'Runway Error',
          original: 'runway 24',
          incorrect: 'runway 06',
          correct: 'runway 24',
        },
        {
          type: 'Missing Element',
          original: 'give way to traffic on final',
          incorrect: '(not mentioned)',
          correct: 'give way to traffic on final',
        },
        {
          type: 'Missing Element',
          original: 'expect 3 minutes delay',
          incorrect: '(not mentioned)',
          correct: 'expect 3 minutes delay',
        },
      ],
      difficulty: 'hard',
    },
  ]

  const exercise = exercises[currentExercise]

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

  const toggleError = (error: string) => {
    setSelectedErrors((prev) =>
      prev.includes(error)
        ? prev.filter((e) => e !== error)
        : [...prev, error]
    )
  }

  const handleSubmit = () => {
    setIsSubmitted(true)
  }

  const handleNext = () => {
    setCurrentExercise((prev) => (prev + 1) % exercises.length)
    setSelectedErrors([])
    setCorrections({})
    setIsSubmitted(false)
    setShowAnswer(false)
  }

  const handleReset = () => {
    setSelectedErrors([])
    setCorrections({})
    setIsSubmitted(false)
    setShowAnswer(false)
  }

  const calculateScore = () => {
    const correctCount = selectedErrors.filter((err) =>
      exercise.errors.some((e) => e.incorrect === err || e.type === err)
    ).length
    return Math.round((correctCount / exercise.errors.length) * 100)
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
              Pilot&apos;s Readback (Contains Errors)
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
            {exercise.errors.length} error{exercise.errors.length > 1 ? 's' : ''} to find
          </p>
        </div>

        {/* Error Selection */}
        <div className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Identify the Errors</h3>
          <p className="text-sm text-gray-600 mb-4">
            Click on the elements that contain errors in the pilot&apos;s readback:
          </p>

          <div className="space-y-3 mb-6">
            {exercise.errors.map((error, index) => (
              <button
                key={index}
                onClick={() => !isSubmitted && toggleError(error.incorrect)}
                disabled={isSubmitted}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  selectedErrors.includes(error.incorrect)
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${isSubmitted ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-900">{error.type}</span>
                    <span className="text-gray-500 ml-2">— &quot;{error.incorrect}&quot;</span>
                  </div>
                  {selectedErrors.includes(error.incorrect) && (
                    <CheckCircle className="w-5 h-5 text-primary-600" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Show Answer Button */}
          {!isSubmitted && (
            <button
              onClick={() => setShowAnswer(!showAnswer)}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1 mb-4"
            >
              <Eye className="w-4 h-4" />
              {showAnswer ? 'Hide Correct Response' : 'Show Correct Response'}
            </button>
          )}

          {showAnswer && !isSubmitted && (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 mb-6">
              <h4 className="font-medium text-gray-700 mb-2">Correct Readback:</h4>
              <p className="text-gray-900">
                Descend and maintain flight level 250, turn left heading 180, PAL456.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {!isSubmitted ? (
              <>
                <button
                  onClick={handleSubmit}
                  disabled={selectedErrors.length === 0}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Target className="w-4 h-4 mr-2" />
                  Submit Answer
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

            <div className="space-y-3">
              {exercise.errors.map((error, index) => {
                const found = selectedErrors.includes(error.incorrect)
                return (
                  <div
                    key={index}
                    className={`p-4 rounded-xl ${found ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}
                  >
                    <div className="flex items-start gap-3">
                      {found ? (
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                      )}
                      <div>
                        <p className={`font-medium ${found ? 'text-green-800' : 'text-red-800'}`}>
                          {error.type}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          <span className="line-through text-red-600">{error.incorrect}</span>
                          <span className="mx-2">→</span>
                          <span className="text-green-600 font-medium">{error.correct}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
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
