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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadUser(authUser: User) {
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
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
      setSession(session)
      if (session?.user) {
        loadUser(session.user).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: any, session: any) => {
        setSession(session)
        if (session?.user) {
          await loadUser(session.user)
        } else {
          setUser(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
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