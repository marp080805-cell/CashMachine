'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { DashboardSummary, DashboardWidget } from '@/types'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { LeadsChart } from '@/components/dashboard/LeadsChart'
import { CanalPerformanceChart } from '@/components/dashboard/CanalPerformanceChart'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Users, DollarSign, Phone, FileText, TrendingUp, BarChart2, Settings2
} from 'lucide-react'
import {
  formatCurrency, formatPercent, getAttainmentColor, formatDate
} from '@/lib/utils'
import { useDashboardRealtime } from '@/hooks/useRealtime'
import { usePermissions } from '@/hooks/usePermissions'
import Link from 'next/link'
import { cn } from '@/lib/utils'

function isOverdue(dateStr: string): boolean {
  return new Date(dateStr) < new Date()
}

function isToday(dateStr: string): boolean {
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

  const { data: configData } = useQuery({
    queryKey: ['dashboard-config'],
    queryFn: () => api.get<{ widgets: DashboardWidget[] }>('/settings/dashboard'),
  })

  const widgets = configData?.widgets
    ? [...configData.widgets].sort((a, b) => a.position - b.position)
    : null

  function isEnabled(id: string): boolean {
    if (!widgets) return true
    const w = widgets.find((x) => x.id === id)
    return w ? w.enabled : true
  }

  const kpiWidgets = [
    { id: 'kpi_leads', title: 'Leads este mês', value: String(data?.kpis.leadsThisMonth ?? 0), icon: Users, attainment: data?.kpis.leadsAttainment },
    { id: 'kpi_cpl', title: 'CPL Médio', value: formatCurrency(data?.kpis.cplAverage), icon: DollarSign },
    { id: 'kpi_calls', title: 'Calls realizadas', value: String(data?.kpis.callsThisMonth ?? 0), icon: Phone },
    { id: 'kpi_contracts', title: 'Contratos fechados', value: String(data?.kpis.contractsThisMonth ?? 0), icon: FileText, subtitle: data ? `${formatPercent(data.kpis.conversionRate)} conversão` : undefined },
    { id: 'kpi_cost', title: 'Custo investido', value: formatCurrency(data?.kpis.totalCost), icon: TrendingUp },
    { id: 'kpi_cac', title: 'CAC Médio', value: formatCurrency(data?.kpis.cacAverage), icon: BarChart2 },
  ]

  const visibleKpis = kpiWidgets.filter((k) => isEnabled(k.id))

  return (
    <div className="space-y-6">
      {/* Header row with config button */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <Link href="/configuracoes/dashboard">
          <Button variant="outline" size="sm">
            <Settings2 className="h-4 w-4 mr-2" />
            Configurar
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      {visibleKpis.length > 0 && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {visibleKpis.map((kpi) => (
            <KpiCard
              key={kpi.id}
              title={kpi.title}
              value={isLoading ? '—' : kpi.value}
              icon={kpi.icon}
              attainment={kpi.attainment}
              subtitle={kpi.subtitle}
              isLoading={isLoading}
            />
          ))}
        </div>
      )}

      {/* Charts row */}
      {(isEnabled('chart_channel') || isEnabled('chart_leads')) && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {isLoading ? (
            <>
              {isEnabled('chart_channel') && <Skeleton className="h-72" />}
              {isEnabled('chart_leads') && <Skeleton className="h-72" />}
            </>
          ) : (
            <>
              {isEnabled('chart_channel') && (
                <CanalPerformanceChart data={data?.channelPerformance ?? []} />
              )}
              {isEnabled('chart_leads') && (
                <LeadsChart data={data?.monthlyTrend ?? []} />
              )}
            </>
          )}
        </div>
      )}

      {/* Table + Activities */}
      {(isEnabled('table_channels') || isEnabled('activities')) && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {isEnabled('table_channels') && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Performance por Canal</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="pb-2 text-left font-medium">Canal</th>
                          <th className="pb-2 text-right font-medium">Leads</th>
                          <th className="pb-2 text-right font-medium">Meta</th>
                          <th className="pb-2 text-right font-medium">%</th>
                          <th className="pb-2 text-right font-medium">CPL</th>
                          <th className="pb-2 text-right font-medium">Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data?.channelPerformance ?? []).map((ch) => (
                          <tr key={ch.channelId} className="border-b last:border-0">
                            <td className="py-2">{ch.channelName}</td>
                            <td className="py-2 text-right">{ch.leadsGenerated}</td>
                            <td className="py-2 text-right">{ch.leadsGoal}</td>
                            <td className={cn('py-2 text-right font-semibold', getAttainmentColor(ch.attainment))}>
                              {formatPercent(ch.attainment, 0)}
                            </td>
                            <td className="py-2 text-right">{formatCurrency(ch.cpl)}</td>
                            <td className={cn('py-2 text-right font-semibold', ch.delta >= 0 ? 'text-green-600' : 'text-red-600')}>
                              {ch.delta >= 0 ? '+' : ''}{ch.delta}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {isEnabled('activities') && (
            <RecentActivities activities={data?.recentActivities ?? []} />
          )}
        </div>
      )}

      {/* Tasks + Team */}
      {(isEnabled('tasks') || (isEnabled('team') && isAdminOrGestor())) && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {isEnabled('tasks') && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Próximas Tarefas</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : data?.upcomingTasks?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma tarefa pendente</p>
                ) : (
                  <div className="space-y-3">
                    {data?.upcomingTasks?.map((task) => (
                      <Link key={task.id} href="/tarefas">
                        <div className={cn(
                          'flex items-center gap-3 rounded-lg border p-3 hover:bg-muted transition-colors',
                          isOverdue(task.dueDate) ? 'border-red-200 bg-red-50' : isToday(task.dueDate) ? 'border-amber-200 bg-amber-50' : ''
                        )}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {task.lead?.name ?? task.deal?.title ?? 'Sem vínculo'} · {formatDate(task.dueDate)}
                            </p>
                          </div>
                          <Badge variant={isOverdue(task.dueDate) ? 'danger' : isToday(task.dueDate) ? 'warning' : 'secondary'}>
                            {isOverdue(task.dueDate) ? 'Atrasada' : isToday(task.dueDate) ? 'Hoje' : 'Futura'}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {isEnabled('team') && isAdminOrGestor() && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Performance do Time</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(data?.teamPerformance ?? []).slice(0, 5).map((member) => (
                      <div key={member.userId} className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {member.userName?.[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{member.userName}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{member.leadsCreated} leads</span>
                            <span>·</span>
                            <span>{member.dealsCreated} deals</span>
                            <span>·</span>
                            <span>{member.tasksCompleted} tarefas</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
