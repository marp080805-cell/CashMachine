'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Funnel } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { GitBranch } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import Link from 'next/link'

const funnelTypeLabels: Record<string, string> = {
  PROSPECTING: 'Prospecção',
  SALES: 'Vendas',
  POST_SALES: 'Pós-Venda',
  CUSTOM: 'Personalizado',
}

export default function FunisPage() {
  const { data: funnels, isLoading } = useQuery({
    queryKey: ['funnels'],
    queryFn: () => api.get<Funnel[]>('/funnels'),
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    )
  }

  if (!funnels?.length) {
    return (
      <EmptyState
        icon={GitBranch}
        title="Nenhum funil cadastrado"
        description="Crie seu primeiro funil de vendas para começar"
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {funnels.map((funnel) => (
        <Link key={funnel.id} href={`/funis/${funnel.id}`}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{funnel.name}</CardTitle>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {funnelTypeLabels[funnel.type] ?? funnel.type}
                </Badge>
              </div>
              {funnel.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{funnel.description}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <GitBranch className="h-4 w-4" />
                <span>{funnel.stages.length} etapas</span>
                <span>·</span>
                <span>{funnel._count?.deals ?? 0} deals</span>
              </div>
              <div className="flex gap-1 mt-3">
                {funnel.stages.slice(0, 6).map((stage) => (
                  <div
                    key={stage.id}
                    className="h-2 flex-1 rounded-full"
                    style={{ backgroundColor: stage.color }}
                    title={stage.name}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
