'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Button from './Button'
import Input from './Input'
import Card from './Card'
import { WorkDay } from '@/lib/database/types'

const WORK_DAYS: { value: WorkDay; label: string }[] = [
  { value: 'monday', label: 'Pazartesi' },
  { value: 'tuesday', label: 'Salı' },
  { value: 'wednesday', label: 'Çarşamba' },
  { value: 'thursday', label: 'Perşembe' },
  { value: 'friday', label: 'Cuma' },
  { value: 'saturday', label: 'Cumartesi' },
  { value: 'sunday', label: 'Pazar' },
]

export default function Profile() {
  const { profile, updateProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    firstName: profile?.first_name || '',
    lastName: profile?.last_name || '',
    classSection: profile?.class_section || '',
    workDays: profile?.work_days || [],
    dailyWorkMinutes: profile?.daily_work_minutes || 0
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const updates = {
      first_name: formData.firstName,
      last_name: formData.lastName,
      class_section: formData.classSection || undefined,
      work_days: formData.workDays,
      daily_work_minutes: formData.dailyWorkMinutes
    }

    const { error } = await updateProfile(updates)

    if (error) {
      setError(error)
    } else {
      setSuccess('Profil bilgileriniz başarıyla güncellendi!')
      setTimeout(() => setSuccess(''), 3000)
    }

    setLoading(false)
  }

  const toggleWorkDay = (day: WorkDay) => {
    setFormData(prev => ({
      ...prev,
      workDays: prev.workDays.includes(day)
        ? prev.workDays.filter(d => d !== day)
        : [...prev.workDays, day]
    }))
  }

  if (!profile) {
    return (
      <Card>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Card>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Header */}
      <Card>
        <div className="text-center">
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
            {profile.first_name[0]}{profile.last_name[0]}
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            {profile.first_name} {profile.last_name}
          </h2>
          <p className="text-gray-600 mt-1">
            {profile.role === 'student' ? 'Öğrenci' : 'Öğretmen'}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {profile.total_points}
              </div>
              <div className="text-sm text-gray-600">Toplam Puan</div>
            </div>

            {profile.role === 'student' && profile.class_section && (
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {profile.class_section}
                </div>
                <div className="text-sm text-gray-600">Sınıf</div>
              </div>
            )}

            {profile.role === 'student' && profile.daily_work_minutes > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {profile.daily_work_minutes}
                </div>
                <div className="text-sm text-gray-600">Günlük Dakika</div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Profile Form */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Profil Bilgilerini Güncelle</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Ad"
              value={formData.firstName}
              onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
              required
            />

            <Input
              label="Soyad"
              value={formData.lastName}
              onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
              required
            />
          </div>

          {profile.role === 'student' && (
            <>
              <Input
                label="Sınıf & Şube (örn: 6/A)"
                value={formData.classSection}
                onChange={(e) => setFormData(prev => ({ ...prev, classSection: e.target.value }))}
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
                        checked={formData.workDays.includes(day.value)}
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
                value={formData.dailyWorkMinutes.toString()}
                onChange={(e) => setFormData(prev => ({ ...prev, dailyWorkMinutes: parseInt(e.target.value) || 0 }))}
                placeholder="120"
              />
            </>
          )}

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="text-green-600 text-sm bg-green-50 p-3 rounded-lg">
              {success}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? 'Güncelleniyor...' : 'Güncelle'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Account Info */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Hesap Bilgileri</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Kayıt Tarihi:</span>
            <span className="font-medium">
              {new Date(profile.created_at).toLocaleDateString('tr-TR')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Son Güncelleme:</span>
            <span className="font-medium">
              {new Date(profile.updated_at).toLocaleDateString('tr-TR')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Rol:</span>
            <span className="font-medium">
              {profile.role === 'student' ? 'Öğrenci' : 'Öğretmen'}
            </span>
          </div>
        </div>
      </Card>
    </div>
  )
}
