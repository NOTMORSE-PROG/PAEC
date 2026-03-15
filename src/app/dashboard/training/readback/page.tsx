'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Target, ChevronRight, Trophy, RotateCcw, CheckCircle, XCircle, Loader2, AlertTriangle, Volume2, Lightbulb, RefreshCw, Mic, MicOff } from 'lucide-react'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { AVIATION_VOCABULARY } from '@/lib/speechNormalize'

type SessionState = 'intro' | 'quiz' | 'results'

interface Question {
  id: string
  category: string
  difficulty: string
  question_data: {
    atcInstruction: string
    incorrectReadback: string
    correctReadback: string
    errors?: { type: string; field: string; wrong: string; correct: string }[]
    explanation?: string
  }
}

interface HistoryData { bestScore: number | null; count: number }

function highlightAll(
  text: string,
  errors: { wrong: string; correct: string }[],
  mode: 'incorrect' | 'answer'
): ReactNode {
  if (!text || errors.length === 0) return text
  const [e, ...rest] = errors
  let phrase = ''
  let className = ''
  if (mode === 'incorrect') {
    if (text.toLowerCase().includes(e.wrong.toLowerCase())) {
      phrase = e.wrong; className = 'bg-amber-200 rounded px-0.5 not-italic'
    }
  } else {
    if (text.toLowerCase().includes(e.wrong.toLowerCase())) {
      phrase = e.wrong; className = 'bg-red-200 rounded px-0.5 not-italic'
    } else if (e.correct && text.toLowerCase().includes(e.correct.toLowerCase())) {
      phrase = e.correct; className = 'bg-green-200 rounded px-0.5 not-italic'
    }
  }
  if (!phrase) return highlightAll(text, rest, mode)
  const idx = text.toLowerCase().indexOf(phrase.toLowerCase())
  const before = text.slice(0, idx)
  const matched = text.slice(idx, idx + phrase.length)
  const after = text.slice(idx + phrase.length)
  return <>{before ? highlightAll(before, rest, mode) : null}<mark className={className}>{matched}</mark>{after ? highlightAll(after, rest, mode) : null}</>
}

function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.8
  window.speechSynthesis.speak(u)
}

const COMMON_ERRORS = [
  'Number transposition (e.g., 250 → 150)',
  'Missing mandatory words (and, maintain, to)',
  'Incomplete readback of all elements',
]

