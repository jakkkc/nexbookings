import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  BedDouble, Plus, Pencil, Trash2, ArrowLeft, Loader,
  Upload, LayoutGrid, DoorOpen,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { AppLayout } from '../components/AppLayout'
import type { Database, RoomPrices } from '../types/database'

type Property = Database['public']['Tables']['properties']['Row']
type RoomType = Database['public']['Tables']['room_types']['Row']
type Room = Database['public']['Tables']['rooms']['Row']

type Tab = 'room_types' | 'rooms'

const emptyPrices: RoomPrices = {
  single: { bb: 0, hb: 0, fb: 0 },
  double: { bb: 0, hb: 0, fb: 0 },
  extra_pax: { bb: 0, hb: 0, fb: 0 },
}

const emptyRoomTypeForm = {
  name: '',
  max_pax: 2,
  prices: emptyPrices,
  cover_photo_url: null as string | null,
}

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [property, setProperty] = useState<Property | null>(null)
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('room_types')

  // Room type form
  const [showRTForm, setShowRTForm] = useState(false)
  const [editingRT, setEditingRT] = useState<RoomType | null>(null)
  const [rtForm, setRtForm] = useState(emptyRoomTypeForm)
  const [rtSaving, setRtSaving] = useState(false)
  const [rtError, setRtError] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Room form
  const [showRoomForm, setShowRoomForm] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [roomForm, setRoomForm] = useState({ name: '', room_type_id: '' })
  const [roomSaving, setRoomSaving] = useState(false)
  const [roomError, setRoomError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const canManage = user?.role === 'owner' || user?.role === 'manager' || user?.role === 'super_admin'
  const isOwner = user?.role === 'owner' || user?.role === 'super_admin'

  useEffect(() => { if (id) fetchData() }, [id])

  async function fetchData() {
    setLoading(true)
    const [propRes, rtRes, roomsRes] = await Promise.all([
      supabase.from('properties').select('*').eq('id', id!).single(),
      supabase.from('room_types').select('*').eq('property_id', id!).order('created_at'),
      supabase.from('rooms').select('*').eq('property_id', id!).order('created_at'),
    ])
    if (propRes.error) setError(propRes.error.message)
    else setProperty(propRes.data)
    if (!rtRes.error) setRoomTypes(rtRes.data || [])
    if (!roomsRes.error) setRooms(roomsRes.data || [])
    setLoading(false)
  }

  // ── Room type handlers ────────────────────────────────────

  function openNewRTForm() {
    setEditingRT(null)
    setRtForm(emptyRoomTypeForm)
    setPhotoFile(null)
    setPhotoPreview(null)
    setRtError(null)
    setShowRTForm(true)
  }

  function openEditRTForm(rt: RoomType) {
    setEditingRT(rt)
    setRtForm({
      name: rt.name,
      max_pax: rt.max_pax,
      prices: rt.prices,
      cover_photo_url: rt.cover_photo_url,
    })
    setPhotoFile(null)
    setPhotoPreview(null)
    setRtError(null)
    setShowRTForm(true)
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function uploadPhoto(roomTypeId: string): Promise<string | null> {
    if (!photoFile) return null
    setUploadingPhoto(true)
    const ext = photoFile.name.split('.').pop()
    const path = `${id}/${roomTypeId}.${ext}`
    const { error } = await supabase.storage
      .from('property-logos')
      .upload(path, photoFile, { upsert: true })
    if (error) { setRtError(error.message); setUploadingPhoto(false); return null }
    const { data } = supabase.storage.from('property-logos').getPublicUrl(path)
    setUploadingPhoto(false)
    return data.publicUrl
  }

  async function handleRTSave(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    setRtSaving(true)
    setRtError(null)

    if (editingRT) {
      let photoUrl = rtForm.cover_photo_url
      if (photoFile) {
        photoUrl = await uploadPhoto(editingRT.id)
        if (!photoUrl && photoFile) { setRtSaving(false); return }
      }
      const { error } = await supabase.from('room_types').update({
        name: rtForm.name.trim(),
        max_pax: rtForm.max_pax,
        prices: rtForm.prices,
        cover_photo_url: photoUrl,
      }).eq('id', editingRT.id)
      if (error) { setRtError(error.message); setRtSaving(false); return }
    } else {
      const tempId = crypto.randomUUID()
      let photoUrl: string | null = null
      if (photoFile) {
        photoUrl = await uploadPhoto(tempId)
        if (!photoUrl) { setRtSaving(false); return }
      }
      const { error } = await supabase.from('room_types').insert({
        property_id: id,
        name: rtForm.name.trim(),
        max_pax: rtForm.max_pax,
        prices: rtForm.prices,
        cover_photo_url: photoUrl,
      })
      if (error) { setRtError(error.message); setRtSaving(false); return }
    }

    setShowRTForm(false)
    setEditingRT(null)
    await fetchData()
    setRtSaving(false)
  }

  async function handleDeleteRT(rtId: string) {
    const hasRooms = rooms.some(r => r.room_type_id === rtId)
    if (hasRooms) {
      alert('Remove all rooms under this type before deleting it.')
      return
    }
    if (!confirm('Delete this room type?')) return
    setDeletingId(rtId)
    await supabase.from('room_types').delete().eq('id', rtId)
    await fetchData()
    setDeletingId(null)
  }

  // ── Room handlers ─────────────────────────────────────────

  function openNewRoomForm(roomTypeId?: string) {
    setEditingRoom(null)
    setRoomForm({ name: '', room_type_id: roomTypeId || roomTypes[0]?.id || '' })
    setRoomError(null)
    setShowRoomForm(true)
  }

  function openEditRoomForm(room: Room) {
    setEditingRoom(room)
    setRoomForm({ name: room.name, room_type_id: room.room_type_id || '' })
    setRoomError(null)
    setShowRoomForm(true)
  }

  async function handleRoomSave(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    setRoomSaving(true)
    setRoomError(null)

    if (editingRoom) {
      const { error } = await supabase.from('rooms').update({
        name: roomForm.name.trim(),
        room_type_id: roomForm.room_type_id || null,
      }).eq('id', editingRoom.id)
      if (error) { setRoomError(error.message); setRoomSaving(false); return }
    } else {
      const { error } = await supabase.from('rooms').insert({
        property_id: id,
        name: roomForm.name.trim(),
        room_type_id: roomForm.room_type_id || null,
      })
      if (error) { setRoomError(error.message); setRoomSaving(false); return }
    }

    setShowRoomForm(false)
    setEditingRoom(null)
    await fetchData()
    setRoomSaving(false)
  }

  async function handleDeleteRoom(roomId: string) {
    if (!confirm('Delete this room?')) return
    setDeletingId(roomId)
    await supabase.from('rooms').delete().eq('id', roomId)
    await fetchData()
    setDeletingId(null)
  }

  // ── Price helper ──────────────────────────────────────────

  function updatePrice(
    occupancy: 'single' | 'double' | 'extra_pax',
    meal: 'bb' | 'hb' | 'fb',
    value: string
  ) {
    setRtForm(prev => ({
      ...prev,
      prices: {
        ...prev.prices,
        [occupancy]: {
          ...prev.prices[occupancy],
          [meal]: parseFloat(value) || 0,
        },
      },
    }))
  }

  // ── Render ────────────────────────────────────────────────

  if (loading) return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)', padding: '2rem 0' }}>
        <Loader size={16} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
        <span>Loading…</span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppLayout>
  )

  if (error || !property) return (
    <AppLayout>
      <div style={{ color: '#ef4444', padding: '1rem' }}>{error || 'Property not found.'}</div>
    </AppLayout>
  )

  const roomsByType = roomTypes.map(rt => ({
    type: rt,
    rooms: rooms.filter(r => r.room_type_id === rt.id),
  }))
  const unassignedRooms = rooms.filter(r => !r.room_type_id)

  return (
    <AppLayout>
      {/* Back */}
      <button onClick={() => navigate('/properties')} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-secondary)', background: 'none', cursor: 'pointer', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        <ArrowLeft size={14} strokeWidth={1.5} /> All properties
      </button>

      {/* Property header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {property.logo_url ? (
            <img src={property.logo_url} alt={property.name} style={{ width: '3rem', height: '3rem', borderRadius: '0.5rem', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '3rem', height: '3rem', borderRadius: '0.5rem', background: 'color-mix(in oklab, var(--primary) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BedDouble size={20} strokeWidth={1.5} style={{ color: 'var(--primary)' }} />
            </div>
          )}
          <div>
            <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '0.25rem' }}>Property</p>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 300 }}>{property.name}</h2>
          </div>
        </div>
        {isOwner && (
          <button onClick={() => navigate(`/properties/${id}/edit`)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1rem', borderRadius: '0.5rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.875rem' }}>
            <Pencil size={14} strokeWidth={1.5} /> Edit property
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0' }}>
        {([
          { key: 'room_types', label: 'Room types', icon: <LayoutGrid size={15} strokeWidth={1.5} /> },
          { key: 'rooms', label: 'Rooms', icon: <DoorOpen size={15} strokeWidth={1.5} /> },
        ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.625rem 1.25rem',
              borderRadius: '0.5rem 0.5rem 0 0',
              background: tab === t.key ? 'color-mix(in oklab, var(--primary) 12%, transparent)' : 'transparent',
              color: tab === t.key ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
              cursor: 'pointer', fontSize: '0.9375rem', fontWeight: tab === t.key ? 500 : 400,
            }}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Room types tab ──────────────────────────────────── */}
      {tab === 'room_types' && (
        <div>
          {canManage && (
            <div style={{ marginBottom: '1.5rem' }}>
              <button onClick={openNewRTForm} className="glow-border" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', borderRadius: '0.5rem', background: 'var(--primary)', color: 'var(--bg)', fontWeight: 500, cursor: 'pointer', fontSize: '0.9375rem' }}>
                <Plus size={16} strokeWidth={1.5} /> Add room type
              </button>
            </div>
          )}

          {/* Room type form */}
          {showRTForm && (
            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', maxWidth: '38rem' }}>
              <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '1.25rem' }}>
                {editingRT ? 'Edit room type' : 'New room type'}
              </p>
              {rtError && (
                <div style={{ padding: '0.75rem 1rem', marginBottom: '1rem', background: 'color-mix(in oklab, #ef4444 15%, transparent)', border: '1px solid #ef4444', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#ef4444' }}>
                  {rtError}
                </div>
              )}
              <form onSubmit={handleRTSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                {/* Cover photo */}
                <div>
                  <label style={labelStyle}>Cover photo <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span></label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {(photoPreview || rtForm.cover_photo_url) ? (
                      <img src={photoPreview || rtForm.cover_photo_url!} alt="Preview" style={{ width: '5rem', height: '4rem', objectFit: 'cover', borderRadius: '0.375rem', border: '1px solid var(--glass-border)' }} />
                    ) : (
                      <div style={{ width: '5rem', height: '4rem', borderRadius: '0.375rem', background: 'var(--glass-bg)', border: '1px dashed var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Upload size={18} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
                      </div>
                    )}
                    <button type="button" onClick={() => photoInputRef.current?.click()} style={{ padding: '0.5rem 0.875rem', borderRadius: '0.375rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text)', cursor: 'pointer', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Upload size={13} strokeWidth={1.5} />
                      {rtForm.cover_photo_url || photoPreview ? 'Change photo' : 'Upload photo'}
                    </button>
                  </div>
                  <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                </div>

                {/* Name + max pax */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'end' }}>
                  <div>
                    <label style={labelStyle}>Room type name</label>
                    <input type="text" required autoFocus value={rtForm.name} onChange={e => setRtForm({ ...rtForm, name: e.target.value })} placeholder="Deluxe Suite" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Max pax</label>
                    <input type="number" required min={1} max={30} value={rtForm.max_pax} onChange={e => setRtForm({ ...rtForm, max_pax: parseInt(e.target.value) || 1 })} style={{ ...inputStyle, width: '6rem' }} />
                  </div>
                </div>

                {/* Pricing matrix */}
                <div>
                  <label style={{ ...labelStyle, marginBottom: '0.75rem' }}>Pricing (KES per night)</label>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>Occupancy</th>
                          <th style={thStyle}>Bed & Breakfast</th>
                          <th style={thStyle}>Half Board</th>
                          <th style={thStyle}>Full Board</th>
                        </tr>
                      </thead>
                      <tbody>
                        {([
                          { key: 'single', label: 'Single' },
                          { key: 'double', label: 'Double' },
                          { key: 'extra_pax', label: 'Extra pax' },
                        ] as { key: 'single' | 'double' | 'extra_pax'; label: string }[]).map(row => (
                          <tr key={row.key}>
                            <td style={tdLabelStyle}>{row.label}</td>
                            {(['bb', 'hb', 'fb'] as const).map(meal => (
                              <td key={meal} style={tdStyle}>
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={rtForm.prices[row.key][meal]}
                                  onChange={e => updatePrice(row.key, meal, e.target.value)}
                                  style={{ ...inputStyle, textAlign: 'right' }}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    Extra pax rate applies per additional guest beyond 2 (for family rooms).
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="submit" disabled={rtSaving || uploadingPhoto || !rtForm.name.trim()} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.5rem', background: 'var(--primary)', color: 'var(--bg)', fontWeight: 500, cursor: rtSaving ? 'not-allowed' : 'pointer', opacity: rtSaving ? 0.7 : 1, fontSize: '0.9375rem' }}>
                    {rtSaving || uploadingPhoto ? 'Saving…' : editingRT ? 'Save changes' : 'Add room type'}
                  </button>
                  <button type="button" onClick={() => { setShowRTForm(false); setRtError(null) }} style={{ padding: '0.625rem 1rem', borderRadius: '0.5rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9375rem' }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Room types list */}
          {roomTypes.length === 0 && !showRTForm && (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
              <LayoutGrid size={40} strokeWidth={1} style={{ color: 'var(--text-secondary)', margin: '0 auto 1rem' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
                {canManage ? 'No room types yet. Add your first one above.' : 'No room types set up yet.'}
              </p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {roomTypes.map(rt => {
              const rtRooms = rooms.filter(r => r.room_type_id === rt.id)
              return (
                <div key={rt.id} className="glass-card" style={{ overflow: 'hidden' }}>
                  <div style={{ display: 'flex', gap: '1rem', padding: '1.25rem', flexWrap: 'wrap' }}>
                    {/* Cover photo */}
                    {rt.cover_photo_url ? (
                      <img src={rt.cover_photo_url} alt={rt.name} style={{ width: '7rem', height: '5rem', objectFit: 'cover', borderRadius: '0.375rem', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '7rem', height: '5rem', borderRadius: '0.375rem', background: 'color-mix(in oklab, var(--primary) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <BedDouble size={24} strokeWidth={1} style={{ color: 'var(--primary)' }} />
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <div>
                          <p style={{ fontWeight: 500, fontSize: '1rem' }}>{rt.name}</p>
                          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                            Max {rt.max_pax} guests · {rtRooms.length} {rtRooms.length === 1 ? 'room' : 'rooms'}
                          </p>
                        </div>
                        {canManage && (
                          <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                            <button onClick={() => openEditRTForm(rt)} style={{ padding: '0.375rem', borderRadius: '0.375rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                              <Pencil size={13} strokeWidth={1.5} />
                            </button>
                            {isOwner && (
                              <button onClick={() => handleDeleteRT(rt.id)} disabled={deletingId === rt.id} style={{ padding: '0.375rem', borderRadius: '0.375rem', background: 'color-mix(in oklab, #ef4444 12%, transparent)', border: '1px solid #ef4444', color: '#ef4444', cursor: 'pointer', opacity: deletingId === rt.id ? 0.5 : 1 }}>
                                <Trash2 size={13} strokeWidth={1.5} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Price summary */}
                      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                        <span>Single BB: <strong style={{ color: 'var(--text)' }}>KES {rt.prices.single.bb.toLocaleString()}</strong></span>
                        <span>Double BB: <strong style={{ color: 'var(--text)' }}>KES {rt.prices.double.bb.toLocaleString()}</strong></span>
                        {rt.max_pax > 2 && <span>Extra pax BB: <strong style={{ color: 'var(--text)' }}>KES {rt.prices.extra_pax.bb.toLocaleString()}</strong></span>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Rooms tab ───────────────────────────────────────── */}
      {tab === 'rooms' && (
        <div>
          {canManage && (
            <div style={{ marginBottom: '1.5rem' }}>
              {roomTypes.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
                  Add at least one room type before adding rooms.
                </p>
              ) : (
                <button onClick={() => openNewRoomForm()} className="glow-border" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', borderRadius: '0.5rem', background: 'var(--primary)', color: 'var(--bg)', fontWeight: 500, cursor: 'pointer', fontSize: '0.9375rem' }}>
                  <Plus size={16} strokeWidth={1.5} /> Add room
                </button>
              )}
            </div>
          )}

          {/* Room form */}
          {showRoomForm && (
            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', maxWidth: '28rem' }}>
              <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '1rem' }}>
                {editingRoom ? 'Edit room' : 'New room'}
              </p>
              {roomError && (
                <div style={{ padding: '0.75rem 1rem', marginBottom: '1rem', background: 'color-mix(in oklab, #ef4444 15%, transparent)', border: '1px solid #ef4444', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#ef4444' }}>
                  {roomError}
                </div>
              )}
              <form onSubmit={handleRoomSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Room number / name</label>
                  <input type="text" required autoFocus value={roomForm.name} onChange={e => setRoomForm({ ...roomForm, name: e.target.value })} placeholder="101" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Room type</label>
                  <select value={roomForm.room_type_id} onChange={e => setRoomForm({ ...roomForm, room_type_id: e.target.value })} style={inputStyle}>
                    <option value="">— Unassigned —</option>
                    {roomTypes.map(rt => (
                      <option key={rt.id} value={rt.id}>{rt.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="submit" disabled={roomSaving || !roomForm.name.trim()} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.5rem', background: 'var(--primary)', color: 'var(--bg)', fontWeight: 500, cursor: roomSaving ? 'not-allowed' : 'pointer', opacity: roomSaving ? 0.7 : 1, fontSize: '0.9375rem' }}>
                    {roomSaving ? 'Saving…' : editingRoom ? 'Save changes' : 'Add room'}
                  </button>
                  <button type="button" onClick={() => { setShowRoomForm(false); setRoomError(null) }} style={{ padding: '0.625rem 1rem', borderRadius: '0.5rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9375rem' }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Rooms grouped by type */}
          {rooms.length === 0 && !showRoomForm && (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
              <DoorOpen size={40} strokeWidth={1} style={{ color: 'var(--text-secondary)', margin: '0 auto 1rem' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
                {canManage ? 'No rooms yet. Add your first room above.' : 'No rooms added yet.'}
              </p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {roomsByType.filter(g => g.rooms.length > 0).map(group => (
              <div key={group.type.id}>
                <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '0.75rem' }}>
                  {group.type.name}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(10rem, 1fr))', gap: '0.75rem' }}>
                  {group.rooms.map(room => (
                    <div key={room.id} className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 500 }}>{room.name}</span>
                      {canManage && (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button onClick={() => openEditRoomForm(room)} style={{ padding: '0.25rem', borderRadius: '0.25rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                            <Pencil size={13} strokeWidth={1.5} />
                          </button>
                          {isOwner && (
                            <button onClick={() => handleDeleteRoom(room.id)} disabled={deletingId === room.id} style={{ padding: '0.25rem', borderRadius: '0.25rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: deletingId === room.id ? 0.5 : 1 }}>
                              <Trash2 size={13} strokeWidth={1.5} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {unassignedRooms.length > 0 && (
              <div>
                <p className="mono-accent" style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Unassigned</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(10rem, 1fr))', gap: '0.75rem' }}>
                  {unassignedRooms.map(room => (
                    <div key={room.id} className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 500 }}>{room.name}</span>
                      {canManage && (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button onClick={() => openEditRoomForm(room)} style={{ padding: '0.25rem', borderRadius: '0.25rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                            <Pencil size={13} strokeWidth={1.5} />
                          </button>
                          {isOwner && (
                            <button onClick={() => handleDeleteRoom(room.id)} disabled={deletingId === room.id} style={{ padding: '0.25rem', borderRadius: '0.25rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: deletingId === room.id ? 0.5 : 1 }}>
                              <Trash2 size={13} strokeWidth={1.5} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppLayout>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', marginBottom: '0.375rem', color: 'var(--text-secondary)',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.625rem 0.875rem',
  background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
  borderRadius: '0.5rem', color: 'var(--text)', fontSize: '0.9375rem',
}
const thStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 500,
  color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)',
  fontSize: '0.8125rem', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = {
  padding: '0.375rem 0.5rem',
}
const tdLabelStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem', fontWeight: 500, color: 'var(--text)',
  whiteSpace: 'nowrap', fontSize: '0.875rem',
}