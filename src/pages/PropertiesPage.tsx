import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Plus, ChevronRight, Loader } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { AppLayout } from '../components/AppLayout'
import type { Database } from '../types/database'

type Property = Database['public']['Tables']['properties']['Row']

export function PropertiesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create property form state
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const isOwner = user?.role === 'owner' || user?.role === 'super_admin'

  useEffect(() => {
    fetchProperties()
  }, [])

  async function fetchProperties() {
    setLoading(true)
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      setError(error.message)
    } else {
      setProperties(data || [])
    }
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !newName.trim()) return

    setCreating(true)
    setFormError(null)

    const { error } = await supabase.from('properties').insert({
      account_id: user.account_id,
      name: newName.trim(),
      currency: 'KES',
    })

    if (error) {
      setFormError(error.message)
      setCreating(false)
    } else {
      setNewName('')
      setShowForm(false)
      await fetchProperties()
      setCreating(false)
    }
  }

  return (
    <AppLayout>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '0.375rem' }}>
            Properties
          </p>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 300 }}>Your properties</h2>
        </div>

        {isOwner && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="glow-border"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1.25rem',
              borderRadius: '0.5rem',
              background: 'var(--primary)',
              color: 'var(--bg)',
              fontWeight: 500,
              fontSize: '0.9375rem',
              cursor: 'pointer',
            }}
          >
            <Plus size={16} strokeWidth={1.5} />
            New property
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', maxWidth: '28rem' }}>
          <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '1rem' }}>
            New property
          </p>
          {formError && (
            <div style={{
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              background: 'color-mix(in oklab, #ef4444 15%, transparent)',
              border: '1px solid #ef4444',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              color: '#ef4444',
            }}>
              {formError}
            </div>
          )}
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.375rem', color: 'var(--text-secondary)' }}>
                Property name
              </label>
              <input
                type="text"
                required
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Lakeside Lodge"
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
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                style={{
                  flex: 1,
                  padding: '0.625rem',
                  borderRadius: '0.5rem',
                  background: 'var(--primary)',
                  color: 'var(--bg)',
                  fontWeight: 500,
                  cursor: creating ? 'not-allowed' : 'pointer',
                  opacity: creating ? 0.7 : 1,
                  fontSize: '0.9375rem',
                }}
              >
                {creating ? 'Creating…' : 'Create property'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError(null); setNewName('') }}
                style={{
                  padding: '0.625rem 1rem',
                  borderRadius: '0.5rem',
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.9375rem',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* States */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)', padding: '2rem 0' }}>
          <Loader size={16} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Loading properties…</span>
        </div>
      )}

      {error && (
        <div style={{
          padding: '1rem',
          background: 'color-mix(in oklab, #ef4444 15%, transparent)',
          border: '1px solid #ef4444',
          borderRadius: '0.5rem',
          color: '#ef4444',
          fontSize: '0.9375rem',
        }}>
          {error}
        </div>
      )}

      {!loading && !error && properties.length === 0 && (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <Building2 size={40} strokeWidth={1} style={{ color: 'var(--text-secondary)', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
            {isOwner ? 'No properties yet. Create your first one above.' : 'No properties have been set up yet.'}
          </p>
        </div>
      )}

      {/* Properties list */}
      {!loading && properties.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {properties.map((property) => (
            <button
              key={property.id}
              onClick={() => navigate(`/properties/${property.id}`)}
              className="glass-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1.5rem',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                transition: 'border-color 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {property.logo_url ? (
                  <img
                    src={property.logo_url}
                    alt={property.name}
                    style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{
                    width: '2.5rem', height: '2.5rem',
                    borderRadius: '0.5rem',
                    background: 'color-mix(in oklab, var(--primary) 15%, transparent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Building2 size={18} strokeWidth={1.5} style={{ color: 'var(--primary)' }} />
                  </div>
                )}
                <div>
                  <p style={{ fontWeight: 500, fontSize: '1rem', color: 'var(--text)' }}>{property.name}</p>
                  <p className="mono-accent" style={{ color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                    {property.currency}
                  </p>
                </div>
              </div>
              <ChevronRight size={18} strokeWidth={1.5} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </AppLayout>
  )
}