'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { normalizeDigits, buildAviationGrammar } from '@/lib/speechNormalize'

// Ambient types for Web Speech API (not fully typed in all TS lib versions)
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionErrorEvent extends Event { error: string }
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  grammars: unknown
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror:  ((e: SpeechRecognitionErrorEvent) => void) | null
  onend:    (() => void) | null
}
declare var SpeechRecognition: { new(): SpeechRecognition }
declare var webkitSpeechRecognition: { new(): SpeechRecognition }

interface SpeechRecognitionOptions {
  vocabulary?: string[]
}

export function useSpeechRecognition(options: SpeechRecognitionOptions = {}) {
  const { vocabulary = [] } = options

  const [isSupported, setIsSupported] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [error,       setError]       = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' &&
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      setIsSupported(true)
    }
  }, [])

  // Abort on unmount
  useEffect(() => () => { recognitionRef.current?.abort() }, [])

  const startListening = useCallback((onFinalResult: (text: string) => void, initialText = '') => {
    if (!isSupported) return
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    const recognition: SpeechRecognition = new SR()
    recognition.continuous = true       // keep recording until user clicks stop
    recognition.interimResults = true
    recognition.lang = 'en-US'

    // Apply aviation vocabulary grammar hint (Chrome/Edge only — no-op elsewhere)
    if (vocabulary.length > 0) {
      const GrammarList = (window as any).SpeechGrammarList ?? (window as any).webkitSpeechGrammarList
      if (GrammarList) {
        const grammarList = new GrammarList()
        grammarList.addFromString(buildAviationGrammar(vocabulary), 1)
        recognition.grammars = grammarList
      }
    }

    // Accumulates all finalized segments — seeded with existing text so
    // a second recording session appends rather than overrides
    let accumulated = initialText

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = ''
      let hasNewFinal = false
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          accumulated += (accumulated ? ' ' : '') + e.results[i][0].transcript
          hasNewFinal = true
        } else {
          interim += e.results[i][0].transcript
        }
      }
      // Show unsettled partial inside textarea
      setInterimText(interim)
      // Only update textarea when a new final segment actually arrived
      if (hasNewFinal) onFinalResult(normalizeDigits(accumulated.trim()))
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      const msgs: Record<string, string> = {
        'not-allowed': 'Microphone access denied. Allow permissions and try again.',
        'no-speech':   'No speech detected. Please try again.',
      }
      setError(msgs[e.error] ?? `Speech error: ${e.error}`)
      setIsListening(false)
      setInterimText('')
    }

    recognition.onend = () => { setIsListening(false); setInterimText('') }

    recognitionRef.current = recognition
    setError(null)
    recognition.start()
    setIsListening(true)
  }, [isSupported, vocabulary])

  const stopListening = useCallback(() => {
    // stop() gracefully finalizes any pending interim before firing onend
    recognitionRef.current?.stop()
  }, [])

  const toggleListening = useCallback((onFinalResult: (text: string) => void, initialText = '') => {
    if (isListening) stopListening()
    else startListening(onFinalResult, initialText)
  }, [isListening, startListening, stopListening])

  return { isSupported, isListening, interimText, error, toggleListening, stopListening }
}
