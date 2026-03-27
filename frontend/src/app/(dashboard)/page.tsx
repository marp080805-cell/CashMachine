'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { DashboardSummary, Task, Opportunity, PaginatedResponse } from '@/types'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Users, DollarSign, TrendingUp, TrendingDown, UserPlus, BarChart2,
  AlertTriangle, Target, ArrowRight, CheckCircle2, Clock, Phone,
  Mail, Calendar, MessageSquare,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useDashboardRealtime } from '@/hooks/useRealtime'
import { usePermissions } from '@/hooks/usePermissions'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// ─── helpers ──────────────────────────────────────────────────────

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

// ─── types ────────────────────────────────────────────────────────

interface GoalProgress {
  id: string
  goalId: string
  name: string
  type: string
  currentValue: number
  targetValue: number
  progress: number
}

interface ConversionFunnel {
  total_leads: number
  scheduled: number
  attended: number
  won: number
  scheduled_pct: number
  attended_pct: number
  won_pct: number
  overall_conversion: number
}

interface UpcomingMeeting {
  id: string
  title?: string
  startDatetime: string
  status: string
  opportunity?: { id: string; title: string }
  contact?: { id: string; name: string }
}

interface TopLossReason {
  lostReasonId: string | null
  name: string
  count: number
}

interface DashboardWidgetsRaw {
  period: string
  date_range: { start: string; end: string }
  widgets: {
    goal_progress?: GoalProgress[]
    mrr_current?: number
    revenue_current?: number
    deal_count?: number
    conversion_funnel?: ConversionFunnel
    pipeline_value?: number
    overdue_tasks?: number
    upcoming_meetings?: UpcomingMeeting[]
    top_loss_reasons?: TopLossReason[]
    sdr_metrics?: {
      leads_created: number
      scheduled: number
      sla_compliance_rate: number
    }
    closer_metrics?: {
      closing_rate: number
      ticket_medio: number
      revenue: number
    }
    [key: string]: unknown
  }
}

interface FunnelStage {
  stageId: string
  stageName: string
  stageColor: string
  sortOrder: number
  count: number
  value: number
}

interface FunnelResponse {
  period: string
  funnel: {
    total: number
    scheduled: number
    attended: number
    won: number
    overall_conversion: number
  }
  by_stage: FunnelStage[]
}

interface OriginImpact {
  originId: string | null
  originName: string
  total_leads: number
  won_count: number
  revenue: number
  conversion_rate: number
}

interface OriginImpactResponse {
  period: string
  by_origin: OriginImpact[]
}

// ─── constants ────────────────────────────────────────────────────

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

const taskTypeIcon: Record<string, typeof Phone> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Calendar,
  FIRST_CONTACT: Phone,
  FOLLOW_UP: MessageSquare,
  SCHEDULE_MEETING: Calendar,
  CONFIRM_PRESENCE: CheckCircle2,
}

const PERIOD_OPTIONS = [
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
]

// ─── component ────────────────────────────────────────────────────

