'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Radio, ChevronRight, Trophy, RotateCcw, CheckCircle, XCircle, Loader2, AlertTriangle, Volume2, Plane, RefreshCw, Cloud, Navigation, Mic, MicOff } from 'lucide-react'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { AVIATION_VOCABULARY } from '@/lib/speechNormalize'

type SessionState = 'intro' | 'quiz' | 'results'

interface ElementDetail { name: string; value: string; found: boolean }

interface Question {
  id: string
  difficulty: string
  question_data: {
    callSign: string
    flightPhase?: string
    aircraftType?: string
    situation?: string
    atcClearance: string
    correctResponse: string
    keyElements?: string[]
    hints?: string[]
  }
}

const ELEMENT_LABELS: Record<string, string> = {
  callSign: 'Call sign',
  altitude: 'Altitude / FL',
  heading: 'Heading',
  squawk: 'Squawk code',
  route: 'Route / destination',
}

interface HistoryData { bestScore: number | null; count: number }

const AIRCRAFT_TYPES = ['Airbus A320', 'Boeing 737-800', 'Airbus A330', 'Boeing 777', 'ATR 72-600', 'Airbus A321', 'Bombardier Q400']
const WEATHER_CONDITIONS = ['CAVOK', 'VMC', 'SCT025', 'BKN030', 'OVC015']

const SITUATION_DEFAULTS: Record<string, string> = {
  ground: 'You are on the ground at your departure airport. ATC has issued the following taxi or clearance instruction.',
  approach: 'You are on approach to your destination, descending for landing. ATC issues the following instruction.',
  departure: 'You are departing, climbing to your assigned altitude. ATC issues the following routing instruction.',
}

function getScenarioMeta(q: Question, idx: number) {
  const aircraftType = q.question_data.aircraftType ?? AIRCRAFT_TYPES[idx % AIRCRAFT_TYPES.length]
  const weather = WEATHER_CONDITIONS[idx % WEATHER_CONDITIONS.length]
  const phase = q.question_data.flightPhase ?? 'departure'
  const statusMap: Record<string, string> = { ground: 'Taxiing', departure: 'En Route', approach: 'On Approach' }
  const status = statusMap[phase] ?? 'En Route'
  const phaseLabel = phase.charAt(0).toUpperCase() + phase.slice(1)
  const situation = q.question_data.situation ?? SITUATION_DEFAULTS[phase] ?? SITUATION_DEFAULTS.departure
  return { aircraftType, weather, status, phaseLabel, situation }
}

function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.8
  window.speechSynthesis.speak(u)
}

const ICAO_TIPS = [
  'Always end your readback with your call sign. This confirms to ATC that the correct aircraft received and understood the instruction.',
  'When reading back altitudes, say each digit separately: "flight level three five zero", not "flight level three fifty".',
  'Squawk codes are read digit by digit: "two two zero one", never "twenty-two hundred one".',
  'Headings are given as three digits: "heading zero nine zero" — always include the leading zero.',
  'Read back ALL elements of a clearance. Omitting even one element is a readback error.',
]

