'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Button from './Button'
import Card from './Card'
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
      <Card>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Card>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <div className="flex flex-col h-[600px]">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Genel Sohbet</h2>
            <p className="text-sm text-gray-600">
              Tüm kullanıcılarla mesajlaşabilirsiniz
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                Henüz hiç mesaj yok. İlk mesajı siz gönderin! 👋
              </div>
            ) : (
              messages.map((message) => {
                const isOwnMessage = message.user_id === user?.id
                const senderName = message.profiles
                  ? `${message.profiles.first_name} ${message.profiles.last_name}`
                  : 'Bilinmeyen Kullanıcı'
                const senderRole = message.profiles?.role === 'teacher' ? 'Öğretmen' : 'Öğrenci'

                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        isOwnMessage
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium">
                          {isOwnMessage ? 'Sen' : senderName}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          message.profiles?.role === 'teacher'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {senderRole}
                        </span>
                      </div>
                      <p className="text-sm">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        isOwnMessage ? 'text-blue-200' : 'text-gray-500'
                      }`}>
                        {formatTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="p-4 border-t border-gray-200">
            <form onSubmit={sendMessage} className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Mesajınızı yazın..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={500}
              />
              <Button
                type="submit"
                disabled={!newMessage.trim()}
              >
                Gönder
              </Button>
            </form>
            <p className="text-xs text-gray-500 mt-2">
              {newMessage.length}/500 karakter
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
