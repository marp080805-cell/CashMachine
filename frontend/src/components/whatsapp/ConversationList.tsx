'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn, formatRelativeDate, getInitials } from '@/lib/utils'
import type { WhatsappConversation } from '@/types'

interface ConversationListProps {
  conversations: WhatsappConversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onSearch: (q: string) => void
}

export function ConversationList({ conversations, activeId, onSelect, onSearch }: ConversationListProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'archived'>('all')

  const filtered = conversations.filter((c) => {
    if (activeTab === 'unread') return c.unreadCount > 0
    if (activeTab === 'archived') return c.isArchived
    return !c.isArchived
  })

  return (
    <div className="flex h-full flex-col border-r bg-card">
      <div className="flex h-16 items-center px-4 border-b">
        <h2 className="text-base font-semibold">WhatsApp</h2>
      </div>

      <div className="px-3 py-2 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            className="pl-9 h-9"
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex border-b text-sm">
        {(['all', 'unread', 'archived'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 py-2 text-center font-medium transition-colors',
              activeTab === tab
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab === 'all' ? 'Todas' : tab === 'unread' ? 'Não lidas' : 'Arquivadas'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">Nenhuma conversa</p>
        ) : (
          filtered.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 border-b hover:bg-muted transition-colors text-left',
                activeId === conv.id && 'bg-primary/5'
              )}
            >
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {getInitials(conv.remoteName ?? conv.remotePhone)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white',
                    conv.number.status === 'CONNECTED' ? 'bg-green-500' : 'bg-gray-300'
                  )}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground truncate">
                    {conv.remoteName ?? conv.remotePhone}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0 ml-1">
                    {formatRelativeDate(conv.lastMessageAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-xs text-muted-foreground truncate">
                    {conv.lastMessage ?? 'Sem mensagens'}
                  </p>
                  {conv.unreadCount > 0 && (
                    <span className="ml-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white shrink-0">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
                {conv.lead && (
                  <Badge variant="secondary" className="mt-1 text-[10px] h-4 px-1.5">
                    {conv.lead.name}
                  </Badge>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
