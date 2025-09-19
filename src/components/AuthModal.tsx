'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Modal from './Modal'
import Button from './Button'
import Input from './Input'
import { UserRole, WorkDay } from '@/lib/database/types'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode: 'login' | 'register'
}

const WORK_DAYS: { value: WorkDay; label: string }[] = [
  { value: 'monday', label: 'Pazartesi' },
  { value: 'tuesday', label: 'Salı' },
  { value: 'wednesday', label: 'Çarşamba' },
  { value: 'thursday', label: 'Perşembe' },
  { value: 'friday', label: 'Cuma' },
  { value: 'saturday', label: 'Cumartesi' },
  { value: 'sunday', label: 'Pazar' },
]

export default function AuthModal({ isOpen, onClose, initialMode }: AuthModalProps) {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Login form
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  })

  // Register form
  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    role: 'student' as UserRole,
    classSection: '',
    workDays: [] as WorkDay[],
    dailyWorkMinutes: 0
  })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await signIn(loginData.email, loginData.password)

    if (error) {
      setError(error)
    } else {
      onClose()
    }

    setLoading(false)
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

    const userData = {
      first_name: registerData.firstName,
      last_name: registerData.lastName,
      role: registerData.role,
      class_section: registerData.classSection || undefined,
      work_days: registerData.workDays,
      daily_work_minutes: registerData.dailyWorkMinutes
    }

    const { error } = await signUp(registerData.email, registerData.password, userData)

    if (error) {
      setError(error)
    } else {
      onClose()
    }

    setLoading(false)
  }

  const toggleWorkDay = (day: WorkDay) => {
    setRegisterData(prev => ({
      ...prev,
      workDays: prev.workDays.includes(day)
        ? prev.workDays.filter(d => d !== day)
        : [...prev.workDays, day]
    }))
  }

  const resetForms = () => {
    setLoginData({ email: '', password: '' })
    setRegisterData({
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      role: 'student',
      classSection: '',
      workDays: [],
      dailyWorkMinutes: 0
    })
    setError('')
  }

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode)
    resetForms()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
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
              Hesabın Yok Mu?
            </Button>

            <Button type="submit" disabled={loading}>
              {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
            </Button>
          </div>
        </form>
      ) : (
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
            <>
              <Input
                label="Sınıf & Şube (örn: 6/A)"
                value={registerData.classSection}
                onChange={(e) => setRegisterData(prev => ({ ...prev, classSection: e.target.value }))}
                placeholder="6/A"
              />

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Hangi günlerde çalışmak istiyorsunuz?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {WORK_DAYS.map((day) => (
                    <label key={day.value} className="flex items-center text-sm">
                      <input
                        type="checkbox"
                        checked={registerData.workDays.includes(day.value)}
                        onChange={() => toggleWorkDay(day.value)}
                        className="mr-2"
                      />
                      {day.label}
                    </label>
                  ))}
                </div>
              </div>

              <Input
                label="Günde kaç dakika çalışmak istiyorsunuz?"
                type="number"
                min="0"
                value={registerData.dailyWorkMinutes.toString()}
                onChange={(e) => setRegisterData(prev => ({ ...prev, dailyWorkMinutes: parseInt(e.target.value) || 0 }))}
                placeholder="120"
              />
            </>
          )}

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
      )}
    </Modal>
  )
}
