'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Target, Plus, Loader2, Pencil, Trash2,
} from 'lucide-react'
import { cn, formatDate, formatCurrency } from '@/lib/utils'

// ── Types ──

interface Goal {
  id: string
  name: string
  type: string
  targetValue: number
  startDate: string
  endDate: string
  scope: string
  userId?: string | null
  channelId?: string | null
}

interface GoalProgress extends Goal {
  currentValue: number
  progressPct: number
}

// ── Constants ──

const goalTypes = [
  { value: 'REVENUE', label: 'Receita' },
  { value: 'MRR', label: 'MRR' },
  { value: 'DEAL_COUNT', label: 'Número de Deals' },
  { value: 'NEW_LEADS', label: 'Novos Leads' },
  { value: 'MEETINGS_BOOKED', label: 'Reuniões Agendadas' },
  { value: 'CONVERSION_SDR', label: 'Conversão SDR' },
  { value: 'CONVERSION_CLOSER', label: 'Conversão Closer' },
  { value: 'CPL', label: 'CPL' },
]

const goalScopes = [
  { value: 'global', label: 'Global' },
  { value: 'user', label: 'Por Usuário' },
  { value: 'channel', label: 'Por Canal' },
]

const typeBadgeColors: Record<string, string> = {
  REVENUE: 'bg-green-100 text-green-700',
  MRR: 'bg-emerald-100 text-emerald-700',
  DEAL_COUNT: 'bg-blue-100 text-blue-700',
  NEW_LEADS: 'bg-purple-100 text-purple-700',
  MEETINGS_BOOKED: 'bg-indigo-100 text-indigo-700',
  CONVERSION_SDR: 'bg-cyan-100 text-cyan-700',
  CONVERSION_CLOSER: 'bg-teal-100 text-teal-700',
  CPL: 'bg-orange-100 text-orange-700',
}

// ── Helpers ──

function formatGoalValue(value: number, type: string): string {
  if (type === 'REVENUE' || type === 'MRR' || type === 'CPL') {
    return formatCurrency(value)
  }
  if (type === 'CONVERSION_SDR' || type === 'CONVERSION_CLOSER') {
    return `${value.toFixed(1)}%`
  }
  return value.toLocaleString('pt-BR')
}

