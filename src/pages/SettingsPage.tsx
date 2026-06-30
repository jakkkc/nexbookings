import { useState } from 'react'
import { Lock, Check, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { AppLayout } from '../components/AppLayout'

const TOUR_SEEN_KEY_PREFIX = 'nexbookings-tour-seen-'

export function SettingsPage() {
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function replayTour() {
    if (user) {
      localStorage.removeItem(TOUR_SEEN_KEY_PREFIX + user.id)
      window.location.reload()
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }

    setSaving(true)

    // Verify current password by re-authenticating
    if (user?.email) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })
      if (signInError) {
        setError('Current password is incorrect.')
        setSaving(false)
        return
      }
    }

    // Update to new password
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <AppLayout>
      <div style={{ marginBottom: '2rem' }}>
        <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '0.375rem' }}>Settings</p>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 300 }}>Account settings</h2>
      </div>

      <div className="glass-card" style={{ padding: '1.5rem', maxWidth: '28rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
          <Lock size={18} strokeWidth={1.5} style={{ color: 'var(--primary)' }} />
          <p style={{ fontWeight: 500, fontSize: '1rem' }}>Change password</p>
        </div>

        {error && (
          <div style={{ padding: '0.75rem 1rem', marginBottom: '1rem', background: 'color-mix(in oklab, #ef4444 15%, transparent)', border: '1px solid #ef4444', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#ef4444' }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1rem', background: 'color-mix(in oklab, #10b981 15%, transparent)', border: '1px solid #10b981', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#10b981' }}>
            <Check size={15} strokeWidth={1.5} /> Password updated successfully.
          </div>
        )}

        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Current password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>New password</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Min. 8 characters"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Confirm new password</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              style={inputStyle}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="glow-border"
            style={{
              padding: '0.75rem', borderRadius: '0.5rem',
              background: 'var(--primary)', color: 'var(--bg)',
              fontWeight: 600, fontSize: '0.9375rem',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>

      <div className="glass-card" style={{ padding: '1.5rem', maxWidth: '28rem', marginTop: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.75rem' }}>
          <Sparkles size={18} strokeWidth={1.5} style={{ color: 'var(--primary)' }} />
          <p style={{ fontWeight: 500, fontSize: '1rem' }}>Welcome tour</p>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.55 }}>
          Want a refresher on what NexBookings can do?
        </p>
        <button
          onClick={replayTour}
          style={{
            padding: '0.625rem 1.25rem', borderRadius: '0.5rem',
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
            color: 'var(--text)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500,
          }}
        >
          Take the tour again
        </button>
      </div>
    </AppLayout>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.875rem', marginBottom: '0.375rem', color: 'var(--text-secondary)' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.625rem 0.875rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '0.5rem', color: 'var(--text)', fontSize: '0.9375rem' }