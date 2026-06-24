import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'frost' | 'neon-void' | 'cosmic' | 'ember'

const THEMES: Theme[] = ['frost', 'neon-void', 'cosmic', 'ember']
const STORAGE_KEY = 'nexbookings-theme'
const DEFAULT_THEME: Theme = 'frost'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  themes: Theme[]
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    return stored && THEMES.includes(stored) ? stored : DEFAULT_THEME
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  function setTheme(newTheme: Theme) {
    setThemeState(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
