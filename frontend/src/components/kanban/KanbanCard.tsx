'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, MessageSquare } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, formatCurrency, formatDate, getInitials } from '@/lib/utils'
import type { Opportunity } from '@/types'

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
  opportunity: Opportunity
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
    </div>
  )
}
