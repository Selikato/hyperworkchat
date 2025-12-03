'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Modal from './Modal'
import Button from './Button'
import Input from './Input'
import { UserRole } from '@/lib/database/types'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'login' | 'register'
}

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'register' | 'verify'>(initialMode)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')
  const [verificationCode, setVerificationCode] = useState('')

  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    role: '' as UserRole,
    classSection: '',
    workDays: [] as string[],
    dailyWorkMinutes: 0
  })

  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  })

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode)
      resetForms()
    }
  }, [isOpen, initialMode])

  const resetForms = () => {
    setLoginData({ email: '', password: '' })
    setRegisterData({
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      role: '',
      classSection: '',
      workDays: [],
      dailyWorkMinutes: 0
    })
    setError('')
    setVerificationCode('')
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn(loginData.email, loginData.password)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    onClose()
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (registerData.password !== registerData.confirmPassword) {
      setError('Şifreler eşleşmiyor')
      setLoading(false)
      return
    }

    if (registerData.password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır')
      setLoading(false)
      return
    }

    if (!registerData.role) {
      setError('Lütfen rolünüzü seçin')
      setLoading(false)
      return
    }

    // Sadece email ve password gönder, metadata'sız
    const result = await signUp(registerData.email, registerData.password)

    if (result.error) {
      console.error('❌ Registration error:', result.error)
      setError(result.error)
      setLoading(false)
      return
    }

    if (!result.error) {
      console.log('✅ Auth successful, user ID:', result.user?.id, 'Role:', registerData.role)

      // Auth başarılı oldu, şimdi manuel profil oluştur
      try {
        const profileData = {
          id: result.user?.id,
          first_name: registerData.firstName || '',
          last_name: registerData.lastName || '',
          role: registerData.role || 'student',
          class_section: registerData.classSection || null,
          work_days: registerData.workDays || [],
          daily_work_minutes: registerData.dailyWorkMinutes || 0
        }

        console.log('📝 Creating profile with data:', profileData)

        // Önce profilin var olup olmadığını kontrol et
        const { data: existingProfile, error: checkError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', profileData.id)
          .single()

        console.log('🔍 Profile check result:', { existingProfile, checkError })

        if (existingProfile && !checkError) {
          console.log('✅ Profile already exists, updating with new data...')
          // Profil zaten var, güncelle
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              first_name: profileData.first_name,
              last_name: profileData.last_name,
              role: profileData.role,
              class_section: profileData.class_section,
              work_days: profileData.work_days,
              daily_work_minutes: profileData.daily_work_minutes
            })
            .eq('id', profileData.id)

          if (updateError) {
            console.error('❌ Profile update error:', updateError)
            setError(`Profil güncelleme hatası: ${updateError.message}`)
            setLoading(false)
            return
          } else {
            console.log('✅ Profile updated successfully')

            // İsimlerin gerçekten kaydedildiğini doğrula
            const { data: verifyProfile } = await supabase
              .from('profiles')
              .select('first_name, last_name, role')
              .eq('id', profileData.id)
              .single()

            console.log('🔍 Profile verification after update:', verifyProfile)

            if (verifyProfile) {
              console.log('✅ Names saved successfully:', {
                firstName: verifyProfile.first_name,
                lastName: verifyProfile.last_name,
                role: verifyProfile.role
              })
            }
          }
        } else {
          console.log('📝 Profile does not exist, creating new one...')
          const { error: profileError } = await supabase
            .from('profiles')
            .insert(profileData)

          if (profileError) {
            console.error('❌ Profile creation error:', {
              message: profileError.message,
              code: profileError.code,
              details: profileError.details,
              hint: profileError.hint,
              fullError: profileError
            })

            // RLS hatası mı kontrol et
            if (profileError.code === '42501') {
              console.warn('🔒 RLS policy violation - trying with service role approach...')
              // Alternatif yöntem: RPC fonksiyonu kullan
              const { error: rpcError } = await supabase.rpc('create_profile_manual', profileData)
              if (rpcError) {
                console.error('❌ RPC profile creation also failed:', rpcError)
                setError(`Profil oluşturulamadı: ${rpcError.message}`)
                setLoading(false)
                return
              } else {
                console.log('✅ Profile created via RPC')
              }
            } else {
              setError(`Profil hatası: ${profileError.message}`)
              setLoading(false)
              return
            }
          } else {
            console.log('✅ Profile created successfully')

            // İsimlerin gerçekten kaydedildiğini doğrula
            const { data: verifyProfile } = await supabase
              .from('profiles')
              .select('first_name, last_name, role')
              .eq('id', profileData.id)
              .single()

            console.log('🔍 Profile verification after creation:', verifyProfile)

            if (verifyProfile) {
              console.log('✅ Names saved successfully:', {
                firstName: verifyProfile.first_name,
                lastName: verifyProfile.last_name,
                role: verifyProfile.role
              })
            }
          }
        }
      } catch (error) {
        console.error('💥 Profile creation exception:', {
          error,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        })
        setError('Profil oluşturma sırasında bir hata oluştu')
        setLoading(false)
        return
      }

      setPendingEmail(registerData.email)
      setMode('verify')
    }
    setLoading(false)
  }

  const verifyEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: pendingEmail,
        token: verificationCode,
        type: 'email'
      })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      onClose()
    } catch (error) {
      setError('Doğrulama sırasında bir hata oluştu')
      setLoading(false)
    }
  }

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode)
    resetForms()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === 'login' ? 'Giriş Yap' :
        mode === 'register' ? 'Kayıt Ol' :
        'E-posta Doğrulama'
      }
      size="lg"
    >
      {mode === 'login' ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="E-posta"
            type="email"
            value={loginData.email}
            onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
            required
          />

          <Input
            label="Şifre"
            type="password"
            value={loginData.password}
            onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
            required
          />

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex justify-between items-center pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => switchMode('register')}
            >
              Kayıt Ol
            </Button>

            <Button type="submit" disabled={loading}>
              {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
            </Button>
          </div>
        </form>
      ) : mode === 'register' ? (
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Ad"
              value={registerData.firstName}
              onChange={(e) => setRegisterData(prev => ({ ...prev, firstName: e.target.value }))}
              required
            />
            <Input
              label="Soyad"
              value={registerData.lastName}
              onChange={(e) => setRegisterData(prev => ({ ...prev, lastName: e.target.value }))}
              required
            />
          </div>
          <Input
            label="E-posta"
            type="email"
            value={registerData.email}
            onChange={(e) => setRegisterData(prev => ({ ...prev, email: e.target.value }))}
            required
          />
          <Input
            label="Şifre"
            type="password"
            value={registerData.password}
            onChange={(e) => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
            required
          />
          <Input
            label="Şifre Tekrar"
            type="password"
            value={registerData.confirmPassword}
            onChange={(e) => setRegisterData(prev => ({ ...prev, confirmPassword: e.target.value }))}
            required
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Rolünüz <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="student"
                  checked={registerData.role === 'student'}
                  onChange={(e) => setRegisterData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                  className="mr-2"
                />
                Öğrenci
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="teacher"
                  checked={registerData.role === 'teacher'}
                  onChange={(e) => setRegisterData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                  className="mr-2"
                />
                Öğretmen
              </label>
            </div>
          </div>

          {registerData.role === 'student' && (
            <Input
              label="Sınıf Bölümü (örn: 6/A)"
              value={registerData.classSection}
              onChange={(e) => setRegisterData(prev => ({ ...prev, classSection: e.target.value }))}
              placeholder="6/A"
            />
          )}

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex justify-between items-center pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => switchMode('login')}
            >
              Zaten Hesabın Var Mı?
            </Button>

            <Button type="submit" disabled={loading}>
              {loading ? 'Kayıt Olunuyor...' : 'Kayıt Ol'}
            </Button>
          </div>
        </form>
      ) : mode === 'verify' ? (
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-4xl mb-4">📧</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              E-posta Doğrulama
            </h3>
            <p className="text-gray-600 mb-4">
              <strong>{pendingEmail}</strong> adresine gönderilen 6 haneli doğrulama kodunu girin.
            </p>
          </div>

          <form onSubmit={verifyEmail} className="space-y-4">
            <Input
              label="Doğrulama Kodu"
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              maxLength={6}
              required
              className="text-center text-2xl tracking-widest"
            />

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="text-center text-sm text-gray-600 mb-4">
              Kodu almadıysanız spam klasörünü kontrol edin.
            </div>

            <div className="flex justify-between items-center pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setMode('register')}
              >
                Geri Dön
              </Button>

              <Button type="submit" disabled={loading || verificationCode.length !== 6}>
                {loading ? 'Doğrulanıyor...' : 'Doğrula'}
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-4xl mb-4">📧</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              E-posta Doğrulama Gönderildi!
            </h3>
            <p className="text-gray-600 mb-4">
              Lütfen e-posta adresinizi kontrol edin ve gelen bağlantıya tıklayarak hesabınızı doğrulayın.
            </p>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={() => switchMode('login')}
              className="w-full"
            >
              Giriş Yap Sayfasına Dön
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}