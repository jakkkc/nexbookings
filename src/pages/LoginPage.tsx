import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ThemeSwitcher } from '../components/ThemeSwitcher'

type Mode = 'signin' | 'signup'

export function LoginPage() {
  const { session, loading } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [fullName, setFullName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  if (!loading && session) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setMessage(null)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            business_name: businessName || fullName + "'s Properties",
          },
        },
      })
      if (error) {
        setError(error.message)
      } else {
        setMessage('Check your email to confirm your account.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }

    setSubmitting(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      background: 'var(--bg)',
    }}>
      {/* Theme switcher top-right */}
      <div style={{ position: 'fixed', top: '1.25rem', right: '1.25rem' }}>
        <ThemeSwitcher />
      </div>

      <div className="glass-card" style={{ width: '100%', maxWidth: '26rem', padding: '2rem' }}>
        {/* Logo / wordmark */}
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 300, letterSpacing: '0.06em', color: 'var(--text)' }}>
            Nex<span style={{ color: 'var(--primary)' }}>Bookings</span>
          </h1>
          <p className="mono-accent" style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
            {mode === 'signup' ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>

        {error && (
          <div style={{
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            background: 'color-mix(in oklab, #ef4444 15%, transparent)',
            border: '1px solid #ef4444',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            color: '#ef4444',
          }}>
            {error}
          </div>
        )}

        {message && (
          <div style={{
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            background: 'color-mix(in oklab, var(--primary) 15%, transparent)',
            border: '1px solid var(--primary)',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
          }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {mode === 'signup' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.375rem', color: 'var(--text-secondary)' }}>
                  Your name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Muthoni"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.375rem', color: 'var(--text-secondary)' }}>
                  Business name
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Lakeside Lodge Group"
                  style={inputStyle}
                />
              </div>
            </>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.375rem', color: 'var(--text-secondary)' }}>
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@lodge.co.ke"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.375rem', color: 'var(--text-secondary)' }}>
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="glow-border"
            style={{
              marginTop: '0.5rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--primary)',
              color: 'var(--bg)',
              fontWeight: 600,
              fontSize: '0.9375rem',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting
              ? 'Please wait…'
              : mode === 'signup'
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>

        <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setMessage(null) }}
            style={{ color: 'var(--primary)', fontWeight: 500, background: 'none', cursor: 'pointer' }}
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>

      {/* Footer */}
      <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
        Built by{' '}
        <a
          href="https://nex-chi-six.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--primary)' }}
        >
          Jackson Mwaniki Munene
        </a>
        {' '}— nex-chi-six.vercel.app
      </p>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.625rem 0.875rem',
  background: 'var(--glass-bg)',
  border: '1px solid var(--glass-border)',
  borderRadius: '0.5rem',
  color: 'var(--text)',
  fontSize: '0.9375rem',
}
