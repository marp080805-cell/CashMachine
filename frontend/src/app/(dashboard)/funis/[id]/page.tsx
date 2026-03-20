'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Funnel, Deal, FunnelStage } from '@/types'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { Skeleton } from '@/components/ui/skeleton'

type FunnelWithDeals = Omit<Funnel, 'stages'> & {
  stages: Array<FunnelStage & { deals: Deal[] }>
}

export default function FunnelKanbanPage() {
  const { id } = useParams<{ id: string }>()

  const { data: funnel, isLoading } = useQuery({
    queryKey: ['funnel', id],
    queryFn: () => api.get<FunnelWithDeals>(`/funnels/${id}`),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-72 shrink-0 space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (!funnel) return null

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">{funnel.name}</h2>
        <p className="text-sm text-muted-foreground">
          {funnel.stages.length} etapas · {funnel.stages.reduce((sum, s) => sum + s.deals.length, 0)} deals em aberto
        </p>
      </div>
      <KanbanBoard funnel={funnel} />
    </div>
  )
}
