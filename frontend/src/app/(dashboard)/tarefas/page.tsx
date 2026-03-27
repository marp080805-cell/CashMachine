'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { Task, User } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  CheckSquare, Phone, Mail, Users, Calendar, FileText,
  Plus, Loader2, CheckCircle2, Circle, Filter,
} from 'lucide-react'
import { cn, formatDateTime, getInitials } from '@/lib/utils'
import Link from 'next/link'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/hooks/useAuth'
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns'

// ── Task type maps ──

const taskTypeIcons: Record<string, React.ElementType> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Users,
  VISIT: Calendar,
  FIRST_CONTACT: Phone,
  FOLLOW_UP: Phone,
  QUALIFY: CheckSquare,
  SCHEDULE_MEETING: Calendar,
  SEND_PROPOSAL: FileText,
  FOLLOW_UP_PROPOSAL: FileText,
  CONFIRM_PRESENCE: CheckSquare,
  PREPARE_BRIEFING: FileText,
  REMINDER: Calendar,
  RESCUE_CONTACT: Phone,
  CUSTOM: FileText,
}

const taskTypeLabels: Record<string, string> = {
  CALL: 'Ligação',
  EMAIL: 'Email',
  MEETING: 'Reunião',
  VISIT: 'Visita',
  FIRST_CONTACT: 'Primeiro Contato',
  FOLLOW_UP: 'Follow-up',
  QUALIFY: 'Qualificação',
  SCHEDULE_MEETING: 'Agendar Reunião',
  SEND_PROPOSAL: 'Enviar Proposta',
  FOLLOW_UP_PROPOSAL: 'Follow-up Proposta',
  CONFIRM_PRESENCE: 'Confirmar Presença',
  PREPARE_BRIEFING: 'Preparar Briefing',
  REMINDER: 'Lembrete',
  RESCUE_CONTACT: 'Resgatar Contato',
  CUSTOM: 'Outro',
}

const priorityLabels: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

const priorityColors: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700 border-gray-200',
  MEDIUM: 'bg-blue-100 text-blue-700 border-blue-200',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
  URGENT: 'bg-red-100 text-red-700 border-red-200',
}

// ── SLA badge ──

function getSlaStatus(task: Task): { label: string; color: string } {
  if (task.status === 'COMPLETED') return { label: 'Concluída', color: 'bg-green-100 text-green-700' }
  if (task.status === 'OVERDUE') return { label: 'Atrasada', color: 'bg-red-100 text-red-700' }
  if (!task.dueDate) return { label: 'Sem prazo', color: 'bg-gray-100 text-gray-600' }
  const due = new Date(task.dueDate)
  const now = new Date()
  if (due < now) return { label: 'Atrasada', color: 'bg-red-100 text-red-700' }
  const diffMs = due.getTime() - now.getTime()
  const diffH = diffMs / (1000 * 60 * 60)
  if (diffH < 2) return { label: 'Vence em breve', color: 'bg-orange-100 text-orange-700' }
  return { label: 'No prazo', color: 'bg-green-100 text-green-700' }
}

// ── TaskCard ──

interface TaskCardProps {
  task: Task
  onComplete: (id: string) => void
}

