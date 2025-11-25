'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Navigation from './Navigation'
import PomodoroTimer from './PomodoroTimer'
import Chat from './Chat'
import Leaderboard from './Leaderboard'
import Profile from './Profile'
import WorkHistory from './WorkHistory'
import TeacherPanel from './TeacherPanel'
import RandomStudentPicker from './RandomStudentPicker'
type Tab = 'timer' | 'chat' | 'leaderboard' | 'profile' | 'history' | 'teacher' | 'random'

export default function Dashboard() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('timer')

  const renderTab = () => {
    switch (activeTab) {
      case 'timer':
        return <PomodoroTimer />
      case 'chat':
        return <Chat />
      case 'leaderboard':
        return <Leaderboard />
      case 'profile':
        return <Profile />
      case 'history':
        return <WorkHistory />
      case 'teacher':
        return profile?.role === 'teacher' ? <TeacherPanel /> : <PomodoroTimer />
      case 'random':
        return <RandomStudentPicker />
      default:
        return <PomodoroTimer />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderTab()}
      </main>
    </div>
  )
}
