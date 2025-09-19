'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Button from './Button'
import Card from './Card'
import { Profile } from '@/lib/database/types'

interface SelectedStudent {
  id: string
  student_id: string
  class_section: string
  selected_at: string
  student_profile?: Profile
}

export default function TeacherPanel() {
  const { user, profile } = useAuth()
  const [availableClasses, setAvailableClasses] = useState<string[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [students, setStudents] = useState<Profile[]>([])
  const [selectedStudents, setSelectedStudents] = useState<SelectedStudent[]>([])
  const [randomStudent, setRandomStudent] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [showResult, setShowResult] = useState(false)

  // Fetch available classes and previously selected students
  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      // Get all unique class sections
      const { data: classesData, error: classesError } = await supabase
        .from('profiles')
        .select('class_section')
        .eq('role', 'student')
        .not('class_section', 'is', null)
        .order('class_section')

      if (!classesError && classesData) {
        const uniqueClasses = [...new Set(classesData.map(c => c.class_section).filter(Boolean))]
        setAvailableClasses(uniqueClasses)
      }

      // Get previously selected students by this teacher
      const { data: selectedData, error: selectedError } = await supabase
        .from('selected_students')
        .select(`
          *,
          student_profile:student_id (
            id,
            first_name,
            last_name,
            class_section,
            total_points
          )
        `)
        .eq('teacher_id', user.id)

      if (!selectedError && selectedData) {
        setSelectedStudents(selectedData)
      }
    }

    fetchData()
  }, [user])

  // Fetch students for selected class
  useEffect(() => {
    if (!selectedClass) {
      setStudents([])
      return
    }

    const fetchStudents = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .eq('class_section', selectedClass)
        .order('total_points', { ascending: false })

      if (error) {
        console.error('Error fetching students:', error)
      } else {
        setStudents(data || [])
      }
    }

    fetchStudents()
  }, [selectedClass])

  const selectRandomStudent = async () => {
    if (!user || !selectedClass || students.length === 0) return

    setLoading(true)

    // Get available students (not previously selected by this teacher)
    const selectedStudentIds = selectedStudents.map(s => s.student_id)
    const availableStudents = students.filter(s => !selectedStudentIds.includes(s.id))

    if (availableStudents.length === 0) {
      alert('Bu sınıftaki tüm öğrenciler zaten seçildi!')
      setLoading(false)
      return
    }

    // Select random student
    const randomIndex = Math.floor(Math.random() * availableStudents.length)
    const selectedStudent = availableStudents[randomIndex]

    // Save selection to database
    const { error } = await supabase
      .from('selected_students')
      .insert({
        teacher_id: user.id,
        student_id: selectedStudent.id,
        class_section: selectedClass
      })

    if (error) {
      console.error('Error saving selection:', error)
      alert('Öğrenci seçimi kaydedilirken hata oluştu!')
    } else {
      setRandomStudent(selectedStudent)
      setShowResult(true)

      // Add to selected students list
      setSelectedStudents(prev => [...prev, {
        id: Date.now().toString(), // Temporary ID
        student_id: selectedStudent.id,
        class_section: selectedClass,
        selected_at: new Date().toISOString(),
        student_profile: selectedStudent
      }])
    }

    setLoading(false)
  }

  const resetSelection = () => {
    setRandomStudent(null)
    setShowResult(false)
  }

  const getSelectedStudentsForClass = (classSection: string) => {
    return selectedStudents.filter(s => s.class_section === classSection)
  }

  if (!profile || profile.role !== 'teacher') {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-gray-600">Bu sayfaya erişim yetkiniz yok.</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">🎯 Öğrenci Seçme Paneli</h2>
          <p className="text-gray-600">
            Sınıf seçin ve rastgele bir öğrenci seçin
          </p>
        </div>

        {/* Class Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sınıf Seçin
          </label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Sınıf seçin...</option>
            {availableClasses.map((classSection) => (
              <option key={classSection} value={classSection}>
                {classSection}
              </option>
            ))}
          </select>
        </div>

        {/* Selection Result */}
        {showResult && randomStudent && (
          <Card>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
                🎉
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Seçilen Öğrenci</h3>
              <div className="text-lg text-gray-700 mb-4">
                {randomStudent.first_name} {randomStudent.last_name}
              </div>
              <div className="text-sm text-gray-600 mb-4">
                Sınıf: {randomStudent.class_section} | Puan: {randomStudent.total_points}
              </div>
              <Button onClick={resetSelection}>
                Yeni Seçim Yap
              </Button>
            </div>
          </Card>
        )}

        {/* Selection Button */}
        {selectedClass && !showResult && (
          <div className="text-center">
            <div className="mb-4">
              <p className="text-gray-600 mb-2">
                {selectedClass} sınıfında {students.length} öğrenci var
              </p>
              <p className="text-sm text-gray-500">
                Daha önce seçilen: {getSelectedStudentsForClass(selectedClass).length} öğrenci
              </p>
            </div>

            <Button
              size="lg"
              onClick={selectRandomStudent}
              disabled={loading || students.length === 0}
            >
              {loading ? 'Seçiliyor...' : 'Rastgele Öğrenci Seç'}
            </Button>
          </div>
        )}
      </Card>

      {/* Previously Selected Students */}
      {selectedStudents.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daha Önce Seçilen Öğrenciler</h3>

          {availableClasses.map((classSection) => {
            const classSelections = getSelectedStudentsForClass(classSection)
            if (classSelections.length === 0) return null

            return (
              <div key={classSection} className="mb-4">
                <h4 className="font-medium text-gray-700 mb-2">{classSection} Sınıfı</h4>
                <div className="space-y-2">
                  {classSelections.map((selection) => (
                    <div
                      key={selection.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium">
                          {selection.student_profile?.first_name[0]}{selection.student_profile?.last_name[0]}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {selection.student_profile?.first_name} {selection.student_profile?.last_name}
                          </div>
                          <div className="text-sm text-gray-600">
                            {new Date(selection.selected_at).toLocaleDateString('tr-TR')}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {selection.student_profile?.total_points} puan
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </Card>
      )}

      {/* Class Statistics */}
      {selectedClass && students.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {selectedClass} Sınıfı İstatistikleri
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{students.length}</div>
              <div className="text-sm text-gray-600">Toplam Öğrenci</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {students.reduce((sum, s) => sum + s.total_points, 0)}
              </div>
              <div className="text-sm text-gray-600">Toplam Puan</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(students.reduce((sum, s) => sum + s.total_points, 0) / students.length)}
              </div>
              <div className="text-sm text-gray-600">Ortalama Puan</div>
            </div>
          </div>

          <div className="text-sm text-gray-600 text-center">
            Lider: {students[0]?.first_name} {students[0]?.last_name} ({students[0]?.total_points} puan)
          </div>
        </Card>
      )}
    </div>
  )
}
