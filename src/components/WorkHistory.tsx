'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Card from './Card'
import { WorkSession } from '@/lib/database/types'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts'
import { format, subDays, eachDayOfInterval } from 'date-fns'
import { tr } from 'date-fns/locale'

interface WorkStats {
  totalSessions: number
  completedSessions: number
  totalMinutes: number
  totalPoints: number
  averageSessionLength: number
  completionRate: number
  bestStreak: number
  currentStreak: number
}

interface ChartData {
  date: string
  minutes: number
  points: number
  sessions: number
  day: string
}

interface WeeklyData {
  name: string
  minutes: number
  points: number
  sessions: number
}

interface DistributionData {
  name: string
  value: number
  color: string
  [key: string]: string | number | undefined
}

export default function WorkHistory() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<WorkSession[]>([])
  const [stats, setStats] = useState<WorkStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'completed' | 'incomplete'>('all')

  // Chart data states
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([])
  const [timeDistribution, setTimeDistribution] = useState<DistributionData[]>([])
  const [pointsTrend, setPointsTrend] = useState<ChartData[]>([])
  const [completionData, setCompletionData] = useState<DistributionData[]>([])

  useEffect(() => {
    if (!user) return

    const fetchWorkHistory = async () => {
      setLoading(true)

      // Mock sistemde work sessions'ları localStorage'dan yükle
      const storedSessions = localStorage.getItem(`work_sessions_${user.id}`)
      if (storedSessions) {
        try {
          const parsedSessions = JSON.parse(storedSessions)
          // En yeni olanları önce göster
          const sortedSessions = parsedSessions
            .sort((a: WorkSession, b: WorkSession) => 
              new Date(b.created_at || b.start_time).getTime() - new Date(a.created_at || a.start_time).getTime()
            )
            .slice(0, 100)
          
          setSessions(sortedSessions)
          calculateStats(sortedSessions)
          calculateChartData(sortedSessions)
          setLoading(false)
          return
        } catch (e) {
          console.warn('Error parsing mock work sessions, falling back to Supabase:', e)
        }
      }

      // Supabase'den yükle
      try {
        const { data, error } = await supabase
          .from('work_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100)

        if (error) {
          console.warn('Error fetching work history from Supabase:', error)
          setSessions([])
          calculateStats([])
          calculateChartData([])
        } else {
          setSessions(data || [])
          calculateStats(data || [])
          calculateChartData(data || [])
        }
      } catch (err) {
        console.warn('Unexpected error fetching work history:', err)
        setSessions([])
        calculateStats([])
        calculateChartData([])
      }

      setLoading(false)
    }

    fetchWorkHistory()
  }, [user])

  const calculateStats = (sessions: WorkSession[]) => {
    const completed = sessions.filter(s => s.is_completed)
    const totalMinutes = sessions.reduce((sum, s) => sum + s.actual_duration, 0)
    const totalPoints = sessions.reduce((sum, s) => sum + s.points_earned, 0)
    const averageLength = completed.length > 0 ? totalMinutes / completed.length : 0
    const completionRate = sessions.length > 0 ? (completed.length / sessions.length) * 100 : 0

    // Calculate streaks (simplified)
    let currentStreak = 0
    let bestStreak = 0
    let tempStreak = 0

    // Sort by date for streak calculation
    const sortedSessions = [...sessions].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    for (const session of sortedSessions) {
      if (session.is_completed) {
        tempStreak++
        bestStreak = Math.max(bestStreak, tempStreak)
      } else {
        tempStreak = 0
      }
    }

    // Calculate current streak (from most recent completed sessions)
    const recentSessions = sortedSessions.slice(-10) // Last 10 sessions
    for (let i = recentSessions.length - 1; i >= 0; i--) {
      if (recentSessions[i].is_completed) {
        currentStreak++
      } else {
        break
      }
    }

    setStats({
      totalSessions: sessions.length,
      completedSessions: completed.length,
      totalMinutes,
      totalPoints,
      averageSessionLength: averageLength,
      completionRate,
      bestStreak,
      currentStreak
    })
  }

  const calculateChartData = (sessions: WorkSession[]) => {
    // Weekly data for the last 7 days
    const last7Days = eachDayOfInterval({
      start: subDays(new Date(), 6),
      end: new Date()
    })

    const weeklyChartData: WeeklyData[] = last7Days.map(date => {
      const daySessions = sessions.filter(session => {
        const sessionDate = new Date(session.created_at)
        return sessionDate.toDateString() === date.toDateString()
      })

      return {
        name: format(date, 'EEE', { locale: tr }),
        minutes: daySessions.reduce((sum, s) => sum + s.actual_duration, 0),
        points: daySessions.reduce((sum, s) => sum + s.points_earned, 0),
        sessions: daySessions.length
      }
    })

    setWeeklyData(weeklyChartData)

    // Points trend (last 14 days)
    const last14Days = eachDayOfInterval({
      start: subDays(new Date(), 13),
      end: new Date()
    })

    const pointsTrendData: ChartData[] = last14Days.map(date => {
      const daySessions = sessions.filter(session => {
        const sessionDate = new Date(session.created_at)
        return sessionDate.toDateString() === date.toDateString()
      })

      return {
        date: format(date, 'dd/MM'),
        minutes: daySessions.reduce((sum, s) => sum + s.actual_duration, 0),
        points: daySessions.reduce((sum, s) => sum + s.points_earned, 0),
        sessions: daySessions.length,
        day: format(date, 'EEE', { locale: tr })
      }
    })

    setPointsTrend(pointsTrendData)

    // Time distribution by hour
    const hourDistribution: { [key: number]: number } = {}
    sessions.forEach(session => {
      const hour = new Date(session.created_at).getHours()
      hourDistribution[hour] = (hourDistribution[hour] || 0) + session.actual_duration
    })

    const timeDistributionData: DistributionData[] = Object.entries(hourDistribution)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([hour, minutes]) => ({
        name: `${hour}:00`,
        value: minutes,
        color: parseInt(hour) >= 6 && parseInt(hour) <= 18 ? '#3b82f6' : '#8b5cf6'
      }))

    setTimeDistribution(timeDistributionData)

    // Completion rate data
    const completed = sessions.filter(s => s.is_completed).length
    const incomplete = sessions.length - completed

    const completionData: DistributionData[] = [
      { name: 'Tamamlandı', value: completed, color: '#10b981' },
      { name: 'Tamamlanmadı', value: incomplete, color: '#ef4444' }
    ]

    setCompletionData(completionData)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}s ${mins}d`
    }
    return `${mins}d`
  }

  const getFilteredSessions = () => {
    switch (filter) {
      case 'completed':
        return sessions.filter(s => s.is_completed)
      case 'incomplete':
        return sessions.filter(s => !s.is_completed)
      default:
        return sessions
    }
  }

  const filteredSessions = getFilteredSessions()

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Card>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stats.totalSessions}
              </div>
              <div className="text-sm text-gray-600">Toplam Oturum</div>
            </div>
          </Card>

          <Card>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatDuration(stats.totalMinutes)}
              </div>
              <div className="text-sm text-gray-600">Toplam Süre</div>
            </div>
          </Card>

          <Card>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {stats.totalPoints}
              </div>
              <div className="text-sm text-gray-600">Kazanılan Puan</div>
            </div>
          </Card>

          <Card>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                %{Math.round(stats.completionRate)}
              </div>
              <div className="text-sm text-gray-600">Tamamlanma Oranı</div>
            </div>
          </Card>
        </div>
      )}

      {/* Charts Section */}
      {weeklyData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Weekly Activity Chart */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Haftalık Çalışma Grafiği</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => [
                    name === 'minutes' ? `${value} dakika` : `${value} puan`,
                    name === 'minutes' ? 'Çalışma Süresi' : 'Kazanılan Puan'
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="minutes"
                  stackId="1"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="points"
                  stackId="2"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Time Distribution */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Saatlik Çalışma Dağılımı</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={timeDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value) => [`${value} dakika`, 'Çalışma Süresi']}
                />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Points Trend */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Puan Trendi (14 Gün)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={pointsTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  formatter={(value) => [`${value} puan`, 'Kazanılan Puan']}
                />
                <Line
                  type="monotone"
                  dataKey="points"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Completion Rate */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tamamlanma Oranı</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={completionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(Number(percent) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {completionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Detailed Stats */}
      {stats && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Detaylı İstatistikler</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Tamamlanan Oturum:</span>
                <span className="font-medium">{stats.completedSessions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Ortalama Oturum Süresi:</span>
                <span className="font-medium">{formatDuration(Math.round(stats.averageSessionLength))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">En İyi Seri:</span>
                <span className="font-medium">{stats.bestStreak} oturum</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Mevcut Seri:</span>
                <span className="font-medium">{stats.currentStreak} oturum</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Ortalama Puan/Oturum:</span>
                <span className="font-medium">
                  {stats.totalSessions > 0 ? Math.round(stats.totalPoints / stats.totalSessions) : 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Bugünkü Oturum:</span>
                <span className="font-medium">
                  {sessions.filter(s => {
                    const today = new Date().toDateString()
                    return new Date(s.created_at).toDateString() === today
                  }).length}
                </span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Work Sessions History */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Çalışma Geçmişi</h3>

          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded text-sm font-medium ${
                filter === 'all'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Tümü ({sessions.length})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-3 py-1 rounded text-sm font-medium ${
                filter === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Tamamlanan ({sessions.filter(s => s.is_completed).length})
            </button>
            <button
              onClick={() => setFilter('incomplete')}
              className={`px-3 py-1 rounded text-sm font-medium ${
                filter === 'incomplete'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Tamamlanmayan ({sessions.filter(s => !s.is_completed).length})
            </button>
          </div>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {filter === 'all'
              ? 'Henüz hiç çalışma oturumu yok.'
              : `Hiç ${filter === 'completed' ? 'tamamlanan' : 'tamamlanmayan'} oturum bulunamadı.`
            }
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                className={`p-4 rounded-lg border ${
                  session.is_completed
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${
                      session.is_completed ? 'bg-green-500' : 'bg-red-500'
                    }`} />

                    <div>
                      <div className="font-medium text-gray-900">
                        {session.is_completed ? 'Tamamlandı' : 'Tamamlanmadı'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatDate(session.created_at)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-gray-600">
                      Süre: {formatDuration(session.actual_duration)}
                    </div>
                    <div className={`text-sm font-medium ${
                      session.points_earned > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {session.points_earned > 0 ? '+' : ''}{session.points_earned} puan
                    </div>
                  </div>
                </div>

                {session.was_paused && (
                  <div className="mt-2 text-xs text-yellow-600 bg-yellow-50 p-2 rounded">
                    ⚠️ Bu oturumda duraklama yapıldı
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
