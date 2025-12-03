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
  signUp: (email: string, password: string) => Promise<{ error?: string; success?: boolean; user?: any }>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<{ error?: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Session refresh function
  const refreshSession = async () => {
    if (!supabase) return

    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (error) {
        console.warn('Session refresh failed:', error.message)
        // If refresh fails due to invalid refresh token, sign out
        if (error.message.includes('Invalid Refresh Token') || error.message.includes('Refresh Token Not Found')) {
          console.log('Invalid refresh token detected, signing out...')
          await supabase.auth.signOut()
        }
      } else if (data.session) {
        console.log('Session refreshed successfully')
      }
    } catch (error) {
      console.warn('Session refresh exception:', error)
    }
  }

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      if (supabase) {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Error getting session:', error)
        }
        setUser(session?.user ?? null)
        if (session?.user) {
          await ensureProfileExists(session.user.id)
          await fetchProfile(session.user.id)
        }
      }
      setLoading(false)
    }

    getInitialSession()

    // Set up periodic session refresh (every 30 minutes)
    const refreshInterval = setInterval(refreshSession, 30 * 60 * 1000)

    // Listen for auth changes
    let subscription: { unsubscribe: () => void } | null = null
    if (supabase) {
      const result = supabase.auth.onAuthStateChange(
        async (event: string, session: Session | null) => {
          console.log('Auth state change:', event, session?.user?.email)

          // Handle different auth events
          switch (event) {
            case 'SIGNED_IN':
            case 'TOKEN_REFRESHED':
              setUser(session?.user ?? null)
              if (session?.user) {
                await ensureProfileExists(session.user.id)
                await fetchProfile(session.user.id)
              }
              break
            case 'SIGNED_OUT':
              setUser(null)
              setProfile(null)
              break
            default:
              setUser(session?.user ?? null)
              if (session?.user) {
                await ensureProfileExists(session.user.id)
                await fetchProfile(session.user.id)
              } else {
                setProfile(null)
              }
          }
          setLoading(false)
        }
      )
      subscription = result.data.subscription
    }

    return () => {
      subscription?.unsubscribe()
      clearInterval(refreshInterval)
    }
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

  const ensureProfileExists = async (userId: string) => {
    if (!supabase) {
      console.error('Supabase not available')
      return
    }

    try {
      console.log('🔍 Checking profile for user:', userId)

      // Profil var mı kontrol et
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role')
        .eq('id', userId)
        .single()

      console.log('Profile check result:', { existingProfile, fetchError })

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('❌ Error checking profile:', fetchError)
        return
      }

      // Profil yoksa oluştur
      if (!existingProfile) {
        console.log('📝 Creating new profile for user:', userId)

        // Kullanıcının auth metadata'sından rolü al
        const { data: userData } = await supabase.auth.getUser()
        const userRole = userData.user?.user_metadata?.role || 'student'

        console.log('👤 User metadata role:', userRole)

        const { data: insertData, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            first_name: userData.user?.user_metadata?.first_name || '',
            last_name: userData.user?.user_metadata?.last_name || '',
            role: userRole,
            class_section: userData.user?.user_metadata?.class_section || null
          })
          .select()

        console.log('Profile creation result:', { insertData, insertError })

        if (insertError) {
          console.error('❌ Error creating profile:', insertError)

          // Daha detaylı error bilgisi
          if (insertError.code === '23503') {
            console.error('Foreign key constraint error - user might not exist in auth.users')
          } else if (insertError.code === '42501') {
            console.error('RLS policy violation - check row level security policies')
          }
        } else {
          console.log('✅ Profile created successfully for user:', userId)
        }
      } else {
        console.log('✅ Profile already exists for user:', userId)
      }
    } catch (error) {
      console.error('❌ Unexpected error in ensureProfileExists:', error)
    }
  }

  const signIn = async (email: string, password: string) => {
    if (!auth) return { error: 'Authentication not available' }

    try {
      console.log('🔐 Attempting sign in for:', email)
      console.log('📧 Email format valid:', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      console.log('🔑 Password length:', password.length)

      const result = await auth.signIn(email, password)
      console.log('🔍 Sign in raw result:', JSON.stringify(result, null, 2))

      if (result.error) {
        console.error('❌ Sign in error details:', {
          message: result.error.message,
          status: result.error.status,
          code: result.error.code
        })

        // Özel hata mesajları
        if (result.error.message.includes('Invalid login credentials') && supabase) {
          console.log('⚠️ Invalid credentials - checking if user exists...')
          // Kullanıcının var olup olmadığını kontrol et
          const { data: userExists } = await supabase
            .from('auth.users')
            .select('id')
            .eq('email', email)
            .single()
          console.log('👤 User exists in auth.users:', !!userExists)
        }

        return { error: result.error.message }
      }

      console.log('✅ Sign in successful for user:', result.data.user?.email)

      // Giriş başarılı oldu, profil kontrolü yap
      if (result.data.user && supabase) {
        console.log('🔍 Ensuring profile exists for:', result.data.user.id)
        await ensureProfileExists(result.data.user.id)
      }

      return { error: undefined }
    } catch (error) {
      console.error('💥 Sign in exception:', error)
      return { error: 'Giriş yapılırken bir hata oluştu' }
    }
  }

  const signUp = async (email: string, password: string) => {
    if (!auth) return { error: 'Authentication not available' }

    try {
      console.log('🔐 Attempting sign up for:', email, password)

      // Basit Supabase signUp çağrısı
      const { data, error } = await supabase!.auth.signUp({
        email: email.trim(),
        password: password
      })

      console.log('🔍 Sign up result:', { data, error })

      if (error) {
        console.error('❌ Supabase Auth Error:', error)
        return { error: `Kayıt hatası: ${error.message}` }
      }

      console.log('✅ Auth successful for user:', data.user?.email)
      return { success: true, user: data.user }

    } catch (error) {
      console.error('💥 Sign up exception:', error)
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

    // Mock sistemde localStorage'da güncelle
    try {
      const users = JSON.parse(localStorage.getItem('mockUsers') || '[]')
      const userIndex = users.findIndex((u: { id: string }) => u.id === user.id)

      if (userIndex !== -1) {
        // Convert Profile format (snake_case) to mock user format (camelCase)
        const mockUpdates: any = {}
        if (updates.first_name !== undefined) mockUpdates.firstName = updates.first_name
        if (updates.last_name !== undefined) mockUpdates.lastName = updates.last_name
        if (updates.class_section !== undefined) mockUpdates.classSection = updates.class_section
        if (updates.work_days !== undefined) mockUpdates.workDays = updates.work_days
        if (updates.daily_work_minutes !== undefined) mockUpdates.dailyWorkMinutes = updates.daily_work_minutes
        if (updates.total_points !== undefined) mockUpdates.totalPoints = updates.total_points

        // Kullanıcı bilgilerini güncelle
        users[userIndex] = { ...users[userIndex], ...mockUpdates }
        localStorage.setItem('mockUsers', JSON.stringify(users))

        // Mock user ve profile state'lerini güncelle
        const mockUser = {
          id: users[userIndex].id,
          email: users[userIndex].email,
          app_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
          user_metadata: {
            first_name: users[userIndex].firstName,
            last_name: users[userIndex].lastName,
            role: users[userIndex].role,
            class_section: users[userIndex].classSection
          }
        }

        setUser(mockUser as unknown as User)

        const mockProfile = {
          id: users[userIndex].id,
          first_name: users[userIndex].firstName,
          last_name: users[userIndex].lastName,
          role: users[userIndex].role,
          class_section: users[userIndex].classSection,
          work_days: users[userIndex].workDays || [],
          daily_work_minutes: users[userIndex].dailyWorkMinutes || 0,
          total_points: users[userIndex].totalPoints ?? profile?.total_points ?? 0,
          created_at: users[userIndex].createdAt || profile?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        setProfile(mockProfile)

        // mockCurrentUser'ı da güncelle
        localStorage.setItem('mockCurrentUser', JSON.stringify(mockUser))

        return {}
      }
    } catch (e) {
      console.warn('Error updating mock profile, falling back to Supabase:', e)
    }

    // Supabase'den güncelle (fallback)
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
    } catch (err) {
      console.warn('Error updating profile in Supabase:', err)
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
