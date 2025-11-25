'use client'

import { useAuth } from '@/contexts/AuthContext'
import Button from './Button'

type Tab = 'timer' | 'chat' | 'leaderboard' | 'profile' | 'history' | 'teacher' | 'random'

interface NavigationProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

const tabs = [
  { id: 'timer' as Tab, label: 'Çalışma Timer', icon: '⏱️' },
  { id: 'chat' as Tab, label: 'Sohbet', icon: '💬' },
  { id: 'leaderboard' as Tab, label: 'Lider Tablosu', icon: '🏆' },
  { id: 'history' as Tab, label: 'Çalışma Geçmişi', icon: '📊' },
  { id: 'profile' as Tab, label: 'Profil', icon: '👤' },
]

const teacherTabs = [
  { id: 'teacher' as Tab, label: 'Öğrenci Yönetimi', icon: '👥' },
  { id: 'random' as Tab, label: 'Rastgele Seçme', icon: '🎲' },
]

export default function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const { profile, signOut } = useAuth()

  const allTabs = profile?.role === 'teacher' ? [...tabs, ...teacherTabs] : tabs

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900">HyperWorkChat</h1>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {allTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                    : 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* User Info & Actions */}
          <div className="flex items-center space-x-4">
            {profile && (
              <div className="hidden sm:flex items-center space-x-2">
                <span className="text-sm text-gray-700">
                  {profile.first_name} {profile.last_name}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  {profile.role === 'student' ? 'Öğrenci' : 'Öğretmen'}
                </span>
                <span className="text-sm text-gray-600">
                  {profile.total_points} puan
                </span>
              </div>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={signOut}
            >
              Çıkış
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-4">
          <div className="flex flex-wrap gap-2">
            {allTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                    : 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Mobile User Info */}
          {profile && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900">
                  {profile.first_name} {profile.last_name}
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {profile.role === 'student' ? 'Öğrenci' : 'Öğretmen'}
                </span>
              </div>
              <span className="text-sm text-gray-500">
                {profile.total_points} puan
              </span>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
