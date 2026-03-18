'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Plane,
  ArrowRight,
  Radio,
  Target,
  BookOpen,
  Headphones,
  ChevronRight,
} from 'lucide-react'

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to the\nCorpus-Based System',
    subtitle: 'Your gateway to authentic Philippine aviation English training.',
    content: null,
  },
  {
    id: 'corpus',
    title: 'About the Corpus',
    subtitle: 'This system is powered by the Philippine Aeronautical English Corpus (PAEC) — a real, research-grade dataset.',
    content: 'corpus',
  },
  {
    id: 'categories',
    title: 'Three Corpus Categories',
    subtitle: 'All training and analysis is organized into three ATC communication domains.',
    content: 'categories',
  },
  {
    id: 'modules',
    title: 'Four Training Modules',
    subtitle: 'Each module targets a specific aspect of aviation English proficiency.',
    content: 'modules',
  },
  {
    id: 'ready',
    title: "You're all set!",
    subtitle: "Let's get you started on your training journey.",
    content: 'ready',
  },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { update } = useSession()

  const isLast = step === STEPS.length - 1

  async function handleNext() {
    if (isLast) {
      setLoading(true)
      await fetch('/api/user/complete-onboarding', { method: 'POST' })
      await update({ onboardingCompleted: true })
      router.push('/dashboard')
      return
    }
    setStep((s) => s + 1)
  }

  const current = STEPS[step]

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex flex-col items-center justify-center px-4 py-12">

      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg">
          <Plane className="w-5 h-5 text-white" />
        </div>
        <span className="text-lg font-bold text-gray-900">Corpus-Based System</span>
      </div>

      {/* Step dots */}
      <div className="flex items-center gap-2 mb-10">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-300 ${
              i === step
                ? 'w-8 h-2.5 bg-primary-600'
                : i < step
                ? 'w-2.5 h-2.5 bg-primary-300'
                : 'w-2.5 h-2.5 bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Card */}
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-elevated border border-gray-100 p-8 sm:p-12">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 whitespace-pre-line">
            {current.title}
          </h1>
          <p className="text-gray-500 text-base max-w-md mx-auto leading-relaxed">
            {current.subtitle}
          </p>
        </div>

        {/* Step content */}
        {current.content === 'corpus' && (
          <div className="space-y-4 mb-8">
            {[
              { label: 'What it is', value: 'Manually transcribed and annotated audio recordings of real pilot–ATC communications.' },
              { label: 'Where', value: 'Ninoy Aquino International Airport (RPLL), Manila, Philippines.' },
              { label: 'Coverage', value: 'Full 0000–2400 Zulu time. Sourced from publicly available LiveATC.net recordings.' },
              { label: 'Led by', value: 'Dr. Ramsey S. Ferrer under PhilSCA\'s AELP course, AY 2024–2025.' },
            ].map((row) => (
              <div key={row.label} className="flex gap-4 p-4 bg-gray-50 rounded-xl">
                <span className="text-xs font-semibold text-primary-600 uppercase tracking-wide w-24 shrink-0 pt-0.5">{row.label}</span>
                <span className="text-sm text-gray-700 leading-relaxed">{row.value}</span>
              </div>
            ))}
          </div>
        )}

        {current.content === 'categories' && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'APP/DEP', desc: 'Approach & Departure Control', color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-50', text: 'text-blue-700' },
              { label: 'GND', desc: 'Ground Control', color: 'from-violet-500 to-purple-500', bg: 'bg-violet-50', text: 'text-violet-700' },
              { label: 'RAMP', desc: 'Ramp Control', color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
            ].map((c) => (
              <div key={c.label} className={`${c.bg} rounded-2xl p-5 text-center`}>
                <div className={`w-12 h-12 bg-gradient-to-br ${c.color} rounded-xl flex items-center justify-center mx-auto mb-3`}>
                  <span className="text-white font-bold text-xs">{c.label}</span>
                </div>
                <div className={`font-bold text-base ${c.text} mb-1`}>{c.label}</div>
                <div className="text-xs text-gray-500 leading-tight">{c.desc}</div>
              </div>
            ))}
          </div>
        )}

        {current.content === 'modules' && (
          <div className="space-y-3 mb-8">
            {[
              { icon: Radio, label: 'Scenario-Based Simulation', desc: 'Respond to ATC clearances and validate your phraseology.', color: 'from-blue-500 to-cyan-500' },
              { icon: Target, label: 'Readback / Hearback Correction', desc: 'Identify and correct errors in pilot readbacks.', color: 'from-indigo-500 to-purple-500' },
              { icon: BookOpen, label: 'Jumbled Clearance', desc: 'Arrange clearance words into correct ICAO sequence.', color: 'from-violet-500 to-pink-500' },
              { icon: Headphones, label: 'Pronunciation Drill', desc: 'Master ICAO standard number and letter pronunciation.', color: 'from-emerald-500 to-teal-500' },
            ].map(({ icon: Icon, label, desc, color }) => (
              <div key={label} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className={`w-10 h-10 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center shrink-0`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-medium text-gray-900 text-sm">{label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {current.content === 'ready' && (
          <div className="flex justify-center mb-8">
            <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-primary-700 rounded-3xl flex items-center justify-center shadow-lg shadow-primary-500/30">
              <Plane className="w-12 h-12 text-white" />
            </div>
          </div>
        )}

        {/* Next button */}
        <button
          onClick={handleNext}
          disabled={loading}
          className="w-full btn-primary flex items-center justify-center text-base py-4"
        >
          {loading ? (
            'Loading...'
          ) : isLast ? (
            <>Go to Dashboard <ArrowRight className="w-5 h-5 ml-2" /></>
          ) : (
            <>Next <ChevronRight className="w-5 h-5 ml-1" /></>
          )}
        </button>

        {/* Step counter */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Step {step + 1} of {STEPS.length}
        </p>
      </div>
    </div>
  )
}
