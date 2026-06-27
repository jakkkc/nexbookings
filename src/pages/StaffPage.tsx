import { useEffect, useState } from 'react'
import { Users, Plus, Trash2, Loader, Mail, Building2, X, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { AppLayout } from '../components/AppLayout'
import type { Database } from '../types/database'

type StaffUser = Database['public']['Tables']['users']['Row']
type Property = Database['public']['Tables']['properties']['Row']
type Assignment = Database['public']['Tables']['staff_assignments']['Row']

interface StaffWithAssignments extends StaffUser {
  assignments: string[] // property_ids
  property_names: string[]
}

const ROLE_COLORS: Record<string, string> = {
  owner: '#3b82f6',
  manager: '#8b5cf6',
  receptionist: '#10b981',
}

export function StaffPage() {
  const { user } = useAuth()
  const [staff, setStaff] = useState<StaffWithAssignments[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Invite form
  const [showForm, setShowForm] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    email: '',
    full_name: '',
    role: 'receptionist' as 'manager' | 'receptionist',
    property_ids: [] as string[],
  })
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  // Assignment editing
  const [editingAssignments, setEditingAssignments] = useState<string | null>(null) // user_id
  const [assignmentDraft, setAssignmentDraft] = useState<string[]>([])
  const [savingAssignments, setSavingAssignments] = useState(false)

  // Removing staff
  const [removingId, setRemovingId] = useState<string | null>(null)

  const isOwner = user?.role === 'owner' || user?.role === 'super_admin'

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [usersRes, propsRes, assignRes] = await Promise.all([
      supabase.from('users').select('*').order('created_at'),
      supabase.from('properties').select('*').order('name'),
      supabase.from('staff_assignments').select('*'),
    ])

    if (usersRes.error) { setError(usersRes.error.message); setLoading(false); return }

    const propMap = Object.fromEntries((propsRes.data || []).map((p: any) => [p.id, p.name]))
    const assignments: Assignment[] = assignRes.data || []

    const staffWithAssignments: StaffWithAssignments[] = (usersRes.data || [])
      .filter((u: any) => u.role !== 'super_admin')
      .map((u: any) => {
        const userAssignments = assignments.filter(a => a.user_id === u.id)
        return {
          ...u,
          assignments: userAssignments.map(a => a.property_id),
          property_names: userAssignments.map(a => propMap[a.property_id] || '—'),
        }
      })

    setStaff(staffWithAssignments)
    setProperties(propsRes.data || [])
    setLoading(false)
  }

  function toggleInviteProperty(propId: string) {
    setInviteForm(f => ({
      ...f,
      property_ids: f.property_ids.includes(propId)
        ? f.property_ids.filter(id => id !== propId)
        : [...f.property_ids, propId],
    }))
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setInviting(true)
    setInviteError(null)
    setInviteSuccess(null)

    const { data: { session } } = await supabase.auth.getSession()

    const { error } = await supabase.functions.invoke('invite-staff', {
      body: {
        email: inviteForm.email,
        full_name: inviteForm.full_name,
        role: inviteForm.role,
        property_ids: inviteForm.property_ids,
        account_id: user.account_id,
      },
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    })

    setInviting(false)

    if (error) {
      setInviteError(error.message || 'Failed to send invite')
    } else {
      setInviteSuccess(`Invite sent to ${inviteForm.email}`)
      setInviteForm({ email: '', full_name: '', role: 'receptionist', property_ids: [] })
      setShowForm(false)
      await fetchData()
    }
  }

  function openAssignmentEdit(staffMember: StaffWithAssignments) {
    setEditingAssignments(staffMember.id)
    setAssignmentDraft([...staffMember.assignments])
  }

  function toggleDraftProperty(propId: string) {
    setAssignmentDraft(prev =>
      prev.includes(propId) ? prev.filter(id => id !== propId) : [...prev, propId]
    )
  }

  async function saveAssignments(userId: string) {
    setSavingAssignments(true)

    // Delete all existing assignments for this user
    await supabase.from('staff_assignments').delete().eq('user_id', userId)

    // Insert new ones
    if (assignmentDraft.length > 0) {
      await supabase.from('staff_assignments').insert(
        assignmentDraft.map(property_id => ({ user_id: userId, property_id }))
      )
    }

    setEditingAssignments(null)
    setSavingAssignments(false)
    await fetchData()
  }

  async function handleRemoveStaff(userId: string, name: string) {
    if (!confirm(`Remove ${name || 'this staff member'}? They will lose access immediately.`)) return
    setRemovingId(userId)

    // Remove assignments first, then the user row
    await supabase.from('staff_assignments').delete().eq('user_id', userId)
    await supabase.from('users').delete().eq('id', userId)

    setRemovingId(null)
    await fetchData()
  }

  return (
    <AppLayout>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '0.375rem' }}>Staff</p>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 300 }}>Team members</h2>
        </div>
        {isOwner && (
          <button
            onClick={() => { setShowForm(!showForm); setInviteError(null); setInviteSuccess(null) }}
            className="glow-border"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', borderRadius: '0.5rem', background: 'var(--primary)', color: 'var(--bg)', fontWeight: 500, fontSize: '0.9375rem', cursor: 'pointer' }}
          >
            <Plus size={16} strokeWidth={1.5} /> Invite staff
          </button>
        )}
      </div>

      {/* Success banner */}
      {inviteSuccess && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.875rem 1rem', marginBottom: '1.25rem', background: 'color-mix(in oklab, #10b981 15%, transparent)', border: '1px solid #10b981', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#10b981' }}>
          <Check size={15} strokeWidth={1.5} />{inviteSuccess}
        </div>
      )}

      {/* Invite form */}
      {showForm && (
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', maxWidth: '36rem' }}>
          <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '1.25rem' }}>Invite new staff member</p>

          {inviteError && (
            <div style={{ padding: '0.75rem 1rem', marginBottom: '1rem', background: 'color-mix(in oklab, #ef4444 15%, transparent)', border: '1px solid #ef4444', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#ef4444' }}>
              {inviteError}
            </div>
          )}

          <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Full name</label>
                <input type="text" value={inviteForm.full_name} onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Jane Kamau" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Role</label>
                <select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value as 'manager' | 'receptionist' }))} style={inputStyle}>
                  <option value="manager">Manager</option>
                  <option value="receptionist">Receptionist</option>
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Email address</label>
              <input type="email" required value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@lodge.co.ke" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Assign to properties</label>
              {properties.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>No properties yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {properties.map(p => (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem', background: 'var(--glass-bg)', border: `1px solid ${inviteForm.property_ids.includes(p.id) ? 'var(--primary)' : 'var(--glass-border)'}`, borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9375rem' }}>
                      <input
                        type="checkbox"
                        checked={inviteForm.property_ids.includes(p.id)}
                        onChange={() => toggleInviteProperty(p.id)}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <Building2 size={15} strokeWidth={1.5} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      {p.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" disabled={inviting || !inviteForm.email} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.5rem', background: 'var(--primary)', color: 'var(--bg)', fontWeight: 500, cursor: inviting ? 'not-allowed' : 'pointer', opacity: inviting ? 0.7 : 1, fontSize: '0.9375rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Mail size={15} strokeWidth={1.5} />
                {inviting ? 'Sending invite…' : 'Send invite'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setInviteError(null) }} style={{ padding: '0.625rem 1rem', borderRadius: '0.5rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9375rem' }}>
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
          <span>Loading team…</span>
        </div>
      )}

      {error && (
        <div style={{ padding: '1rem', background: 'color-mix(in oklab, #ef4444 15%, transparent)', border: '1px solid #ef4444', borderRadius: '0.5rem', color: '#ef4444' }}>
          {error}
        </div>
      )}

      {/* Staff list */}
      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {staff.length === 0 && (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
              <Users size={40} strokeWidth={1} style={{ color: 'var(--text-secondary)', margin: '0 auto 1rem' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>No team members yet. Invite your first staff member above.</p>
            </div>
          )}

          {staff.map(member => (
            <div key={member.id} className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <p style={{ fontWeight: 500, fontSize: '0.9375rem', color: 'var(--text)' }}>
                      {member.full_name || member.email}
                      {member.id === user?.id && (
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(you)</span>
                      )}
                    </p>
                    <span style={{
                      padding: '0.125rem 0.625rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 500,
                      background: `color-mix(in oklab, ${ROLE_COLORS[member.role] || '#6b7280'} 15%, transparent)`,
                      color: ROLE_COLORS[member.role] || '#6b7280',
                    }}>
                      {member.role}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{member.email}</p>

                  {/* Property assignments */}
                  {editingAssignments === member.id ? (
                    <div style={{ marginTop: '1rem' }}>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Assigned properties:</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.75rem' }}>
                        {properties.map(p => (
                          <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={assignmentDraft.includes(p.id)}
                              onChange={() => toggleDraftProperty(p.id)}
                              style={{ accentColor: 'var(--primary)' }}
                            />
                            {p.name}
                          </label>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => saveAssignments(member.id)} disabled={savingAssignments} style={{ padding: '0.375rem 0.875rem', borderRadius: '0.375rem', background: 'var(--primary)', color: 'var(--bg)', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', opacity: savingAssignments ? 0.7 : 1 }}>
                          {savingAssignments ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={() => setEditingAssignments(null)} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.375rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '0.8125rem', cursor: 'pointer' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: '0.625rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {member.role === 'owner' ? (
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Access to all properties</span>
                      ) : member.property_names.length === 0 ? (
                        <span style={{ fontSize: '0.8125rem', color: '#f59e0b' }}>No properties assigned</span>
                      ) : (
                        member.property_names.map((name, i) => (
                          <span key={i} style={{ padding: '0.125rem 0.625rem', borderRadius: '999px', fontSize: '0.75rem', background: 'color-mix(in oklab, var(--primary) 10%, transparent)', border: '1px solid var(--glass-border)', color: 'var(--text)' }}>
                            {name}
                          </span>
                        ))
                      )}
                      {isOwner && member.role !== 'owner' && (
                        <button onClick={() => openAssignmentEdit(member)} style={{ fontSize: '0.75rem', color: 'var(--primary)', background: 'none', cursor: 'pointer', padding: '0.125rem 0.375rem' }}>
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {isOwner && member.id !== user?.id && member.role !== 'owner' && (
                  <button
                    onClick={() => handleRemoveStaff(member.id, member.full_name || member.email)}
                    disabled={removingId === member.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', borderRadius: '0.5rem', background: 'color-mix(in oklab, #ef4444 10%, transparent)', border: '1px solid #ef4444', color: '#ef4444', cursor: 'pointer', fontSize: '0.8125rem', flexShrink: 0, opacity: removingId === member.id ? 0.5 : 1 }}
                  >
                    <Trash2 size={13} strokeWidth={1.5} />
                    {removingId === member.id ? 'Removing…' : 'Remove'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppLayout>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.875rem', marginBottom: '0.375rem', color: 'var(--text-secondary)' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.625rem 0.875rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '0.5rem', color: 'var(--text)', fontSize: '0.9375rem' }