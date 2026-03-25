'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { DashboardSummary } from '@/types'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Users, DollarSign, TrendingUp, TrendingDown, UserPlus, BarChart2
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useDashboardRealtime } from '@/hooks/useRealtime'
import { usePermissions } from '@/hooks/usePermissions'
import Link from 'next/link'
import { cn } from '@/lib/utils'

function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

function isToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

export default function DashboardPage() {
  useDashboardRealtime()
  const { isAdminOrGestor } = usePermissions()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardSummary>('/dashboard/summary'),
    refetchInterval: 60000,
  })

  const kpiWidgets = [
    {
      id: 'open',
      title: 'Oportunidades abertas',
      value: String(data?.kpis.openOpportunities ?? 0),
      icon: BarChart2,
    },
    {
      id: 'won',
      title: 'Ganhas este mês',
      value: String(data?.kpis.wonThisMonth ?? 0),
      icon: TrendingUp,
    },
    {
      id: 'revenue',
      title: 'Receita este mês',
      value: formatCurrency(data?.kpis.revenueWon),
      icon: DollarSign,
    },
    {
      id: 'lost',
      title: 'Perdidas este mês',
      value: String(data?.kpis.lostThisMonth ?? 0),
      icon: TrendingDown,
    },
    {
      id: 'contacts',
      title: 'Novos contatos',
      value: String(data?.kpis.newContacts ?? 0),
      icon: UserPlus,
    },
    {
      id: 'winrate',
      title: 'Taxa de conversão',
      value: `${((data?.kpis.winRate ?? 0) * 100).toFixed(1)}%`,
      icon: Users,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {kpiWidgets.map((kpi) => (
          <KpiCard
            key={kpi.id}
            title={kpi.title}
            value={isLoading ? '—' : kpi.value}
            icon={kpi.icon}
            isLoading={isLoading}
          />
        ))}
      </div>

      {/* Pipeline summary + Activities */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipelines</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : (data?.pipelineSummary ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum pipeline configurado.{' '}
                <Link href="/funis" className="underline text-primary">Criar pipeline</Link>
              </p>
            ) : (
              <div className="space-y-3">
                {(data?.pipelineSummary ?? []).map((ps) => (
                  <Link key={ps.pipelineId} href={`/funis/${ps.pipelineId}`}>
                    <div className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ps.pipelineName}</p>
                        <div className="flex gap-1 mt-1.5">
                          {ps.stages.map((stage) => (
                            <div
                              key={stage.stageId}
                              className="h-1.5 rounded-full"
                              style={{
                                backgroundColor: stage.color,
                                width: `${Math.max(8, (stage.count / Math.max(ps.openCount, 1)) * 100)}%`,
                              }}
                              title={`${stage.stageName}: ${stage.count}`}
                            />
                          ))}
                        </div>
                      </div>
                      <Badge variant="secondary">{ps.openCount} abertas</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <RecentActivities activities={data?.recentActivities ?? []} />
      </div>

      {/* Tasks */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Próximas Tarefas</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (data?.upcomingTasks?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma tarefa pendente</p>
            ) : (
              <div className="space-y-3">
                {data?.upcomingTasks?.map((task) => {
                  const overdue = isOverdue(task.dueDate)
                  const today = isToday(task.dueDate)
                  return (
                    <Link key={task.id} href="/tarefas">
                      <div className={cn(
                        'flex items-center gap-3 rounded-lg border p-3 hover:bg-muted transition-colors',
                        overdue ? 'border-red-200 bg-red-50' : today ? 'border-amber-200 bg-amber-50' : ''
                      )}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {task.contact?.name ?? task.opportunity?.title ?? 'Sem vínculo'}
                            {task.dueDate && ` · ${formatDate(task.dueDate)}`}
                          </p>
                        </div>
                        <Badge variant={overdue ? 'danger' : today ? 'warning' : 'secondary'}>
                          {overdue ? 'Atrasada' : today ? 'Hoje' : 'Futura'}
                        </Badge>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
