import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface Props {
  propertyIds: string[]
  onSuccess?: () => void
}

export function InviteStaffForm({ propertyIds, onSuccess }: Props) {
  const { user, session } = useAuth()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'manager' | 'receptionist'>('receptionist')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !session) return

    setLoading(true)
    setError(null)

    const { error: fnError } = await supabase.functions.invoke('invite-staff', {
      body: {
        email,
        full_name: fullName,
        role,
        property_ids: propertyIds,
        account_id: user.account_id,
      },
    })

    setLoading(false)

    if (fnError) {
      setError(fnError.message || 'Failed to send invite')
    } else {
      setSuccess(true)
      setEmail('')
      setFullName('')
      onSuccess?.()
    }
  }

  return (
    <div className="glass-card" style={{ padding: '1.5rem', maxWidth: '28rem' }}>
      <p className="mono-accent" style={{ marginBottom: '1rem', color: 'var(--primary)' }}>
        Invite staff
      </p>

      {success && (
        <div style={{
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          background: 'color-mix(in oklab, var(--primary) 15%, transparent)',
          border: '1px solid var(--primary)',
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
        }}>
          Invite sent to {email}
        </div>
      )}

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

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.375rem', color: 'var(--text-secondary)' }}>
            Full name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Kamau"
            style={{
              width: '100%',
              padding: '0.625rem 0.875rem',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: '0.5rem',
              color: 'var(--text)',
              fontSize: '0.9375rem',
            }}
          />
        </div>

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
            style={{
              width: '100%',
              padding: '0.625rem 0.875rem',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: '0.5rem',
              color: 'var(--text)',
              fontSize: '0.9375rem',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.375rem', color: 'var(--text-secondary)' }}>
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'manager' | 'receptionist')}
            style={{
              width: '100%',
              padding: '0.625rem 0.875rem',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: '0.5rem',
              color: 'var(--text)',
              fontSize: '0.9375rem',
            }}
          >
            <option value="manager">Manager</option>
            <option value="receptionist">Receptionist</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading || !email}
          className="glow-border"
          style={{
            padding: '0.75rem',
            borderRadius: '0.5rem',
            background: 'var(--primary)',
            color: 'var(--bg)',
            fontWeight: 600,
            fontSize: '0.9375rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Sending…' : 'Send invite'}
        </button>
      </form>
    </div>
  )
}