function TaskCard({ task, onComplete }: TaskCardProps) {
  const isCompleted = task.status === 'COMPLETED'
  const Icon = taskTypeIcons[task.type] ?? FileText
  const sla = getSlaStatus(task)

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-lg border bg-card p-4',
      isCompleted && 'opacity-60',
      (task.status === 'OVERDUE' || (task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted)) && 'border-red-200',
    )}>
      <button
        onClick={() => !isCompleted && onComplete(task.id)}
        disabled={isCompleted}
        className="shrink-0"
        title={isCompleted ? 'Concluída' : 'Marcar como concluída'}
      >
        {isCompleted
          ? <CheckCircle2 className="h-5 w-5 text-green-500" />
          : <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
        }
      </button>

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', isCompleted && 'line-through text-muted-foreground')}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {task.contact && (
            <Link href={`/contatos/${task.contact.id}`} className="text-xs text-primary hover:underline">
              {task.contact.name}
            </Link>
          )}
          {task.opportunity && (
            <span className="text-xs text-muted-foreground">{task.opportunity.title}</span>
          )}
          {task.dueDate && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{formatDateTime(task.dueDate)}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span className={cn('text-xs px-1.5 py-0.5 rounded border', priorityColors[task.priority] ?? 'bg-gray-100 text-gray-600')}>
            {priorityLabels[task.priority] ?? task.priority}
          </span>
          <span className={cn('text-xs px-1.5 py-0.5 rounded', sla.color)}>
            {sla.label}
          </span>
          <Badge variant="outline" className="text-xs h-5">
            {taskTypeLabels[task.type] ?? task.type}
          </Badge>
        </div>
      </div>

      {task.assignedTo && (
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {getInitials(task.assignedTo.name)}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}

// ── Main Page ──

interface TaskFilters {
  type: string
  priority: string
}

export default function TarefasPage() {
  const [activeTab, setActiveTab] = useState('today')
  const [filters, setFilters] = useState<TaskFilters>({ type: '', priority: '' })

  const [completeModalId, setCompleteModalId] = useState<string | null>(null)
  const [completionNotes, setCompletionNotes] = useState('')

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    title: '',
    type: 'CALL',
    priority: 'MEDIUM',
    dueDate: '',
    opportunityId: '',
    contactId: '',
    assignedToId: '',
  })

  const queryClient = useQueryClient()
  const { user } = useAuth()

  function buildQueryParams(tab: string) {
    const now = new Date()
    const params = new URLSearchParams()
    if (tab === 'today') {
      params.set('dueDate_gte', startOfDay(now).toISOString())
      params.set('dueDate_lte', endOfDay(now).toISOString())
    } else if (tab === 'week') {
      params.set('dueDate_gte', startOfWeek(now, { weekStartsOn: 1 }).toISOString())
      params.set('dueDate_lte', endOfWeek(now, { weekStartsOn: 1 }).toISOString())
    } else if (tab === 'overdue') {
      params.set('status', 'OVERDUE')
    }
    if (filters.type) params.set('type', filters.type)
    if (filters.priority) params.set('priority', filters.priority)
    return params.toString()
  }

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', activeTab, filters],
    queryFn: () => api.get<Task[]>(`/tasks?${buildQueryParams(activeTab)}`),
  })

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<{ users: User[] }>('/users'),
    enabled: createModalOpen,
  })

  const completeMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      api.patch<Task>(`/tasks/${id}/complete`, { completionNotes: notes }),
    onSuccess: () => {
      toast.success('Tarefa concluída!')
      setCompleteModalId(null)
      setCompletionNotes('')
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: () => toast.error('Erro ao completar tarefa'),
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Task>('/tasks', body),
    onSuccess: () => {
      toast.success('Tarefa criada!')
      setCreateModalOpen(false)
      setCreateForm({ title: '', type: 'CALL', priority: 'MEDIUM', dueDate: '', opportunityId: '', contactId: '', assignedToId: '' })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: () => toast.error('Erro ao criar tarefa'),
  })

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.title.trim()) { toast.error('Título é obrigatório'); return }
    if (!createForm.dueDate) { toast.error('Data de vencimento é obrigatória'); return }

    const assignId = createForm.assignedToId || user?.id
    if (!assignId) { toast.error('Responsável não identificado'); return }

    createMutation.mutate({
      title: createForm.title,
      type: createForm.type,
      priority: createForm.priority,
      dueDate: new Date(createForm.dueDate).toISOString(),
      assignedToId: assignId,
      ...(createForm.opportunityId && { opportunityId: createForm.opportunityId }),
      ...(createForm.contactId && { contactId: createForm.contactId }),
    })
  }

  const filteredTasks = tasks ?? []

  const tabLabels: Record<string, string> = {
    today: 'Hoje',
    week: 'Esta Semana',
    overdue: 'Atrasadas',
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">Tarefas</h1>
        <Button size="sm" onClick={() => setCreateModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Tarefa
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select
          value={filters.type || 'ALL'}
          onValueChange={(v) => setFilters((f) => ({ ...f, type: v === 'ALL' ? '' : v }))}
        >
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os tipos</SelectItem>
            {Object.entries(taskTypeLabels).map(([val, lbl]) => (
              <SelectItem key={val} value={val} className="text-xs">{lbl}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.priority || 'ALL'}
          onValueChange={(v) => setFilters((f) => ({ ...f, priority: v === 'ALL' ? '' : v }))}
        >
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas as prioridades</SelectItem>
            {Object.entries(priorityLabels).map(([val, lbl]) => (
              <SelectItem key={val} value={val} className="text-xs">{lbl}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filters.type || filters.priority) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setFilters({ type: '', priority: '' })}>
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {Object.entries(tabLabels).map(([key, label]) => (
            <TabsTrigger key={key} value={key}>
              {label}
              {activeTab === key && filteredTasks.length > 0 ? ` (${filteredTasks.length})` : ''}
            </TabsTrigger>
          ))}
        </TabsList>

        {(['today', 'week', 'overdue'] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma tarefa {tab === 'today' ? 'para hoje' : tab === 'week' ? 'esta semana' : 'atrasada'}</p>
                <Button size="sm" className="mt-4" onClick={() => setCreateModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Tarefa
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={(id) => setCompleteModalId(id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Complete Task Modal */}
      <Dialog
        open={!!completeModalId}
        onOpenChange={(open) => { if (!open) { setCompleteModalId(null); setCompletionNotes('') } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Concluir Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Notas de conclusão <span className="text-red-500">*</span></Label>
              <Textarea
                rows={4}
                placeholder="Descreva o que foi realizado..."
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                className="resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setCompleteModalId(null); setCompletionNotes('') }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                disabled={!completionNotes.trim() || completeMutation.isPending}
                onClick={() => {
                  if (completeModalId) {
                    completeMutation.mutate({ id: completeModalId, notes: completionNotes })
                  }
                }}
              >
                {completeMutation.isPending
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                  : 'Concluir Tarefa'
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Task Modal */}
      <Dialog
        open={createModalOpen}
        onOpenChange={(open) => {
          setCreateModalOpen(open)
          if (!open) setCreateForm({ title: '', type: 'CALL', priority: 'MEDIUM', dueDate: '', opportunityId: '', contactId: '', assignedToId: '' })
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Ex: Ligar para o cliente"
                value={createForm.title}
                onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={createForm.type} onValueChange={(v) => setCreateForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(taskTypeLabels).map(([val, lbl]) => (
                      <SelectItem key={val} value={val}>{lbl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select value={createForm.priority} onValueChange={(v) => setCreateForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityLabels).map(([val, lbl]) => (
                      <SelectItem key={val} value={val}>{lbl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Vencimento <span className="text-red-500">*</span></Label>
              <Input
                type="datetime-local"
                value={createForm.dueDate}
                onChange={(e) => setCreateForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
            {(usersData?.users ?? []).length > 0 && (
              <div className="space-y-1.5">
                <Label>Responsável</Label>
                <Select value={createForm.assignedToId} onValueChange={(v) => setCreateForm((f) => ({ ...f, assignedToId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {(usersData?.users ?? []).map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setCreateModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                {createMutation.isPending
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</>
                  : 'Criar Tarefa'
                }
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
