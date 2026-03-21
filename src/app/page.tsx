'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  Plane,
  Radio,
  BookOpen,
  BarChart3,
  ChevronRight,
  Headphones,
  Target,
  Award,
  Users,
  Globe,
  ArrowRight,
  ArrowUp,
  CheckCircle,
  Sparkles,
  Menu,
  X
} from 'lucide-react'

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { data: session } = useSession()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
      setShowScrollTop(window.scrollY > 300)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const features = [
    {
      icon: Radio,
      title: 'Scenario-Based Simulation',
      description: 'Practice real ATC clearances and pilot responses in realistic flight scenarios',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Target,
      title: 'Readback/Hearback Correction',
      description: 'Identify and correct errors in pilot readbacks to ATC instructions',
      color: 'from-indigo-500 to-purple-500',
    },
    {
      icon: BookOpen,
      title: 'Jumbled Clearance',
      description: 'Arrange mixed-order clearance words into correct ICAO phraseology',
      color: 'from-violet-500 to-pink-500',
    },
    {
      icon: Headphones,
      title: 'Pronunciation Drill',
      description: 'Master ICAO standard pronunciation for numbers and aviation terms',
      color: 'from-emerald-500 to-teal-500',
    },
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-soft' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/25">
                <Plane className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <span className="text-xl font-bold text-gray-900">Corpus-Based System</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              <a href="#features" className="nav-link">Features</a>
              <a href="#training" className="nav-link">Training</a>
              <a href="#analysis" className="nav-link">Analysis</a>
              <a href="#about" className="nav-link">About</a>
            </div>

            {/* CTA Buttons */}
            <div className="hidden lg:flex items-center gap-3">
              {session ? (
                <Link href="/dashboard" className="btn-primary">
                  Go to Dashboard
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              ) : (
                <>
                  <Link href="/auth/login" className="btn-ghost">
                    Sign In
                  </Link>
                  <Link href="/auth/register" className="btn-primary">
                    Get Started
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden p-2 text-gray-600 hover:text-primary-600"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-700 shadow-lg animate-slide-down">
            <div className="px-4 py-4 space-y-3">
              <a href="#features" className="block px-4 py-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg">Features</a>
              <a href="#training" className="block px-4 py-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg">Training</a>
              <a href="#analysis" className="block px-4 py-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg">Analysis</a>
              <a href="#about" className="block px-4 py-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg">About</a>
              <hr className="my-3" />
              {session ? (
                <Link href="/dashboard" className="block btn-primary w-full text-center">Go to Dashboard</Link>
              ) : (
                <>
                  <Link href="/auth/login" className="block px-4 py-2 text-center text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg">Sign In</Link>
                  <Link href="/auth/register" className="block btn-primary w-full text-center">Get Started</Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 gradient-bg"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1e3a5f_1px,transparent_1px),linear-gradient(to_bottom,#1e3a5f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]"></div>

        {/* Floating Elements */}
        <div className="absolute top-1/4 left-10 w-72 h-72 bg-primary-200/30 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-aviation-sky/20 rounded-full blur-3xl animate-pulse-slow delay-1000"></div>

        {/* Floating Aircraft Icon */}
        <div className="absolute top-1/3 right-1/4 hidden lg:block animate-float">
          <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-2xl shadow-elevated flex items-center justify-center">
            <Plane className="w-10 h-10 text-primary-500" />
          </div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 lg:pt-32">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Content */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 border border-primary-100 rounded-full text-sm font-medium text-primary-700 mb-6 animate-fade-in">
                <Sparkles className="w-4 h-4" />
                Philippine Aeronautical English Corpus
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6 animate-slide-up">
                Master ICAO-Standard
                <span className="block gradient-text">Phraseology</span>
              </h1>

              <p className="text-lg sm:text-xl text-gray-600 max-w-xl mx-auto lg:mx-0 mb-8 animate-slide-up delay-100">
                Train with authentic pilot–ATC communications drawn directly from the Philippine
                Aeronautical English Corpus (PAEC). Improve your ICAO-standard phraseology and
                enhance aviation communication safety in Philippine operations.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-slide-up delay-200">
                {session ? (
                  <Link href="/dashboard" className="btn-primary text-lg px-8 py-4">
                    Go to Dashboard
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                ) : (
                  <Link href="/auth/register" className="btn-primary text-lg px-8 py-4">
                    Start Training
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                )}
                <Link href="#features" className="btn-secondary text-lg px-8 py-4">
                  Explore Features
                </Link>
              </div>

              {/* Trust Badges */}
              <div className="mt-10 pt-8 border-t border-gray-200 dark:border-slate-700 animate-fade-in delay-300">
                <p className="text-sm text-gray-500 mb-4">Built on ICAO Standards</p>
                <div className="flex items-center justify-center lg:justify-start gap-6">
                  <div className="flex items-center gap-2 text-gray-600">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-medium">ICAO Compliant</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-medium">Research-Based</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Content - Hero Card */}
            <div className="relative hidden lg:block">
              <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-elevated p-8 border border-gray-100 dark:border-slate-700">
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Sample Analysis</h3>
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">APP/DEP</span>
                  </div>

                  {/* ATC line */}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">ATC</p>
                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl px-4 py-3 text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
                      PAL456, descend and maintain four thousand, QNH one zero one three.
                    </div>
                  </div>

                  {/* Pilot readback with highlighted errors */}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pilot Readback</p>
                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl px-4 py-3 text-sm leading-relaxed">
                      <span className="text-gray-700 dark:text-slate-300">Roger, </span>
                      <span className="bg-amber-200 dark:bg-amber-400/30 text-amber-800 dark:text-amber-300 rounded px-1">descend four thousand</span>
                      <span className="text-gray-700 dark:text-slate-300">, QNH one zero one three, PAL456.</span>
                    </div>
                  </div>

                  {/* Error tags */}
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 text-xs">
                      <span className="shrink-0 mt-0.5 w-2 h-2 rounded-full bg-amber-400"></span>
                      <span className="text-gray-600 dark:text-slate-400"><span className="font-medium text-gray-800 dark:text-slate-200">&quot;Roger&quot;</span> — non-standard acknowledgement</span>
                    </div>
                    <div className="flex items-start gap-2 text-xs">
                      <span className="shrink-0 mt-0.5 w-2 h-2 rounded-full bg-amber-400"></span>
                      <span className="text-gray-600 dark:text-slate-400"><span className="font-medium text-gray-800 dark:text-slate-200">&quot;maintain&quot;</span> — omitted from readback</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100 dark:border-slate-700">
                    <Link href={session ? '/dashboard' : '/auth/register'} className="w-full btn-primary flex items-center justify-center">
                      {session ? 'Go to Dashboard' : 'Start Training'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Decorative Elements */}
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary-100 dark:bg-primary-900/30 rounded-2xl -z-10"></div>
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-aviation-light dark:bg-slate-800/50 rounded-2xl -z-10"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 lg:py-32 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="badge-primary mb-4">Training Modules</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Four Comprehensive Training Categories
            </h2>
            <p className="text-lg text-gray-600">
              Each module is designed to target specific aspects of aviation English proficiency
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            {features.map((feature, index) => (
              <div key={index} className="card-interactive group p-6 lg:p-8">
                <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 mb-4">{feature.description}</p>
                <div className="flex items-center text-primary-600 font-medium">
                  Start Training
                  <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Training Mode Section */}
      <section id="training" className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <span className="badge-primary mb-4">Training Mode</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
                Interactive Practice for Real-World Scenarios
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Train with authentic pilot-ATC communications drawn directly from the
                Philippine Aeronautical English Corpus (PAEC). The system validates your
                responses against ICAO standard phraseology and provides instant, actionable
                feedback on non-standard elements.
              </p>

              <div className="space-y-4">
                {[
                  'Real flight scenario simulations',
                  'Instant feedback on phraseology accuracy',
                  'Number and terminology error detection',
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-primary-600" />
                    </div>
                    <span className="text-gray-700">{item}</span>
                  </div>
                ))}
              </div>

              <Link href="/dashboard/training" className="btn-primary mt-8 inline-flex">
                Enter Training Mode
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-primary-500 to-primary-700 rounded-3xl p-8 text-white">
                <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm mb-6">
                  <div className="text-sm text-primary-100 mb-2">ATC Clearance</div>
                  <p className="text-lg font-medium">
                    &quot;PAL456, climb and maintain flight level 350, turn right heading 090&quot;
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-700 rounded-2xl p-6 text-gray-900 dark:text-slate-100">
                  <div className="text-sm text-gray-500 dark:text-slate-400 mb-2">Your Response</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 dark:bg-slate-600 rounded-xl px-4 py-3 text-gray-700 dark:text-slate-200">
                      Climb maintain flight level 350, right heading 090, PAL456
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    <span className="text-sm text-primary-100">Correct Elements: 4/5</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Analysis Mode Section */}
      <section id="analysis" className="py-20 lg:py-32 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="order-2 lg:order-1">
              <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-elevated p-8 border border-gray-100 dark:border-slate-700">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="font-semibold text-gray-900">Corpus Analysis</h4>
                  <span className="badge-success">APP/DEP Control</span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-primary-50 rounded-xl p-4">
                    <div className="text-2xl font-bold text-primary-600">12.4</div>
                    <div className="text-xs text-gray-600">Non-standard per 1k words</div>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4">
                    <div className="text-2xl font-bold text-amber-600">23</div>
                    <div className="text-xs text-gray-600">Clarification Sequences</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-sm text-gray-600">Language-Based Errors</span>
                    <span className="font-semibold text-gray-900">67%</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-sm text-gray-600">Number-Related Errors</span>
                    <span className="font-semibold text-gray-900">33%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <span className="badge-primary mb-4">Analysis Mode</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
                Deep Insights from Corpus Data
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Analyze authentic aviation communication patterns from the Philippine
                Aeronautical English Corpus (PAEC) across three specialized domains.
                Explore phraseology patterns, deviations from ICAO standards, and
                standardization insights specific to Philippine operations.
              </p>

              <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                  { label: 'APP/DEP', desc: 'Approach & Departure' },
                  { label: 'GND', desc: 'Ground Control' },
                  { label: 'RAMP', desc: 'Ramp Control' },
                ].map((corpus, index) => (
                  <div key={index} className="text-center p-4 bg-white dark:bg-slate-700 rounded-xl border border-gray-200 dark:border-slate-600">
                    <div className="font-bold text-primary-600 mb-1">{corpus.label}</div>
                    <div className="text-xs text-gray-500">{corpus.desc}</div>
                  </div>
                ))}
              </div>

              <Link href="/dashboard/analysis" className="btn-primary inline-flex">
                Explore Analysis
                <BarChart3 className="w-5 h-5 ml-2" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 lg:py-32 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Section header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="badge-primary mb-4">About the Corpus</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Philippine Aeronautical English Corpus
            </h2>
            <p className="text-lg text-gray-600">
              An authentic, specialized collection of manually transcribed and annotated
              audio recordings of real pilot–ATC communications at Ninoy Aquino
              International Airport (RPLL) in Manila.
            </p>
          </div>

          {/* What is a Corpus? definitions */}
          <div className="grid md:grid-cols-2 gap-6 mb-10">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-2">What is a Corpus?</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                A corpus is a collection of machine-readable authentic texts (including transcripts
                of spoken data) that is sampled to be representative of a particular language or
                language variety.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-2">What is a Specialized Corpus?</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Specialized corpora are designed for the analysis of specific domains, genres, or
                speaker groups. Unlike general corpora, their goal is not broad coverage but depth
                and contextual specificity.
              </p>
            </div>
          </div>

          {/* Related corpora — compact chips */}
          <div className="mb-16">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 text-center">Related aviation English corpora</p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                { name: 'ATCOSIM', year: '2007', author: 'Stefan Petrik' },
                { name: 'RTPEC', year: '2019', author: 'Malila Prado' },
                { name: 'CORPAC', year: '2021', author: 'Aline Pacheco' },
                { name: 'Aerocorpus', year: '2024', author: 'Tosqui-Lucks et al.' },
                { name: 'ACE-PHI', year: '2025', author: 'Ramsey Ferrer' },
              ].map((corpus) => (
                <span key={corpus.name} className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 text-xs text-gray-700">
                  <span className="font-semibold text-gray-900">{corpus.name}</span>
                  <span className="text-gray-400">{corpus.year}</span>
                  <span className="text-gray-400">·</span>
                  <span>{corpus.author}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Two-column: history + key facts */}
          <div className="grid lg:grid-cols-2 gap-12 items-start mb-16">

            {/* Left: History */}
            <div className="space-y-5">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <span className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-primary-600" />
                </span>
                History
              </h3>
              <p className="text-gray-600 leading-relaxed text-justify">
                PAEC was built during the 2nd semester of AY 2024–2025 under{' '}
                <span className="font-medium text-gray-800">Dr. Ramsey S. Ferrer</span> as part of
                the AELP course at PhilSCA. Batch Lima — 31 pairs of 2nd-year BSAVCOMM students
                (PAEC01–PAEC31) — collected full 24-hour recordings from LiveATC.net at RPLL between
                February 1 and March 3, 2025, then transcribed and annotated them with structured metadata.
              </p>
              <p className="text-sm font-medium text-gray-700">Guest workshops by Dr. Malila Prado</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-primary-50 rounded-xl p-4 border border-primary-100">
                  <p className="text-xs font-semibold text-primary-700 mb-1">Online</p>
                  <p className="text-xs text-gray-600 leading-relaxed">Corpus building, transcription guidelines, and RTPEC review.</p>
                </div>
                <div className="bg-primary-50 rounded-xl p-4 border border-primary-100">
                  <p className="text-xs font-semibold text-primary-700 mb-1">In-person · Feb 7, 2025</p>
                  <p className="text-xs text-gray-600 leading-relaxed">Students&apos; experiences, transcription, and professional markup guidelines.</p>
                </div>
              </div>
            </div>

            {/* Right: Key facts card */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-soft p-8 space-y-5">
              <h3 className="text-lg font-semibold text-gray-900">Corpus at a Glance</h3>
              {[
                { label: 'Airport', value: 'Ninoy Aquino International Airport (RPLL), Manila' },
                { label: 'Institution', value: 'Philippine State College of Aeronautics (PhilSCA)' },
                { label: 'Program', value: 'BS Aviation Communication Major in Flight Operations' },
                { label: 'Course', value: 'Aeronautical English Language Proficiency (AELP)' },
                { label: 'Led by', value: 'Dr. Ramsey S. Ferrer' },
                { label: 'Academic Year', value: '2nd Semester, AY 2024–2025' },
                { label: 'Source', value: 'LiveATC.net — full 0000–2400 Zulu time coverage' },
              ].map((fact) => (
                <div key={fact.label} className="flex gap-4 items-start">
                  <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider w-28 shrink-0 pt-0.5">{fact.label}</span>
                  <span className="text-gray-700 text-sm leading-relaxed">{fact.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Corpus phases timeline */}
          <div className="mb-16">
            <h3 className="text-xl font-semibold text-gray-900 mb-8 text-center">How the Corpus Was Built</h3>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  phase: '01',
                  title: 'Data Collection',
                  description: 'Audio recordings sourced from publicly available LiveATC.net, covering full 0000–2400 Zulu time at RPLL.',
                  color: 'from-blue-500 to-cyan-500',
                  bg: 'bg-blue-50',
                },
                {
                  phase: '02',
                  title: 'Transcription & Metadata',
                  description: 'Manual transcription with metadata entry: corpus ID, speaker roles, situational context, duration, word count, weather, and date.',
                  color: 'from-violet-500 to-purple-500',
                  bg: 'bg-violet-50',
                },
                {
                  phase: '03',
                  title: 'Expert Review',
                  description: 'Final expert-guided review and standardization, benchmarked against RTPEC (2019) during the Dr. Malila Prado workshop.',
                  color: 'from-emerald-500 to-teal-500',
                  bg: 'bg-emerald-50',
                },
              ].map((step) => (
                <div key={step.phase} className={`${step.bg} rounded-2xl p-6 border border-white`}>
                  <div className={`w-10 h-10 bg-gradient-to-br ${step.color} rounded-xl flex items-center justify-center text-white font-bold text-sm mb-4`}>
                    {step.phase}
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">{step.title}</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Feature cards */}
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Globe,
                title: 'ICAO Standards',
                description: 'Built on international aviation communication standards to ensure global compliance.',
              },
              {
                icon: Users,
                title: 'Research-Driven',
                description: 'Developed through extensive analysis of real ATC-pilot communications.',
              },
              {
                icon: Award,
                title: 'Quality Training',
                description: 'Designed to enhance aviation English proficiency and communication safety.',
              },
            ].map((item, index) => (
              <div key={index} className="text-center p-8 bg-white rounded-2xl border border-gray-100">
                <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <item.icon className="w-8 h-8 text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>

          {/* Development Status */}
          <div className="mt-12 bg-amber-50 border border-amber-200 rounded-2xl p-6 flex gap-4 items-start">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
              <BookOpen className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-900 mb-1">Development Status</h3>
              <p className="text-sm text-amber-800 leading-relaxed">
                PAEC is a work in progress. Refining, polishing, and further reviewing of the corpus
                are still ongoing. However, it is already usable for analysis and training purposes.
                As a specialized corpus, PAEC is intentionally focused on a specific context (RPLL
                frequencies) and is not meant to generalize the overall or entire picture of
                pilot–controller interaction across the Philippines.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to Enhance Your Aviation Communication?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Join hundreds of aviation professionals improving their ICAO phraseology skills.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {session ? (
              <Link href="/dashboard" className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-primary-600 bg-white rounded-xl shadow-lg hover:bg-gray-50 transition-all duration-300">
                Go to Dashboard
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            ) : (
              <>
                <Link href="/auth/register" className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-primary-600 bg-white rounded-xl shadow-lg hover:bg-gray-50 transition-all duration-300">
                  Create Free Account
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
                <Link href="/auth/login" className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white border-2 border-white/30 rounded-xl hover:bg-white/10 transition-all duration-300">
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 p-2.5 bg-gray-900 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors"
          title="Scroll to top"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
                  <Plane className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">Corpus-Based System</span>
              </div>
              <p className="text-gray-400 max-w-md">
                Corpus Based System - Supporting Philippine Aviation English training
                through authentic corpus data.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Training</h4>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white transition-colors">Scenario Simulation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Readback Correction</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Jumbled Clearance</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pronunciation Drill</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Resources</h4>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white transition-colors">ICAO Standards</a></li>
                <li><a href="#" className="hover:text-white transition-colors">About the Corpus</a></li>
                <li><a href="#" className="hover:text-white transition-colors">About Research</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2026 Corpus Based System. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
