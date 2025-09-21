'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Button from './Button'
import { Message } from '@/lib/database/types'

export default function Chat() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<(Message & { profiles?: { first_name: string; last_name: string; role: string } })[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Load initial messages
  useEffect(() => {
    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          profiles:user_id (
            first_name,
            last_name,
            role
          )
        `)
        .order('created_at', { ascending: true })
        .limit(50)

      if (error) {
        console.error('Error loading messages:', error)
      } else {
        setMessages(data || [])
      }
      setLoading(false)
    }

    loadMessages()
  }, [])

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        async (payload) => {
          // Fetch the complete message with profile info
          const { data, error } = await supabase
            .from('messages')
            .select(`
              *,
              profiles:user_id (
                first_name,
                last_name,
                role
              )
            `)
            .eq('id', payload.new.id)
            .single()

          if (!error && data) {
            setMessages(prev => [...prev, data])
            scrollToBottom()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newMessage.trim()) return

    const { error } = await supabase
      .from('messages')
      .insert({
        user_id: user.id,
        content: newMessage.trim()
      })

    if (!error) {
      setNewMessage('')
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg border border-purple-200 p-6">
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        <div className="flex flex-col h-[600px] bg-gray-50">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-white">
            <h2 className="text-lg font-semibold text-gray-900">💬 Genel Sohbet</h2>
            <p className="text-sm text-gray-600">
              Tüm kullanıcılarla mesajlaşabilirsiniz
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-white">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <div className="text-4xl mb-2">💭</div>
                Henüz hiç mesaj yok. İlk mesajı siz gönderin!
              </div>
            ) : (
              messages.map((message, index) => {
                const isOwnMessage = message.user_id === user?.id
                const senderName = message.profiles
                  ? `${message.profiles.first_name} ${message.profiles.last_name}`
                  : 'Bilinmeyen Kullanıcı'
                const senderRole = message.profiles?.role === 'teacher' ? '👨‍🏫' : '👨‍🎓'
                const isTeacher = message.profiles?.role === 'teacher'

                // Grup mesajları için aynı kişiden ardışık mesajları kontrol et
                const previousMessage = index > 0 ? messages[index - 1] : null
                const showSenderInfo = !previousMessage || previousMessage.user_id !== message.user_id

                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-1`}
                  >
                    <div className={`flex items-end space-x-2 max-w-[85%] ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      {/* Avatar - sadece ilk mesajda göster */}
                      {showSenderInfo && !isOwnMessage && (
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          isTeacher ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                        }`}>
                          {senderName.charAt(0).toUpperCase()}
                        </div>
                      )}

                      {/* Mesaj baloncuğu */}
                      <div className="flex flex-col">
                        {/* Gönderen bilgisi - sadece ilk mesajda */}
                        {showSenderInfo && (
                          <div className={`text-xs text-gray-600 mb-1 px-2 ${isOwnMessage ? 'text-right' : 'text-left'}`}>
                            <span className="font-medium">{isOwnMessage ? 'Sen' : senderName}</span>
                            <span className="ml-1">{senderRole}</span>
                          </div>
                        )}

                        {/* Mesaj içeriği */}
                        <div
                          className={`relative px-4 py-2 max-w-xs lg:max-w-md shadow-sm ${
                            isOwnMessage
                              ? 'bg-green-500 text-white rounded-l-2xl rounded-tr-2xl rounded-br-md'
                              : 'bg-white text-gray-900 rounded-r-2xl rounded-tl-2xl rounded-bl-md border border-gray-200'
                          }`}
                        >
                          <p className="text-sm break-words">{message.content}</p>

                          {/* Zaman damgası */}
                          <div className={`text-xs mt-1 ${
                            isOwnMessage ? 'text-green-100' : 'text-gray-500'
                          }`}>
                            {formatTime(message.created_at)}
                          </div>

                          {/* Mesaj kuyruğu (WhatsApp stili) */}
                          <div className={`absolute bottom-0 ${
                            isOwnMessage
                              ? 'right-0 transform rotate-45 translate-x-1 translate-y-1 w-3 h-3 bg-green-500'
                              : 'left-0 transform -rotate-45 -translate-x-1 translate-y-1 w-3 h-3 bg-white border-l border-b border-gray-200'
                          }`} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="p-4 border-t border-purple-200 bg-white">
            <form onSubmit={sendMessage} className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Mesajınızı yazın..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50"
                maxLength={500}
              />
              <Button
                type="submit"
                disabled={!newMessage.trim()}
                variant="secondary"
                className="rounded-full px-6 py-3"
              >
                📤
              </Button>
            </form>
            <p className="text-xs text-gray-500 mt-2 text-center">
              {newMessage.length}/500 karakter
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
