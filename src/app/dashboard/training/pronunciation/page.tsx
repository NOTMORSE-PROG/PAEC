'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Headphones,
  CheckCircle,
  XCircle,
  ChevronRight,
  RefreshCw,
  Volume2,
  Lightbulb,
  HelpCircle,
  VolumeX
} from 'lucide-react'
import { useTextToSpeech } from '@/hooks/useTextToSpeech'

interface PronunciationExercise {
  id: number
  type: 'number' | 'letter' | 'term'
  display: string
  correctPronunciation: string
  options: string[]
  audioHint: string
}

export default function PronunciationPage() {
  const [currentExercise, setCurrentExercise] = useState(0)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const { speak, isSpeaking, stop } = useTextToSpeech()

  const speakPronunciation = (text: string) => {
    if (isSpeaking) {
      stop()
    } else {
      // Speak slowly and clearly for pronunciation practice
      speak(text, { rate: 0.7, pitch: 1 })
    }
  }

  const exercises: PronunciationExercise[] = [
    {
      id: 1,
      type: 'number',
      display: '9',
      correctPronunciation: 'NINER',
      options: ['NINE', 'NINER', 'NAIN', 'NEIN'],
      audioHint: 'In ICAO phraseology, 9 is pronounced as "NINER" to avoid confusion with "NEIN" (German for no).',
    },
    {
      id: 2,
      type: 'number',
      display: '3',
      correctPronunciation: 'TREE',
      options: ['THREE', 'TREE', 'THRI', 'TRI'],
      audioHint: 'The number 3 is pronounced "TREE" in aviation to improve clarity over radio communications.',
    },
    {
      id: 3,
      type: 'number',
      display: '5',
      correctPronunciation: 'FIFE',
      options: ['FIVE', 'FIFE', 'FAIV', 'FIF'],
      audioHint: 'The number 5 is pronounced "FIFE" to distinguish it clearly from "FOUR" and "NINE".',
    },
    {
      id: 4,
      type: 'letter',
      display: 'A',
      correctPronunciation: 'ALFA',
      options: ['ALPHA', 'ALFA', 'AY', 'ABLE'],
      audioHint: 'In the NATO phonetic alphabet, A is "ALFA" (spelled without PH to avoid ambiguity).',
    },
    {
      id: 5,
      type: 'letter',
      display: 'J',
      correctPronunciation: 'JULIETT',
      options: ['JULIET', 'JULIETT', 'JAY', 'JULIA'],
      audioHint: 'J is "JULIETT" with double T at the end in the NATO phonetic alphabet.',
    },
    {
      id: 6,
      type: 'number',
      display: '1000',
      correctPronunciation: 'ONE TOUSAND',
      options: ['ONE THOUSAND', 'ONE TOUSAND', 'WUN TOUSAND', 'WUN THOUSAND'],
      audioHint: 'Thousands are pronounced with "TOUSAND" (without the TH sound) for clarity.',
    },
    {
      id: 7,
      type: 'term',
      display: 'FL350',
      correctPronunciation: 'FLIGHT LEVEL TREE FIFE ZERO',
      options: [
        'FLIGHT LEVEL THREE FIVE ZERO',
        'FLIGHT LEVEL TREE FIFE ZERO',
        'FLIGHT LEVEL 350',
        'FL THREE FIFTY'
      ],
      audioHint: 'Flight levels use modified number pronunciation: TREE for 3, FIFE for 5.',
    },
  ]

  const exercise = exercises[currentExercise]

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'number':
        return 'bg-blue-100 text-blue-700'
      case 'letter':
        return 'bg-green-100 text-green-700'
      case 'term':
        return 'bg-purple-100 text-purple-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const handleSubmit = () => {
    if (!selectedOption) return
    setIsSubmitted(true)
  }

  const handleNext = () => {
    setCurrentExercise((prev) => (prev + 1) % exercises.length)
    setSelectedOption(null)
    setIsSubmitted(false)
    setShowHint(false)
  }

  const handleReset = () => {
    setSelectedOption(null)
    setIsSubmitted(false)
    setShowHint(false)
  }

  const isCorrect = selectedOption === exercise.correctPronunciation

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
          <h1 className="text-2xl font-bold text-gray-900">Pronunciation Drill</h1>
          <p className="text-gray-600">
            Exercise {currentExercise + 1} of {exercises.length}
          </p>
        </div>
        <span className={`badge ${getTypeColor(exercise.type)}`}>
          {exercise.type.charAt(0).toUpperCase() + exercise.type.slice(1)}
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
        {/* Display Section */}
        <div className="p-8 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Headphones className="w-6 h-6" />
            <span className="font-medium">How do you pronounce this?</span>
          </div>
          <div className="text-6xl sm:text-8xl font-bold mb-4 tracking-wider">
            {exercise.display}
          </div>
          <button
            onClick={() => speakPronunciation(exercise.correctPronunciation)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
              isSpeaking
                ? 'bg-white/40 text-white'
                : 'bg-white/20 hover:bg-white/30 text-white'
            }`}
          >
            {isSpeaking ? (
              <VolumeX className="w-5 h-5 animate-pulse" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
            <span className="text-sm">{isSpeaking ? 'Stop' : 'Listen'}</span>
          </button>
        </div>

        {/* Options Section */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Select the correct ICAO pronunciation:</h3>
            <button
              onClick={() => setShowHint(!showHint)}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <HelpCircle className="w-4 h-4" />
              {showHint ? 'Hide' : 'Hint'}
            </button>
          </div>

          {/* Hint */}
          {showHint && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm text-amber-700">
                <Lightbulb className="w-4 h-4 inline mr-2" />
                {exercise.audioHint}
              </p>
            </div>
          )}

          {/* Options Grid */}
          <div className="grid sm:grid-cols-2 gap-3 mb-6">
            {exercise.options.map((option, index) => {
              const isSelected = selectedOption === option
              const isCorrectOption = option === exercise.correctPronunciation

              let optionStyle = 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              if (isSubmitted) {
                if (isCorrectOption) {
                  optionStyle = 'border-green-500 bg-green-50'
                } else if (isSelected && !isCorrectOption) {
                  optionStyle = 'border-red-500 bg-red-50'
                }
              } else if (isSelected) {
                optionStyle = 'border-primary-500 bg-primary-50'
              }

              return (
                <div
                  key={index}
                  className={`p-4 rounded-xl border-2 transition-all ${optionStyle} ${
                    isSubmitted ? 'cursor-default' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => !isSubmitted && setSelectedOption(option)}
                      disabled={isSubmitted}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      <span className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-sm font-medium text-gray-600">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className={`font-medium ${
                        isSubmitted && isCorrectOption
                          ? 'text-green-700'
                          : isSubmitted && isSelected && !isCorrectOption
                          ? 'text-red-700'
                          : 'text-gray-900'
                      }`}>
                        {option}
                      </span>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          speakPronunciation(option)
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title={`Listen to "${option}"`}
                      >
                        <Volume2 className="w-4 h-4 text-gray-500" />
                      </button>
                      {isSubmitted && isCorrectOption && (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      )}
                      {isSubmitted && isSelected && !isCorrectOption && (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      {!isSubmitted && isSelected && (
                        <div className="w-3 h-3 bg-primary-500 rounded-full" />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {!isSubmitted ? (
              <>
                <button
                  onClick={handleSubmit}
                  disabled={!selectedOption}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Check Answer
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
          <div className={`p-6 border-t ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                isCorrect ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {isCorrect ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600" />
                )}
              </div>
              <div>
                <h4 className={`font-semibold ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                  {isCorrect ? 'Correct!' : 'Incorrect'}
                </h4>
                <p className={`text-sm mt-1 ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                  The correct ICAO pronunciation is: <strong>{exercise.correctPronunciation}</strong>
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  {exercise.audioHint}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reference Card */}
      <div className="card p-6 bg-emerald-50 border-emerald-100">
        <h3 className="font-semibold text-emerald-900 mb-4 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-emerald-600" />
          ICAO Number Pronunciation
        </h3>
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
          {[
            { num: '0', pron: 'ZERO' },
            { num: '1', pron: 'WUN' },
            { num: '2', pron: 'TOO' },
            { num: '3', pron: 'TREE' },
            { num: '4', pron: 'FOW-ER' },
            { num: '5', pron: 'FIFE' },
            { num: '6', pron: 'SIX' },
            { num: '7', pron: 'SEV-EN' },
            { num: '8', pron: 'AIT' },
            { num: '9', pron: 'NIN-ER' },
          ].map((item) => (
            <div key={item.num} className="text-center p-2 bg-white rounded-lg border border-emerald-200">
              <div className="text-lg font-bold text-emerald-700">{item.num}</div>
              <div className="text-xs text-emerald-600">{item.pron}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