function progressColor(pct: number): string {
  if (pct >= 80) return 'bg-green-500'
  if (pct >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}

function progressTextColor(pct: number): string {
  if (pct >= 80) return 'text-green-600'
  if (pct >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

// ── GoalCard ──

function GoalCard({
  goal,
  onEdit,
  onDelete,
}: {
  goal: GoalProgress
  onEdit: (goal: GoalProgress) => void
  onDelete: (id: string) => void
}) {
  const typeLabel = goalTypes.find((t) => t.value === goal.type)?.label ?? goal.type
  const pct = Math.min(100, goal.progressPct)

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{goal.name}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', typeBadgeColors[goal.type] ?? 'bg-gray-100 text-gray-700')}>
              {typeLabel}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDate(goal.startDate)} – {formatDate(goal.endDate)}
            </span>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(goal)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(goal.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {formatGoalValue(goal.currentValue, goal.type)} / {formatGoalValue(goal.targetValue, goal.type)}
          </span>
          <span className={cn('text-xs font-bold', progressTextColor(pct))}>
            {pct.toFixed(1)}%
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', progressColor(pct))}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Scope */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Escopo: {goalScopes.find((s) => s.value === goal.scope)?.label ?? goal.scope}</span>
      </div>
    </div>
  )
}

// ── GoalFormModal ──

interface GoalForm {
  name: string
  type: string
  targetValue: string
  startDate: string
  endDate: string
  scope: string
}

const defaultForm: GoalForm = {
  name: '',
  type: 'REVENUE',
  targetValue: '',
  startDate: '',
  endDate: '',
  scope: 'global',
}

interface GoalFormModalProps {
  open: boolean
  editing: GoalProgress | null
  onClose: () => void
  onSave: (data: Record<string, unknown>) => void
  isPending: boolean
}

function GoalFormModal({ open, editing, onClose, onSave, isPending }: GoalFormModalProps) {
  const [form, setForm] = useState<GoalForm>(() =>
    editing
      ? {
          name: editing.name,
          type: editing.type,
          targetValue: String(editing.targetValue),
          startDate: editing.startDate.slice(0, 10),
          endDate: editing.endDate.slice(0, 10),
          scope: editing.scope,
        }
      : defaultForm
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return }
    if (!form.targetValue || isNaN(Number(form.targetValue))) { toast.error('Target deve ser um número'); return }
    if (!form.startDate || !form.endDate) { toast.error('Datas são obrigatórias'); return }
    if (form.startDate > form.endDate) { toast.error('Data de início deve ser anterior ao fim'); return }

    onSave({
      name: form.name,
      type: form.type,
      targetValue: Number(form.targetValue),
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      scope: form.scope,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar Meta' : 'Nova Meta'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome <span className="text-red-500">*</span></Label>
            <Input
              placeholder="Ex: Receita Q1 2026"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {goalTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Escopo</Label>
              <Select value={form.scope} onValueChange={(v) => setForm((f) => ({ ...f, scope: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {goalScopes.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Target <span className="text-red-500">*</span></Label>
            <Input
              type="number"
              min="0"
              step="any"
              placeholder="Ex: 100000"
              value={form.targetValue}
              onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data Início <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data Fim <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={isPending}>
              {isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                : editing ? 'Salvar' : 'Criar Meta'
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ──

export default function MetasPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<GoalProgress | null>(null)

  const queryClient = useQueryClient()

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals-progress'],
    queryFn: () => api.get<GoalProgress[]>('/goals/progress'),
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Goal>('/goals', body),
    onSuccess: () => {
      toast.success('Meta criada!')
      setFormOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['goals-progress'] })
    },
    onError: () => toast.error('Erro ao criar meta'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api.patch<Goal>(`/goals/${id}`, body),
    onSuccess: () => {
      toast.success('Meta atualizada!')
      setFormOpen(false)
      setEditingGoal(null)
      void queryClient.invalidateQueries({ queryKey: ['goals-progress'] })
    },
    onError: () => toast.error('Erro ao atualizar meta'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/goals/${id}`),
    onSuccess: () => {
      toast.success('Meta excluída!')
      void queryClient.invalidateQueries({ queryKey: ['goals-progress'] })
    },
    onError: () => toast.error('Erro ao excluir meta'),
  })

  function handleEdit(goal: GoalProgress) {
    setEditingGoal(goal)
    setFormOpen(true)
  }

  function handleDelete(id: string) {
    if (!confirm('Excluir esta meta?')) return
    deleteMutation.mutate(id)
  }

  function handleSave(data: Record<string, unknown>) {
    if (editingGoal) {
      updateMutation.mutate({ id: editingGoal.id, ...data })
    } else {
      createMutation.mutate(data)
    }
  }

  const isSavePending = createMutation.isPending || updateMutation.isPending

  // Overview stats
  const avgProgress = goals.length > 0
    ? goals.reduce((sum, g) => sum + g.progressPct, 0) / goals.length
    : 0
  const onTrack = goals.filter((g) => g.progressPct >= 80).length
  const atRisk = goals.filter((g) => g.progressPct >= 50 && g.progressPct < 80).length
  const behind = goals.filter((g) => g.progressPct < 50).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Metas</h1>
        </div>
        <Button size="sm" onClick={() => { setEditingGoal(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Meta
        </Button>
      </div>

      {/* Overview cards */}
      {goals.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-2xl font-bold">{goals.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{onTrack}</p>
            <p className="text-xs text-muted-foreground mt-0.5">No Alvo</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-yellow-600">{atRisk}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Em Risco</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{behind}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Atrasado</p>
          </div>
        </div>
      )}

      {/* Average progress bar */}
      {goals.length > 0 && (
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Progresso Médio</p>
            <p className={cn('text-sm font-bold', progressTextColor(avgProgress))}>
              {avgProgress.toFixed(1)}%
            </p>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', progressColor(avgProgress))}
              style={{ width: `${Math.min(100, avgProgress)}%` }}
            />
          </div>
        </div>
      )}

      {/* Goal cards grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma meta cadastrada</p>
          <Button size="sm" className="mt-4" onClick={() => { setEditingGoal(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Meta
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Form Modal */}
      <GoalFormModal
        open={formOpen}
        editing={editingGoal}
        onClose={() => { setFormOpen(false); setEditingGoal(null) }}
        onSave={handleSave}
        isPending={isSavePending}
      />
    </div>
  )
}
