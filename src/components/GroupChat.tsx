'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Card from './Card'
import Button from './Button'
import { Group, GroupMessage, Profile } from '@/lib/database/types'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

interface GroupChatProps {
  className?: string
}

export default function GroupChat({ className }: GroupChatProps) {
  const { user, profile } = useAuth()
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDescription, setNewGroupDescription] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch groups for user's class
  useEffect(() => {
    if (!profile) return

    const fetchGroups = async () => {
      try {
        let query = supabase
          .from('groups')
          .select(`
            *,
            creator_profile:created_by (
              first_name,
              last_name,
              role
            )
          `)
          .order('created_at', { ascending: false })

        // If student, only show groups for their class
        if (profile.role === 'student' && profile.class_section) {
          query = query.eq('class_section', profile.class_section)
        }
        // If teacher, show all groups they created or can access

        const { data, error } = await query

        if (error) {
          console.error('Error fetching groups:', error)
        } else {
          setGroups(data || [])
        }
      } catch (err) {
        console.error('Error fetching groups:', err)
      }
    }

    fetchGroups()
  }, [profile])

  // Fetch messages for selected group
  useEffect(() => {
    if (!selectedGroup) {
      setMessages([])
      return
    }

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('group_messages')
        .select(`
          *,
          user_profile:user_id (
            first_name,
            last_name,
            role
          )
        `)
        .eq('group_id', selectedGroup.id)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching messages:', error)
      } else {
        setMessages(data || [])
      }
    }

    fetchMessages()

    // Set up realtime subscription
    const subscription = supabase
      .channel(`group_messages_${selectedGroup.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'group_messages',
        filter: `group_id=eq.${selectedGroup.id}`
      }, (payload) => {
        console.log('New group message:', payload)
        // Fetch the new message with user profile
        supabase
          .from('group_messages')
          .select(`
            *,
            user_profile:user_id (
              first_name,
              last_name,
              role
            )
          `)
          .eq('id', payload.new.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setMessages(prev => [...prev, data])
            }
          })
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [selectedGroup])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const createGroup = async () => {
    if (!user || !profile || !newGroupName.trim()) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('groups')
        .insert({
          name: newGroupName.trim(),
          description: newGroupDescription.trim() || null,
          class_section: profile.class_section || '',
          created_by: user.id
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating group:', error)
        alert('Grup oluşturma hatası: ' + error.message)
      } else {
        // Add current user as member
        await supabase
          .from('group_members')
          .insert({
            group_id: data.id,
            user_id: user.id
          })

        // Add all students from the class as members (if teacher)
        if (profile.role === 'teacher' && profile.class_section) {
          const { data: students } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'student')
            .eq('class_section', profile.class_section)

          if (students && students.length > 0) {
            const memberInserts = students.map(student => ({
              group_id: data.id,
              user_id: student.id
            }))

            await supabase
              .from('group_members')
              .insert(memberInserts)
          }
        }

        setGroups(prev => [data, ...prev])
        setNewGroupName('')
        setNewGroupDescription('')
        setShowCreateGroup(false)
      }
    } catch (err) {
      console.error('Error creating group:', err)
      alert('Grup oluşturma hatası')
    }
    setLoading(false)
  }

  const sendMessage = async () => {
    if (!user || !selectedGroup || !newMessage.trim()) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('group_messages')
        .insert({
          group_id: selectedGroup.id,
          user_id: user.id,
          content: newMessage.trim()
        })

      if (error) {
        console.error('Error sending message:', error)
        alert('Mesaj gönderme hatası: ' + error.message)
      } else {
        setNewMessage('')
      }
    } catch (err) {
      console.error('Error sending message:', err)
      alert('Mesaj gönderme hatası')
    }
    setLoading(false)
  }

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return format(date, 'HH:mm', { locale: tr })
    } else {
      return format(date, 'dd/MM HH:mm', { locale: tr })
    }
  }

  if (!profile) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-gray-600">Grup sohbetlerine erişmek için giriş yapın.</p>
        </div>
      </Card>
    )
  }

  return (
    <div className={`max-w-6xl mx-auto space-y-6 ${className}`}>
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">👥 Grup Sohbetleri</h2>
            <p className="text-gray-600 mt-1">
              {profile.role === 'teacher'
                ? 'Sınıfınız için grup sohbetleri oluşturun ve yönetin'
                : 'Sınıf grubunuzda arkadaşlarınızla sohbet edin'
              }
            </p>
          </div>

          {profile.role === 'teacher' && (
            <Button
              onClick={() => setShowCreateGroup(!showCreateGroup)}
              variant="secondary"
            >
              {showCreateGroup ? 'İptal' : '+ Yeni Grup'}
            </Button>
          )}
        </div>

        {/* Create Group Form */}
        {showCreateGroup && profile.role === 'teacher' && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Yeni Grup Oluştur</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grup Adı *
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="örn: 6/A Sınıfı Grubu"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Açıklama (İsteğe bağlı)
                </label>
                <textarea
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  placeholder="Grup hakkında kısa bir açıklama..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <Button
                  onClick={() => setShowCreateGroup(false)}
                  variant="secondary"
                >
                  İptal
                </Button>
                <Button
                  onClick={createGroup}
                  disabled={loading || !newGroupName.trim()}
                >
                  {loading ? 'Oluşturuluyor...' : 'Grup Oluştur'}
                </Button>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Groups List */}
          <div className="lg:col-span-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Gruplar</h3>
            <div className="space-y-3">
              {groups.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {profile.role === 'teacher'
                    ? 'Henüz hiç grup oluşturmadınız.'
                    : 'Sınıfınız için henüz grup oluşturulmamış.'
                  }
                </div>
              ) : (
                groups.map((group) => (
                  <div
                    key={group.id}
                    onClick={() => setSelectedGroup(group)}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedGroup?.id === group.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                        👥
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">
                          {group.name}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {group.class_section}
                        </p>
                        {group.description && (
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            {group.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-2">
            {selectedGroup ? (
              <div className="h-[600px] flex flex-col">
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                      👥
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {selectedGroup.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {selectedGroup.class_section} • {messages.length} mesaj
                      </p>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Bu grupta henüz hiç mesaj yok. İlk mesajı siz gönderin! 💬
                    </div>
                  ) : (
                    messages.map((message) => {
                      const isOwnMessage = message.user_id === user?.id
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-xs lg:max-w-md ${
                            isOwnMessage ? 'order-2' : 'order-1'
                          }`}>
                            {!isOwnMessage && (
                              <div className="flex items-center space-x-2 mb-1">
                                <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-xs font-medium">
                                  {message.user_profile?.first_name[0]}{message.user_profile?.last_name[0]}
                                </div>
                                <span className="text-xs font-medium text-gray-700">
                                  {message.user_profile?.first_name} {message.user_profile?.last_name}
                                </span>
                              </div>
                            )}
                            <div className={`p-3 rounded-2xl ${
                              isOwnMessage
                                ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                                : 'bg-gray-200 text-gray-900'
                            }`}>
                              <p className="text-sm">{message.content}</p>
                            </div>
                            <div className={`text-xs text-gray-500 mt-1 ${
                              isOwnMessage ? 'text-right' : 'text-left'
                            }`}>
                              {formatMessageTime(message.created_at)}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="p-4 border-t border-gray-200 rounded-b-lg bg-gray-50">
                  <div className="flex space-x-3">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Mesajınızı yazın..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={loading}
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={loading || !newMessage.trim()}
                      className="px-6 py-2 rounded-full"
                    >
                      {loading ? '...' : 'Gönder'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-[600px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
                    💬
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Grup Seçin
                  </h3>
                  <p className="text-gray-600">
                    Sohbet etmek için soldaki listeden bir grup seçin.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
