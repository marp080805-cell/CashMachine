'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Snowflake, Calendar } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn, formatCurrency, formatDate, getInitials } from '@/lib/utils'
import type { Deal } from '@/types'

interface KanbanCardProps {
  deal: Deal
  onClick: (deal: Deal) => void
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

export function KanbanCard({ deal, onClick }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const overdueClass = isOverdue(deal.expectedClose)
    ? 'border-l-4 border-l-red-400'
    : isNearDeadline(deal.expectedClose)
    ? 'border-l-4 border-l-amber-400'
    : ''

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(deal)}
      className={cn(
        'rounded-lg border bg-white p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow',
        overdueClass,
        deal.isFrozen && 'opacity-60'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">{deal.title}</p>
        {deal.isFrozen && <Snowflake className="h-4 w-4 text-blue-400 shrink-0" />}
      </div>

      {deal.company && (
        <p className="text-xs text-muted-foreground mb-2 truncate">{deal.company.name}</p>
      )}

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1">
          <Avatar className="h-5 w-5">
            <AvatarImage src={deal.assignedTo.avatarUrl ?? undefined} />
            <AvatarFallback className="text-[8px]">{getInitials(deal.assignedTo.name)}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate max-w-[80px]">{deal.assignedTo.name}</span>
        </div>

        {deal.value !== null && deal.value !== undefined && (
          <span className="text-xs font-semibold text-primary">{formatCurrency(deal.value)}</span>
        )}
      </div>

      {deal.expectedClose && (
        <div className={cn(
          'flex items-center gap-1 mt-2 text-xs',
          isOverdue(deal.expectedClose) ? 'text-red-500' : 'text-muted-foreground'
        )}>
          <Calendar className="h-3 w-3" />
          <span>{formatDate(deal.expectedClose)}</span>
        </div>
      )}
    </div>
  )
}
