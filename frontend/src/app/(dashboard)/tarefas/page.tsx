'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { Task, Lead, User } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckSquare, Phone, Mail, Users, Calendar, FileText, Plus, Loader2 } from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { useAuth } from '@/hooks/useAuth'

const taskTypeIcons: Record<string, React.ElementType> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Users,
  VISIT: Calendar,
  PROPOSAL: FileText,
  FOLLOW_UP: Phone,
  OTHER: FileText,
}

const taskTypeLabels: Record<string, string> = {
  CALL: 'Ligação',
  EMAIL: 'Email',
  MEETING: 'Reunião',
  VISIT: 'Visita',
  PROPOSAL: 'Proposta',
  FOLLOW_UP: 'Follow-up',
  OTHER: 'Outro',
}

type FilterTab = 'today' | 'week' | 'overdue' | 'all'

function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date() && !isTaskToday(dueDate)
}

function isTaskToday(dueDate: string): boolean {
  return new Date(dueDate).toDateString() === new Date().toDateString()
}

interface TaskForm {
  title: string
  type: string
  dueDate: string
  leadId: string
  description: string
}

const defaultForm: TaskForm = {
  title: '',
  type: 'CALL',
  dueDate: '',
  leadId: '',
  description: '',
}

export default function TarefasPage() {
  const [filter, setFilter] = useState<FilterTab>('today')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<TaskForm>(defaultForm)
  const [leadSearch, setLeadSearch] = useState('')
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', filter],
    queryFn: () => api.get<Task[]>(`/tasks?filter=${filter}`),
  })

  const { data: leadsData } = useQuery({
    queryKey: ['leads-search-tasks', leadSearch],
    queryFn: () =>
      api.get<{ leads: Lead[] }>(`/leads?limit=10${leadSearch ? `&search=${encodeURIComponent(leadSearch)}` : ''}`),
    enabled: modalOpen,
  })

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/tasks/${id}/complete`),
    onSuccess: () => {
      toast.success('Tarefa concluída!')
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: () => toast.error('Erro ao completar tarefa'),
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Task>('/tasks', body),
    onSuccess: () => {
      toast.success('Tarefa criada!')
      setModalOpen(false)
      setForm(defaultForm)
      setLeadSearch('')
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: () => toast.error('Erro ao criar tarefa'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Título é obrigatório'); return }
    if (!form.dueDate) { toast.error('Data de vencimento é obrigatória'); return }
    if (!user?.id) { toast.error('Usuário não identificado'); return }

    createMutation.mutate({
      title: form.title,
      type: form.type,
      dueDate: new Date(form.dueDate).toISOString(),
      assignedToId: user.id,
      ...(form.leadId && { leadId: form.leadId }),
      ...(form.description && { description: form.description }),
    })
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'today', label: 'Hoje' },
    { key: 'week', label: 'Esta Semana' },
    { key: 'overdue', label: 'Atrasadas' },
    { key: 'all', label: 'Todas' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                filter === tab.key
                  ? 'bg-card shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Tarefa
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : tasks?.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma tarefa neste período</p>
          <Button size="sm" className="mt-4" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar primeira tarefa
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks?.map((task) => {
            const Icon = taskTypeIcons[task.type] ?? FileText
            const overdueTask = task.dueDate ? isOverdue(task.dueDate) : false
            const todayTask = task.dueDate ? isTaskToday(task.dueDate) : false

            return (
              <div
                key={task.id}
                className={cn(
                  'flex items-center gap-4 rounded-lg border bg-card p-4',
                  task.isCompleted && 'opacity-60',
                  overdueTask && !task.isCompleted && 'border-red-200',
                  todayTask && !task.isCompleted && !overdueTask && 'border-amber-200'
                )}
              >
                <button
                  onClick={() => !task.isCompleted && completeMutation.mutate(task.id)}
                  disabled={task.isCompleted || completeMutation.isPending}
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
                    task.isCompleted
                      ? 'border-primary bg-primary text-white'
                      : 'border-muted-foreground hover:border-primary'
                  )}
                >
                  {task.isCompleted && <CheckSquare className="h-3 w-3" />}
                </button>

                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', task.isCompleted && 'line-through')}>{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    {task.lead && (
                      <Link href={`/leads/${task.lead.id}`} className="hover:underline text-primary">
                        {task.lead.name}
                      </Link>
                    )}
                    {task.deal && <span>{task.deal.title}</span>}
                    <span>·</span>
                    <span>{formatDateTime(task.dueDate)}</span>
                  </div>
                </div>

                <Badge
                  variant={
                    task.isCompleted ? 'success' : overdueTask ? 'danger' : todayTask ? 'warning' : 'secondary'
                  }
                  className="shrink-0"
                >
                  {task.isCompleted ? 'Concluída' : overdueTask ? 'Atrasada' : todayTask ? 'Hoje' : 'Futura'}
                </Badge>
              </div>
            )
          })}
        </div>
      )}

      {/* Nova Tarefa Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) { setForm(defaultForm); setLeadSearch('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input
                placeholder="Ex: Ligar para o cliente"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(taskTypeLabels).map(([val, lbl]) => (
                      <SelectItem key={val} value={val}>{lbl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Vencimento *</Label>
                <Input
                  type="datetime-local"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Vincular a um Lead</Label>
              <Input
                placeholder="Buscar lead..."
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
              />
              {form.leadId ? (
                <div className="flex items-center gap-2 rounded border px-3 py-2 bg-primary/5 text-sm">
                  <span className="flex-1 font-medium">
                    {leadsData?.leads.find((l) => l.id === form.leadId)?.name ?? 'Lead vinculado'}
                  </span>
                  <button type="button" onClick={() => { setForm((f) => ({ ...f, leadId: '' })); setLeadSearch('') }}
                    className="text-muted-foreground hover:text-foreground text-xs">✕</button>
                </div>
              ) : leadSearch ? (
                <div className="rounded border divide-y max-h-32 overflow-y-auto">
                  {(leadsData?.leads ?? []).map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => { setForm((f) => ({ ...f, leadId: lead.id })); setLeadSearch('') }}
                    >
                      {lead.name}
                    </button>
                  ))}
                  {leadsData?.leads.length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum lead encontrado</p>
                  )}
                </div>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input
                placeholder="Detalhes adicionais..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</>
                ) : 'Criar Tarefa'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
