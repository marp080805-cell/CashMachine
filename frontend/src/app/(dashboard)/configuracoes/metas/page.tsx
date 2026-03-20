'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Goal, Channel, GoalPeriod } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Target } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

const METRIC_OPTIONS = [
  { value: 'leads', label: 'Leads gerados', unit: 'leads' },
  { value: 'calls', label: 'Calls realizadas', unit: 'calls' },
  { value: 'contracts', label: 'Contratos fechados', unit: 'contratos' },
  { value: 'revenue', label: 'Receita gerada', unit: 'R$' },
  { value: 'deals_won', label: 'Deals ganhos', unit: 'deals' },
  { value: 'cpl', label: 'CPL (Custo por Lead)', unit: 'R$' },
  { value: 'cac', label: 'CAC (Custo de Aquisição)', unit: 'R$' },
  { value: 'conversion_rate', label: 'Taxa de conversão', unit: '%' },
  { value: 'total_cost', label: 'Investimento total', unit: 'R$' },
]

const PERIOD_LABELS: Record<GoalPeriod, string> = {
  MONTHLY: 'Mensal',
  QUARTERLY: 'Trimestral',
  ANNUAL: 'Anual',
}

const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

const now = new Date()

interface GoalForm {
  name: string
  metric: string
  target: string
  period: GoalPeriod
  month: string
  year: string
  channelId: string
}

const EMPTY_FORM: GoalForm = {
  name: '',
  metric: 'leads',
  target: '',
  period: 'MONTHLY',
  month: String(now.getMonth() + 1),
  year: String(now.getFullYear()),
  channelId: '',
}

export default function MetasPage() {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<GoalForm>(EMPTY_FORM)
  const [filterYear, setFilterYear] = useState(String(now.getFullYear()))

  const { data, isLoading } = useQuery({
    queryKey: ['goals', filterYear],
    queryFn: () => api.get<{ goals: Goal[] }>(`/settings/goals?year=${filterYear}`),
  })

  const { data: channelsData } = useQuery({
    queryKey: ['channels'],
    queryFn: () => api.get<{ channels: Channel[] }>('/channels'),
  })

  const goals = data?.goals ?? []
  const channels = channelsData?.channels ?? []

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/settings/goals', body),
    onSuccess: () => {
      toast.success('Meta criada!')
      setModalOpen(false)
      void qc.invalidateQueries({ queryKey: ['goals'] })
    },
    onError: () => toast.error('Erro ao criar meta'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/settings/goals/${id}`, body),
    onSuccess: () => {
      toast.success('Meta atualizada!')
      setModalOpen(false)
      void qc.invalidateQueries({ queryKey: ['goals'] })
    },
    onError: () => toast.error('Erro ao atualizar meta'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/goals/${id}`),
    onSuccess: () => {
      toast.success('Meta removida!')
      void qc.invalidateQueries({ queryKey: ['goals'] })
    },
    onError: () => toast.error('Erro ao remover meta'),
  })

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(goal: Goal) {
    setEditingId(goal.id)
    setForm({
      name: goal.name,
      metric: goal.metric,
      target: String(goal.target),
      period: goal.period,
      month: goal.month ? String(goal.month) : String(now.getMonth() + 1),
      year: String(goal.year),
      channelId: goal.channelId ?? '',
    })
    setModalOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const body: Record<string, unknown> = {
      name: form.name,
      metric: form.metric,
      target: Number(form.target),
      period: form.period,
      year: Number(form.year),
    }
    if (form.period === 'MONTHLY') body.month = Number(form.month)
    if (form.channelId) body.channelId = form.channelId

    if (editingId) {
      updateMutation.mutate({ id: editingId, body })
    } else {
      createMutation.mutate(body)
    }
  }

  function formatTarget(goal: Goal): string {
    const meta = METRIC_OPTIONS.find((m) => m.value === goal.metric)
    if (!meta) return String(goal.target)
    if (['revenue', 'cpl', 'cac', 'total_cost'].includes(goal.metric)) {
      return formatCurrency(goal.target)
    }
    if (goal.metric === 'conversion_rate') return `${goal.target}%`
    return `${goal.target} ${meta.unit}`
  }

  function getPeriodLabel(goal: Goal): string {
    if (goal.period === 'MONTHLY' && goal.month) {
      return `${MONTH_NAMES[goal.month - 1]} ${goal.year}`
    }
    return `${PERIOD_LABELS[goal.period]} ${goal.year}`
  }

  const years = [String(now.getFullYear() - 1), String(now.getFullYear()), String(now.getFullYear() + 1)]
  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Metas</h2>
          <p className="text-sm text-muted-foreground">
            Configure metas para qualquer métrica do negócio
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Meta
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
      ) : goals.length === 0 ? (
        <div className="border-2 border-dashed rounded-lg py-16 text-center">
          <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground text-sm">Nenhuma meta configurada para {filterYear}</p>
          <Button variant="outline" className="mt-3" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Criar primeira meta
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {goals.map((goal) => {
            const metaInfo = METRIC_OPTIONS.find((m) => m.value === goal.metric)
            return (
              <Card key={goal.id} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-semibold truncate">{goal.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {metaInfo?.label ?? goal.metric}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(goal)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500"
                        onClick={() => deleteMutation.mutate(goal.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-2xl font-bold text-primary">
                    {formatTarget(goal)}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {PERIOD_LABELS[goal.period]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{getPeriodLabel(goal)}</span>
                    {goal.channel && (
                      <Badge variant="outline" className="text-xs">{goal.channel.name}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Meta' : 'Nova Meta'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome da meta *</Label>
              <Input
                placeholder="Ex: Leads de outubro, Meta anual de receita..."
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Métrica</Label>
              <Select value={form.metric} onValueChange={(v) => setForm((f) => ({ ...f, metric: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METRIC_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Valor alvo *</Label>
              <Input
                type="number"
                placeholder="0"
                min="0"
                step="0.01"
                value={form.target}
                onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Período</Label>
                <Select
                  value={form.period}
                  onValueChange={(v) => setForm((f) => ({ ...f, period: v as GoalPeriod }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PERIOD_LABELS) as GoalPeriod[]).map((p) => (
                      <SelectItem key={p} value={p}>{PERIOD_LABELS[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Ano</Label>
                <Select value={form.year} onValueChange={(v) => setForm((f) => ({ ...f, year: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.period === 'MONTHLY' && (
              <div className="space-y-1.5">
                <Label>Mês</Label>
                <Select value={form.month} onValueChange={(v) => setForm((f) => ({ ...f, month: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Canal <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Select
                value={form.channelId || 'all'}
                onValueChange={(v) => setForm((f) => ({ ...f, channelId: v === 'all' ? '' : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Todos os canais" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os canais</SelectItem>
                  {channels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar Meta'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
