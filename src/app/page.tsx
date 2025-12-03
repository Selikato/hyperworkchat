'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import LandingPage from '@/components/LandingPage'
import Dashboard from '@/components/Dashboard'
import TestSupabase from '@/components/TestSupabase'

// Import supabase config check
let isSupabaseConfigured: (() => boolean) | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const supabaseModule = require('@/lib/supabase')
  isSupabaseConfigured = supabaseModule.isSupabaseConfigured
} catch (error) {
  console.error('Failed to import supabase config:', error)
}

export default function Home() {
  const { user, loading } = useAuth()
  const [supabaseReady, setSupabaseReady] = useState(false)

  useEffect(() => {
    if (isSupabaseConfigured) {
      setSupabaseReady(isSupabaseConfigured())
    } else {
      // If we can't check, assume it's configured
      setSupabaseReady(true)
    }
  }, [])

  if (!supabaseReady) {
  return (
      <div className="min-h-screen bg-gray-50 py-8">
        <TestSupabase />
        </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
    )
  }

  if (!user) {
    return <LandingPage />
  }

  return <Dashboard />
}
