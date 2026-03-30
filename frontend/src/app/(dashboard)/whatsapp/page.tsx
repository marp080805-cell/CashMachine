'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { WhatsappConversation } from '@/types'
import { ConversationList } from '@/components/whatsapp/ConversationList'
import { ChatWindow } from '@/components/whatsapp/ChatWindow'
import { ContactInfo } from '@/components/whatsapp/ContactInfo'
import { useWhatsappStore } from '@/stores/whatsappStore'
import { MessageSquare, Info, Sparkles, Bot, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getSocket } from '@/lib/socket'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface AIAgent {
  id: string
  name: string
  type: string
  isActive: boolean
}

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

  // Buscar agentes IA disponíveis
  const { data: agents = [] } = useQuery({
    queryKey: ['ai-agents'],
    queryFn: () => api.get<AIAgent[]>('/ai-agents'),
    select: (agents) => agents.filter((a) => a.isActive),
  })

  useEffect(() => {
    const socket = getSocket()

    const handleNotification = (data: { type: string; conversationId: string }) => {
      if (data.type === 'WHATSAPP_MESSAGE') {
        void queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] })
      }
    }

    const handleConversationUpdated = () => {
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] })
    }

    socket.on('notification:new', handleNotification)
    socket.on('conversation:updated', handleConversationUpdated)

    return () => {
      socket.off('notification:new', handleNotification)
      socket.off('conversation:updated', handleConversationUpdated)
    }
  }, [queryClient])

  const conversations = data?.conversations ?? []
  const activeConversation = conversations.find((c) => c.id === activeConversationId)

  // Estado local de IA para a conversa ativa (sincroniza com a conversa)
  const [aiEnabled, setAiEnabled] = useState(true)
  const [aiAgentId, setAiAgentId] = useState<string | null>(null)

  useEffect(() => {
    if (activeConversation) {
      setAiEnabled(activeConversation.aiEnabled ?? true)
      setAiAgentId(activeConversation.aiAgentId ?? null)
    }
  }, [activeConversation?.id, activeConversation?.aiEnabled, activeConversation?.aiAgentId])

  const aiConfigMutation = useMutation({
    mutationFn: (body: { aiEnabled?: boolean; aiAgentId?: string | null }) =>
      api.patch(`/whatsapp/conversations/${activeConversationId}/ai-config`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] })
    },
    onError: () => toast.error('Erro ao salvar configuração de IA'),
  })

  function handleToggleAi(enabled: boolean) {
    setAiEnabled(enabled)
    aiConfigMutation.mutate({ aiEnabled: enabled })
  }

  function handleSelectAgent(agentId: string | null) {
    setAiAgentId(agentId)
    aiConfigMutation.mutate({ aiAgentId: agentId })
  }

  const activeAgent = agents.find((a) => a.id === aiAgentId)

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
            <div className="flex h-16 items-center justify-between px-4 border-b bg-card gap-3">
              {/* Identidade da conversa */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm shrink-0">
                  {(activeConversation?.remoteName ?? activeConversation?.remotePhone ?? '?')[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{activeConversation?.remoteName ?? activeConversation?.remotePhone}</p>
                  <p className="text-xs text-muted-foreground">{activeConversation?.remotePhone}</p>
                </div>
              </div>

              {/* Controles de IA */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Seletor de agente */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        'h-8 gap-1.5 text-xs',
                        !aiEnabled && 'opacity-50',
                      )}
                      disabled={!aiEnabled}
                    >
                      <Bot className="h-3.5 w-3.5" />
                      <span className="max-w-[100px] truncate">
                        {activeAgent ? activeAgent.name : 'Agente padrão'}
                      </span>
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Agente de IA</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleSelectAgent(null)}
                      className={cn('text-xs', !aiAgentId && 'font-medium text-primary')}
                    >
                      Agente padrão
                    </DropdownMenuItem>
                    {agents.length > 0 && <DropdownMenuSeparator />}
                    {agents.map((agent) => (
                      <DropdownMenuItem
                        key={agent.id}
                        onClick={() => handleSelectAgent(agent.id)}
                        className={cn('text-xs', aiAgentId === agent.id && 'font-medium text-primary')}
                      >
                        {agent.name}
                      </DropdownMenuItem>
                    ))}
                    {agents.length === 0 && (
                      <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                        Nenhum agente criado
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Toggle IA */}
                <div className="flex items-center gap-1.5">
                  <Sparkles className={cn('h-3.5 w-3.5', aiEnabled ? 'text-violet-500' : 'text-muted-foreground')} />
                  <Switch
                    checked={aiEnabled}
                    onCheckedChange={handleToggleAi}
                    disabled={aiConfigMutation.isPending}
                  />
                </div>

                {/* Info do contato */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowContactInfo((v) => !v)}
                  className={showContactInfo ? 'text-primary' : ''}
                >
                  <Info className="h-5 w-5" />
                </Button>
              </div>
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
