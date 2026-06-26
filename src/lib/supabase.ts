import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file.')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Untyped client for mutations where generated types are too strict
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: any = supabase