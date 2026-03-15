'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Headphones, ChevronRight, Trophy, RotateCcw, CheckCircle, XCircle, Loader2, AlertTriangle, Volume2, RefreshCw, Lightbulb } from 'lucide-react'

type SessionState = 'intro' | 'quiz' | 'results'

interface Question {
  id: string
  difficulty: string
  question_data: {
    type: string
    display: string
    correctPronunciation: string
    options: string[]
    explanation?: string
    audioHint?: string
  }
}

interface HistoryData { bestScore: number | null; count: number }

function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.7
  window.speechSynthesis.speak(u)
}

const OPTION_LABELS = ['A', 'B', 'C', 'D']
const OPTION_BADGE_CLASSES = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
]

const NUMBER_REFERENCE = [
  { digit: '0', icao: 'ZERO' }, { digit: '1', icao: 'WUN' }, { digit: '2', icao: 'TOO' },
  { digit: '3', icao: 'TREE' }, { digit: '4', icao: 'FOW·ER' }, { digit: '5', icao: 'FIFE' },
  { digit: '6', icao: 'SIX' }, { digit: '7', icao: 'SEV·EN' }, { digit: '8', icao: 'AIT' },
  { digit: '9', icao: 'NIN·ER' },
]

const LETTER_REFERENCE = [
  { ch: 'A', icao: 'ALFA' }, { ch: 'B', icao: 'BRAVO' }, { ch: 'C', icao: 'CHARLIE' },
  { ch: 'D', icao: 'DELTA' }, { ch: 'E', icao: 'ECHO' }, { ch: 'F', icao: 'FOXTROT' },
  { ch: 'G', icao: 'GOLF' }, { ch: 'H', icao: 'HOTEL' }, { ch: 'I', icao: 'INDIA' },
  { ch: 'J', icao: 'JULIETT' }, { ch: 'K', icao: 'KILO' }, { ch: 'L', icao: 'LIMA' },
  { ch: 'M', icao: 'MIKE' }, { ch: 'N', icao: 'NOVEMBER' }, { ch: 'O', icao: 'OSCAR' },
  { ch: 'P', icao: 'PAPA' }, { ch: 'Q', icao: 'QUEBEC' }, { ch: 'R', icao: 'ROMEO' },
  { ch: 'S', icao: 'SIERRA' }, { ch: 'T', icao: 'TANGO' }, { ch: 'U', icao: 'UNIFORM' },
  { ch: 'V', icao: 'VICTOR' }, { ch: 'W', icao: 'WHISKEY' }, { ch: 'X', icao: 'X-RAY' },
  { ch: 'Y', icao: 'YANKEE' }, { ch: 'Z', icao: 'ZULU' },
]

