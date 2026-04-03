'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, MessageSquare } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, formatCurrency, formatDate, getInitials } from '@/lib/utils'
import type { Opportunity } from '@/types'

interface CardTask {
  id: string
  title: string
  status: string
  dueDate: string | null
  priority: string
}

interface CardConversation {
  id: string
  messages: { id: string; direction: string; content: string | null; createdAt: string }[]
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return d.toLocaleDateString('pt-BR', { weekday: 'short' })
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

interface KanbanCardProps {
  opportunity: Opportunity & {
    tasks?: CardTask[]
    conversations?: CardConversation[]
  }
  onClick: (opportunity: Opportunity) => void
  cardFields?: string[]
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

function isNearDeadline(dateStr: string | null): boolean {
  if (!dateStr) return false
  const diff = new Date(dateStr).getTime() - Date.now()
  return diff > 0 && diff < 7 * 86400000
}

export function KanbanCard({ opportunity, onClick, cardFields }: KanbanCardProps) {
  const fields = cardFields ?? ['contact', 'company', 'assignedTo', 'value', 'expectedCloseDate']
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: opportunity.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const closeDate = opportunity.expectedCloseDate ?? null
  const overdueClass = isOverdue(closeDate)
    ? 'border-l-4 border-l-red-400'
    : isNearDeadline(closeDate)
    ? 'border-l-4 border-l-amber-400'
    : ''

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(opportunity)}
      className={cn(
        'rounded-lg border bg-card p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow',
        overdueClass
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-foreground line-clamp-2 flex-1">{opportunity.title}</p>
      </div>

      {fields.includes('contact') && opportunity.contact && (
        <p className="text-xs text-muted-foreground mb-1 truncate">{opportunity.contact.name}</p>
      )}

      {fields.includes('company') && opportunity.company && (
        <p className="text-xs text-muted-foreground mb-2 truncate">{opportunity.company.name}</p>
      )}

      <div className="flex items-center justify-between mt-3">
        {fields.includes('assignedTo') && opportunity.assignedTo && (
          <div className="flex items-center gap-1">
            <Avatar className="h-5 w-5">
              <AvatarImage src={opportunity.assignedTo.avatarUrl ?? undefined} />
              <AvatarFallback className="text-[8px]">{getInitials(opportunity.assignedTo.name)}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate max-w-[80px]">{opportunity.assignedTo.name}</span>
          </div>
        )}

        {fields.includes('value') && opportunity.value !== null && opportunity.value !== undefined && (
          <span className="text-xs font-semibold text-primary">{formatCurrency(opportunity.value)}</span>
        )}
      </div>

      {fields.includes('expectedCloseDate') && closeDate && (
        <div className={cn(
          'flex items-center gap-1 mt-2 text-xs',
          isOverdue(closeDate) ? 'text-red-500' : 'text-muted-foreground'
        )}>
          <Calendar className="h-3 w-3" />
          <span>{formatDate(closeDate)}</span>
        </div>
      )}

      {fields.includes('sdr') && (opportunity as any).sdr && (
        <p className="text-xs text-muted-foreground truncate">SDR: {(opportunity as any).sdr.name}</p>
      )}
      {fields.includes('closer') && (opportunity as any).closer && (
        <p className="text-xs text-muted-foreground truncate">Closer: {(opportunity as any).closer.name}</p>
      )}
      {fields.includes('origin') && (opportunity as any).origin && (
        <p className="text-xs text-muted-foreground truncate">{(opportunity as any).origin.name}</p>
      )}
      {fields.includes('temperature') && (opportunity as any).temperature && (
        <span className="text-xs text-muted-foreground">{(opportunity as any).temperature}</span>
      )}
      {fields.includes('qualificationScore') && (opportunity as any).qualificationScore != null && (
        <span className="text-xs text-muted-foreground">Score: {(opportunity as any).qualificationScore}</span>
      )}
      {fields.includes('status') && (
        <span className="text-xs text-muted-foreground">{opportunity.status}</span>
      )}
      {fields.includes('tags') && (opportunity as any).tagAssignments?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {((opportunity as any).tagAssignments as { tag: { name: string; color: string } }[]).slice(0, 3).map((ta, i) => (
            <span
              key={i}
              className="text-xs px-1.5 py-0.5 rounded-full text-white"
              style={{ backgroundColor: ta.tag.color }}
            >
              {ta.tag.name}
            </span>
          ))}
        </div>
      )}
      {fields.includes('createdAt') && (
        <p className="text-xs text-muted-foreground">{new Date(opportunity.createdAt).toLocaleDateString('pt-BR')}</p>
      )}

      {/* Tarefas */}
      {fields.includes('tasks') && opportunity.tasks && opportunity.tasks.length > 0 && (
        <div className="border-t pt-1.5 mt-0.5 space-y-1">
          {opportunity.tasks.slice(0, 3).map((task) => {
            const isTaskOverdue = task.dueDate && new Date(task.dueDate) < new Date()
            return (
              <div key={task.id} className="flex items-center gap-1.5">
                <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                  task.status === 'COMPLETED' ? 'bg-green-500' :
                  task.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                  isTaskOverdue ? 'bg-red-500' : 'bg-muted-foreground'
                }`} />
                <span className={`text-xs truncate flex-1 ${isTaskOverdue ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {task.title}
                </span>
              </div>
            )
          })}
          {opportunity.tasks.length > 3 && (
            <p className="text-xs text-muted-foreground">+{opportunity.tasks.length - 3} tarefas</p>
          )}
        </div>
      )}

      {/* Mensagem não respondida do WhatsApp */}
      {fields.includes('unrespondedMessage') && (() => {
        const conv = opportunity.conversations?.[0]
        const lastMsg = conv?.messages?.[0]
        if (!lastMsg || lastMsg.direction !== 'INBOUND') return null
        return (
          <div className="border-t pt-1.5 mt-0.5">
            <div className="flex items-start gap-1.5 bg-green-500/10 rounded p-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0 mt-1" />
              <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
                {lastMsg.content ?? '📎 Mídia'}
              </p>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
