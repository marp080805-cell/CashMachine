'use client'

import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Funnel, Deal, FunnelStage, Lead } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, Plus, Loader2, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from '@/components/ui/sheet'

type FunnelWithDeals = Omit<Funnel, 'stages'> & {
  stages: Array<FunnelStage & { deals: Deal[] }>
}

export default function FunnelKanbanPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dealModalOpen, setDealModalOpen] = useState(false)
  const [defaultStageId, setDefaultStageId] = useState<string>('')
  const [dealForm, setDealForm] = useState({
    title: '',
    value: '',
    stageId: '',
    leadId: '',
    notes: '',
    expectedClose: '',
  })
  const [leadSearch, setLeadSearch] = useState('')
  const [newStageName, setNewStageName] = useState('')
  const [newStageColor, setNewStageColor] = useState('#6366f1')

  const { data: funnel, isLoading } = useQuery({
    queryKey: ['funnel', id],
    queryFn: () => api.get<FunnelWithDeals>(`/funnels/${id}`),
    enabled: !!id,
  })

  const { data: leadsData } = useQuery({
    queryKey: ['leads-search', leadSearch],
    queryFn: () =>
      api.get<{ leads: Lead[] }>(`/leads?limit=20${leadSearch ? `&search=${encodeURIComponent(leadSearch)}` : ''}`),
    enabled: dealModalOpen,
  })

  const addStageMutation = useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) =>
      api.post(`/funnels/${id}/stages`, {
        name,
        color,
        position: (funnel?.stages.length ?? 0),
      }),
    onSuccess: () => {
      toast.success('Etapa adicionada!')
      setNewStageName('')
      void queryClient.invalidateQueries({ queryKey: ['funnel', id] })
    },
    onError: () => toast.error('Erro ao adicionar etapa'),
  })

  const deleteStageMutation = useMutation({
    mutationFn: (stageId: string) => api.delete(`/funnels/${id}/stages/${stageId}`),
    onSuccess: () => {
      toast.success('Etapa removida!')
      void queryClient.invalidateQueries({ queryKey: ['funnel', id] })
    },
    onError: () => toast.error('Erro ao remover etapa'),
  })

  const createDealMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Deal>('/deals', body),
    onSuccess: () => {
      toast.success('Deal criado!')
      setDealModalOpen(false)
      setDealForm({ title: '', value: '', stageId: '', leadId: '', notes: '', expectedClose: '' })
      setLeadSearch('')
      void queryClient.invalidateQueries({ queryKey: ['funnel', id] })
    },
    onError: (err: unknown) => toast.error((err as { message?: string })?.message ?? 'Erro ao criar deal'),
  })

  function openNewDeal(stageId?: string) {
    setDefaultStageId(stageId ?? funnel?.stages[0]?.id ?? '')
    setDealForm((f) => ({ ...f, stageId: stageId ?? funnel?.stages[0]?.id ?? '' }))
    setDealModalOpen(true)
  }

  function handleDealSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!dealForm.title.trim()) { toast.error('Título é obrigatório'); return }
    if (!dealForm.stageId) { toast.error('Selecione uma etapa'); return }

    createDealMutation.mutate({
      title: dealForm.title,
      funnelId: id,
      stageId: dealForm.stageId,
      ...(dealForm.leadId && { leadId: dealForm.leadId }),
      ...(dealForm.value && { value: parseFloat(dealForm.value) }),
      ...(dealForm.notes && { notes: dealForm.notes }),
      ...(dealForm.expectedClose && { expectedClose: new Date(dealForm.expectedClose).toISOString() }),
      assignedToId: user?.id ?? '',
    })
  }

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
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{funnel.name}</h2>
          <p className="text-sm text-muted-foreground">
            {funnel.stages.length} etapas · {funnel.stages.reduce((sum, s) => sum + s.deals.length, 0)} deals em aberto
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => openNewDeal()}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Deal
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Gerenciar
          </Button>
        </div>
      </div>

      <KanbanBoard funnel={funnel} onNewDeal={openNewDeal} />

      {/* Stage Management Sheet */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="w-[400px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Gerenciar Etapas — {funnel.name}</SheetTitle>
          </SheetHeader>

          <div className="space-y-4 mt-6">
            <div className="space-y-2">
              {funnel.stages
                .sort((a, b) => a.position - b.position)
                .map((stage) => (
                  <div key={stage.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                    <div
                      className="h-4 w-4 rounded-full shrink-0"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="flex-1 text-sm font-medium">{stage.name}</span>
                    <span className="text-xs text-muted-foreground">{stage.deals.length} deals</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-600 h-7 w-7 p-0"
                      onClick={() => deleteStageMutation.mutate(stage.id)}
                      disabled={deleteStageMutation.isPending || stage.deals.length > 0}
                      title={stage.deals.length > 0 ? 'Mova os deals antes de remover' : 'Remover etapa'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
            </div>

            <div className="border-t pt-4 space-y-3">
              <Label className="text-sm font-semibold">Adicionar nova etapa</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={newStageColor}
                  onChange={(e) => setNewStageColor(e.target.value)}
                  className="h-9 w-9 rounded border cursor-pointer bg-transparent shrink-0"
                />
                <Input
                  placeholder="Nome da etapa"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newStageName.trim()) {
                      addStageMutation.mutate({ name: newStageName.trim(), color: newStageColor })
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (newStageName.trim()) {
                      addStageMutation.mutate({ name: newStageName.trim(), color: newStageColor })
                    }
                  }}
                  disabled={addStageMutation.isPending || !newStageName.trim()}
                >
                  {addStageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* New Deal Modal */}
      <Dialog open={dealModalOpen} onOpenChange={(open) => { setDealModalOpen(open); if (!open) setLeadSearch('') }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Deal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleDealSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input
                placeholder="Ex: Contrato Empresa XYZ"
                value={dealForm.title}
                onChange={(e) => setDealForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Etapa</Label>
              <Select value={dealForm.stageId} onValueChange={(v) => setDealForm((f) => ({ ...f, stageId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar etapa..." /></SelectTrigger>
                <SelectContent>
                  {funnel.stages.sort((a, b) => a.position - b.position).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Vincular a um Lead</Label>
              <div className="space-y-2">
                <Input
                  placeholder="Buscar lead por nome ou telefone..."
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                />
                {dealForm.leadId && (
                  <div className="flex items-center gap-2 rounded border px-3 py-2 bg-primary/5 text-sm">
                    <span className="flex-1 font-medium">
                      {leadsData?.leads.find((l) => l.id === dealForm.leadId)?.name ?? 'Lead selecionado'}
                    </span>
                    <button type="button" onClick={() => setDealForm((f) => ({ ...f, leadId: '' }))}>
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                )}
                {leadSearch && !dealForm.leadId && (
                  <div className="rounded border divide-y max-h-36 overflow-y-auto">
                    {(leadsData?.leads ?? []).map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                        onClick={() => { setDealForm((f) => ({ ...f, leadId: lead.id })); setLeadSearch('') }}
                      >
                        <span className="font-medium">{lead.name}</span>
                        {lead.company && <span className="text-muted-foreground ml-2 text-xs">— {lead.company.name}</span>}
                      </button>
                    ))}
                    {leadsData?.leads.length === 0 && (
                      <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum lead encontrado</p>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={dealForm.value}
                  onChange={(e) => setDealForm((f) => ({ ...f, value: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Previsão de fechamento</Label>
                <Input
                  type="date"
                  value={dealForm.expectedClose}
                  onChange={(e) => setDealForm((f) => ({ ...f, expectedClose: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <textarea
                rows={2}
                placeholder="Observações..."
                value={dealForm.notes}
                onChange={(e) => setDealForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setDealModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={createDealMutation.isPending}>
                {createDealMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</>
                ) : 'Criar Deal'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