export default function ReadbackPage() {
  const router = useRouter()
  const [state, setState] = useState<SessionState>('intro')
  const [history, setHistory] = useState<HistoryData>({ bestScore: null, count: 0 })
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [sessionId, setSessionId] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [score, setScore] = useState(0)
  const [questionScores, setQuestionScores] = useState<Record<string, number>>({})
  const [resultQuestions, setResultQuestions] = useState<Question[]>([])
  const [openAccordion, setOpenAccordion] = useState<string | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [showHints, setShowHints] = useState(false)
  const { isSupported, isListening, interimText, error: speechError, toggleListening, stopListening } = useSpeechRecognition({ vocabulary: AVIATION_VOCABULARY })

  useEffect(() => {
    fetch('/api/training/history?category=readback')
      .then(r => r.json())
      .then(d => setHistory({ bestScore: d.bestScore, count: d.count }))
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [])

  useEffect(() => { setShowHints(false); stopListening() }, [currentIdx, stopListening])

  const startSession = async () => {
    setStarting(true); setError('')
    try {
      const res = await fetch('/api/training/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'readback' }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to start session.'); return }
      setSessionId(data.sessionId); setQuestions(data.questions)
      // Pre-fill textarea with the incorrect readback so user edits it
      setAnswers(Object.fromEntries(data.questions.map((q: Question) => [q.id, q.question_data.incorrectReadback ?? ''])))
      setState('quiz')
    } catch { setError('Network error. Please try again.') }
    finally { setStarting(false) }
  }

  const submitSession = async () => {
    if (submitting) return
    setSubmitting(true); setError('')
    try {
      const res = await fetch(`/api/training/session/${sessionId}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to submit.'); return }
      setScore(data.score); setQuestionScores(data.questionScores); setResultQuestions(data.questions)
      setState('results')
    } catch { setError('Network error. Please try again.') }
    finally { setSubmitting(false) }
  }

  const tryAgain = () => {
    setQuestions([]); setAnswers({}); setError(''); setCurrentIdx(0); setState('intro')
    fetch('/api/training/history?category=readback').then(r => r.json()).then(d => setHistory({ bestScore: d.bestScore, count: d.count })).catch(() => {})
  }

  const scoreColor = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'
  const scoreBg = score >= 80 ? 'bg-green-50 border-green-200' : score >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'

  // ── INTRO ─────────────────────────────────────────────────────────────────
  if (state === 'intro') return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <button onClick={() => router.push('/dashboard/training')} className="text-sm text-gray-500 hover:text-primary-600 mb-4 flex items-center gap-1">← Training</button>
        <div className="flex items-center gap-4 mb-2">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
            <Target className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Readback/Hearback Correction</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Advanced</span>
          </div>
        </div>
        <p className="text-gray-600 mt-2">You will be shown an ATC instruction and a pilot&apos;s incorrect readback. Correct the readback so it accurately reflects the instruction using ICAO standard phraseology.</p>
      </div>

      {!loadingHistory && history.count > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-5 text-center">
            <div className={`text-3xl font-bold ${history.bestScore !== null ? (history.bestScore >= 80 ? 'text-green-600' : history.bestScore >= 60 ? 'text-amber-600' : 'text-red-600') : 'text-gray-400'}`}>
              {history.bestScore !== null ? `${history.bestScore}%` : '—'}
            </div>
            <div className="text-sm text-gray-500 mt-1">Best Score</div>
          </div>
          <div className="card p-5 text-center">
            <div className="text-3xl font-bold text-gray-900">{history.count}</div>
            <div className="text-sm text-gray-500 mt-1">Sessions Completed</div>
          </div>
        </div>
      )}

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700"><AlertTriangle className="w-5 h-5 shrink-0" />{error}</div>}

      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">How it works</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          {['Up to 10 questions — answer all before submitting', 'Each question shows an incorrect pilot readback — correct it', 'Scored by accuracy against the correct readback', 'Questions are randomly drawn from the pool each session'].map((t, i) => (
            <li key={i} className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary-500 mt-0.5 shrink-0" />{t}</li>
          ))}
        </ul>
        <button onClick={startSession} disabled={starting} className="btn-primary w-full">
          {starting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading questions...</> : <>Start Session <ChevronRight className="w-4 h-4 ml-1" /></>}
        </button>
      </div>
    </div>
  )

  // ── QUIZ ──────────────────────────────────────────────────────────────────
  if (state === 'quiz') {
    const q = questions[currentIdx]
    const isLast = currentIdx === questions.length - 1
    const currentAnswered = (answers[q?.id] ?? '').trim().length > 0
    const errorCount = q?.question_data.errors?.length ?? 1
    const diffColor = q?.difficulty === 'easy' ? 'bg-green-100 text-green-700' : q?.difficulty === 'hard' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
    const handleSpeechResult = (text: string) =>
      setAnswers(prev => ({ ...prev, [q.id]: text }))

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <button onClick={() => router.push('/dashboard/training')} className="text-sm text-gray-500 hover:text-primary-600 mb-1 flex items-center gap-1">← Training</button>
            <h2 className="text-xl font-bold text-gray-900">Readback/Hearback Correction</h2>
            <p className="text-sm text-gray-500 mt-0.5">Exercise {currentIdx + 1} of {questions.length}</p>
          </div>
          {q && <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${diffColor}`}>{q.difficulty}</span>}
        </div>

        {/* Segmented progress */}
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= currentIdx ? 'bg-indigo-500' : 'bg-gray-200'}`} />
          ))}
        </div>

        {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700"><AlertTriangle className="w-5 h-5 shrink-0" />{error}</div>}

        {q && (
          <>
            {/* ATC Instruction gradient card */}
            <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
              <div className="px-5 pt-4 pb-1 flex items-center justify-between">
                <p className="text-sm font-semibold text-indigo-100">Original ATC Instruction</p>
                <button onClick={() => speak(q.question_data.atcInstruction)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                  <Volume2 className="w-4 h-4 text-white" />
                </button>
              </div>
              <div className="px-5 pb-5">
                <p className="text-white font-medium text-base leading-relaxed">{q.question_data.atcInstruction}</p>
              </div>
            </div>

            {/* Main question card */}
            <div className="card overflow-hidden">
              <div className="p-5 space-y-5">
                {/* Incorrect readback */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <p className="text-sm font-semibold text-gray-800">Pilot&apos;s Incorrect Readback</p>
                    </div>
                    <button onClick={() => speak(q.question_data.incorrectReadback)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="border-2 border-amber-200 bg-amber-50 rounded-xl px-4 py-3">
                    <p className="text-gray-800 text-sm leading-relaxed">{q.question_data.incorrectReadback}</p>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">{errorCount} error{errorCount !== 1 ? 's' : ''} to correct</p>
                </div>

                {/* Your correction */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">✏️</span>
                    <p className="text-sm font-semibold text-gray-800">Your Correction</p>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">The incorrect readback is pre-filled — correct the error(s) and submit:</p>
                  <div className="relative">
                    <textarea
                      value={isListening && interimText ? `${answers[q.id] ?? ''} ${interimText}`.trim() : (answers[q.id] ?? '')}
                      onChange={e => { if (!isListening) setAnswers(prev => ({ ...prev, [q.id]: e.target.value })) }}
                      readOnly={isListening}
                      className="input-field text-sm resize-none w-full border-l-4 border-amber-400"
                      rows={4}
                      placeholder={isListening ? 'Listening — speak the corrected readback...' : undefined}
                    />
                    {isSupported && (
                      <button
                        type="button"
                        onClick={() => toggleListening(handleSpeechResult, answers[q.id] ?? '')}
                        className={`absolute bottom-2 right-2 p-2 rounded-lg transition-colors ${
                          isListening
                            ? 'bg-red-100 text-red-600 hover:bg-red-200 animate-pulse'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                        title={isListening ? 'Stop recording' : 'Speak the corrected readback'}
                      >
                        {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                  {speechError && <p className="mt-1 text-xs text-red-500 px-1">{speechError}</p>}
                </div>

                {/* Hint toggles */}
                <div className="space-y-2">
                  {q.question_data.errors && q.question_data.errors.length > 0 && (
                    <>
                      <button onClick={() => setShowHints(h => !h)} className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700">
                        <Lightbulb className="w-4 h-4" />
                        {showHints ? 'Hide Error Hints' : 'Show Error Hints'}
                      </button>
                      {showHints && (
                        <ul className="ml-6 space-y-1">
                          {q.question_data.errors.map((e, i) => (
                            <li key={i} className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                              {e.field}: <span className="line-through">{e.wrong}</span> → <span className="font-semibold">{e.correct}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>

                {/* Action row */}
                <div className="flex gap-2">
                  <button
                    onClick={isLast ? submitSession : () => setCurrentIdx(i => i + 1)}
                    disabled={!currentAnswered || isListening || (isLast && submitting)}
                    className="btn-primary flex-1 disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {isLast && submitting
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting...</>
                      : '⊙ Submit Correction'
                    }
                  </button>
                  <button
                    onClick={() => { stopListening(); setAnswers(prev => ({ ...prev, [q.id]: q.question_data.incorrectReadback ?? '' })) }}
                    className="p-2.5 rounded-xl border-2 border-gray-200 hover:border-gray-300 text-gray-500 hover:text-gray-700 transition-colors"
                    title="Reset to original incorrect readback"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Common errors tip */}
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-indigo-600" />
                <p className="text-sm font-bold text-indigo-700">Common Readback Errors</p>
              </div>
              <ul className="space-y-1">
                {COMMON_ERRORS.map((e, i) => (
                  <li key={i} className="text-xs text-indigo-700 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-indigo-400 shrink-0" />{e}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-1">
          <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0} className="btn-secondary disabled:opacity-40">← Back</button>
          {!isLast && (
            <button onClick={() => setCurrentIdx(i => i + 1)} disabled={!currentAnswered || isListening} className="btn-primary disabled:opacity-40">
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── RESULTS ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center">
        <div className={`inline-flex flex-col items-center gap-2 p-8 rounded-2xl border ${scoreBg}`}>
          <Trophy className={`w-12 h-12 ${scoreColor}`} />
          <div className={`text-6xl font-bold ${scoreColor}`}>{score}%</div>
          <div className="text-gray-600 font-medium">{score >= 80 ? 'Excellent work!' : score >= 60 ? 'Good effort!' : 'Keep practising!'}</div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Question Breakdown</h3>
        {resultQuestions.map((q, idx) => {
          const qScore = questionScores[q.id] ?? 0
          const passed = qScore >= 60
          const open = openAccordion === q.id
          return (
            <div key={q.id} className="card overflow-hidden">
              <button className="w-full flex items-center justify-between p-4 text-left" onClick={() => setOpenAccordion(open ? null : q.id)}>
                <div className="flex items-center gap-3">
                  {passed ? <CheckCircle className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                  <span className="font-medium text-gray-900">Exercise {idx + 1}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-semibold ${passed ? 'text-green-600' : 'text-red-600'}`}>{qScore}%</span>
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
                </div>
              </button>
              {open && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                  <div><p className="text-xs font-semibold text-gray-500 mb-1">ATC INSTRUCTION</p><p className="text-sm text-gray-700 italic">&quot;{q.question_data.atcInstruction}&quot;</p></div>
                  <div>
                    <p className="text-xs font-semibold text-amber-600 mb-1">INCORRECT READBACK</p>
                    <p className="text-sm text-amber-800">
                      {q.question_data.errors && q.question_data.errors.length > 0
                        ? highlightAll(q.question_data.incorrectReadback, q.question_data.errors, 'incorrect')
                        : q.question_data.incorrectReadback}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">YOUR ANSWER</p>
                    <p className="text-sm text-gray-700">
                      {answers[q.id]
                        ? q.question_data.errors && q.question_data.errors.length > 0
                          ? highlightAll(answers[q.id], q.question_data.errors, 'answer')
                          : answers[q.id]
                        : '—'}
                    </p>
                  </div>
                  <div><p className="text-xs font-semibold text-green-600 mb-1">CORRECT READBACK</p><p className="text-sm text-green-700 font-medium">{q.question_data.correctReadback}</p></div>
                  {q.question_data.explanation && <p className="text-xs text-gray-500 italic">{q.question_data.explanation}</p>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={tryAgain} className="btn-primary flex-1"><RotateCcw className="w-4 h-4 mr-2" />Try Again</button>
        <button onClick={() => router.push('/dashboard/training')} className="btn-secondary flex-1">Different Category</button>
        <button onClick={() => router.push('/dashboard')} className="btn-secondary flex-1">Dashboard</button>
      </div>
    </div>
  )
}
