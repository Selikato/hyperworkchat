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
  signUp: (email: string, password: string) => Promise<{ error?: string; success?: boolean; user?: { id: string; email: string; firstName: string; lastName: string; role: string; classSection: string } }>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<{ error?: string }>
  updateUserInfo: (userId: string, info: { firstName?: string; lastName?: string; role?: string; classSection?: string; workDays?: string[]; dailyWorkMinutes?: number }) => Promise<{ error?: string }>
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
    // Mock sistemde localStorage'dan giriş bilgilerini yükle
    const loadMockSession = () => {
      try {
        const mockUser = localStorage.getItem('mockCurrentUser')
        if (mockUser) {
          const user = JSON.parse(mockUser)
          setUser(user)

        // Mock profile oluştur
        const mockProfile = {
          id: user.id,
          first_name: user.user_metadata.first_name,
          last_name: user.user_metadata.last_name,
          role: user.user_metadata.role,
          class_section: user.user_metadata.class_section,
          work_days: [],
          daily_work_minutes: 0,
          total_points: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
          setProfile(mockProfile)
        }
      } catch (error) {
        console.error('Error loading mock session:', error)
      }
      setLoading(false)
    }

    loadMockSession()

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
    // Mock authentication - localStorage'dan kontrol et
    try {
      console.log('🔐 Attempting sign in for:', email)

      const users = JSON.parse(localStorage.getItem('mockUsers') || '[]')
      const user = users.find((u: { email: string; password: string; id: string; firstName: string; lastName: string; role: string; classSection: string }) => u.email === email && u.password === password)

      if (!user) {
        return { error: 'Geçersiz giriş bilgileri' }
      }

      console.log('✅ Mock sign in successful for user:', user.email)

      // Mock user oluştur
      const mockUser = {
        id: user.id,
        email: user.email,
        user_metadata: {
          first_name: user.firstName,
          last_name: user.lastName,
          role: user.role,
          class_section: user.classSection
        }
      }

      // localStorage'a kaydet
      localStorage.setItem('mockCurrentUser', JSON.stringify(mockUser))

      setUser(mockUser as User)

      // Mock profile oluştur
      const mockProfile = {
        id: user.id,
        first_name: user.firstName,
        last_name: user.lastName,
        role: user.role,
        class_section: user.classSection,
        work_days: user.workDays || [],
        daily_work_minutes: user.dailyWorkMinutes || 0
      }

      setProfile(mockProfile)

      return { error: undefined }
    } catch (error) {
      console.error('💥 Mock sign in exception:', error)
      return { error: 'Giriş yapılırken bir hata oluştu' }
    }
  }

  const signUp = async (email: string, password: string) => {
    // Mock registration - localStorage'a kaydet
    try {
      console.log('🔐 Attempting mock sign up for:', email)

      const users = JSON.parse(localStorage.getItem('mockUsers') || '[]')

      // Email zaten var mı kontrol et
      const existingUser = users.find((u: { email: string }) => u.email === email)
      if (existingUser) {
        return { error: 'Bu email adresi zaten kayıtlı' }
      }

      // Yeni kullanıcı oluştur
      const newUser: { id: string; email: string; firstName: string; lastName: string; role: string; classSection: string } = {
        id: 'mock-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        email: email.trim(),
        firstName: '',
        lastName: '',
        role: 'student',
        classSection: ''
      }

      users.push(newUser)
      localStorage.setItem('mockUsers', JSON.stringify(users))

      console.log('✅ Mock registration successful for user:', newUser.email)
      return { success: true, user: newUser }

    } catch (error) {
      console.error('💥 Mock sign up exception:', error)
      return { error: 'Kayıt olurken bir hata oluştu' }
    }
  }

  const signOut = async () => {
    // Mock sign out - state'leri ve localStorage'ı temizle
    setUser(null)
    setProfile(null)
    localStorage.removeItem('mockCurrentUser')
    console.log('✅ Mock sign out successful')
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

  const updateUserInfo = async (userId: string, info: { firstName?: string; lastName?: string; role?: string; classSection?: string; workDays?: string[]; dailyWorkMinutes?: number }) => {
    // Mock user info update - localStorage'da güncelle
    try {
      const users = JSON.parse(localStorage.getItem('mockUsers') || '[]')
      const userIndex = users.findIndex((u: { id: string }) => u.id === userId)

      if (userIndex === -1) {
        return { error: 'Kullanıcı bulunamadı' }
      }

      // Kullanıcı bilgilerini güncelle
      users[userIndex] = { ...users[userIndex], ...info }
      localStorage.setItem('mockUsers', JSON.stringify(users))

      // Eğer şu an giriş yapmış kullanıcıysa state'i güncelle
      if (user && user.id === userId) {
        const mockUser = {
          id: users[userIndex].id,
          email: users[userIndex].email,
          user_metadata: {
            first_name: users[userIndex].firstName,
            last_name: users[userIndex].lastName,
            role: users[userIndex].role,
            class_section: users[userIndex].classSection
          }
        }

        setUser(mockUser as User)

        const mockProfile = {
          id: users[userIndex].id,
          first_name: users[userIndex].firstName,
          last_name: users[userIndex].lastName,
          role: users[userIndex].role,
          class_section: users[userIndex].classSection,
          work_days: users[userIndex].workDays || [],
          daily_work_minutes: users[userIndex].dailyWorkMinutes || 0,
          total_points: 0,
          created_at: users[userIndex].createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        setProfile(mockProfile)
      }

      return {}
    } catch (error) {
      console.error('💥 Update user info exception:', error)
      return { error: 'Kullanıcı bilgileri güncellenirken hata oluştu' }
    }
  }

  const value = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    updateUserInfo
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
