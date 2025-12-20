'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle,
  XCircle,
  ChevronRight,
  RefreshCw,
  Lightbulb,
} from 'lucide-react'

interface JumbledExercise {
  id: number
  instruction: string
  correctOrder: string[]
  jumbledWords: string[]
  category: string
}

export default function JumbledPage() {
  const [currentExercise, setCurrentExercise] = useState(0)
  const [wordBank, setWordBank] = useState<string[]>([])
  const [arrangedWords, setArrangedWords] = useState<string[]>([])
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [draggedWord, setDraggedWord] = useState<string | null>(null)
  const [dragSource, setDragSource] = useState<'bank' | 'arranged' | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const exercises: JumbledExercise[] = [
    {
      id: 1,
      instruction: 'Arrange the words to form a correct pilot readback:',
      correctOrder: ['Climb', 'and', 'maintain', 'flight', 'level', '350', 'PAL456'],
      jumbledWords: ['PAL456', 'level', 'maintain', '350', 'Climb', 'flight', 'and'],
      category: 'Altitude Clearance',
    },
    {
      id: 2,
      instruction: 'Arrange the words to form a correct taxi clearance readback:',
      correctOrder: ['Taxi', 'to', 'holding', 'point', 'runway', '24', 'via', 'taxiway', 'Alpha', 'CEB789'],
      jumbledWords: ['Alpha', 'runway', 'Taxi', 'CEB789', 'holding', '24', 'taxiway', 'to', 'via', 'point'],
      category: 'Taxi Clearance',
    },
    {
      id: 3,
      instruction: 'Arrange the words to form a correct heading and speed clearance:',
      correctOrder: ['Turn', 'right', 'heading', '090', 'reduce', 'speed', '180', 'knots', 'PAL123'],
      jumbledWords: ['090', 'PAL123', 'speed', 'Turn', 'heading', '180', 'right', 'reduce', 'knots'],
      category: 'Heading/Speed',
    },
  ]

  const exercise = exercises[currentExercise]

  useEffect(() => {
    setWordBank([...exercise.jumbledWords])
    setArrangedWords([])
  }, [currentExercise])

  // Drag from word bank
  const handleBankDragStart = (e: React.DragEvent<HTMLDivElement>, word: string, index: number) => {
    if (isSubmitted) return
    setDraggedWord(word)
    setDragSource('bank')
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  // Drag from arranged area
  const handleArrangedDragStart = (e: React.DragEvent<HTMLDivElement>, word: string, index: number) => {
    if (isSubmitted) return
    setDraggedWord(word)
    setDragSource('arranged')
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  // Drop into arranged area
  const handleArrangedDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!draggedWord || isSubmitted) return

    if (dragSource === 'bank' && draggedIndex !== null) {
      // Move from bank to arranged
      const newBank = [...wordBank]
      newBank.splice(draggedIndex, 1)
      setWordBank(newBank)
      setArrangedWords([...arrangedWords, draggedWord])
    }

    resetDragState()
  }

  // Drop back into word bank
  const handleBankDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!draggedWord || isSubmitted) return

    if (dragSource === 'arranged' && draggedIndex !== null) {
      // Move from arranged back to bank
      const newArranged = [...arrangedWords]
      newArranged.splice(draggedIndex, 1)
      setArrangedWords(newArranged)
      setWordBank([...wordBank, draggedWord])
    }

    resetDragState()
  }

  // Click to move word from bank to arranged
  const handleWordClick = (word: string, index: number, source: 'bank' | 'arranged') => {
    if (isSubmitted) return

    if (source === 'bank') {
      const newBank = [...wordBank]
      newBank.splice(index, 1)
      setWordBank(newBank)
      setArrangedWords([...arrangedWords, word])
    } else {
      const newArranged = [...arrangedWords]
      newArranged.splice(index, 1)
      setArrangedWords(newArranged)
      setWordBank([...wordBank, word])
    }
  }

  const resetDragState = () => {
    setDraggedWord(null)
    setDragSource(null)
    setDraggedIndex(null)
  }

  const handleDragEnd = () => {
    resetDragState()
  }

  const handleSubmit = () => {
    if (arrangedWords.length !== exercise.correctOrder.length) return

    let correctCount = 0
    for (let i = 0; i < exercise.correctOrder.length; i++) {
      if (arrangedWords[i] === exercise.correctOrder[i]) {
        correctCount++
      }
    }
    setScore(Math.round((correctCount / exercise.correctOrder.length) * 100))
    setIsSubmitted(true)
  }

  const handleNext = () => {
    setCurrentExercise((prev) => (prev + 1) % exercises.length)
    setIsSubmitted(false)
    setScore(null)
  }

  const handleReset = () => {
    setWordBank([...exercise.jumbledWords])
    setArrangedWords([])
    setIsSubmitted(false)
    setScore(null)
  }

  const isWordCorrect = (word: string, index: number) => {
    return exercise.correctOrder[index] === word
  }

  const canSubmit = arrangedWords.length === exercise.correctOrder.length

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
          <h1 className="text-2xl font-bold text-gray-900">Jumbled Clearance</h1>
          <p className="text-gray-600">
            Exercise {currentExercise + 1} of {exercises.length}
          </p>
        </div>
        <span className="badge bg-violet-100 text-violet-700">
          {exercise.category}
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
        {/* Instruction Header */}
        <div className="p-6 bg-gradient-to-r from-violet-500 to-pink-500 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-lg">Arrange the Clearance</h3>
          </div>
          <p className="text-violet-100">{exercise.instruction}</p>
        </div>

        {/* Word Bank */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Word Bank</h3>
            {!isSubmitted && (
              <p className="text-sm text-gray-500">
                Click or drag words to arrange
              </p>
            )}
          </div>

          {/* Scattered Word Chips */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleBankDrop}
            className={`flex flex-wrap gap-3 min-h-[80px] p-4 rounded-2xl border-2 border-dashed transition-all ${
              dragSource === 'arranged'
                ? 'border-primary-400 bg-primary-50'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            {wordBank.length === 0 ? (
              <p className="text-gray-400 text-sm w-full text-center py-4">
                {isSubmitted ? 'All words placed' : 'Drop words here to remove'}
              </p>
            ) : (
              wordBank.map((word, index) => (
                <div
                  key={`bank-${word}-${index}`}
                  draggable={!isSubmitted}
                  onDragStart={(e) => handleBankDragStart(e, word, index)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleWordClick(word, index, 'bank')}
                  className={`px-4 py-2.5 rounded-full border-2 font-medium transition-all select-none ${
                    isSubmitted
                      ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-default'
                      : draggedWord === word && dragSource === 'bank'
                      ? 'bg-primary-100 border-primary-400 text-primary-700 opacity-50'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:shadow-md cursor-grab active:cursor-grabbing active:scale-95'
                  }`}
                >
                  {word}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Answer Drop Zone */}
        <div className="px-6 pb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Your Answer</h3>
            {!isSubmitted && arrangedWords.length > 0 && (
              <button
                onClick={handleReset}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <RefreshCw className="w-4 h-4" />
                Reset
              </button>
            )}
          </div>

          {/* Drop Zone for Arranged Words */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleArrangedDrop}
            className={`flex flex-wrap gap-3 min-h-[100px] p-4 rounded-2xl border-2 transition-all mb-6 ${
              isSubmitted
                ? score !== null && score >= 80
                  ? 'border-green-400 bg-green-50'
                  : 'border-red-400 bg-red-50'
                : dragSource === 'bank'
                ? 'border-primary-400 bg-primary-50 border-dashed'
                : arrangedWords.length === 0
                ? 'border-gray-300 bg-gray-50 border-dashed'
                : 'border-gray-200 bg-white'
            }`}
          >
            {arrangedWords.length === 0 ? (
              <p className="text-gray-400 text-sm w-full text-center py-6">
                {dragSource === 'bank' ? 'Drop here!' : 'Click or drag words here to form your answer'}
              </p>
            ) : (
              arrangedWords.map((word, index) => (
                <div
                  key={`arranged-${word}-${index}`}
                  draggable={!isSubmitted}
                  onDragStart={(e) => handleArrangedDragStart(e, word, index)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleWordClick(word, index, 'arranged')}
                  className={`px-4 py-2.5 rounded-full border-2 font-medium transition-all select-none ${
                    isSubmitted
                      ? isWordCorrect(word, index)
                        ? 'bg-green-100 border-green-400 text-green-700'
                        : 'bg-red-100 border-red-400 text-red-700'
                      : draggedWord === word && dragSource === 'arranged'
                      ? 'bg-primary-100 border-primary-400 text-primary-700 opacity-50'
                      : 'bg-primary-50 border-primary-300 text-primary-700 hover:border-primary-400 hover:shadow-md cursor-grab active:cursor-grabbing active:scale-95'
                  }`}
                >
                  {word}
                  {isSubmitted && (
                    isWordCorrect(word, index) ? (
                      <CheckCircle className="w-4 h-4 ml-2 inline" />
                    ) : (
                      <XCircle className="w-4 h-4 ml-2 inline" />
                    )
                  )}
                </div>
              ))
            )}
          </div>

          {/* Preview Sentence */}
          {arrangedWords.length > 0 && (
            <div className="p-4 bg-gray-100 rounded-xl mb-6">
              <p className="text-sm text-gray-500 mb-1">Your sentence:</p>
              <p className="text-gray-900 font-medium">
                {arrangedWords.join(' ')}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {!isSubmitted ? (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Check Answer
                {!canSubmit && (
                  <span className="ml-2 text-sm opacity-75">
                    ({arrangedWords.length}/{exercise.correctOrder.length} words)
                  </span>
                )}
              </button>
            ) : (
              <button onClick={handleNext} className="btn-primary flex-1">
                Next Exercise
                <ChevronRight className="w-4 h-4 ml-2" />
              </button>
            )}
          </div>
        </div>

        {/* Results Section */}
        {isSubmitted && score !== null && (
          <div className={`p-6 border-t ${score >= 80 ? 'bg-green-50' : 'bg-amber-50'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Results</h3>
              <span className={`text-2xl font-bold ${
                score >= 80 ? 'text-green-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {score}%
              </span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-gray-200">
              <p className="text-sm text-gray-500 mb-2">Correct Order:</p>
              <div className="flex flex-wrap gap-2">
                {exercise.correctOrder.map((word, index) => (
                  <span
                    key={index}
                    className="px-3 py-1.5 rounded-full bg-green-100 border border-green-300 text-green-700 text-sm font-medium"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tips Card */}
      <div className="card p-6 bg-violet-50 border-violet-100">
        <h3 className="font-semibold text-violet-900 mb-2 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-violet-600" />
          Standard Phraseology Structure
        </h3>
        <ul className="space-y-2 text-sm text-violet-700">
          <li className="flex items-center gap-2">
            <span className="w-6 h-6 bg-violet-200 rounded-full flex items-center justify-center text-xs font-medium">1</span>
            Action verb (Climb, Descend, Turn, Taxi)
          </li>
          <li className="flex items-center gap-2">
            <span className="w-6 h-6 bg-violet-200 rounded-full flex items-center justify-center text-xs font-medium">2</span>
            Connecting words (and, to, via)
          </li>
          <li className="flex items-center gap-2">
            <span className="w-6 h-6 bg-violet-200 rounded-full flex items-center justify-center text-xs font-medium">3</span>
            Values (altitude, heading, speed)
          </li>
          <li className="flex items-center gap-2">
            <span className="w-6 h-6 bg-violet-200 rounded-full flex items-center justify-center text-xs font-medium">4</span>
            Call sign at the end
          </li>
        </ul>
      </div>
    </div>
  )
}
