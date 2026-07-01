import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { UserRole } from '../types/database'

interface AppUser {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  account_id: string
}

interface AuthContextValue {
  session: Session | null
  user: AppUser | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const CACHE_KEY = 'nexbookings-user-profile'

function getCachedUser(userId: string): AppUser | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw)
    if (cached.id === userId) return cached
  } catch { /* ignore */ }
  return null
}

function setCachedUser(user: AppUser) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(user)) } catch { /* ignore */ }
}

function clearCachedUser() {
  try { sessionStorage.removeItem(CACHE_KEY) } catch { /* ignore */ }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadUser(authUser: User) {
    // Check cache first — avoids a DB round trip on repeat loads
    const cached = getCachedUser(authUser.id)
    if (cached) {
      setUser(cached)
      return
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, account_id')
      .eq('id', authUser.id)
      .single()

    if (error || !data) {
      console.error('Failed to load user profile:', error)
      setUser(null)
    } else {
      setUser(data)
      setCachedUser(data)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
      setSession(session)
      if (session?.user) {
        // Set loading false immediately — don't block on profile fetch
        const cached = getCachedUser(session.user.id)
        if (cached) {
          setUser(cached)
          setLoading(false)
        } else {
          // Show app as soon as session is confirmed, load profile in background
          setLoading(false)
          loadUser(session.user)
        }
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: any, session: any) => {
        setSession(session)
        if (session?.user) {
          const cached = getCachedUser(session.user.id)
          if (cached) {
            setUser(cached)
            setLoading(false)
          } else {
            setLoading(false)
            loadUser(session.user)
          }
        } else {
          setUser(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    clearCachedUser()
    setUser(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}