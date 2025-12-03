'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Button from './Button'
import { Message, Group, GroupMessage } from '@/lib/database/types'

interface UserWithProfile {
  id: string
  first_name: string
  last_name: string
  role: 'student' | 'teacher'
  class_section?: string | null
}

export default function Chat() {
  const { user, profile } = useAuth()
  const [selectedUser, setSelectedUser] = useState<UserWithProfile | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [users, setUsers] = useState<UserWithProfile[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [messages, setMessages] = useState<(Message & { profiles?: { first_name: string; last_name: string; role: string } })[]>([])
  const [groupMessages, setGroupMessages] = useState<(GroupMessage & { user_profile?: { first_name: string; last_name: string; role: string } })[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [chatMode, setChatMode] = useState<'dm' | 'group'>('dm')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const MESSAGES_PER_LOAD = 20 // Her seferinde 20 mesaj yükle
  const [userProfiles, setUserProfiles] = useState<Map<string, { first_name: string; last_name: string; role: string }>>(new Map())

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Cache user profiles to avoid repeated queries
  const cacheUserProfiles = useCallback(async (userIds: string[]) => {
    const uncachedIds = userIds.filter(id => !userProfiles.has(id))
    if (uncachedIds.length === 0) return

    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, role')
      .in('id', uncachedIds)

    if (!error && data) {
      setUserProfiles(prev => {
        const newMap = new Map(prev)
        data.forEach(profile => {
          newMap.set(profile.id, {
            first_name: profile.first_name,
            last_name: profile.last_name,
            role: profile.role
          })
        })
        return newMap
      })
    }
  }, [userProfiles])

  // Grup mesajlarını yükle
  const fetchGroupMessages = useCallback(async (groupId: string) => {
    try {
      const { data, error } = await supabase
        .from('group_messages')
        .select(`
          *,
          user_profile:profiles!group_messages_user_id_fkey (
            first_name,
            last_name,
            role
          )
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PER_LOAD)

      if (error) {
        console.error('Error fetching group messages:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in fetchGroupMessages:', error)
      return []
    }
  }, [])

  // Grupları yükle
  useEffect(() => {
    if (!user || !profile) return

    const fetchGroups = async () => {
      setLoadingGroups(true)
      try {
        const { data, error } = await supabase
          .from('group_members')
          .select(`
            group_id,
            groups!group_members_group_id_fkey (
              id,
              name,
              description,
              class_section,
              created_by,
              created_at,
              updated_at,
              creator_profile:profiles!groups_created_by_fkey (
                first_name,
                last_name,
                role
              )
            )
          `)
          .eq('user_id', user.id)

        if (error) {
          console.error('Error fetching groups:', error)
        } else {
          const groupData = data?.map(item => item.groups).filter(Boolean) || []
          setGroups(groupData)
        }
      } catch (error) {
        console.error('Error in fetchGroups:', error)
      } finally {
        setLoadingGroups(false)
      }
    }

    fetchGroups()
  }, [user, profile])

  // Load all users except current user
  useEffect(() => {
    const loadUsers = async () => {
      // Mock sistemde kullanıcıları localStorage'dan yükle
      const mockUsers = localStorage.getItem('mockUsers')
      if (mockUsers) {
        try {
          const parsedUsers = JSON.parse(mockUsers)
          // Kendimiz hariç diğer kullanıcıları filtrele
          const otherUsers = parsedUsers
            .filter((u: { id: string }) => u.id !== user?.id)
            .map((u: { id: string; firstName: string; lastName: string; role: string; classSection: string }) => ({
              id: u.id,
              first_name: u.firstName,
              last_name: u.lastName,
              role: u.role,
              class_section: u.classSection
            }))
            .sort((a: { first_name: string }, b: { first_name: string }) => a.first_name.localeCompare(b.first_name))

          setUsers(otherUsers)
          setLoadingUsers(false)
          return
        } catch (e) {
          console.warn('Error parsing mock users, falling back to Supabase:', e)
        }
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .neq('id', user?.id)
          .order('first_name', { ascending: true })

        if (error) {
          // Supabase hatası alırsak (örn: tablo yoksa) sessizce geç
          console.warn('Error loading users from Supabase:', error)
          setUsers([])
        } else {
          setUsers(data || [])
        }
      } catch (err) {
        console.warn('Unexpected error loading users:', err)
        setUsers([])
      }
      setLoadingUsers(false)
    }

    if (user) {
      loadUsers()
    }
  }, [user])

  // Load messages for selected user
  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedUser) {
        setMessages([])
        setLoading(false)
        return
      }

      // Mock sistemde mesajları localStorage'dan yükle
      const storedMessages = localStorage.getItem(`messages_${user?.id}_${selectedUser.id}`)
      if (storedMessages) {
        try {
          const parsedMessages = JSON.parse(storedMessages)
          setMessages(parsedMessages)
          setLoading(false)
          setTimeout(scrollToBottom, 100)
          return
        } catch (e) {
          console.warn('Error parsing mock messages:', e)
        }
      }

      try {
        // First load messages without profiles (faster)
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .not('receiver_id', 'is', null) // Sadece receiver_id null olmayan mesajları al
          .or(`and(user_id.eq.${user?.id},receiver_id.eq.${selectedUser.id}),and(user_id.eq.${selectedUser.id},receiver_id.eq.${user?.id})`)
          .order('created_at', { ascending: false })
          .limit(MESSAGES_PER_LOAD)

        if (error) {
          console.warn('Error loading messages from DB:', error)
          setLoading(false)
          // DB hatası varsa boş liste ile devam et
          return
        }

        if (data && data.length > 0) {
          // Cache user profiles for better performance
          const userIds = [...new Set(data.map(msg => msg.user_id))]
          await cacheUserProfiles(userIds)

          // Add profile data from cache
          const messagesWithProfiles = data.map(msg => ({
            ...msg,
            profiles: userProfiles.get(msg.user_id) || { first_name: '', last_name: '', role: '' }
          }))

          // Reverse to show chronological order (oldest first)
          setMessages(messagesWithProfiles.reverse())
          setHasMoreMessages(data.length === MESSAGES_PER_LOAD)
        } else {
          setMessages([])
          setHasMoreMessages(false)
        }
      } catch (err) {
        console.warn('Unexpected error loading messages:', err)
        setMessages([])
      }

      setLoading(false)
      // Scroll to bottom after initial load
      setTimeout(scrollToBottom, 100)
    }

    loadMessages()
  }, [selectedUser, user?.id, MESSAGES_PER_LOAD, scrollToBottom, cacheUserProfiles, userProfiles])

  // Load more messages for infinite scrolling
  const loadMoreMessages = useCallback(async () => {
    if (!hasMoreMessages || loadingMore || messages.length === 0 || !selectedUser) return

    setLoadingMore(true)
    const oldestMessage = messages[0] // First message is the oldest

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .not('receiver_id', 'is', null) // Sadece receiver_id null olmayan mesajları al
      .or(`and(user_id.eq.${user?.id},receiver_id.eq.${selectedUser.id}),and(user_id.eq.${selectedUser.id},receiver_id.eq.${user?.id})`)
      .order('created_at', { ascending: false })
      .lt('created_at', oldestMessage.created_at)
      .limit(MESSAGES_PER_LOAD)

    if (error) {
      console.error('Error loading more messages:', error)
    } else {
      if (data && data.length > 0) {
        // Cache user profiles for new messages
        const userIds = [...new Set(data.map(msg => msg.user_id))]
        await cacheUserProfiles(userIds)

        // Add profile data from cache
        const messagesWithProfiles = data.map(msg => ({
          ...msg,
          profiles: userProfiles.get(msg.user_id) || { first_name: '', last_name: '', role: '' }
        }))

        // Add older messages to the beginning
        setMessages(prev => [...messagesWithProfiles.reverse(), ...prev])
        setHasMoreMessages(data.length === MESSAGES_PER_LOAD)
      } else {
        setHasMoreMessages(false)
      }
    }
    setLoadingMore(false)
  }, [hasMoreMessages, loadingMore, messages, MESSAGES_PER_LOAD, selectedUser, user?.id, cacheUserProfiles, userProfiles])

  // Handle scroll to load more messages
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget
    if (element.scrollTop === 0 && hasMoreMessages && !loadingMore) {
      loadMoreMessages()
    }
  }, [hasMoreMessages, loadingMore, loadMoreMessages])

  // WhatsApp style: No pagination, just show recent messages
  // Old messages are automatically cleaned up by database triggers

  // Set up realtime subscription for selected user
  useEffect(() => {
    if (!selectedUser) return

    const channel = supabase
      .channel(`messages-${selectedUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        async (payload) => {
          // Check if the message is between current user and selected user
          const message = payload.new
          if ((message.user_id === user?.id && message.receiver_id === selectedUser.id) ||
              (message.user_id === selectedUser.id && message.receiver_id === user?.id)) {

            // Cache user profile if not already cached
            await cacheUserProfiles([message.user_id])

            setMessages(prev => {
              // Only add if not already exists (prevent duplicates)
              const exists = prev.some(msg => msg.id === message.id)
              if (exists) return prev

              // Replace any optimistic message with the real one
              const filteredMessages = prev.filter(msg => msg.id !== `temp-${Date.now()}` && !msg.id.startsWith('temp-'))

              const newMessages = [...filteredMessages, {
                id: message.id,
                user_id: message.user_id,
                receiver_id: message.receiver_id,
                content: message.content,
                created_at: message.created_at,
                profiles: userProfiles.get(message.user_id) || { first_name: '', last_name: '', role: '' }
              } as Message & { profiles?: { first_name: string; last_name: string; role: string } }]
              return newMessages
            })
            // Scroll to bottom after new message
            setTimeout(scrollToBottom, 100)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedUser, user?.id, scrollToBottom, cacheUserProfiles, userProfiles])

  // Scroll logic is handled in realtime subscription and sendMessage

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !selectedUser || !newMessage.trim()) return

    const messageContent = newMessage.trim()

    // Optimistically add message to local state immediately
    const optimisticMessage = {
      id: `temp-${Date.now()}`, // Temporary ID
      user_id: user.id,
      receiver_id: selectedUser.id,
      content: messageContent,
      created_at: new Date().toISOString(),
      profiles: { first_name: user.user_metadata?.first_name || '', last_name: user.user_metadata?.last_name || '', role: user.user_metadata?.role || 'student' }
    } as Message & { profiles?: { first_name: string; last_name: string; role: string } }

    setMessages(prev => [...prev, optimisticMessage])
    setNewMessage('')

    // Scroll to bottom immediately
    setTimeout(scrollToBottom, 100)

    // Send to database
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          user_id: user.id,
          receiver_id: selectedUser.id,
          content: messageContent
        })

      if (error) {
        console.warn('Error sending message to DB:', error)
        // DB hatası olsa bile optimistic update ile devam ediyoruz,
        // ama mock sistem için localStorage'a da kaydedelim
        const storedMessages = JSON.parse(localStorage.getItem(`messages_${user.id}_${selectedUser.id}`) || '[]')
        storedMessages.push(optimisticMessage)
        localStorage.setItem(`messages_${user.id}_${selectedUser.id}`, JSON.stringify(storedMessages))
        
        // Karşı taraf için de kaydedelim (mock sistemde chatleşebilmek için)
        const reverseStoredMessages = JSON.parse(localStorage.getItem(`messages_${selectedUser.id}_${user.id}`) || '[]')
        reverseStoredMessages.push(optimisticMessage)
        localStorage.setItem(`messages_${selectedUser.id}_${user.id}`, JSON.stringify(reverseStoredMessages))
      }
    } catch (err) {
      console.warn('Unexpected error sending message:', err)
      // Fallback to local storage
      const storedMessages = JSON.parse(localStorage.getItem(`messages_${user.id}_${selectedUser.id}`) || '[]')
      storedMessages.push(optimisticMessage)
      localStorage.setItem(`messages_${user.id}_${selectedUser.id}`, JSON.stringify(storedMessages))
      
       // Karşı taraf için de kaydedelim
      const reverseStoredMessages = JSON.parse(localStorage.getItem(`messages_${selectedUser.id}_${user.id}`) || '[]')
      reverseStoredMessages.push(optimisticMessage)
      localStorage.setItem(`messages_${selectedUser.id}_${user.id}`, JSON.stringify(reverseStoredMessages))
    }
  }

  if (loadingUsers) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Kullanıcılar yükleniyor...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        <div className="flex h-[600px]">
          {/* Kullanıcı ve Grup Listesi - Sol Taraf */}
          <div className="w-80 border-r border-gray-200 bg-gray-50">
            {/* Tab Buttons */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setChatMode('dm')}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                  chatMode === 'dm'
                    ? 'bg-white text-blue-600 border-b-2 border-blue-500'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                👥 DM
              </button>
              <button
                onClick={() => setChatMode('group')}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                  chatMode === 'group'
                    ? 'bg-white text-blue-600 border-b-2 border-blue-500'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                👨‍👩‍👧‍👦 Gruplar
              </button>
            </div>

            <div className="p-4 border-b border-gray-200 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">
                {chatMode === 'dm' ? '👥 Kullanıcılar' : '👨‍👩‍👧‍👦 Gruplar'}
              </h2>
              <p className="text-sm text-gray-600">
                {chatMode === 'dm'
                  ? 'Mesajlaşmak istediğiniz kişiyi seçin'
                  : 'Katıldığınız grupları görüntüleyin'
                }
              </p>
            </div>
            <div className="overflow-y-auto h-full">
              {users.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  <div className="text-6xl mb-4">👥</div>
                  <h3 className="text-lg font-medium mb-2">Kişi Bulunamadı</h3>
                  <p className="text-sm">Henüz başka kullanıcı kayıt olmamış</p>
                </div>
              ) : (
                users.map((userProfile) => (
                  <div
                    key={userProfile.id}
                    onClick={() => {
                      setSelectedUser(userProfile)
                      setSelectedGroup(null)
                    }}
                    className={`p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                      selectedUser?.id === userProfile.id
                        ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-r-4 border-r-blue-500 shadow-sm'
                        : 'hover:bg-gray-50 border-b border-gray-100'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      {/* Avatar */}
                      <div className={`relative w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shadow-lg ${
                        userProfile.role === 'teacher'
                          ? 'bg-gradient-to-br from-red-400 to-red-600 text-white'
                          : 'bg-gradient-to-br from-green-400 to-green-600 text-white'
                      }`}>
                        {userProfile.first_name.charAt(0).toUpperCase()}{userProfile.last_name.charAt(0).toUpperCase()}

                        {/* Online Status Indicator */}
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-white rounded-full"></div>
                      </div>

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">
                            {userProfile.first_name} {userProfile.last_name}
                          </h3>
                          <span className="text-xs text-gray-500">
                            {userProfile.role === 'teacher' ? '👨‍🏫' : '👨‍🎓'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-gray-600 truncate">
                            {userProfile.role === 'teacher' ? 'Öğretmen' : `Öğrenci${userProfile.class_section ? ` • ${userProfile.class_section}` : ''}`}
                          </p>
                          <span className="text-xs text-gray-400">
                            Çevrimiçi
                          </span>
                        </div>

                        {/* Last Message Preview (simulated) */}
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {selectedUser?.id === userProfile.id ? 'Mesajlaşmaya hazır' : 'Son görüldü: Şimdi'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chat Alanı - Sağ Taraf */}
          <div className="flex-1 flex flex-col bg-white">
            {!selectedUser ? (
              <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center text-gray-500">
                  <div className="text-6xl mb-4">💬</div>
                  <h3 className="text-lg font-medium mb-2">Mesajlaşmaya Başlayın</h3>
                  <p>Sol taraftan bir kullanıcı seçerek sohbeti başlatabilirsiniz</p>
                </div>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-200 bg-white">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      selectedUser.role === 'teacher' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                    }`}>
                      {selectedUser.first_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {selectedUser.first_name} {selectedUser.last_name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {selectedUser.role === 'teacher' ? '👨‍🏫 Öğretmen' : '👨‍🎓 Öğrenci'}
                        {selectedUser.class_section && ` • ${selectedUser.class_section}`}
                        {loading && ' (yükleniyor...)'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div
                  ref={messagesContainerRef}
                  className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50"
                  onScroll={handleScroll}
                >
                  {loadingMore && (
                    <div className="text-center py-2">
                      <div className="inline-flex items-center text-sm text-gray-500">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                        Eski mesajlar yükleniyor...
                      </div>
                    </div>
                  )}
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <div className="text-4xl mb-2">💭</div>
                      <p>Henüz hiç mesajınız yok</p>
                      <p className="text-sm">İlk mesajı siz gönderin!</p>
                    </div>
                  ) : (
                    messages.map((message) => {
                      const isOwnMessage = message.user_id === user?.id
                      const senderName = message.profiles
                        ? `${message.profiles.first_name} ${message.profiles.last_name}`
                        : 'Bilinmeyen Kullanıcı'

                      // DM'de sadece karşı taraftan gelen mesajlar için avatar göster
                      const showAvatar = !isOwnMessage

                      return (
                        <div
                          key={message.id}
                          className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-2`}
                        >
                          <div className={`flex items-end space-x-2 max-w-[85%] ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
                            {/* Avatar - sadece karşı taraftan gelen mesajlarda */}
                            {showAvatar && (
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                message.profiles?.role === 'teacher' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                              }`}>
                                {senderName.charAt(0).toUpperCase()}
                              </div>
                            )}

                            {/* Mesaj baloncuğu - Instagram tarzı */}
                            <div
                              className={`relative px-4 py-3 max-w-xs lg:max-w-md ${
                                isOwnMessage
                                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-2xl rounded-br-md shadow-lg'
                                  : 'bg-gray-100 text-gray-900 rounded-2xl rounded-bl-md shadow-sm'
                              }`}
                            >
                              {/* Gönderen adı (karşı taraftan gelen mesajlarda) */}
                              {!isOwnMessage && (
                                <div className="text-xs font-semibold text-blue-600 mb-1 opacity-80">
                                  {senderName}
                                </div>
                              )}

                              <p className="text-sm break-words leading-relaxed">{message.content}</p>

                              {/* Zaman damgası */}
                              <div className={`text-xs mt-2 text-right ${
                                isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                              }`}>
                                {new Date(message.created_at).toLocaleTimeString('tr-TR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
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
                <div className="p-4 border-t border-gray-200 bg-white">
                  <form onSubmit={sendMessage} className="flex space-x-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={`${selectedUser.first_name} ile mesajlaşın...`}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                      maxLength={500}
                      disabled={loading}
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim() || loading}
                      className={`rounded-full p-3 transition-all duration-200 ${
                        !newMessage.trim() || loading
                          ? 'opacity-50 cursor-not-allowed bg-gray-200'
                          : 'bg-white hover:bg-gray-50 border border-gray-300 shadow-sm hover:shadow-md'
                      }`}
                    >
                      <img
                        src="/images/send-button-interface-icon-vector-removebg-preview.png"
                        alt="Gönder"
                        className="w-6 h-6"
                      />
                    </button>
                  </form>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    {newMessage.length}/500 karakter
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
