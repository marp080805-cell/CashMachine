'use client'

import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Send, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageBubble } from './MessageBubble'
import { AiSuggestionBar } from './AiSuggestionBar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { api } from '@/lib/api'
import { useWhatsappStore } from '@/stores/whatsappStore'
import { useWhatsAppSocket } from '@/hooks/useWhatsApp'
import type { WhatsappConversation, WhatsappMessage } from '@/types'
import { getInitials, formatDate } from '@/lib/utils'
import { isToday, isYesterday, parseISO } from 'date-fns'

function getDateLabel(dateStr: string): string {
  const d = parseISO(dateStr)
  if (isToday(d)) return 'Hoje'
  if (isYesterday(d)) return 'Ontem'
  return formatDate(dateStr)
}

function shouldShowDate(messages: WhatsappMessage[], index: number): { show: boolean; label: string } {
  if (index === 0) return { show: true, label: getDateLabel(messages[0]?.timestamp ?? '') }
  const curr = messages[index]!
  const prev = messages[index - 1]!
  const currDate = parseISO(curr.timestamp).toDateString()
  const prevDate = parseISO(prev.timestamp).toDateString()
  if (currDate !== prevDate) return { show: true, label: getDateLabel(curr.timestamp) }
  return { show: false, label: '' }
}

interface ChatWindowProps {
  conversationId: string
}

export function ChatWindow({ conversationId }: ChatWindowProps) {
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  useWhatsAppSocket(conversationId)

  const { messages: storeMessages, aiSuggestions, setMessages, markAsRead } = useWhatsappStore()

  const conversation = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: async () => {
      const data = await api.get<{
        conversations: WhatsappConversation[]
        pagination: unknown
      }>(`/whatsapp/conversations?limit=1`)
      return null
    },
    enabled: false,
  })

  const { isLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const data = await api.get<{ messages: WhatsappMessage[]; nextCursor: string | null }>(
        `/whatsapp/conversations/${conversationId}/messages`
      )
      setMessages(conversationId, data.messages)
      return data
    },
    enabled: !!conversationId,
  })

  useEffect(() => {
    if (conversationId) {
      void api.patch(`/whatsapp/conversations/${conversationId}/read`)
      markAsRead(conversationId)
    }
  }, [conversationId, markAsRead])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [storeMessages.get(conversationId)?.length])

  const sendMutation = useMutation({
    mutationFn: (msgText: string) =>
      api.post<WhatsappMessage>(`/whatsapp/conversations/${conversationId}/send`, { text: msgText }),
    onSuccess: (msg) => {
      const current = storeMessages.get(conversationId) ?? []
      setMessages(conversationId, [...current, msg])
      setText('')
    },
    onError: () => toast.error('Erro ao enviar mensagem'),
  })

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    sendMutation.mutate(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const messages = storeMessages.get(conversationId) ?? []
  const aiSuggestion = aiSuggestions.get(conversationId)

  if (isLoading) {
    return (
      <div className="flex flex-col h-full p-4 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className={`h-12 w-3/4 ${i % 2 ? 'ml-auto' : ''}`} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const { show, label } = shouldShowDate(messages, i)
            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                showDate={show}
                dateLabel={label}
              />
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {aiSuggestion && (
        <AiSuggestionBar
          conversationId={conversationId}
          suggestion={aiSuggestion}
          onUse={(t) => setText(t)}
        />
      )}

      <div className="border-t bg-white p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem..."
            className="min-h-[40px] max-h-[120px] resize-none border-0 focus-visible:ring-0 p-2"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!text.trim() || sendMutation.isPending}
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
