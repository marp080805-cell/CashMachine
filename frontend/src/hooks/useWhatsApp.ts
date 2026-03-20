'use client'

import { useEffect } from 'react'
import { getSocket } from '@/lib/socket'
import { useWhatsappStore } from '@/stores/whatsappStore'
import type { WhatsappMessage } from '@/types'

export function useWhatsAppSocket(conversationId?: string) {
  const { addMessage, setAiSuggestion, markAsRead, activeConversationId, updateConversation, conversations, incrementUnread, updateMessageStatus } = useWhatsappStore()

  useEffect(() => {
    const socket = getSocket()

    const handleNewMessage = (data: { conversationId: string; message: WhatsappMessage }) => {
      addMessage(data.conversationId, data.message)

      if (data.conversationId === conversationId) {
        markAsRead(data.conversationId)
        // Mark as read on server too
        void fetch(`${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3011'}/whatsapp/conversations/${data.conversationId}/read`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}` },
        }).catch(() => null)
      }
    }

    const handleAiSuggestion = (data: { conversationId: string; suggestion: string }) => {
      setAiSuggestion(data.conversationId, data.suggestion)
    }

    const handleConversationUpdated = (data: {
      conversationId: string
      lastMessage: string | null
      lastMessageAt: string
      unreadDelta: number
    }) => {
      const conv = conversations.get(data.conversationId)
      if (conv) {
        updateConversation({
          ...conv,
          lastMessage: data.lastMessage,
          lastMessageAt: data.lastMessageAt,
          unreadCount: data.conversationId === conversationId
            ? conv.unreadCount  // already reading this conversation
            : conv.unreadCount + data.unreadDelta,
        })
      }
    }

    const handleMessageStatus = (data: { conversationId: string; remoteId: string; status: string }) => {
      updateMessageStatus(data.conversationId, data.remoteId, data.status)
    }

    // Re-join conversation room on socket reconnect
    const handleConnect = () => {
      if (conversationId) {
        socket.emit('join:conversation', conversationId)
      }
    }

    socket.on('message:new', handleNewMessage)
    socket.on('message:status', handleMessageStatus)
    socket.on('ai:suggestion', handleAiSuggestion)
    socket.on('conversation:updated', handleConversationUpdated)
    socket.on('connect', handleConnect)

    if (conversationId) {
      socket.emit('join:conversation', conversationId)
    }

    return () => {
      socket.off('message:new', handleNewMessage)
      socket.off('message:status', handleMessageStatus)
      socket.off('ai:suggestion', handleAiSuggestion)
      socket.off('conversation:updated', handleConversationUpdated)
      socket.off('connect', handleConnect)

      if (conversationId) {
        socket.emit('leave:conversation', conversationId)
      }
    }
  }, [conversationId, addMessage, setAiSuggestion, markAsRead, updateConversation, conversations, incrementUnread, activeConversationId, updateMessageStatus])
}
