'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Button from './Button'
import Card from './Card'
import { WorkSession } from '@/lib/database/types'

type TimerState = 'idle' | 'working' | 'break' | 'paused'
type TimerType = 'work' | 'break'

const WORK_DURATION = 20 * 60 // 20 minutes in seconds
const BREAK_DURATION = 5 * 60 // 5 minutes in seconds

export default function PomodoroTimer() {
  const { user, profile, updateProfile } = useAuth()
  const [timerState, setTimerState] = useState<TimerState>('idle')
  const [currentType, setCurrentType] = useState<TimerType>('work')
  const [timeLeft, setTimeLeft] = useState(WORK_DURATION)
  const [currentSession, setCurrentSession] = useState<WorkSession | null>(null)
  const [wasPaused, setWasPaused] = useState(false)
  const [completedSessions, setCompletedSessions] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Save session to localStorage
  const saveSessionToLocalStorage = (session: WorkSession) => {
    if (!user) return
    try {
      const storedSessions = localStorage.getItem(`work_sessions_${user.id}`)
      const sessions = storedSessions ? JSON.parse(storedSessions) : []
      
      // Check if session already exists, update it; otherwise add it
      const existingIndex = sessions.findIndex((s: WorkSession) => s.id === session.id)
      if (existingIndex >= 0) {
        sessions[existingIndex] = session
      } else {
        sessions.push(session)
      }
      
      localStorage.setItem(`work_sessions_${user.id}`, JSON.stringify(sessions))
    } catch (error) {
      console.warn('Error saving session to localStorage:', error)
    }
  }

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Start timer
  const startTimer = async () => {
    if (!user) return

    const now = new Date()
    const plannedDuration = currentType === 'work' ? WORK_DURATION : BREAK_DURATION

    // Create work session in database
    const session = {
      id: crypto.randomUUID(),
      user_id: user.id,
      start_time: now.toISOString(),
      planned_duration: plannedDuration,
      actual_duration: 0,
      points_earned: 0,
      is_completed: false,
      was_paused: false,
      created_at: now.toISOString()
    }

    try {
      const { error } = await supabase
        .from('work_sessions')
        .insert(session)

      if (error) {
        // Mock sistemde tablo yoksa hata verebilir, bunu yutalım ve local çalışalım
        console.warn('Could not save session to DB (might be missing table), continuing locally:', error)
      }
    } catch (err) {
      console.warn('Error saving session:', err)
    }

    const workSession = session as WorkSession
    setCurrentSession(workSession)
    // Save to localStorage for mock system
    saveSessionToLocalStorage(workSession)
    setTimerState(currentType === 'work' ? 'working' : 'break')
    setTimeLeft(plannedDuration)
    setWasPaused(false)

    // Start countdown
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleTimerComplete()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // Pause timer
  const pauseTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setTimerState('paused')
    setWasPaused(true)

    // Update session in database
    if (currentSession) {
      const updatedSession = { ...currentSession, was_paused: true }
      try {
        supabase
          .from('work_sessions')
          .update({ was_paused: true })
          .eq('id', currentSession.id)
      } catch (error) {
        console.warn('Error updating session pause status:', error)
      }
      // Save to localStorage
      saveSessionToLocalStorage(updatedSession)
      setCurrentSession(updatedSession)
    }
  }

  // Resume timer
  const resumeTimer = () => {
    setTimerState(currentType === 'work' ? 'working' : 'break')

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleTimerComplete()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // Stop/Kapat timer
  const stopTimer = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (currentSession) {
      const now = new Date()
      const actualDuration = currentType === 'work'
        ? WORK_DURATION - timeLeft
        : BREAK_DURATION - timeLeft

      // Update session with end time and 0 points
      const updatedSession = {
        ...currentSession,
        end_time: now.toISOString(),
        actual_duration: actualDuration,
        points_earned: 0,
        is_completed: false
      }
      try {
        await supabase
          .from('work_sessions')
          .update({
            end_time: now.toISOString(),
            actual_duration: actualDuration,
            points_earned: 0,
            is_completed: false
          })
          .eq('id', currentSession.id)
      } catch (error) {
        console.warn('Error updating session stop status:', error)
      }
      // Save to localStorage
      saveSessionToLocalStorage(updatedSession)
    }

    resetTimer()
  }

  // Handle timer completion
  const handleTimerComplete = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (!currentSession || !user || !profile) return

    const now = new Date()
    let pointsEarned = 0

    if (currentType === 'work') {
      // Calculate points for work session
      pointsEarned = wasPaused ? 50 : 100

      // Update user total points
      const newTotalPoints = profile.total_points + pointsEarned
      await updateProfile({ total_points: newTotalPoints })

      setCompletedSessions(prev => prev + 1)
    }

    // Update session in database
    const actualDuration = currentType === 'work'
      ? WORK_DURATION - timeLeft
      : BREAK_DURATION - timeLeft

    const updatedSession = {
      ...currentSession,
      end_time: now.toISOString(),
      actual_duration: actualDuration,
      points_earned: pointsEarned,
      is_completed: true
    }
    try {
      await supabase
        .from('work_sessions')
        .update({
          end_time: now.toISOString(),
          actual_duration: actualDuration,
          points_earned: pointsEarned,
          is_completed: true
        })
        .eq('id', currentSession.id)
    } catch (error) {
      console.warn('Error updating session in DB:', error)
    }
    // Save to localStorage
    saveSessionToLocalStorage(updatedSession)

    // Switch to next phase
    if (currentType === 'work') {
      setCurrentType('break')
      setTimeLeft(BREAK_DURATION)
      setTimerState('break')
      setCurrentSession(null)
      setWasPaused(false)

      // Auto-start break timer after 2 seconds
      setTimeout(() => {
        if (timerState !== 'idle') {
          startTimer()
        }
      }, 2000)
    } else {
      // Break completed, back to work
      setCurrentType('work')
      setTimeLeft(WORK_DURATION)
      setTimerState('idle')
      setCurrentSession(null)
      setWasPaused(false)
    }
  }

  // Reset timer
  const resetTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setTimerState('idle')
    setCurrentType('work')
    setTimeLeft(WORK_DURATION)
    setCurrentSession(null)
    setWasPaused(false)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const getTimerColor = () => {
    switch (timerState) {
      case 'working':
        return 'text-red-600'
      case 'break':
        return 'text-green-600'
      case 'paused':
        return 'text-yellow-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusText = () => {
    switch (timerState) {
      case 'working':
        return 'Çalışma Zamanı'
      case 'break':
        return 'Mola Zamanı'
      case 'paused':
        return 'Duraklatıldı'
      default:
        return 'Hazır'
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <div className="text-center">
          <div className={`text-6xl md:text-8xl font-mono font-bold mb-4 ${getTimerColor()}`}>
            {formatTime(timeLeft)}
          </div>

          <div className="text-xl font-semibold text-gray-700 mb-2">
            {getStatusText()}
          </div>

          <div className="text-sm text-gray-500 mb-6">
            {currentType === 'work'
              ? '20 dakikalık çalışma süresi'
              : '5 dakikalık mola'
            }
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            {timerState === 'idle' && (
              <Button size="lg" onClick={startTimer}>
                Başlat
              </Button>
            )}

            {timerState === 'working' || timerState === 'break' ? (
              <Button variant="secondary" size="lg" onClick={pauseTimer}>
                Durdur
              </Button>
            ) : null}

            {timerState === 'paused' && (
              <Button size="lg" onClick={resumeTimer}>
                Devam Et
              </Button>
            )}

            {(timerState === 'working' || timerState === 'break' || timerState === 'paused') && (
              <Button variant="danger" size="lg" onClick={stopTimer}>
                Kapat
              </Button>
            )}
          </div>

          {wasPaused && timerState === 'working' && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ Bu oturumda duraklama yaptığınız için 50 puan kazanacaksınız.
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {profile?.total_points || 0}
            </div>
            <div className="text-sm text-gray-600">Toplam Puan</div>
          </div>

          <div>
            <div className="text-2xl font-bold text-green-600">
              {completedSessions}
            </div>
            <div className="text-sm text-gray-600">Tamamlanan Oturum</div>
          </div>

          <div>
            <div className="text-2xl font-bold text-purple-600">
              {currentType === 'work' ? 'Çalışma' : 'Mola'}
            </div>
            <div className="text-sm text-gray-600">Mevcut Aşama</div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Puanlama Sistemi</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl mb-2">💯</div>
              <div className="font-semibold text-green-800">100 Puan</div>
              <div className="text-sm text-green-600">Hiç durmadan bitirirsen</div>
            </div>

            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl mb-2">🎯</div>
              <div className="font-semibold text-yellow-800">50 Puan</div>
              <div className="text-sm text-yellow-600">En az bir kez duraklarsan</div>
            </div>

            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl mb-2">❌</div>
              <div className="font-semibold text-red-800">0 Puan</div>
              <div className="text-sm text-red-600">Vaktinden önce kapatırsan</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
