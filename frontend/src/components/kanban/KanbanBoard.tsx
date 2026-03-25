'use client'

import { useState } from 'react'
import {
  DndContext,
  type DragEndEvent,
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
import { OpportunitySheet } from './OpportunitySheet'
import type { Opportunity, Pipeline, Stage } from '@/types'
import { api } from '@/lib/api'

type PipelineWithOpportunities = Omit<Pipeline, 'stages'> & {
  stages: Array<Stage & { opportunities: Opportunity[] }>
}

interface KanbanBoardProps {
  pipeline: PipelineWithOpportunities
  onNewOpportunity?: (stageId: string) => void
}

export function KanbanBoard({ pipeline, onNewOpportunity }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null)
  const queryClient = useQueryClient()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const moveMutation = useMutation({
    mutationFn: ({ opportunityId, stageId }: { opportunityId: string; stageId: string }) =>
      api.put(`/opportunities/${opportunityId}/move`, { stageId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pipeline', pipeline.id] })
    },
    onError: () => toast.error('Erro ao mover oportunidade'),
  })

  const allOpportunities = pipeline.stages.flatMap((s) => s.opportunities)
  const activeCard = activeId ? allOpportunities.find((o) => o.id === activeId) : null

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const opportunityId = active.id as string
    const overId = over.id as string

    const sourceStage = pipeline.stages.find((s) => s.opportunities.some((o) => o.id === opportunityId))
    const targetStage = pipeline.stages.find((s) => s.id === overId || s.opportunities.some((o) => o.id === overId))

    if (!sourceStage || !targetStage) return
    if (sourceStage.id === targetStage.id) return

    moveMutation.mutate({ opportunityId, stageId: targetStage.id })
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
          {pipeline.stages
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                opportunities={stage.opportunities}
                onOpportunityClick={setSelectedOpportunity}
                onNewOpportunity={onNewOpportunity ? () => onNewOpportunity(stage.id) : undefined}
              />
            ))}
        </div>

        <DragOverlay>
          {activeCard && (
            <KanbanCard opportunity={activeCard} onClick={() => {}} />
          )}
        </DragOverlay>
      </DndContext>

      <OpportunitySheet
        opportunity={selectedOpportunity}
        onClose={() => setSelectedOpportunity(null)}
        pipelineId={pipeline.id}
      />
    </>
  )
}
