'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Button from './Button'
import { RealtimeChannel } from '@supabase/supabase-js'

interface ExamResult {
  student_id: string
  student_name: string
  completion_time: number // saniye cinsinden
  finished_at: Date
}

interface ExamSession {
  id: string
  teacher_id: string
  start_time: Date
  duration_minutes: number
  is_active: boolean
  results: ExamResult[]
}

export default function ExamTimer() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [userRole, setUserRole] = useState<'student' | 'teacher' | null>(null)
  const [currentSession, setCurrentSession] = useState<ExamSession | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [isRunning, setIsRunning] = useState(false)
  const [examDuration, setExamDuration] = useState<number>(60) // dakika
  const [results, setResults] = useState<ExamResult[]>([])
  const [students, setStudents] = useState<{ id: string; name: string }[]>([])

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    initializeUser()
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  const initializeUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user && user.email) {
      setUser({ id: user.id, email: user.email })

      // Kullanıcı rolünü al
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUserRole(profile.role)

        if (profile.role === 'teacher') {
          loadStudents()
          setupRealtimeSubscription()
        } else {
          checkActiveExam()
        }
      }
    }
  }

  const loadStudents = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('role', 'student')
      .order('first_name')

    if (data && !error) {
      const formattedStudents = data.map(student => ({
        id: student.id,
        name: `${student.first_name} ${student.last_name}`.trim()
      }))
      setStudents(formattedStudents)
    }
  }

  const setupRealtimeSubscription = () => {
    if (channelRef.current) {
      channelRef.current.unsubscribe()
    }

    channelRef.current = supabase.channel('exam-timer')
      .on('broadcast', { event: 'exam-finished' }, (payload) => {
        handleStudentFinished(payload.payload)
      })
      .on('broadcast', { event: 'exam-started' }, (payload) => {
        handleExamStarted(payload.payload)
      })
      .subscribe()
  }

  const checkActiveExam = () => {
    // Öğrenciler için aktif sınav kontrolü
    // Bu kısım daha sonra exam_sessions tablosu eklendiğinde implement edilecek
  }

  const startExam = async () => {
    if (!user || userRole !== 'teacher') return

    const startTime = new Date()

    // Yeni sınav oturumu oluştur
    const session: ExamSession = {
      id: crypto.randomUUID(),
      teacher_id: user.id,
      start_time: startTime,
      duration_minutes: examDuration,
      is_active: true,
      results: []
    }

    setCurrentSession(session)
    setTimeRemaining(examDuration * 60)
    setIsRunning(true)
    setResults([])

    // Öğrencilere broadcast gönder
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'exam-started',
        payload: {
          sessionId: session.id,
          duration: examDuration,
          startTime: startTime.toISOString()
        }
      })
    }

    // Timer başlat
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          endExam()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const endExam = () => {
    setIsRunning(false)
    setCurrentSession(null)
    setTimeRemaining(0)

    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    // Sonuçları göster
    const sortedResults = [...results].sort((a, b) => a.completion_time - b.completion_time)
    setResults(sortedResults)
  }

  const finishExam = async () => {
    if (!user || userRole !== 'student' || !currentSession) return

    const completionTime = examDuration * 60 - timeRemaining
    const finishedAt = new Date()

    const result: ExamResult = {
      student_id: user.id,
      student_name: `Öğrenci (${user.email})`,
      completion_time: completionTime,
      finished_at: finishedAt
    }

    // Öğretmene broadcast gönder
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'exam-finished',
        payload: result
      })
    }

    // Öğrenci için sınavı bitir
    setIsRunning(false)
    setCurrentSession(null)
    setTimeRemaining(0)

    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    alert(`Sınavı tamamladınız! Süre: ${formatTime(completionTime)}`)
  }

  const handleStudentFinished = (result: ExamResult) => {
    if (userRole !== 'teacher') return

    setResults(prev => {
      const updated = [...prev, result]
      return updated.sort((a, b) => a.completion_time - b.completion_time)
    })
  }

  const handleExamStarted = (payload: { startTime: string; duration: number; sessionId: string }) => {
    if (userRole !== 'student') return

    // Öğrenci için sınav başlat
    const startTime = new Date(payload.startTime)
    const duration = payload.duration * 60 // saniye

    const session: ExamSession = {
      id: payload.sessionId,
      teacher_id: '', // bilinmiyor
      start_time: startTime,
      duration_minutes: payload.duration,
      is_active: true,
      results: []
    }

    setCurrentSession(session)
    setTimeRemaining(duration)
    setIsRunning(true)

    // Timer başlat
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setIsRunning(false)
          setCurrentSession(null)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <p className="text-center text-gray-500">Lütfen önce giriş yapın</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">⏰ Sınav Zamanlayıcı</h2>

      {userRole === 'teacher' ? (
        /* Öğretmen Görünümü */
        <div>
          {/* Sınav Ayarları */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-4">📋 Sınav Ayarları</h3>
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <span>Sınav Süresi:</span>
                <input
                  type="number"
                  value={examDuration}
                  onChange={(e) => setExamDuration(Number(e.target.value))}
                  className="border rounded px-2 py-1 w-20"
                  min="1"
                  max="300"
                />
                <span>dakika</span>
              </label>
            </div>
          </div>

          {/* Sınav Kontrolleri */}
          <div className="text-center mb-8">
            {!isRunning ? (
              <Button onClick={startExam} size="lg" className="text-xl px-8 py-4">
                🚀 Sınavı Başlat
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="text-6xl font-bold text-red-600">
                  {formatTime(timeRemaining)}
                </div>
                <Button onClick={endExam} variant="secondary" size="lg">
                  🛑 Sınavı Bitir
                </Button>
              </div>
            )}
          </div>

          {/* Öğrenci Listesi */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4">👥 Öğrenciler ({students.length})</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {students.map((student, index) => (
                <div key={index} className="bg-blue-50 p-2 rounded text-center text-sm">
                  {student.name}
                </div>
              ))}
            </div>
          </div>

          {/* Sonuçlar */}
          {results.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-4">🏆 Sınav Sonuçları ({results.length})</h3>
              <div className="space-y-2">
                {results.map((result, index) => (
                  <div key={result.student_id} className="flex justify-between items-center bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                      </span>
                      <div>
                        <div className="font-medium">{result.student_name}</div>
                        <div className="text-sm text-gray-500">
                          {result.finished_at.toLocaleTimeString('tr-TR')}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        {formatTime(result.completion_time)}
                      </div>
                      <div className="text-sm text-gray-500">
                        Süre
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Öğrenci Görünümü */
        <div className="text-center">
          {!isRunning ? (
            <div className="py-12">
              <div className="text-6xl mb-4">⏳</div>
              <h3 className="text-xl font-semibold mb-2">Sınav Henüz Başlamadı</h3>
              <p className="text-gray-600">Öğretmen sınavı başlattığında otomatik başlayacak</p>
            </div>
          ) : (
            <div className="py-12">
              <div className="text-8xl font-bold text-red-600 mb-6">
                {formatTime(timeRemaining)}
              </div>
              <h3 className="text-xl font-semibold mb-6">Sınav Devam Ediyor</h3>
              <Button onClick={finishExam} size="lg" className="text-xl px-8 py-4">
                ✅ Sınavı Bitir
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}