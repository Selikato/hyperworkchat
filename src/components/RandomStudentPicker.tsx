'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Button from './Button'

// Sınıf bazlı öğrenci listeleri
const CLASS_STUDENTS: { [key: string]: string[] } = {
  '6/A': [
    'Ahmet Yavuz',
    'Ahmet Hamza',
    'Berat',
    'Çetin Ali',
    'Ekrem',
    'Emir',
    'Eymen',
    'Kayra Emir'
  ],
  '6/B': [
    'Talha',
    'Muhammed Kerem(KETO)',
    'Ömer',
    'Ömer Asaf',
    'Selim Kaan',
    'Yavuz Selim',
    'Yusuf'
  ],
  '6/C': [
    'Onur Enes',
    'İshak',
    'Hamza'
  ]
}

interface SelectedStudent {
  name: string
  timestamp: Date
}

export default function RandomStudentPicker() {
  const { profile, user } = useAuth()
  const [selectedStudents, setSelectedStudents] = useState<SelectedStudent[]>([])
  const [currentSelection, setCurrentSelection] = useState<string | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [availableStudents, setAvailableStudents] = useState<string[]>([])
  const [loadingStudents, setLoadingStudents] = useState(true)

  useEffect(() => {
    // Öğrenci listesini profile'a göre yükle
    const loadStudents = async () => {
      try {
        // Öğrencinin sınıfına göre öğrenci listesi seç
        let studentsForClass: string[] = []

        if (profile?.role === 'student' && profile.class_section) {
          // Öğrenci kendi sınıfındaki öğrencileri görsün
          studentsForClass = CLASS_STUDENTS[profile.class_section] || []
          console.log(`📚 ${profile.class_section} sınıfındaki öğrenciler yüklendi:`, studentsForClass.length, 'öğrenci')
        } else if (profile?.role === 'teacher') {
          // Öğretmen tüm öğrencileri görebilir (şimdilik eski sistem)
          const { data, error } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('role', 'student')
            .order('first_name', { ascending: true })

          if (!error && data) {
            studentsForClass = data.map(student => {
              const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim()
              return fullName
            }).filter(name => name.length > 0)
          } else {
            // Fallback olarak tüm hardcoded öğrencileri kullan
            studentsForClass = Object.values(CLASS_STUDENTS).flat()
          }
        } else {
          // Giriş yapmamış kullanıcı için varsayılan liste
          studentsForClass = Object.values(CLASS_STUDENTS).flat()
        }

        console.log('📋 Yüklenen öğrenci listesi:', studentsForClass.slice(0, 5), '...')

        setAvailableStudents(studentsForClass)
        console.log('✅ Öğrenci listesi yüklendi:', studentsForClass.length, 'öğrenci')
      } catch (error) {
        console.error('Öğrenci listesi yükleme hatası:', error)
        // Hata durumunda tüm öğrencileri göster
        const fallbackStudents = Object.values(CLASS_STUDENTS).flat()
        setAvailableStudents(fallbackStudents)
      } finally {
        setLoadingStudents(false)
      }
    }

    loadStudents()

    // Önceki seçimleri yükle (sadece öğretmenler için)
    if (profile?.role === 'teacher') {
      loadPreviousSelections()
    }
  }, [profile])

  const loadPreviousSelections = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('selected_students')
        .select('*')
        .eq('teacher_id', user.id)
        .order('selected_at', { ascending: false })

      if (error) {
        console.error('Seçimleri yükleme hatası:', error)
        return
      }

      // Öğrenci isimlerini profiles tablosundan al
      const selectedNames = data?.map(async (selection) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', selection.student_id)
          .single()

        if (profile) {
          return {
            name: `${profile.first_name} ${profile.last_name}`,
            timestamp: new Date(selection.selected_at)
          }
        }
        return null
      }).filter(Boolean) || []

      const resolvedNames = await Promise.all(selectedNames)
      setSelectedStudents(resolvedNames.filter(Boolean) as SelectedStudent[])

      // Kullanılabilir öğrencileri güncelle - veritabanından gelen öğrencilerle
      const usedNames = resolvedNames.map(s => s?.name).filter(Boolean)
      setAvailableStudents(allStudentsFromDB.filter(student => !usedNames.includes(student)))

    } catch (error) {
      console.error('Seçimleri yükleme hatası:', error)
    }
  }

  const selectRandomStudent = async () => {
    if (availableStudents.length === 0) {
      alert('Tüm öğrenciler seçildi! Listeyi sıfırlayın.')
      return
    }

    if (!user) {
      alert('Önce giriş yapmalısınız!')
      return
    }

    setIsAnimating(true)

    // Animasyon için rastgele isimleri göster
    const animationDuration = 2000 // 2 saniye
    const animationInterval = 100 // 100ms'de bir değiştir
    const startTime = Date.now()

    const animate = () => {
      const randomIndex = Math.floor(Math.random() * availableStudents.length)
      setCurrentSelection(availableStudents[randomIndex])

      if (Date.now() - startTime < animationDuration) {
        setTimeout(animate, animationInterval)
      } else {
        // Animasyon bitti, final seçimi yap
        let finalIndex = Math.floor(Math.random() * availableStudents.length)
        let selectedName = availableStudents[finalIndex]

        // Eğer seçilen isim boşsa, başka bir tane seç
        if (!selectedName || selectedName.trim() === '') {
          console.warn('⚠️ Empty student name selected, trying another one...')
          finalIndex = (finalIndex + 1) % availableStudents.length
          selectedName = availableStudents[finalIndex]
        }

        setCurrentSelection(selectedName)
        setIsAnimating(false)

        console.log('🎯 Random student selected:', {
          selectedName: `"${selectedName}"`,
          selectedNameLength: selectedName.length,
          availableCount: availableStudents.length,
          finalIndex,
          availableStudents: availableStudents.slice(0, 5) // İlk 5 tanesini göster
        })

        // Veritabanına kaydet (sadece geçerli isimler için)
        if (selectedName && selectedName.trim() !== '') {
          saveSelection(selectedName)
        } else {
          console.error('❌ Cannot save selection: student name is empty')
        }
      }
    }

    animate()
  }

  const saveSelection = async (studentName: string) => {
    if (!user) return

    try {
      // Öğrencinin profilini bul - veritabanındaki formatla eşleştir
      // Öğrenci adı "Ad Soyad" veya "Ad" formatında olabilir
      const nameParts = studentName.trim().split(' ')
      const firstName = nameParts[0]
      const lastName = nameParts.slice(1).join(' ') || '' // Soyad yoksa boş string

      console.log('🔍 Searching for student:', {
        studentName: `"${studentName}"`,
        firstName: `"${firstName}"`,
        lastName: `"${lastName}"`,
        nameParts: nameParts,
        studentNameLength: studentName.length,
        isStudentNameEmpty: studentName.trim() === ''
      })

      // Önce mevcut profili kontrol et - tam eşleşme ara
      const { data: existingProfile, error: searchError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('role', 'student')
        .eq('first_name', firstName)
        .eq('last_name', lastName)
        .single()

      console.log('🔍 Student search result:', {
        studentName: `"${studentName}"`,
        firstName: `"${firstName}"`,
        lastName: `"${lastName}"`,
        profileFound: existingProfile ? 'YES' : 'NO',
        profileId: existingProfile?.id,
        searchError: searchError?.message || 'NONE',
        searchCode: searchError?.code
      })

      const studentId = existingProfile?.id

      // Profil yoksa sessizce çık (sadece kayıtlı öğrencileri kullan)
      if (!studentId) {
        console.warn('⚠️ Student profile not found, cannot save selection:', studentName)
        return
      }

      // Öğrencinin sınıf bilgisini al
      const { data: studentProfile } = await supabase
        .from('profiles')
        .select('class_section')
        .eq('id', studentId)
        .single()

      const classSection = studentProfile?.class_section || 'Bilinmiyor'

      // Seçimi kaydet
      const { error: selectionError } = await supabase
        .from('selected_students')
        .insert({
          teacher_id: user.id,
          student_id: studentId,
          class_section: classSection,
          selected_at: new Date().toISOString()
        })

      if (selectionError) {
        console.error('Seçim kaydetme hatası:', selectionError)
        return
      }

      // State'i güncelle
      const newSelection: SelectedStudent = {
        name: studentName,
        timestamp: new Date()
      }

      setSelectedStudents(prev => [newSelection, ...prev])
      setAvailableStudents(prev => prev.filter(student => student !== studentName))

    } catch (error) {
      console.error('Seçim kaydetme hatası:', error)
    }
  }

  const resetSelections = async () => {
    if (!user) return

    if (!confirm('Tüm seçimleri sıfırlamak istediğinizden emin misiniz?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('selected_students')
        .delete()
        .eq('teacher_id', user.id)

      if (error) {
        console.error('Seçimleri sıfırlama hatası:', error)
        return
      }

      setSelectedStudents([])
      setAvailableStudents(allStudentsFromDB)
      setCurrentSelection(null)

    } catch (error) {
      console.error('Seçimleri sıfırlama hatası:', error)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">🎯 Rastgele Öğrenci Seçimi</h2>

      {/* Ana seçim alanı */}
      <div className="text-center mb-8">
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-8 rounded-xl border-2 border-dashed border-gray-300 mb-6">
          <div className="text-6xl mb-4">
            {isAnimating ? '🎲' : currentSelection ? '🏆' : '❓'}
          </div>
          <div className="text-4xl font-bold text-gray-800 mb-4 min-h-[60px] flex items-center justify-center">
            {isAnimating ? (
              <span className="animate-pulse">Seçiliyor...</span>
            ) : currentSelection ? (
              <span className="text-green-600">{currentSelection}</span>
            ) : (
              <span className="text-gray-500">Henüz seçim yapılmadı</span>
            )}
          </div>
        </div>

        <Button
          onClick={selectRandomStudent}
          disabled={isAnimating || availableStudents.length === 0}
          size="lg"
          className="text-xl px-8 py-4"
        >
          {isAnimating ? '🎲 Seçiliyor...' : '🎯 Rastgele Öğrenci Seç'}
        </Button>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-600">{allStudentsFromDB.length}</div>
          <div className="text-sm text-blue-800">Toplam Öğrenci</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-600">{selectedStudents.length}</div>
          <div className="text-sm text-green-800">Seçilen Öğrenci</div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-orange-600">{availableStudents.length}</div>
          <div className="text-sm text-orange-800">Kalan Öğrenci</div>
        </div>
      </div>

      {/* Kullanılabilir öğrenciler */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4">📝 Kullanılabilir Öğrenciler ({availableStudents.length})</h3>
        {loadingStudents ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Öğrenci listesi yükleniyor...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {availableStudents.map((student, index) => (
              <div key={index} className="bg-gray-50 p-2 rounded text-center text-sm">
                {student}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seçim geçmişi */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4">📊 Seçim Geçmişi ({selectedStudents.length})</h3>
        {selectedStudents.length > 0 ? (
          <div className="space-y-2">
            {selectedStudents.map((selection, index) => (
              <div key={index} className="flex justify-between items-center bg-green-50 p-3 rounded-lg">
                <div className="flex items-center">
                  <span className="text-green-600 mr-3">#{selectedStudents.length - index}</span>
                  <span className="font-medium">{selection.name}</span>
                </div>
                <span className="text-sm text-gray-500">
                  {selection.timestamp.toLocaleTimeString('tr-TR')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">Henüz seçim yapılmadı</p>
        )}
      </div>

      {/* Kontrol butonları */}
      <div className="flex justify-center space-x-4">
        <Button
          onClick={resetSelections}
          variant="secondary"
          disabled={selectedStudents.length === 0}
        >
          🔄 Listeyi Sıfırla
        </Button>
      </div>
    </div>
  )
}