export default function PronunciationPage() {
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
  const [showRef, setShowRef] = useState(false)

  useEffect(() => {
    fetch('/api/training/history?category=pronunciation')
      .then(r => r.json())
      .then(d => setHistory({ bestScore: d.bestScore, count: d.count }))
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [])

  const startSession = async () => {
    setStarting(true); setError('')
    try {
      const res = await fetch('/api/training/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'pronunciation' }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to start session.'); return }
      setSessionId(data.sessionId); setQuestions(data.questions)
      setAnswers(Object.fromEntries(data.questions.map((q: Question) => [q.id, ''])))
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
    fetch('/api/training/history?category=pronunciation').then(r => r.json()).then(d => setHistory({ bestScore: d.bestScore, count: d.count })).catch(() => {})
  }

  const scoreColor = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'
  const scoreBg = score >= 80 ? 'bg-green-50 border-green-200' : score >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'

  // ── INTRO ─────────────────────────────────────────────────────────────────
  if (state === 'intro') return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <button onClick={() => router.push('/dashboard/training')} className="text-sm text-gray-500 hover:text-primary-600 mb-4 flex items-center gap-1">← Training</button>
        <div className="flex items-center gap-4 mb-2">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
            <Headphones className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pronunciation Drill</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Beginner</span>
          </div>
        </div>
        <p className="text-gray-600 mt-2">Select the correct ICAO standard pronunciation for the displayed number, letter, or aviation term. Use the speaker buttons to hear each option.</p>
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
          {['10 items — select the correct pronunciation for each', 'Click the speaker icon to hear each option', 'Exact match required — full score or zero per question', 'Random items each session'].map((t, i) => (
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
    const currentAnswered = !!(answers[q?.id])
    const isNumber = q?.question_data.type === 'number'
    const isQuestion = q?.question_data.type === 'question'
    const typeLabel = isQuestion ? 'Question' : isNumber ? 'Number' : 'Letter'

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <button onClick={() => router.push('/dashboard/training')} className="text-sm text-gray-500 hover:text-primary-600 mb-1 flex items-center gap-1">← Training</button>
            <h2 className="text-xl font-bold text-gray-900">Pronunciation Drill</h2>
            <p className="text-sm text-gray-500 mt-0.5">Exercise {currentIdx + 1} of {questions.length}</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-100 text-emerald-700">{typeLabel}</span>
        </div>

        {/* Segmented progress */}
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= currentIdx ? 'bg-emerald-500' : 'bg-gray-200'}`} />
          ))}
        </div>

        {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700"><AlertTriangle className="w-5 h-5 shrink-0" />{error}</div>}

        {q && (
          <>
            {/* Display card — question-type shows full sentence; number/letter shows big char */}
            {isQuestion ? (
              <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white px-5 py-6">
                <p className="text-lg font-semibold leading-snug">{q.question_data.display}</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white px-5 py-6 flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-emerald-100 text-sm font-medium">
                  <Headphones className="w-4 h-4" />
                  How do you pronounce this?
                </div>
                <div className="text-7xl font-bold leading-none">{q.question_data.display}</div>
                <button
                  onClick={() => speak(q.question_data.display)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors text-sm font-medium"
                >
                  <Volume2 className="w-4 h-4" /> Listen
                </button>
              </div>
            )}

            {/* Options card */}
            <div className="card overflow-hidden p-5 space-y-4">
              {!isQuestion && (
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">Select the correct ICAO pronunciation:</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {q.question_data.options.map((opt, oi) => (
                  <button
                    key={oi}
                    onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))}
                    className={`flex items-center justify-between p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                      answers[q.id] === opt
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-md text-xs flex items-center justify-center font-bold shrink-0 ${answers[q.id] === opt ? 'bg-emerald-500 text-white' : OPTION_BADGE_CLASSES[oi]}`}>
                        {OPTION_LABELS[oi]}
                      </span>
                      <span className={isQuestion ? '' : 'uppercase tracking-wide'}>{opt}</span>
                    </div>
                    {!isQuestion && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={e => { e.stopPropagation(); speak(opt) }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); speak(opt) } }}
                        className="p-1 rounded hover:bg-gray-200 cursor-pointer"
                      >
                        <Volume2 className="w-3 h-3 text-gray-400" />
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Action row */}
              <div className="flex gap-2">
                <button
                  onClick={isLast ? submitSession : () => setCurrentIdx(i => i + 1)}
                  disabled={!currentAnswered || (isLast && submitting)}
                  className="btn-primary flex-1 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {isLast && submitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting...</>
                    : '⊙ Check Answer'
                  }
                </button>
                <button
                  onClick={() => setAnswers(prev => ({ ...prev, [q.id]: '' }))}
                  className="p-2.5 rounded-xl border-2 border-gray-200 hover:border-gray-300 text-gray-500 hover:text-gray-700 transition-colors"
                  title="Clear selection"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Reference tip card — collapsible, hidden for generic questions */}
            {!isQuestion && <div className="rounded-xl bg-emerald-50 border border-emerald-100 overflow-hidden">
              <button
                onClick={() => setShowRef(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-emerald-600" />
                  <p className="text-sm font-bold text-emerald-700">
                    {isNumber ? 'ICAO Number Pronunciation' : 'NATO Phonetic Alphabet'}
                  </p>
                </div>
                <ChevronRight className={`w-4 h-4 text-emerald-500 transition-transform ${showRef ? 'rotate-90' : ''}`} />
              </button>
              {showRef && (
                <div className="px-4 pb-4">
                  {isNumber ? (
                    <div className="grid grid-cols-5 gap-2">
                      {NUMBER_REFERENCE.map(({ digit, icao }) => (
                        <div key={digit} className="flex flex-col items-center p-1.5 rounded-lg bg-white border border-emerald-200">
                          <span className="text-base font-bold text-emerald-700">{digit}</span>
                          <span className="text-xs text-emerald-600 font-medium">{icao}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-1.5">
                      {LETTER_REFERENCE.map(({ ch, icao }) => (
                        <div key={ch} className="flex items-center gap-1.5 p-1 rounded-lg bg-white border border-emerald-200">
                          <span className="text-sm font-bold text-emerald-700 w-4">{ch}</span>
                          <span className="text-xs text-emerald-600 truncate">{icao}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>}
          </>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-1">
          <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0} className="btn-secondary disabled:opacity-40">← Back</button>
          {!isLast && (
            <button onClick={() => setCurrentIdx(i => i + 1)} disabled={!currentAnswered} className="btn-primary disabled:opacity-40">
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
          const passed = qScore === 100
          const open = openAccordion === q.id
          return (
            <div key={q.id} className="card overflow-hidden">
              <button className="w-full flex items-center justify-between p-4 text-left" onClick={() => setOpenAccordion(open ? null : q.id)}>
                <div className="flex items-center gap-3">
                  {passed ? <CheckCircle className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                  <span className="font-medium text-gray-900 line-clamp-1">Q{idx + 1}: {q.question_data.display}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-semibold ${passed ? 'text-green-600' : 'text-red-600'}`}>{passed ? '✓' : '✗'}</span>
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
                </div>
              </button>
              {open && (
                <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3">
                  <div><p className="text-xs font-semibold text-gray-500 mb-1">YOUR ANSWER</p><p className="text-sm text-gray-700">{String(answers[q.id] || '—')}</p></div>
                  <div><p className="text-xs font-semibold text-green-600 mb-1">CORRECT</p><p className="text-sm text-green-700 font-medium">{q.question_data.correctPronunciation}</p></div>
                  <p className="text-xs text-gray-500 italic">
                    {q.question_data.explanation
                      ? q.question_data.explanation
                      : `Correct: ${q.question_data.correctPronunciation} — ICAO standard for "${q.question_data.display}"`}
                  </p>
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