export default function DashboardPage() {
  useDashboardRealtime()
  const { isAdminOrGestor } = usePermissions()
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')

  // Summary: KPIs, activities, pipeline
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardSummary>('/dashboard/summary'),
    refetchInterval: 60000,
  })

  // Widgets: goals, funnel, meetings, loss reasons, pipeline_value, overdue
  const { data: widgetsRaw, isLoading: widgetsLoading } = useQuery({
    queryKey: ['dashboard-widgets', period],
    queryFn: () => api.get<DashboardWidgetsRaw>(`/dashboard/widgets?period=${period}`),
    refetchInterval: 60000,
  })

  // Funnel by stage
  const { data: funnelData, isLoading: funnelLoading } = useQuery({
    queryKey: ['analytics-funnel', period],
    queryFn: () => api.get<FunnelResponse>(`/analytics/funnel?period=${period}`),
    refetchInterval: 120000,
  })

  // Origin impact
  const { data: originData, isLoading: originLoading } = useQuery({
    queryKey: ['analytics-origin', period],
    queryFn: () => api.get<OriginImpactResponse>(`/analytics/origin-impact?period=${period}`),
    refetchInterval: 120000,
  })

  // My queue
  const { data: myQueue, isLoading: queueLoading } = useQuery({
    queryKey: ['tasks-my-queue'],
    queryFn: () => api.get<Task[]>('/tasks/my-queue'),
    refetchInterval: 30000,
  })

  // Recent opportunities
  const { data: recentOpps, isLoading: oppsLoading } = useQuery({
    queryKey: ['opportunities-recent'],
    queryFn: () => api.get<PaginatedResponse<Opportunity>>('/opportunities?limit=5'),
    refetchInterval: 60000,
  })

  // Complete task mutation
  const completeTask = useMutation({
    mutationFn: (taskId: string) => api.post(`/tasks/${taskId}/complete`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks-my-queue'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-widgets'] })
    },
  })

  // Extract widgets safely (backend wraps in `widgets` key)
  const widgets = widgetsRaw?.widgets

  const goalProgress = widgets?.goal_progress ?? []
  const convFunnel = widgets?.conversion_funnel
  const upcomingMeetings = widgets?.upcoming_meetings ?? []
  const topLossReasons = widgets?.top_loss_reasons ?? []
  const overdueTasksCount = widgets?.overdue_tasks ?? 0
  const pipelineValue = widgets?.pipeline_value ?? 0

  // My queue (max 5 items)
  const queueItems = (myQueue ?? []).slice(0, 5)

  // Main KPI row (4 cards)
  const mainKpis = [
    {
      id: 'open',
      title: 'Oportunidades Abertas',
      value: String(data?.kpis.openOpportunities ?? 0),
      icon: BarChart2,
    },
    {
      id: 'pipeline',
      title: 'Valor em Pipeline',
      value: widgetsLoading ? '—' : formatCurrency(pipelineValue),
      icon: DollarSign,
    },
    {
      id: 'winrate',
      title: 'Taxa de Conversão',
      value: `${((data?.kpis.winRate ?? 0)).toFixed(1)}%`,
      icon: TrendingUp,
    },
    {
      id: 'overdue',
      title: 'Tarefas Atrasadas',
      value: widgetsLoading ? '—' : String(overdueTasksCount),
      icon: AlertTriangle,
      highlight: overdueTasksCount > 0 ? 'red' as const : undefined,
    },
  ]

  // Secondary KPI row
  const secondaryKpis = [
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
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        {/* Period toggle buttons */}
        <div className="flex items-center gap-1 rounded-lg border bg-muted p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value as '7d' | '30d' | '90d')}
              className={cn(
                'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                period === opt.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main KPI row — 4 cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {mainKpis.map((kpi) => (
          <KpiCard
            key={kpi.id}
            title={kpi.title}
            value={(isLoading || widgetsLoading) ? '—' : kpi.value}
            icon={kpi.icon}
            isLoading={isLoading || widgetsLoading}
          />
        ))}
      </div>

      {/* Secondary KPI row — 4 cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {secondaryKpis.map((kpi) => (
          <KpiCard
            key={kpi.id}
            title={kpi.title}
            value={isLoading ? '—' : kpi.value}
            icon={kpi.icon}
            isLoading={isLoading}
          />
        ))}
      </div>

      {/* Pipeline + Activities */}
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

      {/* My Queue + Upcoming Meetings */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* My Queue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Minha Fila</CardTitle>
            <div className="flex items-center gap-2">
              {overdueTasksCount > 0 && (
                <Badge className="bg-red-100 text-red-700 border-red-200 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {overdueTasksCount} atrasada{overdueTasksCount !== 1 ? 's' : ''}
                </Badge>
              )}
              <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                <Link href="/tarefas">Ver todas <ArrowRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {queueLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : queueItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma tarefa pendente</p>
            ) : (
              <div className="space-y-2">
                {queueItems.map((task) => {
                  const overdueTask = isOverdue(task.dueDate)
                  const today = isToday(task.dueDate)
                  const TypeIcon = taskTypeIcon[task.type] ?? Clock
                  return (
                    <div
                      key={task.id}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                        overdueTask ? 'border-red-200 bg-red-50' : today ? 'border-amber-200 bg-amber-50' : 'hover:bg-muted'
                      )}
                    >
                      <button
                        className="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-green-600 transition-colors"
                        onClick={() => completeTask.mutate(task.id)}
                        title="Marcar como concluída"
                        disabled={completeTask.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <TypeIcon className="h-3 w-3 flex-shrink-0" />
                          {task.opportunity?.title ?? task.contact?.name ?? 'Sem vínculo'}
                          {task.dueDate && ` · ${formatDate(task.dueDate)}`}
                        </p>
                      </div>
                      <Badge variant={overdueTask ? 'destructive' : 'secondary'} className="flex-shrink-0 text-xs">
                        {overdueTask ? 'Atrasada' : today ? 'Hoje' : 'Futura'}
                      </Badge>
                    </div>
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
                        {meeting.title ?? meeting.opportunity?.title ?? meeting.contact?.name ?? 'Reunião'}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(meeting.startDatetime)}</p>
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

      {/* Funnel by stage + Recent Opportunities */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Funnel by stage */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Funil por Estágio</CardTitle>
            <span className="text-xs text-muted-foreground">
              {funnelData ? `${funnelData.funnel.total} leads · ${funnelData.funnel.overall_conversion.toFixed(1)}% conversão` : ''}
            </span>
          </CardHeader>
          <CardContent>
            {funnelLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : !funnelData || funnelData.by_stage.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados de funil no período</p>
            ) : (
              <div className="space-y-2">
                {funnelData.by_stage.map((stage) => {
                  const maxCount = Math.max(...funnelData.by_stage.map((s) => s.count), 1)
                  const pct = (stage.count / maxCount) * 100
                  return (
                    <div key={stage.stageId} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate max-w-[180px]">{stage.stageName}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{formatCurrency(stage.value)}</span>
                          <span className="font-semibold w-6 text-right">{stage.count}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: stage.stageColor }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Opportunities */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Últimas Oportunidades</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
              <Link href="/oportunidades">Ver todas <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {oppsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (recentOpps?.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma oportunidade</p>
            ) : (
              <div className="space-y-2">
                {(recentOpps?.data ?? []).slice(0, 5).map((opp) => (
                  <Link key={opp.id} href={`/oportunidades/${opp.id}`}>
                    <div className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{opp.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {opp.pipeline?.name} · {opp.stage?.name}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold">{opp.value ? formatCurrency(opp.value) : '—'}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(opp.createdAt)}</p>
                      </div>
                    </div>
                  </Link>
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
                  <div key={goal.goalId ?? goal.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{goal.name}</span>
                      <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                        {(goal.progress ?? 0).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          (goal.progress ?? 0) >= 100
                            ? 'bg-green-500'
                            : (goal.progress ?? 0) >= 70
                            ? 'bg-blue-500'
                            : (goal.progress ?? 0) >= 40
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        )}
                        style={{ width: `${Math.min(100, goal.progress ?? 0)}%` }}
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

        {/* Conversion Funnel (simple steps from widgets) */}
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
                  { label: 'Leads', value: convFunnel.total_leads, color: 'bg-blue-500' },
                  { label: 'Agendados', value: convFunnel.scheduled, color: 'bg-indigo-500', pct: convFunnel.scheduled_pct },
                  { label: 'Compareceram', value: convFunnel.attended, color: 'bg-violet-500', pct: convFunnel.attended_pct },
                  { label: 'Ganhos', value: convFunnel.won, color: 'bg-green-500', pct: convFunnel.won_pct },
                ].map((step) => {
                  const maxVal = convFunnel.total_leads || 1
                  const barPct = (step.value / maxVal) * 100
                  return (
                    <div key={step.label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{step.label}</span>
                        <div className="flex items-center gap-2">
                          {'pct' in step && step.pct !== undefined && (
                            <span className="text-xs text-muted-foreground">{step.pct.toFixed(0)}%</span>
                          )}
                          <span className="font-semibold">{step.value}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${step.color}`}
                          style={{ width: `${barPct}%` }}
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
                    <div key={item.lostReasonId ?? i} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate text-muted-foreground">
                          {i + 1}. {item.name ?? 'Sem motivo'}
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

      {/* Metrics by Origin */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Conversão por Origem</CardTitle>
          <span className="text-xs text-muted-foreground">período: {period}</span>
        </CardHeader>
        <CardContent>
          {originLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : !originData || originData.by_origin.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados de origem no período</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left font-medium text-muted-foreground">Origem</th>
                    <th className="py-2 text-right font-medium text-muted-foreground">Leads</th>
                    <th className="py-2 text-right font-medium text-muted-foreground">Convertidos</th>
                    <th className="py-2 text-right font-medium text-muted-foreground">Taxa</th>
                    <th className="py-2 text-right font-medium text-muted-foreground">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {originData.by_origin.map((row, i) => (
                    <tr key={row.originId ?? i} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-2 font-medium">{row.originName}</td>
                      <td className="py-2 text-right tabular-nums">{row.total_leads}</td>
                      <td className="py-2 text-right tabular-nums">{row.won_count}</td>
                      <td className="py-2 text-right tabular-nums">
                        <span className={cn(
                          'font-medium',
                          row.conversion_rate >= 20 ? 'text-green-600' :
                          row.conversion_rate >= 10 ? 'text-amber-600' : 'text-red-600'
                        )}>
                          {row.conversion_rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2 text-right tabular-nums">{formatCurrency(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
