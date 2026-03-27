'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { DashboardSummary } from '@/types'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Users, DollarSign, TrendingUp, TrendingDown, UserPlus, BarChart2,
  AlertTriangle, Target, ArrowRight,
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

interface GoalProgress {
  id: string
  name: string
  type: string
  currentValue: number
  targetValue: number
  progressPct: number
}

interface ConversionFunnel {
  leads: number
  scheduled: number
  attended: number
  won: number
}

interface UpcomingMeeting {
  id: string
  title?: string
  scheduledAt: string
  status: string
  opportunity?: { title: string }
}

interface TopLossReason {
  lostReasonId: string
  reason?: { name: string }
  count: number
}

interface OverdueTasks {
  count: number
}

interface DashboardWidgets {
  goal_progress?: GoalProgress[]
  conversion_funnel?: ConversionFunnel
  upcoming_meetings?: UpcomingMeeting[]
  top_loss_reasons?: TopLossReason[]
  overdue_tasks?: OverdueTasks
  [key: string]: unknown
}

const meetingStatusLabel: Record<string, string> = {
  SCHEDULED: 'Agendada',
  CONFIRMED: 'Confirmada',
  DONE: 'Realizada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'Não compareceu',
}

const meetingStatusVariant: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  DONE: 'bg-gray-100 text-gray-700',
  CANCELLED: 'bg-red-100 text-red-700',
  NO_SHOW: 'bg-amber-100 text-amber-700',
}

export default function DashboardPage() {
  useDashboardRealtime()
  const { isAdminOrGestor } = usePermissions()
  const [period, setPeriod] = useState('30')

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardSummary>('/dashboard/summary'),
    refetchInterval: 60000,
  })

  const { data: widgets, isLoading: widgetsLoading } = useQuery({
    queryKey: ['dashboard-widgets', period],
    queryFn: () => api.get<DashboardWidgets>(`/dashboard/widgets?period=${period}`),
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

  const goalProgress = widgets?.goal_progress ?? []
  const convFunnel = widgets?.conversion_funnel
  const upcomingMeetings = widgets?.upcoming_meetings ?? []
  const topLossReasons = widgets?.top_loss_reasons ?? []
  const overdueTasks = widgets?.overdue_tasks

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="h-8 w-32 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
            <SelectItem value="90">90 dias</SelectItem>
          </SelectContent>
        </Select>
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

      {/* Tasks + New widgets row */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Próximas Tarefas</CardTitle>
            {overdueTasks && overdueTasks.count > 0 && (
              <Link href="/tarefas">
                <Badge className="bg-red-100 text-red-700 border-red-200 gap-1 cursor-pointer hover:bg-red-200">
                  <AlertTriangle className="h-3 w-3" />
                  {overdueTasks.count} atrasada{overdueTasks.count !== 1 ? 's' : ''}
                </Badge>
              </Link>
            )}
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
                  const overdueTask = isOverdue(task.dueDate)
                  const today = isToday(task.dueDate)
                  return (
                    <Link key={task.id} href="/tarefas">
                      <div className={cn(
                        'flex items-center gap-3 rounded-lg border p-3 hover:bg-muted transition-colors',
                        overdueTask ? 'border-red-200 bg-red-50' : today ? 'border-amber-200 bg-amber-50' : ''
                      )}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {task.contact?.name ?? task.opportunity?.title ?? 'Sem vínculo'}
                            {task.dueDate && ` · ${formatDate(task.dueDate)}`}
                          </p>
                        </div>
                        <Badge variant={overdueTask ? 'destructive' : 'secondary'}>
                          {overdueTask ? 'Atrasada' : today ? 'Hoje' : 'Futura'}
                        </Badge>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Meetings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Próximas Reuniões</CardTitle>
          </CardHeader>
          <CardContent>
            {widgetsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : upcomingMeetings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma reunião agendada</p>
            ) : (
              <div className="space-y-3">
                {upcomingMeetings.map((meeting) => (
                  <div key={meeting.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {meeting.title ?? meeting.opportunity?.title ?? 'Reunião'}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(meeting.scheduledAt)}</p>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${meetingStatusVariant[meeting.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {meetingStatusLabel[meeting.status] ?? meeting.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Goals + Conversion Funnel + Loss Reasons */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Goal Progress */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Metas</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
              <Link href="/metas">Ver todas <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {widgetsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : goalProgress.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma meta configurada</p>
            ) : (
              <div className="space-y-4">
                {goalProgress.map((goal) => (
                  <div key={goal.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{goal.name}</span>
                      <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                        {goal.progressPct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          goal.progressPct >= 100
                            ? 'bg-green-500'
                            : goal.progressPct >= 70
                            ? 'bg-blue-500'
                            : goal.progressPct >= 40
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        )}
                        style={{ width: `${Math.min(100, goal.progressPct)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(goal.currentValue)} / {formatCurrency(goal.targetValue)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversion Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funil de Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            {widgetsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !convFunnel ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <div className="space-y-2">
                {[
                  { label: 'Leads', value: convFunnel.leads, color: 'bg-blue-500' },
                  { label: 'Agendados', value: convFunnel.scheduled, color: 'bg-indigo-500' },
                  { label: 'Compareceram', value: convFunnel.attended, color: 'bg-violet-500' },
                  { label: 'Ganhos', value: convFunnel.won, color: 'bg-green-500' },
                ].map((step, i, arr) => {
                  const maxVal = arr[0]?.value ?? 1
                  const pct = maxVal > 0 ? (step.value / maxVal) * 100 : 0
                  const convRate = i > 0 && (arr[i - 1]?.value ?? 0) > 0
                    ? ((step.value / (arr[i - 1]?.value ?? 1)) * 100).toFixed(0)
                    : null
                  return (
                    <div key={step.label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{step.label}</span>
                        <div className="flex items-center gap-2">
                          {convRate && (
                            <span className="text-xs text-muted-foreground">{convRate}%</span>
                          )}
                          <span className="font-semibold">{step.value}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${step.color}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Loss Reasons */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Motivos de Perda</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {widgetsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : topLossReasons.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados de perda</p>
            ) : (
              <div className="space-y-2">
                {topLossReasons.map((item, i) => {
                  const maxCount = topLossReasons[0]?.count ?? 1
                  const pct = (item.count / maxCount) * 100
                  return (
                    <div key={item.lostReasonId} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate text-muted-foreground">
                          {i + 1}. {item.reason?.name ?? 'Sem motivo'}
                        </span>
                        <span className="font-semibold ml-2 flex-shrink-0">{item.count}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
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
