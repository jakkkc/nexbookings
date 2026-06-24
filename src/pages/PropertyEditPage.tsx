import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, Loader, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { AppLayout } from '../components/AppLayout'
import type { Database } from '../types/database'

type Property = Database['public']['Tables']['properties']['Row']

export function PropertyEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [property, setProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (id) fetchProperty()
  }, [id])

  async function fetchProperty() {
    setLoading(true)
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id!)
      .single()

    if (error || !data) {
      setError(error?.message || 'Property not found')
    } else {
      setProperty(data)
      setName(data.name)
    }
    setLoading(false)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  async function uploadLogo(): Promise<string | null> {
    if (!logoFile || !id) return null

    setUploadingLogo(true)
    const ext = logoFile.name.split('.').pop()
    const path = `${id}/logo.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('property-logos')
      .upload(path, logoFile, { upsert: true })

    if (uploadError) {
      setError(uploadError.message)
      setUploadingLogo(false)
      return null
    }

    const { data } = supabase.storage.from('property-logos').getPublicUrl(path)
    setUploadingLogo(false)
    return data.publicUrl
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !name.trim()) return

    setSaving(true)
    setError(null)
    setSuccess(false)

    let logoUrl = property?.logo_url ?? null

    if (logoFile) {
      const url = await uploadLogo()
      if (!url) { setSaving(false); return }
      logoUrl = url
    }

    const { error } = await supabase
      .from('properties')
      .update({ name: name.trim(), logo_url: logoUrl })
      .eq('id', id)

    setSaving(false)

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      setLogoFile(null)
      await fetchProperty()
    }
  }

  async function handleRemoveLogo() {
    if (!id || !property?.logo_url) return
    if (!confirm('Remove the logo?')) return

    setSaving(true)
    await supabase.from('properties').update({ logo_url: null }).eq('id', id)
    setLogoPreview(null)
    await fetchProperty()
    setSaving(false)
  }

  if (loading) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)', padding: '2rem 0' }}>
          <Loader size={16} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Loading…</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </AppLayout>
    )
  }

  if (!property) {
    return (
      <AppLayout>
        <div style={{ color: '#ef4444' }}>{error || 'Property not found.'}</div>
      </AppLayout>
    )
  }

  const currentLogo = logoPreview || property.logo_url

  return (
    <AppLayout>
      <button
        onClick={() => navigate(`/properties/${id}`)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.375rem',
          color: 'var(--text-secondary)', background: 'none', cursor: 'pointer',
          fontSize: '0.875rem', marginBottom: '1.5rem',
        }}
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        Back to {property.name}
      </button>

      <div style={{ marginBottom: '2rem' }}>
        <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '0.375rem' }}>Edit property</p>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 300 }}>{property.name}</h2>
      </div>

      {error && (
        <div style={{
          padding: '0.75rem 1rem', marginBottom: '1rem',
          background: 'color-mix(in oklab, #ef4444 15%, transparent)',
          border: '1px solid #ef4444', borderRadius: '0.5rem',
          fontSize: '0.875rem', color: '#ef4444',
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '0.75rem 1rem', marginBottom: '1rem',
          background: 'color-mix(in oklab, var(--primary) 15%, transparent)',
          border: '1px solid var(--primary)', borderRadius: '0.5rem',
          fontSize: '0.875rem',
        }}>
          Property updated successfully.
        </div>
      )}

      <div className="glass-card" style={{ padding: '1.5rem', maxWidth: '32rem' }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Logo upload */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
              Property logo
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {currentLogo ? (
                <img
                  src={currentLogo}
                  alt="Logo preview"
                  style={{ width: '4rem', height: '4rem', borderRadius: '0.5rem', objectFit: 'cover', border: '1px solid var(--glass-border)' }}
                />
              ) : (
                <div style={{
                  width: '4rem', height: '4rem', borderRadius: '0.5rem',
                  background: 'var(--glass-bg)', border: '1px dashed var(--glass-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Upload size={20} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: '0.5rem 0.875rem', borderRadius: '0.375rem',
                    background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                    color: 'var(--text)', cursor: 'pointer', fontSize: '0.875rem',
                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                  }}
                >
                  <Upload size={14} strokeWidth={1.5} />
                  {currentLogo ? 'Change logo' : 'Upload logo'}
                </button>
                {property.logo_url && !logoFile && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    style={{
                      padding: '0.5rem 0.875rem', borderRadius: '0.375rem',
                      background: 'color-mix(in oklab, #ef4444 10%, transparent)',
                      border: '1px solid #ef4444',
                      color: '#ef4444', cursor: 'pointer', fontSize: '0.875rem',
                      display: 'flex', alignItems: 'center', gap: '0.375rem',
                    }}
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                    Remove logo
                  </button>
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              PNG, JPG, or WebP. Recommended: square, at least 200×200px.
            </p>
          </div>

          {/* Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.375rem', color: 'var(--text-secondary)' }}>
              Property name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%', padding: '0.625rem 0.875rem',
                background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                borderRadius: '0.5rem', color: 'var(--text)', fontSize: '0.9375rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="submit"
              disabled={saving || uploadingLogo}
              className="glow-border"
              style={{
                flex: 1, padding: '0.75rem', borderRadius: '0.5rem',
                background: 'var(--primary)', color: 'var(--bg)',
                fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1, fontSize: '0.9375rem',
              }}
            >
              {saving || uploadingLogo ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/properties/${id}`)}
              style={{
                padding: '0.75rem 1.25rem', borderRadius: '0.5rem',
                background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9375rem',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppLayout>
  )
}