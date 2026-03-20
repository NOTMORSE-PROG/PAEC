'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, ChevronRight, Trophy, RotateCcw, CheckCircle, XCircle, Loader2, AlertTriangle, Lightbulb } from 'lucide-react'
import SessionHistory, { SessionRow } from '@/components/training/SessionHistory'
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor,
  useSensor, useSensors, closestCenter, useDroppable, useDraggable,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type SessionState = 'intro' | 'quiz' | 'results'

interface Question {
  id: string
  difficulty: string
  question_data: {
    instruction: string
    correctOrder: string[]
    category?: string
  }
}

interface HistoryData { bestScore: number | null; count: number; sessions: SessionRow[] }
interface WordItem { id: string; word: string }

type WordStatus = 'correct' | 'present' | 'wrong'
function analyzeWords(submitted: string[], correctOrder: string[]): WordStatus[] {
  const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, '')
  const normCorrect = correctOrder.map(norm)
  return submitted.map((w, i) => {
    const nw = norm(w)
    if (nw === normCorrect[i]) return 'correct'
    if (normCorrect.includes(nw)) return 'present'
    return 'wrong'
  })
}

const CATEGORY_LABELS: Record<string, string> = {
  altitude: 'Altitude Assignment',
  heading: 'Routing Instruction',
  taxi: 'Taxi Instruction',
  clearance: 'ATC Clearance',
  approach: 'Approach Clearance',
  departure: 'Departure Clearance',
}

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const PHRASEOLOGY_TIPS = [
  { num: 1, text: 'Action verb (Climb, Descend, Turn, Taxi)' },
  { num: 2, text: 'Connecting words (and, to, via)' },
  { num: 3, text: 'Values (altitude, heading, speed)' },
  { num: 4, text: 'Call sign at the end' },
]

// ── Draggable bank word (pointer + touch via @dnd-kit) ─────────────────────
function DraggableWord({ item, onAdd }: { item: WordItem; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onAdd}
      className={`px-3 py-1.5 rounded-full border bg-white text-gray-700 text-sm font-medium cursor-grab active:cursor-grabbing select-none transition-all hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700 touch-none${isDragging ? ' opacity-40' : ''}`}
    >
      {item.word}
    </div>
  )
}

// ── Drop zone containers (must be children of DndContext) ──────────────────
function BankDropZone({ children, highlight }: { children: React.ReactNode; highlight: boolean }) {
  const { setNodeRef } = useDroppable({ id: 'bank-drop' })
  return (
    <div ref={setNodeRef} className={`min-h-[60px] p-3 rounded-xl border-2 transition-colors flex flex-wrap gap-2 ${highlight ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-gray-50'}`}>
      {children}
    </div>
  )
}

function AnswerDropZone({ children, highlight }: { children: React.ReactNode; highlight: boolean }) {
  const { setNodeRef } = useDroppable({ id: 'answer-drop' })
  return (
    <div ref={setNodeRef} className={`min-h-[70px] p-3 rounded-xl border-2 border-dashed transition-colors flex flex-wrap gap-2 ${highlight ? 'border-violet-400 bg-violet-50' : 'border-gray-300'}`}>
      {children}
    </div>
  )
}

// ── Sortable answer word (reorderable via @dnd-kit) ─────────────────────────
function SortableWord({ item, onRemove }: { item: WordItem; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      onClick={onRemove}
      className="px-3 py-1.5 rounded-full border border-violet-300 bg-violet-50 text-violet-700 text-sm font-medium cursor-grab active:cursor-grabbing select-none transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 touch-none"
    >
      {item.word}
    </div>
  )
}

