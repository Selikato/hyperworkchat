'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import LandingPage from '@/components/LandingPage'
import Dashboard from '@/components/Dashboard'

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Supabase Yapılandırma Hatası</h2>
            <p className="text-gray-600 mb-4">
              Supabase bağlantısı kurulamadı. Lütfen .env.local dosyanızı kontrol edin.
            </p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <h3 className="font-medium text-gray-900 mb-2">Gerekli Değişkenler:</h3>
            <div className="text-left text-sm text-gray-600 space-y-1">
              <div><code className="bg-gray-100 px-1 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_URL</code></div>
              <div><code className="bg-gray-100 px-1 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code></div>
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Sayfayı Yenile
            </button>
          </div>
        </div>
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
