'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Card from './Card'

interface LeaderboardEntry {
  id: string
  first_name: string
  last_name: string
  total_points: number
  class_section?: string
  role: 'student' | 'teacher'
}

export default function Leaderboard() {
  const { profile } = useAuth()
  const [students, setStudents] = useState<LeaderboardEntry[]>([])
  const [teachers, setTeachers] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'students' | 'teachers'>('students')

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true)

      // Mock sistemde kullanıcıları localStorage'dan yükle
      const mockUsers = localStorage.getItem('mockUsers')
      if (mockUsers) {
        try {
          const parsedUsers = JSON.parse(mockUsers)
          
          // Öğrencileri filtrele ve dönüştür
          const mockStudents = parsedUsers
            .filter((u: { role: string }) => u.role === 'student')
            .map((u: { id: string; firstName: string; lastName: string; classSection: string; totalPoints?: number }) => ({
              id: u.id,
              first_name: u.firstName,
              last_name: u.lastName,
              total_points: u.totalPoints || 0,
              class_section: u.classSection || null,
              role: 'student' as const
            }))
            .sort((a: LeaderboardEntry, b: LeaderboardEntry) => b.total_points - a.total_points)
            .slice(0, 50)

          // Öğretmenleri filtrele ve dönüştür
          const mockTeachers = parsedUsers
            .filter((u: { role: string }) => u.role === 'teacher')
            .map((u: { id: string; firstName: string; lastName: string; totalPoints?: number }) => ({
              id: u.id,
              first_name: u.firstName,
              last_name: u.lastName,
              total_points: u.totalPoints || 0,
              role: 'teacher' as const
            }))
            .sort((a: LeaderboardEntry, b: LeaderboardEntry) => b.total_points - a.total_points)
            .slice(0, 50)

          setStudents(mockStudents)
          setTeachers(mockTeachers)
          setLoading(false)
          return
        } catch (e) {
          console.warn('Error parsing mock users, falling back to Supabase:', e)
        }
      }

      // Supabase'den yükle
      try {
        // Fetch students
        const { data: studentsData, error: studentsError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, total_points, class_section, role')
          .eq('role', 'student')
          .order('total_points', { ascending: false })
          .limit(50)

        if (studentsError) {
          console.warn('Error fetching students from Supabase:', studentsError)
          setStudents([])
        } else {
          setStudents(studentsData || [])
        }
      } catch (err) {
        console.warn('Unexpected error fetching students:', err)
        setStudents([])
      }

      try {
        // Fetch teachers
        const { data: teachersData, error: teachersError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, total_points, role')
          .eq('role', 'teacher')
          .order('total_points', { ascending: false })
          .limit(50)

        if (teachersError) {
          console.warn('Error fetching teachers from Supabase:', teachersError)
          setTeachers([])
        } else {
          setTeachers(teachersData || [])
        }
      } catch (err) {
        console.warn('Unexpected error fetching teachers:', err)
        setTeachers([])
      }

      setLoading(false)
    }

    fetchLeaderboard()
  }, [])

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇'
      case 2:
        return '🥈'
      case 3:
        return '🥉'
      default:
        return `#${rank}`
    }
  }

  const getCurrentUserRank = (entries: LeaderboardEntry[]) => {
    if (!profile) return null
    const index = entries.findIndex(entry => entry.id === profile.id)
    return index >= 0 ? index + 1 : null
  }

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Card>
    )
  }

  const currentData = activeTab === 'students' ? students : teachers
  const currentUserRank = getCurrentUserRank(currentData)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">🏆 Lider Tablosu</h2>
          <p className="text-gray-600">
            Çalışma performansına göre sıralama
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex justify-center mb-6">
          <div className="bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('students')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'students'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Öğrenciler
            </button>
            <button
              onClick={() => setActiveTab('teachers')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'teachers'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Öğretmenler
            </button>
          </div>
        </div>

        {/* Current User Rank Highlight */}
        {currentUserRank && currentUserRank > 3 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center space-x-2">
              <span className="text-lg">🎯</span>
              <span className="font-medium text-blue-800">
                Sen {currentUserRank}. sıradasın!
              </span>
            </div>
          </div>
        )}

        {/* Leaderboard List */}
        <div className="space-y-3">
          {currentData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Henüz hiç {activeTab === 'students' ? 'öğrenci' : 'öğretmen'} yok.
            </div>
          ) : (
            currentData.map((entry, index) => {
              const rank = index + 1
              const isCurrentUser = profile?.id === entry.id
              const isTopThree = rank <= 3

              return (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                    isCurrentUser
                      ? 'bg-blue-50 border-blue-200'
                      : isTopThree
                      ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`text-xl font-bold w-12 text-center ${
                      isTopThree ? 'text-yellow-600' : 'text-gray-600'
                    }`}>
                      {getRankIcon(rank)}
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                        isTopThree
                          ? rank === 1
                            ? 'bg-yellow-500'
                            : rank === 2
                            ? 'bg-gray-400'
                            : 'bg-orange-500'
                          : 'bg-blue-500'
                      }`}>
                        {entry.first_name[0]}{entry.last_name[0]}
                      </div>

                      <div>
                        <div className="flex items-center space-x-2">
                          <span className={`font-medium ${
                            isCurrentUser ? 'text-blue-700' : 'text-gray-900'
                          }`}>
                            {entry.first_name} {entry.last_name}
                          </span>
                          {isCurrentUser && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Sen
                            </span>
                          )}
                        </div>
                        {activeTab === 'students' && entry.class_section && (
                          <div className="text-sm text-gray-600">
                            {entry.class_section}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={`text-xl font-bold ${
                    isTopThree ? 'text-yellow-600' : 'text-gray-900'
                  }`}>
                    {entry.total_points.toLocaleString()} puan
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Stats */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {currentData.length}
              </div>
              <div className="text-sm text-gray-600">
                Toplam {activeTab === 'students' ? 'Öğrenci' : 'Öğretmen'}
              </div>
            </div>

            <div>
              <div className="text-2xl font-bold text-green-600">
                {currentData[0]?.total_points || 0}
              </div>
              <div className="text-sm text-gray-600">
                Lider Puan
              </div>
            </div>

            <div>
              <div className="text-2xl font-bold text-purple-600">
                {currentData.reduce((sum, entry) => sum + entry.total_points, 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">
                Toplam Puan
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
