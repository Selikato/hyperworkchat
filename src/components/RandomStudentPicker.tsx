'use client'

import { useState, useEffect } from 'react'
import Button from './Button'

// Öğrenci listesi - sabit liste
const STUDENTS = [
  'Ahmet Yavuz',
  'Ahmet Hamza',
  'Berat',
  'Çetin Ali',
  'Ekrem',
  'Emir',
  'Eymen',
  'Kayra Emir',
  'Talha',
  'Muhammed Kerem(KETO)',
  'Ömer',
  'Ömer Asaf',
  'Selim Kaan',
  'Yavuz Selim',
  'Yusuf',
  'Onur Enes',
  'İshak',
  'Hamza'
]

interface SelectedStudent {
  name: string
  timestamp: Date
}

export default function RandomStudentPicker() {
  const [selectedStudents, setSelectedStudents] = useState<SelectedStudent[]>([])
  const [currentSelection, setCurrentSelection] = useState<string | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [availableStudents, setAvailableStudents] = useState<string[]>([])

  useEffect(() => {
    console.log('🎯 RandomStudentPicker useEffect çalıştı')
    console.log('📚 STUDENTS array:', STUDENTS)
    console.log('📊 STUDENTS length:', STUDENTS.length)

    // Öğrenci listesini başlat
    setAvailableStudents(STUDENTS)
    console.log('✅ Available students set to:', STUDENTS)

    // localStorage'dan önceki seçimleri yükle
    loadPreviousSelections()
  }, [])

  const loadPreviousSelections = () => {
    try {
      const saved = localStorage.getItem('selectedStudents_v2')
      if (saved) {
        const parsed = JSON.parse(saved).map((item: { name: string; timestamp: string }) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }))
        setSelectedStudents(parsed)

        // Kullanılabilir öğrencileri güncelle
        const usedNames = parsed.map((s: SelectedStudent) => s.name)
        setAvailableStudents(STUDENTS.filter(student => !usedNames.includes(student)))
      }
    } catch (error) {
      console.error('Seçimleri yükleme hatası:', error)
    }
  }

  const selectRandomStudent = () => {
    if (availableStudents.length === 0) {
      alert('Tüm öğrenciler seçildi! Listeyi sıfırlayın.')
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
        const finalIndex = Math.floor(Math.random() * availableStudents.length)
        const selectedName = availableStudents[finalIndex]

        setCurrentSelection(selectedName)
        setIsAnimating(false)

        console.log('🎯 Random student selected:', selectedName)

        // Local'e kaydet
        saveSelection(selectedName)
      }
    }

    animate()
  }

  const saveSelection = (studentName: string) => {
    // State'i güncelle
    const newSelection: SelectedStudent = {
      name: studentName,
      timestamp: new Date()
    }

    const updatedSelections = [newSelection, ...selectedStudents]
    setSelectedStudents(updatedSelections)
    setAvailableStudents(prev => prev.filter(student => student !== studentName))

    // localStorage'a kaydet
    localStorage.setItem('selectedStudents', JSON.stringify(updatedSelections))
  }

  const resetSelections = () => {
    if (!confirm('Tüm seçimleri sıfırlamak istediğinizden emin misiniz?')) {
      return
    }

    setSelectedStudents([])
    setAvailableStudents(STUDENTS)
    setCurrentSelection(null)

    // localStorage'ı temizle
    localStorage.removeItem('selectedStudents')
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
          <div className="text-2xl font-bold text-blue-600">{STUDENTS.length}</div>
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {availableStudents.map((student, index) => (
            <div key={index} className="bg-gray-50 p-2 rounded text-center text-sm">
              {student}
            </div>
          ))}
        </div>
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