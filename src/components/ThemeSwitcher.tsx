import { useTheme, type Theme } from '../contexts/ThemeContext'

const THEME_LABELS: Record<Theme, string> = {
  frost: 'Frost',
  'neon-void': 'Neon void',
  cosmic: 'Cosmic',
  ember: 'Ember',
}

const THEME_COLORS: Record<Theme, string> = {
  frost: '#90caf9',
  'neon-void': '#4fc3f7',
  cosmic: '#e0b84f',
  ember: '#ff7043',
}

export function ThemeSwitcher() {
  const { theme, setTheme, themes } = useTheme()

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      {themes.map((t) => (
        <button
          key={t}
          onClick={() => setTheme(t)}
          title={THEME_LABELS[t]}
          style={{
            width: '1.5rem',
            height: '1.5rem',
            borderRadius: '50%',
            background: THEME_COLORS[t],
            border: theme === t ? '2px solid var(--text)' : '2px solid transparent',
            cursor: 'pointer',
            padding: 0,
            outline: theme === t ? '2px solid var(--primary)' : 'none',
            outlineOffset: '2px',
            transition: 'outline 0.2s, border-color 0.2s',
          }}
          aria-label={`Switch to ${THEME_LABELS[t]} theme`}
          aria-pressed={theme === t}
        />
      ))}
    </div>
  )
}
