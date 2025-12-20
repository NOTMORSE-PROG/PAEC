'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
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
  CheckCircle,
  Sparkles,
  Menu,
  X
} from 'lucide-react'

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
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

  const stats = [
    { value: '10,000+', label: 'Training Exercises' },
    { value: '95%', label: 'Accuracy Rate' },
    { value: '500+', label: 'Active Learners' },
    { value: '3', label: 'Corpus Categories' },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/95 backdrop-blur-md shadow-soft' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/25">
                <Plane className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <span className="text-xl font-bold text-gray-900">PAEC</span>
                <span className="hidden md:inline text-xs text-gray-500 block -mt-1">Corpus-Based System</span>
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
              <Link href="/auth/login" className="btn-ghost">
                Sign In
              </Link>
              <Link href="/auth/register" className="btn-primary">
                Get Started
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
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
          <div className="lg:hidden bg-white border-t border-gray-100 shadow-lg animate-slide-down">
            <div className="px-4 py-4 space-y-3">
              <a href="#features" className="block px-4 py-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg">Features</a>
              <a href="#training" className="block px-4 py-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg">Training</a>
              <a href="#analysis" className="block px-4 py-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg">Analysis</a>
              <a href="#about" className="block px-4 py-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg">About</a>
              <hr className="my-3" />
              <Link href="/auth/login" className="block px-4 py-2 text-center text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg">Sign In</Link>
              <Link href="/auth/register" className="block btn-primary w-full text-center">Get Started</Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 gradient-bg"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]"></div>

        {/* Floating Elements */}
        <div className="absolute top-1/4 left-10 w-72 h-72 bg-primary-200/30 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-aviation-sky/20 rounded-full blur-3xl animate-pulse-slow delay-1000"></div>

        {/* Floating Aircraft Icon */}
        <div className="absolute top-1/3 right-1/4 hidden lg:block animate-float">
          <div className="w-20 h-20 bg-white rounded-2xl shadow-elevated flex items-center justify-center">
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
                Master Aviation
                <span className="block gradient-text">Communication</span>
              </h1>

              <p className="text-lg sm:text-xl text-gray-600 max-w-xl mx-auto lg:mx-0 mb-8 animate-slide-up delay-100">
                Train with corpus-based exercises designed to improve your ICAO standard
                phraseology and enhance aviation communication safety.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-slide-up delay-200">
                <Link href="/auth/register" className="btn-primary text-lg px-8 py-4">
                  Start Training
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
                <Link href="#features" className="btn-secondary text-lg px-8 py-4">
                  Explore Features
                </Link>
              </div>

              {/* Trust Badges */}
              <div className="mt-10 pt-8 border-t border-gray-200 animate-fade-in delay-300">
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
              <div className="relative bg-white rounded-3xl shadow-elevated p-8 border border-gray-100">
                {/* Mini Dashboard Preview */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Training Progress</h3>
                    <span className="badge-primary">Student View</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="stat-card">
                      <div className="text-2xl font-bold text-primary-600">87%</div>
                      <div className="text-sm text-gray-500">Accuracy Rate</div>
                    </div>
                    <div className="stat-card">
                      <div className="text-2xl font-bold text-primary-600">156</div>
                      <div className="text-sm text-gray-500">Exercises Done</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Scenario Simulation</span>
                      <span className="font-medium text-primary-600">92%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: '92%' }}></div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Readback Correction</span>
                      <span className="font-medium text-primary-600">78%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: '78%' }}></div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <button className="w-full btn-primary">
                      Continue Training
                    </button>
                  </div>
                </div>
              </div>

              {/* Decorative Elements */}
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary-100 rounded-2xl -z-10"></div>
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-aviation-light rounded-2xl -z-10"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gradient-to-r from-primary-600 to-primary-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-white mb-2">{stat.value}</div>
                <div className="text-primary-100">{stat.label}</div>
              </div>
            ))}
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
                Train with realistic ATC communications based on actual corpus data.
                Our system validates your responses against ICAO phraseology standards
                and provides instant, actionable feedback.
              </p>

              <div className="space-y-4">
                {[
                  'Real flight scenario simulations',
                  'Instant feedback on phraseology accuracy',
                  'Number and terminology error detection',
                  'Progressive difficulty levels',
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
                    "PAL456, climb and maintain flight level 350, turn right heading 090"
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-6 text-gray-900">
                  <div className="text-sm text-gray-500 mb-2">Your Response</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-xl px-4 py-3 text-gray-700">
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
              <div className="bg-white rounded-3xl shadow-elevated p-8 border border-gray-100">
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
                Analyze aviation communication patterns with three specialized corpus
                categories. Understand error distributions, miscommunication risks,
                and phraseology deviations.
              </p>

              <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                  { label: 'APP/DEP', desc: 'Approach & Departure' },
                  { label: 'GND', desc: 'Ground Control' },
                  { label: 'RAMP', desc: 'Ramp Control' },
                ].map((corpus, index) => (
                  <div key={index} className="text-center p-4 bg-white rounded-xl border border-gray-200">
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
      <section id="about" className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="badge-primary mb-4">About PAEC</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Philippine Aeronautical English Corpus
            </h2>
            <p className="text-lg text-gray-600">
              A research-based corpus of authentic aviation communications designed
              to improve safety and standardization in Philippine airspace.
            </p>
          </div>

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
              <div key={index} className="text-center p-8">
                <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <item.icon className="w-8 h-8 text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-600">{item.description}</p>
              </div>
            ))}
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
            <Link href="/auth/register" className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-primary-600 bg-white rounded-xl shadow-lg hover:bg-gray-50 transition-all duration-300">
              Create Free Account
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
            <Link href="/auth/login" className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white border-2 border-white/30 rounded-xl hover:bg-white/10 transition-all duration-300">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
                  <Plane className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">PAEC</span>
              </div>
              <p className="text-gray-400 max-w-md">
                Philippine Aeronautical English Corpus - Enhancing aviation communication
                safety through research-based training.
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
                <li><a href="#" className="hover:text-white transition-colors">Corpus Data</a></li>
                <li><a href="#" className="hover:text-white transition-colors">About Research</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2024 Philippine Aeronautical English Corpus. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
