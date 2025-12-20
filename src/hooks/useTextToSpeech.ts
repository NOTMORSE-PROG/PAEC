'use client'

import { useState, useCallback } from 'react'

export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isSupported, setIsSupported] = useState(false)

  // Check if browser supports speech synthesis
  const checkSupport = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true)
      return true
    }
    return false
  }, [])

  const speak = useCallback((text: string, options?: {
    rate?: number
    pitch?: number
    volume?: number
    voice?: string
  }) => {
    if (!checkSupport()) {
      console.warn('Speech synthesis not supported')
      return
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)

    // Set options
    utterance.rate = options?.rate || 0.9 // Slightly slower for clarity
    utterance.pitch = options?.pitch || 1
    utterance.volume = options?.volume || 1

    // Try to use a specific voice if provided
    if (options?.voice) {
      const voices = window.speechSynthesis.getVoices()
      const selectedVoice = voices.find(voice =>
        voice.name.toLowerCase().includes(options.voice!.toLowerCase())
      )
      if (selectedVoice) {
        utterance.voice = selectedVoice
      }
    }

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }, [checkSupport])

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }, [])

  const speakATCClearance = useCallback((text: string) => {
    // Use a more professional voice for ATC communications
    speak(text, { rate: 0.85, voice: 'en-US' })
  }, [speak])

  return {
    speak,
    speakATCClearance,
    stop,
    isSpeaking,
    isSupported: isSupported || checkSupport(),
  }
}
