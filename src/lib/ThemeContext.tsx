'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type ThemeContextType = {
  darkMode: boolean
  setDarkMode: (value: boolean) => void
  autoPlayAudio: boolean
  setAutoPlayAudio: (value: boolean) => void
}

const ThemeContext = createContext<ThemeContextType>({
  darkMode: false,
  setDarkMode: () => {},
  autoPlayAudio: true,
  setAutoPlayAudio: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkModeState] = useState(false)
  const [autoPlayAudio, setAutoPlayAudioState] = useState(true)

  // Read from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('darkMode')
    const enabled = stored === 'true'
    setDarkModeState(enabled)
    if (enabled) {
      document.documentElement.classList.add('dark')
    }
    const storedAuto = localStorage.getItem('autoPlayAudio')
    if (storedAuto !== null) setAutoPlayAudioState(storedAuto === 'true')
  }, [])

  const setDarkMode = (value: boolean) => {
    const html = document.documentElement
    // Add transition class so the switch animates smoothly
    html.classList.add('theme-transitioning')
    setDarkModeState(value)
    localStorage.setItem('darkMode', String(value))
    if (value) {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
    setTimeout(() => html.classList.remove('theme-transitioning'), 260)
  }

  const setAutoPlayAudio = (value: boolean) => {
    setAutoPlayAudioState(value)
    localStorage.setItem('autoPlayAudio', String(value))
  }

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode, autoPlayAudio, setAutoPlayAudio }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