export default function JumbledPage() {
  const router = useRouter()
  const [state, setState] = useState<SessionState>('intro')
  const [history, setHistory] = useState<HistoryData>({ bestScore: null, count: 0, sessions: [] })
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [sessionId, setSessionId] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [wordBanks, setWordBanks] = useState<Record<string, WordItem[]>>({})
  const [arranged, setArranged] = useState<Record<string, WordItem[]>>({})
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [score, setScore] = useState(0)
  const [questionScores, setQuestionScores] = useState<Record<string, number>>({})
  const [resultQuestions, setResultQuestions] = useState<Question[]>([])
  const [openAccordion, setOpenAccordion] = useState<string | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [activeItem, setActiveItem] = useState<WordItem | null>(null)
  const [overZone, setOverZone] = useState<'bank' | 'answer' | null>(null)

  // Stable ID counter across renders
  const idRef = useRef(0)

  // dnd-kit sensors — PointerSensor covers both mouse AND touch
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    fetch('/api/training/history?category=jumbled')
      .then(r => r.json())
      .then(d => setHistory({ bestScore: d.bestScore, count: d.count, sessions: d.sessions ?? [] }))
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [])

  const startSession = async () => {
    setStarting(true); setError('')
    try {
      const res = await fetch('/api/training/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'jumbled' }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to start session.'); return }
      setSessionId(data.sessionId); setQuestions(data.questions)
      const banks: Record<string, WordItem[]> = {}
      const arrs: Record<string, WordItem[]> = {}
      const ans: Record<string, string> = {}
      for (const q of data.questions) {
        banks[q.id] = shuffleArr(q.question_data.correctOrder as string[]).map(word => ({ id: `w${idRef.current++}`, word }))
        arrs[q.id] = []
        ans[q.id] = ''
      }
      setWordBanks(banks); setArranged(arrs); setAnswers(ans)
      setState('quiz')
    } catch { setError('Network error. Please try again.') }
    finally { setStarting(false) }
  }

  const moveToArranged = (qId: string, item: WordItem, bankIdx: number) => {
    setWordBanks(prev => { const b = [...prev[qId]]; b.splice(bankIdx, 1); return { ...prev, [qId]: b } })
    setArranged(prev => {
      const a = [...(prev[qId] ?? []), item]
      setAnswers(ans => ({ ...ans, [qId]: a.map(w => w.word).join(' ') }))
      return { ...prev, [qId]: a }
    })
  }

  const moveToBank = (qId: string, item: WordItem, arrIdx: number) => {
    setArranged(prev => {
      const a = [...prev[qId]]; a.splice(arrIdx, 1)
      setAnswers(ans => ({ ...ans, [qId]: a.map(w => w.word).join(' ') }))
      return { ...prev, [qId]: a }
    })
    setWordBanks(prev => ({ ...prev, [qId]: [...prev[qId], item] }))
  }

  const reorderArranged = (qId: string, fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return
    setArranged(prev => {
      const a = arrayMove([...prev[qId]], fromIdx, toIdx)
      setAnswers(ans => ({ ...ans, [qId]: a.map(w => w.word).join(' ') }))
      return { ...prev, [qId]: a }
    })
  }

  const resetQuestion = (qId: string, correctOrder: string[]) => {
    setWordBanks(prev => ({ ...prev, [qId]: shuffleArr(correctOrder).map(word => ({ id: `w${idRef.current++}`, word })) }))
    setArranged(prev => ({ ...prev, [qId]: [] }))
    setAnswers(prev => ({ ...prev, [qId]: '' }))
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
    setQuestions([]); setWordBanks({}); setArranged({}); setAnswers({}); setError(''); setCurrentIdx(0); setState('intro')
    fetch('/api/training/history?category=jumbled').then(r => r.json()).then(d => setHistory({ bestScore: d.bestScore, count: d.count, sessions: d.sessions ?? [] })).catch(() => {})
  }

  const scoreColor = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'
  const scoreBg = score >= 80 ? 'bg-green-50 border-green-200' : score >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'

  // ── INTRO ─────────────────────────────────────────────────────────────────
  if (state === 'intro') return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <button onClick={() => router.push('/dashboard/training')} className="text-sm text-gray-500 hover:text-primary-600 mb-4 flex items-center gap-1">← Training</button>
        <div className="flex items-center gap-4 mb-2">
          <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Jumbled Clearance</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Beginner</span>
          </div>
        </div>
        <p className="text-gray-600 mt-2">Arrange the jumbled words into the correct ICAO standard phraseology sequence. Click or drag words to move them between the word bank and your answer.</p>
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
          {['Up to 10 clearances — arrange all before submitting', 'Click or drag words to move them to your answer area', 'Drag words within your answer to reorder them', 'Scored by how many words are in the correct position', 'New random clearances each session'].map((t, i) => (
            <li key={i} className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary-500 mt-0.5 shrink-0" />{t}</li>
          ))}
        </ul>
        <button onClick={startSession} disabled={starting} className="btn-primary w-full">
          {starting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading clearances...</> : <>Start Session <ChevronRight className="w-4 h-4 ml-1" /></>}
        </button>
      </div>

      <SessionHistory sessions={history.sessions} loading={loadingHistory} />
    </div>
  )

  // ── QUIZ ──────────────────────────────────────────────────────────────────
  if (state === 'quiz') {
    const q = questions[currentIdx]
    const isLast = currentIdx === questions.length - 1
    const bank = wordBanks[q?.id] ?? []
    const arr = arranged[q?.id] ?? []
    const done = arr.length === (q?.question_data.correctOrder.length ?? 0)
    const totalWords = q?.question_data.correctOrder.length ?? 0
    const catLabel = q?.question_data.category
      ? (CATEGORY_LABELS[q.question_data.category] ?? 'ATC Clearance')
      : undefined

    const handleDragStart = (event: DragStartEvent) => {
      const id = event.active.id as string
      const item = [...bank, ...arr].find(w => w.id === id) ?? null
      setActiveItem(item)
    }

    const handleDragOver = (event: DragOverEvent) => {
      const overId = event.over?.id as string | undefined
      if (!overId) { setOverZone(null); return }
      if (overId === 'answer-drop' || arr.some(w => w.id === overId)) setOverZone('answer')
      else if (overId === 'bank-drop' || bank.some(w => w.id === overId)) setOverZone('bank')
      else setOverZone(null)
    }

    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event
      setActiveItem(null)
      setOverZone(null)
      if (!over || !q) return

      const activeId = active.id as string
      const overId = over.id as string

      const bankIdx = bank.findIndex(w => w.id === activeId)
      const arrIdx = arr.findIndex(w => w.id === activeId)

      if (bankIdx >= 0) {
        // Dragging from bank → drop on answer zone or any answer word
        const goToAnswer = overId === 'answer-drop' || arr.some(w => w.id === overId) || overZone === 'answer'
        if (goToAnswer) moveToArranged(q.id, bank[bankIdx], bankIdx)
      } else if (arrIdx >= 0) {
        // Dragging from answer
        const goToBank = overId === 'bank-drop' || bank.some(w => w.id === overId) || overZone === 'bank'
        if (goToBank) {
          moveToBank(q.id, arr[arrIdx], arrIdx)
        } else {
          // Reorder within answer
          const toIdx = arr.findIndex(w => w.id === overId)
          if (toIdx >= 0 && arrIdx !== toIdx) {
            reorderArranged(q.id, arrIdx, toIdx)
          }
        }
      }
    }

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <button onClick={() => router.push('/dashboard/training')} className="text-sm text-gray-500 hover:text-primary-600 mb-1 flex items-center gap-1">← Training</button>
            <h2 className="text-xl font-bold text-gray-900">Jumbled Clearance</h2>
            <p className="text-sm text-gray-500 mt-0.5">Exercise {currentIdx + 1} of {questions.length}</p>
          </div>
          {catLabel && <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-violet-100 text-violet-700">{catLabel}</span>}
        </div>

        {/* Segmented progress */}
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= currentIdx ? 'bg-violet-500' : 'bg-gray-200'}`} />
          ))}
        </div>

        {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700"><AlertTriangle className="w-5 h-5 shrink-0" />{error}</div>}

        {q && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {/* Gradient header card */}
            <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 text-white px-5 py-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-lg leading-tight">Arrange the Clearance</p>
                  {catLabel && <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white/90 font-medium">{catLabel}</span>}
                </div>
              </div>
              <p className="text-violet-100 text-sm">{q.question_data.instruction}</p>
            </div>

            {/* Word bank + answer card */}
            <div className="card overflow-hidden p-5 space-y-5">
              {/* Word Bank */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-800">Word Bank</p>
                  <p className="text-xs text-violet-500">Click or drag words to arrange</p>
                </div>
                <BankDropZone highlight={overZone === 'bank'}>
                  {bank.length === 0
                    ? <p className="text-xs text-gray-400 w-full text-center py-2">All words placed ✓</p>
                    : bank.map(item => (
                      <DraggableWord
                        key={item.id}
                        item={item}
                        onAdd={() => moveToArranged(q.id, item, bank.indexOf(item))}
                      />
                    ))
                  }
                </BankDropZone>
              </div>

              {/* Your Answer */}
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-3">Your Answer</p>
                <AnswerDropZone highlight={overZone === 'answer'}>
                  {arr.length === 0
                    ? <p className="text-xs text-gray-400 w-full text-center py-2">Click or drag words here to form your answer</p>
                    : (
                      <SortableContext items={arr.map(w => w.id)} strategy={rectSortingStrategy}>
                        {arr.map((item, wi) => (
                          <SortableWord
                            key={item.id}
                            item={item}
                            onRemove={() => moveToBank(q.id, item, wi)}
                          />
                        ))}
                      </SortableContext>
                    )
                  }
                </AnswerDropZone>
              </div>

              {/* Check Answer button */}
              <div className="flex gap-2">
                <button
                  onClick={isLast ? submitSession : () => setCurrentIdx(i => i + 1)}
                  disabled={!done || (isLast && submitting)}
                  className="btn-primary flex-1 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {isLast && submitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting...</>
                    : `⊙ Check Answer (${arr.length}/${totalWords} words)`
                  }
                </button>
                <button
                  onClick={() => resetQuestion(q.id, q.question_data.correctOrder)}
                  className="p-2.5 rounded-xl border-2 border-gray-200 hover:border-gray-300 text-gray-500 hover:text-gray-700 transition-colors"
                  title="Reset"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Drag overlay — floats under the pointer/finger */}
            <DragOverlay>
              {activeItem && (
                <div className="px-3 py-1.5 rounded-full border shadow-lg select-none text-sm font-medium cursor-grabbing border-violet-400 bg-violet-100 text-violet-700">
                  {activeItem.word}
                </div>
              )}
            </DragOverlay>

            {/* Tip card */}
            <div className="rounded-xl bg-violet-50 border border-violet-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-violet-600" />
                <p className="text-sm font-bold text-violet-700">Standard Phraseology Structure</p>
              </div>
              <ol className="space-y-1.5">
                {PHRASEOLOGY_TIPS.map(t => (
                  <li key={t.num} className="flex items-start gap-2 text-xs text-violet-700">
                    <span className="w-4 h-4 rounded-full bg-violet-200 text-violet-700 flex items-center justify-center text-xs font-bold shrink-0">{t.num}</span>
                    {t.text}
                  </li>
                ))}
              </ol>
            </div>
          </DndContext>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-1">
          <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0} className="btn-secondary disabled:opacity-40">← Back</button>
          {!isLast && (
            <button onClick={() => setCurrentIdx(i => i + 1)} disabled={!done} className="btn-primary disabled:opacity-40">
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
                  <span className="font-medium text-gray-900">Clearance {idx + 1}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-semibold ${passed ? 'text-green-600' : 'text-red-600'}`}>{qScore}%</span>
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
                </div>
              </button>
              {open && (() => {
                const submitted = (answers[q.id] ?? '').trim().split(/\s+/).filter(Boolean)
                const statuses = analyzeWords(submitted, q.question_data.correctOrder)
                const correctCount = statuses.filter(s => s === 'correct').length
                const pillClass = (s: WordStatus) =>
                  s === 'correct' ? 'bg-green-100 text-green-700 border-green-300'
                  : s === 'present' ? 'bg-amber-100 text-amber-700 border-amber-300'
                  : 'bg-red-100 text-red-700 border-red-300'
                return (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-500">YOUR ANSWER</p>
                        {submitted.length > 0 && (
                          <p className="text-xs text-gray-500">{correctCount} of {q.question_data.correctOrder.length} words correct</p>
                        )}
                      </div>
                      {submitted.length === 0
                        ? <p className="text-sm text-gray-400">—</p>
                        : <div className="flex flex-wrap gap-1.5">
                            {submitted.map((w, wi) => (
                              <span key={wi} className={`px-2.5 py-1 rounded-full border text-xs font-medium ${pillClass(statuses[wi])}`}>{w}</span>
                            ))}
                          </div>
                      }
                      <div className="flex gap-3 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />Correct position</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Wrong position</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Not in answer</span>
                      </div>
                    </div>
                    <div><p className="text-xs font-semibold text-green-600 mb-1">CORRECT ORDER</p><p className="text-sm text-green-700 font-medium">{q.question_data.correctOrder.join(' ')}</p></div>
                  </div>
                )
              })()}
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
