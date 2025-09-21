'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function TestSupabase() {
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'success' | 'error'>('testing')
  const [tables, setTables] = useState<{ name: string; exists: boolean; error?: string }[]>([])
  const [error, setError] = useState<string>('')

  useEffect(() => {
    testConnection()
  }, [])

  const testConnection = async () => {
    try {
      setConnectionStatus('testing')

      // Test basic connection
      const { data, error: connectionError } = await supabase
        .from('profiles')
        .select('count')
        .limit(1)

      console.log('Basic connection test:', { data, error: connectionError })

      if (connectionError) {
        throw connectionError
      }

      // Test tables
      const { data: tableData, error: tableError } = await supabase.rpc('get_table_list')

      if (tableError) {
        // Alternative: check specific tables
        const tablesToCheck = ['profiles', 'work_sessions', 'messages', 'selected_students']
        const tableResults = []

        for (const tableName of tablesToCheck) {
          try {
            const { error: tableCheckError } = await supabase
              .from(tableName)
              .select('*')
              .limit(1)

            tableResults.push({
              name: tableName,
              exists: !tableCheckError,
              error: tableCheckError?.message
            })
          } catch {
            tableResults.push({
              name: tableName,
              exists: false,
              error: 'Table check failed'
            })
          }
        }

        setTables(tableResults)
      } else {
        setTables(tableData || [])
      }

      setConnectionStatus('success')
    } catch (err: unknown) {
      setConnectionStatus('error')
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Supabase test error:', err)
    }
  }

  const createTables = async () => {
    try {
      setError('')
      alert('Lütfen Supabase SQL Editor&apos;da schema.sql dosyasının içeriğini çalıştırın.')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`Hata: ${errorMessage}`)
    }
  }

  const createTestUser = async () => {
    try {
      setError('')

      // Önce basit bir auth testi yap
      const { data: sessionData } = await supabase.auth.getSession()
      console.log('Current session:', sessionData)

      // Test kullanıcısı oluştur
      const testEmail = `test${Date.now()}@example.com`
      console.log('Creating user with email:', testEmail)

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: testEmail,
        password: 'TestPassword123!'
      })

      console.log('Auth response:', { data: authData, error: authError })

      if (authError) {
        setError(`Auth hatası: ${authError.message}`)
        console.error('Auth error details:', authError)
        return
      }

      if (authData.user) {
        alert(`✅ Kullanıcı oluşturuldu!\nEmail: ${authData.user.email}\nID: ${authData.user.id}`.replace(/'/g, '&apos;').replace(/"/g, '&quot;'))

        // Profil oluşturmayı dene
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            first_name: 'Test',
            last_name: 'User',
            role: 'student'
          })

        console.log('Profile creation result:', { error: profileError })

        if (profileError) {
          setError(`Profil hatası: ${profileError.message}`)
        } else {
          alert('✅ Profil başarıyla oluşturuldu!')
          testConnection()
        }
      } else {
        setError('Auth başarılı ama kullanıcı verisi yok')
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`Beklenmeyen hata: ${errorMessage}`)
      console.error('Unexpected error:', err)
    }
  }

  const testAuth = async () => {
    try {
      setError('')
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        setError(`Auth testi başarısız: ${error.message}`)
      } else {
        alert(`Auth testi başarılı! Kullanıcı: ${data.session?.user?.email || 'Misafir'}`)
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`Auth testi hatası: ${errorMessage}`)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">🔧 Supabase Bağlantı Testi</h2>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Bağlantı Durumu:</h3>
        <div className={`p-3 rounded-lg ${
          connectionStatus === 'success' ? 'bg-green-100 text-green-800' :
          connectionStatus === 'error' ? 'bg-red-100 text-red-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {connectionStatus === 'testing' && '🔄 Bağlantı test ediliyor...'}
          {connectionStatus === 'success' && '✅ Bağlantı başarılı!'}
          {connectionStatus === 'error' && `❌ Bağlantı hatası: ${error}`}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Tablo Durumları:</h3>
        {tables.length > 0 ? (
          <div className="space-y-2">
            {tables.map((table, index) => (
              <div key={index} className={`p-3 rounded-lg ${
                table.exists ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{table.name}</span>
                  <span className={table.exists ? 'text-green-600' : 'text-red-600'}>
                    {table.exists ? '✅ Var' : '❌ Yok'}
                  </span>
                </div>
                {table.error && (
                  <div className="text-sm text-red-600 mt-1">
                    Hata: {table.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">Tablo bilgileri yükleniyor...</p>
        )}
      </div>

      <div className="space-y-3">
        <button
          onClick={testConnection}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          🔄 Bağlantıyı Tekrar Test Et
        </button>

        <button
          onClick={createTestUser}
          className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          👤 Test Kullanıcı + Profil Oluştur
        </button>

        <button
          onClick={testAuth}
          className="w-full bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          🔐 Auth Sistemini Test Et
        </button>

        <button
          onClick={createTables}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          🛠️ Tabloları Oluştur (SQL Editor&apos;da)
        </button>
      </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-2">📋 Email Confirmation&apos;ı Kapatma:</h4>

          <div className="space-y-3">
            <div>
              <h5 className="font-medium text-blue-800">Yöntem 1 - Dashboard&apos;dan:</h5>
              <ol className="text-sm text-blue-700 ml-4 space-y-1">
                <li>1. Sol menüden <strong>&quot;Authentication&quot;</strong> tıklayın</li>
                <li>2. Üstte <strong>&quot;Settings&quot;</strong> sekmesine tıklayın</li>
                <li>3. <strong>&quot;User Signups&quot;</strong> bölümünü bulun</li>
                <li>4. <strong>&quot;Enable email confirmations&quot;</strong> toggle&apos;ını kapatın</li>
                <li>5. <strong>&quot;Save changes&quot;</strong> butonuna tıklayın</li>
              </ol>
            </div>

            <div>
              <h5 className="font-medium text-blue-800">Yöntem 2 - Alternatif Yol:</h5>
              <ol className="text-sm text-blue-700 ml-4 space-y-1">
                <li>1. Sol menüden <strong>&quot;Settings&quot;</strong> (çark ikonu) tıklayın</li>
                <li>2. <strong>&quot;Authentication&quot;</strong> sekmesine tıklayın</li>
                <li>3. <strong>&quot;Email Confirmations&quot;</strong> toggle&apos;ını kapatın</li>
                <li>4. Değişiklikleri kaydedin</li>
              </ol>
            </div>

            <div>
              <h5 className="font-medium text-blue-800">Yöntem 3 - API ile:</h5>
              <p className="text-sm text-blue-700 ml-4">
                Supabase CLI kullanıyorsanız: <code>supabase auth update --enable-email-confirmations false</code>
              </p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-red-50 rounded border border-red-200">
            <h5 className="font-medium text-red-900 mb-1">🚨 Kritik Sorun: Email Confirmation Açık!</h5>
            <p className="text-xs text-red-800 mb-2">
              <strong>Sign In sekmesindeki &quot;Confirm email&quot; hala açık!</strong> Mutlaka kapatın.
            </p>
            <div className="text-xs text-red-700">
              <strong>Yapılacaklar:</strong>
              <ol className="ml-4 mt-1 space-y-1">
                <li>1. Supabase Dashboard → Authentication → Sign In</li>
                <li>2. &quot;Confirm email&quot; toggle&apos;ını kapatın (off yapın)</li>
                <li>3. &quot;Save&quot; butonuna tıklayın</li>
                <li>4. Sayfayı yenileyin ve tekrar deneyin</li>
              </ol>
            </div>
          </div>

          <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-200">
            <h5 className="font-medium text-yellow-900 mb-1">🔄 Alternatif: Yeni Kullanıcı Oluştur</h5>
            <p className="text-xs text-yellow-800">
              Eğer hala çalışmazsa, yeni bir email ile kayıt olun (örnek: test2@example.com).
              Eski kullanıcılar email confirmation ile kaydedildiği için giriş yapamaz.
            </p>
          </div>

        <div className="mt-4 p-3 bg-yellow-50 rounded">
          <h5 className="font-medium text-yellow-900 mb-1">🎯 Test SQL Komutları:</h5>

          <div className="space-y-2">
            <div>
              <strong className="text-xs text-yellow-900">Seçenek 1 - Manuel UUID:</strong>
              <code className="text-xs text-yellow-800 block mt-1">
                INSERT INTO profiles (id, first_name, last_name, role) <br/>
                VALUES (&apos;550e8400-e29b-41d4-a716-446655440000&apos;, &apos;Test&apos;, &apos;User&apos;, &apos;student&apos;)<br/>
                ON CONFLICT (id) DO NOTHING;
              </code>
            </div>

            <div>
              <strong className="text-xs text-yellow-900">Seçenek 2 - Rastgele UUID:</strong>
              <code className="text-xs text-yellow-800 block mt-1">
                INSERT INTO profiles (id, first_name, last_name, role) <br/>
                VALUES (gen_random_uuid(), &apos;Test&apos;, &apos;User&apos;, &apos;student&apos;)<br/>
                ON CONFLICT (id) DO NOTHING;
              </code>
            </div>

            <div>
              <strong className="text-xs text-yellow-900">Seçenek 3 - Gerçek Kullanıcı ID&apos;si:</strong>
              <div className="text-xs text-yellow-800 mt-1">
                <div className="mb-2">
                  <strong>Adım 1:</strong> Mevcut kullanıcıları kontrol et<br/>
                  <code className="block bg-yellow-100 p-1 rounded mt-1">
                    SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC;
                  </code>
                </div>
                <div className="mb-2">
                  <strong>Adım 2:</strong> Eğer kullanıcı varsa ID&apos;yi kullan<br/>
                  <code className="block bg-yellow-100 p-1 rounded mt-1">
                    INSERT INTO profiles (id, first_name, last_name, role)<br/>
                    VALUES (&apos;[buraya-user-id-yaz]&apos;, &apos;Test&apos;, &apos;User&apos;, &apos;student&apos;)<br/>
                    ON CONFLICT (id) DO NOTHING;
                  </code>
                </div>
                <div className="mb-2">
                  <strong>Adım 3:</strong> Eğer hiç kullanıcı yoksa<br/>
                  <code className="block bg-yellow-100 p-1 rounded mt-1">
                    -- Bu seçeneği kullan: gen_random_uuid()
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
