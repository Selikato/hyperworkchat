'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { Profile } from '@/lib/database/types'

// Lazy import supabase to avoid initialization errors
let supabase: typeof import('@/lib/supabase').supabase | null = null
let auth: typeof import('@/lib/supabase').auth | null = null

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const supabaseModule = require('@/lib/supabase')
  supabase = supabaseModule.supabase
  auth = supabaseModule.auth
} catch (error) {
  console.error('Failed to initialize Supabase:', error)
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, userData: Partial<Profile>) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<{ error?: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        }
      }
      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    let subscription: { unsubscribe: () => void } | null = null
    if (supabase) {
      const result = supabase.auth.onAuthStateChange(
        async (event: string, session: Session | null) => {
          setUser(session?.user ?? null)
          if (session?.user) {
            await fetchProfile(session.user.id)
          } else {
            setProfile(null)
          }
          setLoading(false)
        }
      )
      subscription = result.data.subscription
    }

    return () => subscription?.unsubscribe()
  }, [])

  const fetchProfile = async (userId: string) => {
    if (!supabase) return

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching profile:', error)
      } else if (data) {
        setProfile(data)
      }
    } catch {
      console.error('Error fetching profile')
    }
  }

  const signIn = async (email: string, password: string) => {
    if (!auth) return { error: 'Authentication not available' }

    try {
      const result = await auth.signIn(email, password)
      return { error: result.error?.message }
    } catch {
      return { error: 'Giriş yapılırken bir hata oluştu' }
    }
  }

  const signUp = async (email: string, password: string, userData: Partial<Profile>) => {
    if (!auth) return { error: 'Authentication not available' }

    try {
      const result = await auth.signUp(email, password)
      if (result.error) {
        return { error: result.error.message }
      }

      if (result.data.user && supabase) {
        // Update profile with additional data
        const profileResult = await supabase
          .from('profiles')
          .update(userData)
          .eq('id', result.data.user.id)

        if (profileResult.error) {
          return { error: 'Profil güncellenirken hata oluştu' }
        }
      }

      return {}
    } catch {
      return { error: 'Kayıt olurken bir hata oluştu' }
    }
  }

  const signOut = async () => {
    if (auth) {
      await auth.signOut()
    }
  }

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: 'Kullanıcı bulunamadı' }
    if (!supabase) return { error: 'Database not available' }

    try {
      const result = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)

      if (result.error) {
        return { error: result.error.message }
      }

      // Update local state
      setProfile(prev => prev ? { ...prev, ...updates } : null)
      return {}
    } catch {
      return { error: 'Profil güncellenirken hata oluştu' }
    }
  }

  const value = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
