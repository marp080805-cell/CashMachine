'use client'

import { useEffect } from 'react'
import { getSocket } from '@/lib/socket'
import { useWhatsappStore } from '@/stores/whatsappStore'
import type { WhatsappMessage } from '@/types'

export function useWhatsAppSocket(conversationId?: string) {
  const { addMessage, setAiSuggestion, markAsRead, activeConversationId } = useWhatsappStore()

  useEffect(() => {
    const socket = getSocket()

    const handleNewMessage = (data: { conversationId: string; message: WhatsappMessage }) => {
      addMessage(data.conversationId, data.message)

      if (data.conversationId === activeConversationId) {
        markAsRead(data.conversationId)
      }
    }

    const handleAiSuggestion = (data: { conversationId: string; suggestion: string }) => {
      setAiSuggestion(data.conversationId, data.suggestion)
    }

    socket.on('message:new', handleNewMessage)
    socket.on('ai:suggestion', handleAiSuggestion)

    if (conversationId) {
      socket.emit('join:conversation', conversationId)
    }

    return () => {
      socket.off('message:new', handleNewMessage)
      socket.off('ai:suggestion', handleAiSuggestion)

      if (conversationId) {
        socket.emit('leave:conversation', conversationId)
      }
    }
  }, [conversationId, addMessage, setAiSuggestion, markAsRead, activeConversationId])
}
