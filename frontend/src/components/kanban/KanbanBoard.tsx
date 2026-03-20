'use client'

import { useState } from 'react'
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCard } from './KanbanCard'
import { DealModal } from './DealModal'
import type { Deal, Funnel } from '@/types'
import { api } from '@/lib/api'

interface KanbanBoardProps {
  funnel: Omit<Funnel, 'stages'> & { stages: Array<{ id: string; name: string; position: number; color: string; funnelId: string; createdAt: string; deals: Deal[] }> }
}

export function KanbanBoard({ funnel }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const queryClient = useQueryClient()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const moveMutation = useMutation({
    mutationFn: ({ dealId, stageId }: { dealId: string; stageId: string }) =>
      api.patch(`/deals/${dealId}/move`, { stageId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['funnel', funnel.id] })
    },
    onError: () => toast.error('Erro ao mover deal'),
  })

  const allDeals = funnel.stages.flatMap((s) => s.deals)
  const activeCard = activeId ? allDeals.find((d) => d.id === activeId) : null

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const dealId = active.id as string
    const overId = over.id as string

    const sourceStage = funnel.stages.find((s) => s.deals.some((d) => d.id === dealId))
    const targetStage = funnel.stages.find((s) => s.id === overId || s.deals.some((d) => d.id === overId))

    if (!sourceStage || !targetStage) return
    if (sourceStage.id === targetStage.id) return

    moveMutation.mutate({ dealId, stageId: targetStage.id })
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e) => setActiveId(e.active.id as string)}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {funnel.stages
            .sort((a, b) => a.position - b.position)
            .map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                deals={stage.deals}
                onDealClick={setSelectedDeal}
              />
            ))}
        </div>

        <DragOverlay>
          {activeCard && (
            <KanbanCard deal={activeCard} onClick={() => {}} />
          )}
        </DragOverlay>
      </DndContext>

      <DealModal
        deal={selectedDeal}
        onClose={() => setSelectedDeal(null)}
        funnelId={funnel.id}
      />
    </>
  )
}
