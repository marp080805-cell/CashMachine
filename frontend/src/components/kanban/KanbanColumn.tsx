'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { KanbanCard } from './KanbanCard'
import { formatCurrency } from '@/lib/utils'
import type { Opportunity, Stage } from '@/types'
import { Plus } from 'lucide-react'

interface KanbanColumnProps {
  stage: Stage & { opportunities: Opportunity[] }
  opportunities: Opportunity[]
  onOpportunityClick: (opportunity: Opportunity) => void
  onNewOpportunity?: () => void
}

export function KanbanColumn({ stage, opportunities, onOpportunityClick, onNewOpportunity }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  const totalValue = opportunities.reduce((sum, o) => sum + (o.value ?? 0), 0)

  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="text-sm font-semibold text-foreground">{stage.name}</h3>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
            {opportunities.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {totalValue > 0 && (
            <span className="text-xs text-muted-foreground">{formatCurrency(totalValue)}</span>
          )}
          {onNewOpportunity && (
            <button
              onClick={onNewOpportunity}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Nova oportunidade nesta etapa"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 min-h-[200px] rounded-lg p-2 transition-colors ${
          isOver ? 'bg-primary/5 ring-2 ring-primary/20' : 'bg-muted'
        }`}
      >
        <SortableContext items={opportunities.map((o) => o.id)} strategy={verticalListSortingStrategy}>
          {opportunities.map((opportunity) => (
            <KanbanCard key={opportunity.id} opportunity={opportunity} onClick={onOpportunityClick} />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
