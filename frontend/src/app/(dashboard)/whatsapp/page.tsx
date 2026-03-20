'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { WhatsappConversation } from '@/types'
import { ConversationList } from '@/components/whatsapp/ConversationList'
import { ChatWindow } from '@/components/whatsapp/ChatWindow'
import { ContactInfo } from '@/components/whatsapp/ContactInfo'
import { useWhatsappStore } from '@/stores/whatsappStore'
import { MessageSquare, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getSocket } from '@/lib/socket'

export default function WhatsAppPage() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showContactInfo, setShowContactInfo] = useState(false)
  const { setConversations } = useWhatsappStore()
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ['whatsapp-conversations', search],
    queryFn: async () => {
      const result = await api.get<{
        conversations: WhatsappConversation[]
        pagination: unknown
      }>(`/whatsapp/conversations?limit=50${search ? `&search=${encodeURIComponent(search)}` : ''}`)
      setConversations(result.conversations)
      return result
    },
    refetchInterval: 30000,
  })

  useEffect(() => {
    const socket = getSocket()

    const handleNotification = (data: { type: string; conversationId: string }) => {
      if (data.type === 'WHATSAPP_MESSAGE') {
        void queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] })
      }
    }

    socket.on('notification:new', handleNotification)
    return () => {
      socket.off('notification:new', handleNotification)
    }
  }, [queryClient])

  const conversations = data?.conversations ?? []
  const activeConversation = conversations.find((c) => c.id === activeConversationId)

  return (
    <div className="-m-6 h-[calc(100vh-64px)] flex">
      <div className="w-[300px] shrink-0">
        <ConversationList
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={setActiveConversationId}
          onSearch={setSearch}
        />
      </div>

      <div className="flex-1 flex flex-col">
        {activeConversationId ? (
          <>
            <div className="flex h-16 items-center justify-between px-4 border-b bg-card">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                  {(activeConversation?.remoteName ?? activeConversation?.remotePhone ?? '?')[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold">{activeConversation?.remoteName ?? activeConversation?.remotePhone}</p>
                  <p className="text-xs text-muted-foreground">{activeConversation?.remotePhone}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowContactInfo((v) => !v)}
                className={showContactInfo ? 'text-primary' : ''}
              >
                <Info className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatWindow conversationId={activeConversationId} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium text-muted-foreground">Selecione uma conversa</p>
              <p className="text-sm text-muted-foreground">Escolha uma conversa na lista à esquerda</p>
            </div>
          </div>
        )}
      </div>

      {activeConversation && showContactInfo && (
        <ContactInfo conversation={activeConversation} />
      )}
    </div>
  )
}