export default function ScenarioPage() {
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
  const [elementResults, setElementResults] = useState<Record<string, ElementDetail[]>>({})
  const [openAccordion, setOpenAccordion] = useState<string | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [showHints, setShowHints] = useState(false)
  const { isSupported, isListening, interimText, error: speechError, toggleListening, stopListening } = useSpeechRecognition({ vocabulary: AVIATION_VOCABULARY })

  useEffect(() => {
    fetch('/api/training/history?category=scenario')
      .then(r => r.json())
      .then(d => setHistory({ bestScore: d.bestScore, count: d.count }))
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [])

  // Reset hints when question changes; stop any active recording
  useEffect(() => { setShowHints(false); stopListening() }, [currentIdx, stopListening])

  const startSession = async () => {
    setStarting(true); setError('')
    try {
      const res = await fetch('/api/training/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'scenario' }),
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
      setScore(data.score); setQuestionScores(data.questionScores); setResultQuestions(data.questions); setElementResults(data.elementResults ?? {})
      setState('results')
    } catch { setError('Network error. Please try again.') }
    finally { setSubmitting(false) }
  }

  const tryAgain = () => {
    setQuestions([]); setAnswers({}); setError(''); setCurrentIdx(0); setState('intro')
    fetch('/api/training/history?category=scenario').then(r => r.json()).then(d => setHistory({ bestScore: d.bestScore, count: d.count })).catch(() => {})
  }

  const scoreColor = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'
  const scoreBg = score >= 80 ? 'bg-green-50 border-green-200' : score >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'

  // ── INTRO ─────────────────────────────────────────────────────────────────
  if (state === 'intro') return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <button onClick={() => router.push('/dashboard/training')} className="text-sm text-gray-500 hover:text-primary-600 mb-4 flex items-center gap-1">← Training</button>
        <div className="flex items-center gap-4 mb-2">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
            <Radio className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Scenario-Based Simulation</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Intermediate</span>
          </div>
        </div>
        <p className="text-gray-600 mt-2">Read the ATC clearance and type a correct pilot readback using ICAO standard phraseology. Include all required elements: call sign, altitude, heading, route, and squawk code as given.</p>
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
          {['Up to 10 scenarios — answer all before submitting', 'Type the correct pilot readback to the ATC clearance', 'Scored by how many required elements you include', 'New random scenarios each session'].map((t, i) => (
            <li key={i} className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary-500 mt-0.5 shrink-0" />{t}</li>
          ))}
        </ul>
        <button onClick={startSession} disabled={starting} className="btn-primary w-full">
          {starting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading scenarios...</> : <>Start Session <ChevronRight className="w-4 h-4 ml-1" /></>}
        </button>
      </div>
    </div>
  )

  // ── QUIZ ──────────────────────────────────────────────────────────────────
  if (state === 'quiz') {
    const q = questions[currentIdx]
    const isLast = currentIdx === questions.length - 1
    const currentAnswered = (answers[q?.id] ?? '').trim().length > 0
    const meta = q ? getScenarioMeta(q, currentIdx) : null
    const tip = ICAO_TIPS[currentIdx % ICAO_TIPS.length]
    const handleSpeechResult = (text: string) =>
      setAnswers(prev => ({ ...prev, [q.id]: text }))

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div>
          <button onClick={() => router.push('/dashboard/training')} className="text-sm text-gray-500 hover:text-primary-600 mb-2 flex items-center gap-1">← Training</button>
          <h2 className="text-xl font-bold text-gray-900">Scenario-Based Simulation</h2>
          <p className="text-sm text-gray-500 mt-0.5">Scenario {currentIdx + 1} of {questions.length}</p>
        </div>

        {/* Segmented progress bar */}
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= currentIdx ? 'bg-primary-500' : 'bg-gray-200'}`} />
          ))}
        </div>

        {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700"><AlertTriangle className="w-5 h-5 shrink-0" />{error}</div>}

        {q && meta && (
          <>
            {/* Scenario context card */}
            <div className="rounded-2xl overflow-hidden shadow-md bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
              <div className="px-5 pt-5 pb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Plane className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-lg leading-tight">{q.question_data.callSign}</div>
                    <div className="text-blue-100 text-sm">{meta.aircraftType}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-blue-200 text-xs uppercase tracking-wider">Flight Phase</div>
                  <div className="font-bold text-base">{meta.phaseLabel}</div>
                </div>
              </div>
              <div className="mx-5 mb-5 bg-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-blue-200" />
                  <span>{meta.weather}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-blue-200" />
                  <span>{meta.status}</span>
                </div>
              </div>
            </div>

            {/* Situation context */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-800">
              <span className="font-semibold">Situation: </span>{meta.situation}
            </div>

            {/* Question card */}
            <div className="card overflow-hidden">
              <div className="p-5 space-y-5">
                {/* ATC Clearance */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-700">ATC Clearance</p>
                    <button onClick={() => speak(q.question_data.atcClearance)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="border-l-4 border-primary-400 pl-4 py-1 bg-primary-50 rounded-r-lg">
                    <p className="text-gray-900 text-sm leading-relaxed">{q.question_data.atcClearance}</p>
                  </div>
                </div>

                {/* Your Response */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-700">Your Response</p>
                    {q.question_data.hints && q.question_data.hints.length > 0 && (
                      <button onClick={() => setShowHints(h => !h)} className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
                        ⓘ {showHints ? 'Hide Hints' : 'Show Hints'}
                      </button>
                    )}
                  </div>
                  {showHints && q.question_data.hints && (
                    <ul className="mb-2 space-y-1.5">
                      {q.question_data.hints.map((h, i) => (
                        <li key={i} className="text-xs text-primary-700 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2 flex items-start gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-primary-500 shrink-0 mt-0.5" />{h}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="relative">
                    <textarea
                      value={isListening && interimText ? `${answers[q.id] ?? ''} ${interimText}`.trim() : (answers[q.id] ?? '')}
                      onChange={e => { if (!isListening) setAnswers(prev => ({ ...prev, [q.id]: e.target.value })) }}
                      readOnly={isListening}
                      className="input-field text-sm resize-none w-full"
                      rows={4}
                      placeholder={isListening ? 'Listening...' : 'Type your readback response here...'}
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
                        title={isListening ? 'Stop recording' : 'Speak your answer'}
                      >
                        {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                  {speechError && <p className="mt-1 text-xs text-red-500 px-1">{speechError}</p>}
                </div>

                {/* Action row */}
                <div className="flex gap-2">
                  <button
                    onClick={isLast ? submitSession : () => setCurrentIdx(i => i + 1)}
                    disabled={!currentAnswered || isListening || (isLast && submitting)}
                    className="btn-primary flex-1 disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {isLast
                      ? (submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting...</> : <><Navigation className="w-4 h-4" />Submit Response</>)
                      : <>Next Question <ChevronRight className="w-4 h-4" /></>
                    }
                  </button>
                  <button
                    onClick={() => { stopListening(); setAnswers(prev => ({ ...prev, [q.id]: '' })) }}
                    className="p-2.5 rounded-xl border-2 border-gray-200 hover:border-gray-300 text-gray-500 hover:text-gray-700 transition-colors"
                    title="Clear answer"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* ICAO tip */}
            <div className="rounded-xl bg-primary-50 border border-primary-100 p-4">
              <p className="text-xs font-bold text-primary-700 uppercase tracking-wider mb-1">ICAO Phraseology Tip</p>
              <p className="text-sm text-primary-800">{tip}</p>
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
          <div className="text-gray-600 font-medium">{score >= 80 ? 'Excellent work!' : score >= 60 ? 'Good effort — keep practising!' : 'Keep at it — review correct answers below.'}</div>
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
                  <span className="font-medium text-gray-900">Scenario {idx + 1}: {q.question_data.callSign}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-semibold ${passed ? 'text-green-600' : 'text-red-600'}`}>{qScore}%</span>
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
                </div>
              </button>
              {open && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                  <div><p className="text-xs font-semibold text-gray-500 mb-1">ATC CLEARANCE</p><p className="text-sm text-gray-700 italic">&quot;{q.question_data.atcClearance}&quot;</p></div>
                  <div><p className="text-xs font-semibold text-gray-500 mb-1">YOUR ANSWER</p><p className="text-sm text-gray-700">{answers[q.id] || '—'}</p></div>
                  {(elementResults[q.id] ?? []).length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Required Elements</p>
                      <ul className="space-y-1.5">
                        {elementResults[q.id].map(el => (
                          <li key={el.name} className="flex items-center gap-2 text-sm">
                            {el.found
                              ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                              : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                            <span className={el.found ? 'text-green-700' : 'text-red-600'}>
                              {ELEMENT_LABELS[el.name] ?? el.name}
                              {el.value ? ` — ${el.value}` : ''}
                              {!el.found && ' (missing)'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    q.question_data.correctResponse && (
                      <div><p className="text-xs font-semibold text-green-600 mb-1">CORRECT READBACK</p><p className="text-sm text-green-700 font-medium">{q.question_data.correctResponse}</p></div>
                    )
                  )}
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
