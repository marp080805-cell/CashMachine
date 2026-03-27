'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Pipeline, Opportunity, Stage, Contact } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Settings, Plus, Loader2, Trash2, X, RotateCcw, Columns, List,
  ChevronDown, Search, GitBranch, Trophy, XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCurrency, formatDate } from '@/lib/utils'

type PipelineWithOpportunities = Omit<Pipeline, 'stages'> & {
  stages: Array<Stage & { opportunities: Opportunity[] }>
}

type ViewMode = 'kanban' | 'list'

export default function PipelineKanbanPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [closedOpen, setClosedOpen] = useState(false)
  const [closedTab, setClosedTab] = useState<'lost' | 'won'>('lost')
  const [oppModalOpen, setOppModalOpen] = useState(false)
  const [newPipelineOpen, setNewPipelineOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [oppForm, setOppForm] = useState({
    title: '', value: '', stageId: '', contactId: '', notes: '', expectedCloseDate: '',
  })
  const [contactSearch, setContactSearch] = useState('')
  const [newStageName, setNewStageName] = useState('')
  const [newStageColor, setNewStageColor] = useState('#6366f1')
  const [newPipelineForm, setNewPipelineForm] = useState({ name: '', description: '', type: 'SALES' })

  const { data: allPipelines } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => api.get<Pipeline[]>('/pipelines'),
  })

  const { data: pipeline, isLoading } = useQuery({
    queryKey: ['pipeline', id],
    queryFn: () => api.get<PipelineWithOpportunities>(`/pipelines/${id}`),
    enabled: !!id,
  })

  const { data: contactsData } = useQuery({
    queryKey: ['contacts-search', contactSearch],
    queryFn: () =>
      api.get<{ data: Contact[] }>(`/contacts?limit=20${contactSearch ? `&search=${encodeURIComponent(contactSearch)}` : ''}`),
    enabled: oppModalOpen,
  })

  const { data: lostOpps } = useQuery({
    queryKey: ['opportunities-lost', id],
    queryFn: () => api.get<{ data: Opportunity[] }>(`/opportunities?pipelineId=${id}&status=LOST&limit=100`),
    enabled: !!id,
  })

  const { data: wonOpps } = useQuery({
    queryKey: ['opportunities-won', id],
    queryFn: () => api.get<{ data: Opportunity[] }>(`/opportunities?pipelineId=${id}&status=WON&limit=100`),
    enabled: !!id,
  })

  const addStageMutation = useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) =>
      api.post(`/pipelines/${id}/stages`, {
        name, color, sortOrder: (pipeline?.stages.length ?? 0),
      }),
    onSuccess: () => {
      toast.success('Etapa adicionada!')
      setNewStageName('')
      void queryClient.invalidateQueries({ queryKey: ['pipeline', id] })
    },
    onError: () => toast.error('Erro ao adicionar etapa'),
  })

  const deleteStageMutation = useMutation({
    mutationFn: (stageId: string) => api.delete(`/pipelines/${id}/stages/${stageId}`),
    onSuccess: () => {
      toast.success('Etapa removida!')
      void queryClient.invalidateQueries({ queryKey: ['pipeline', id] })
    },
    onError: () => toast.error('Erro ao remover etapa'),
  })

  const createOppMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Opportunity>('/opportunities', body),
    onSuccess: () => {
      toast.success('Oportunidade criada!')
      setOppModalOpen(false)
      setOppForm({ title: '', value: '', stageId: '', contactId: '', notes: '', expectedCloseDate: '' })
      setContactSearch('')
      void queryClient.invalidateQueries({ queryKey: ['pipeline', id] })
    },
    onError: (err: unknown) => {
      const e = err as { message?: string; data?: { details?: Array<{ path: string[]; message: string }> } }
      const fieldErrors = e?.data?.details?.map((d) => `${d.path.join('.')}: ${d.message}`).join(' | ')
      toast.error(fieldErrors ?? e?.message ?? 'Erro ao criar oportunidade', { duration: 10000 })
    },
  })

  const createPipelineMutation = useMutation({
    mutationFn: async (body: { name: string; description: string; type: string }) => {
      const pl = await api.post<Pipeline>('/pipelines', body)
      await api.post(`/pipelines/${pl.id}/stages`, { name: 'Novo', color: '#6366f1', sortOrder: 0 })
      await api.post(`/pipelines/${pl.id}/stages`, { name: 'Em contato', color: '#f59e0b', sortOrder: 1 })
      await api.post(`/pipelines/${pl.id}/stages`, { name: 'Proposta', color: '#10b981', sortOrder: 2 })
      await api.post(`/pipelines/${pl.id}/stages`, { name: 'Fechamento', color: '#8b5cf6', sortOrder: 3 })
      return pl
    },
    onSuccess: (pl) => {
      toast.success('Pipeline criado!')
      setNewPipelineOpen(false)
      setNewPipelineForm({ name: '', description: '', type: 'SALES' })
      void queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      router.push(`/funis/${pl.id}`)
    },
    onError: () => toast.error('Erro ao criar pipeline'),
  })

  const reopenOppMutation = useMutation({
    mutationFn: (oppId: string) => api.post(`/opportunities/${oppId}/reopen`),
    onSuccess: () => {
      toast.success('Oportunidade reaberta!')
      void queryClient.invalidateQueries({ queryKey: ['pipeline', id] })
      void queryClient.invalidateQueries({ queryKey: ['opportunities-lost', id] })
      void queryClient.invalidateQueries({ queryKey: ['opportunities-won', id] })
    },
    onError: () => toast.error('Erro ao reabrir oportunidade'),
  })

  function openNewOpp(stageId?: string) {
    setOppForm((f) => ({ ...f, stageId: stageId ?? pipeline?.stages[0]?.id ?? '' }))
    setOppModalOpen(true)
  }

  function handleOppSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!oppForm.title.trim()) { toast.error('Título é obrigatório'); return }
    if (!oppForm.stageId) { toast.error('Selecione uma etapa'); return }
    if (!oppForm.contactId) { toast.error('Selecione um contato'); return }
    createOppMutation.mutate({
      title: oppForm.title,
      pipelineId: id,
      stageId: oppForm.stageId,
      contactId: oppForm.contactId,
      ...(oppForm.value && { value: parseFloat(oppForm.value) }),
      ...(oppForm.notes && { notes: oppForm.notes }),
      ...(oppForm.expectedCloseDate && { expectedCloseDate: new Date(oppForm.expectedCloseDate).toISOString() }),
      assignedToId: user?.id ?? '',
    })
  }

  const selectedContact = contactsData?.data?.find((c) => c.id === oppForm.contactId)

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

  if (!pipeline) return null

  const totalOpenValue = pipeline.stages.reduce(
    (sum, s) => sum + s.opportunities.reduce((acc, o) => acc + (o.value ?? 0), 0), 0
  )
  const totalOpenOpps = pipeline.stages.reduce((sum, s) => sum + s.opportunities.length, 0)
  const lostCount = lostOpps?.data.length ?? 0
  const wonCount = wonOpps?.data.length ?? 0
  const closedCount = lostCount + wonCount

  // Filtro de busca para lista
  const allOpenOpps = pipeline.stages.flatMap((s) =>
    s.opportunities.map((o) => ({ ...o, stageName: s.name, stageColor: s.color }))
  )
  const filteredOpps = search
    ? allOpenOpps.filter((o) =>
        o.title.toLowerCase().includes(search.toLowerCase()) ||
        o.contact?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : allOpenOpps

  return (
    <div className="flex flex-col h-full">
      {/* ── HEADER ESTILO KOMMO ── */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b flex-wrap">
        {/* Pipeline selector dropdown com opção de criar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 px-3 font-semibold text-base gap-1.5 max-w-[220px]">
              <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{pipeline.name}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {(allPipelines ?? []).map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => router.push(`/funis/${p.id}`)}
                className={p.id === id ? 'bg-accent font-medium' : ''}
              >
                <div className="h-2 w-2 rounded-full bg-primary shrink-0 mr-2" />
                {p.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setNewPipelineOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo pipeline
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* View toggle kanban/lista */}
        <div className="flex rounded-md border bg-muted/40 p-0.5">
          <button
            onClick={() => setViewMode('kanban')}
            title="Kanban"
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
              viewMode === 'kanban' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Columns className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            title="Lista"
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
              viewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>

        {/* Busca */}
        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar oportunidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground whitespace-nowrap ml-auto">
          <span className="font-medium text-foreground">{totalOpenOpps}</span>
          <span>em aberto</span>
          {totalOpenValue > 0 && (
            <>
              <span>·</span>
              <span className="font-medium text-foreground">{formatCurrency(totalOpenValue)}</span>
            </>
          )}
        </div>

        {/* Fechados */}
        {closedCount > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-muted-foreground gap-1.5"
            onClick={() => setClosedOpen(true)}
          >
            <span>Fechados</span>
            <Badge variant="secondary" className="text-xs h-4 px-1">{closedCount}</Badge>
          </Button>
        )}

        {/* Configurações */}
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setSettingsOpen(true)} title="Gerenciar etapas">
          <Settings className="h-4 w-4" />
        </Button>

        {/* Nova Oportunidade */}
        <Button size="sm" onClick={() => openNewOpp()} className="h-8 gap-1.5">
          <Plus className="h-4 w-4" />
          Nova Oportunidade
        </Button>
      </div>

      {/* ── CONTEÚDO ── */}
      {viewMode === 'kanban' ? (
        <KanbanBoard pipeline={pipeline} onNewOpportunity={openNewOpp} />
      ) : (
        <ListViewTable
          opportunities={filteredOpps}
          onReopen={() => {}}
        />
      )}

      {/* ── SHEET: FECHADOS (Perdidos + Ganhos) ── */}
      <Sheet open={closedOpen} onOpenChange={setClosedOpen}>
        <SheetContent side="right" className="w-[700px] max-w-full flex flex-col p-0">
          <SheetHeader className="px-6 py-4 border-b flex-shrink-0">
            <div className="flex items-center gap-3">
              <SheetTitle>Oportunidades Fechadas</SheetTitle>
              <div className="flex rounded-md border bg-muted/40 p-0.5">
                <button
                  onClick={() => setClosedTab('lost')}
                  className={`flex items-center gap-1.5 h-7 px-3 rounded text-xs font-medium transition-colors ${
                    closedTab === 'lost' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                  Perdidos
                  {lostCount > 0 && <Badge variant="destructive" className="text-xs h-4 px-1">{lostCount}</Badge>}
                </button>
                <button
                  onClick={() => setClosedTab('won')}
                  className={`flex items-center gap-1.5 h-7 px-3 rounded text-xs font-medium transition-colors ${
                    closedTab === 'won' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  <Trophy className="h-3.5 w-3.5 text-green-500" />
                  Ganhos
                  {wonCount > 0 && <Badge variant="secondary" className="text-xs h-4 px-1">{wonCount}</Badge>}
                </button>
              </div>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-6">
            <ClosedOppsTable
              opportunities={closedTab === 'lost' ? (lostOpps?.data ?? []) : (wonOpps?.data ?? [])}
              emptyMessage={closedTab === 'lost' ? 'Nenhuma oportunidade perdida' : 'Nenhuma oportunidade ganha'}
              onReopen={(oppId) => reopenOppMutation.mutate(oppId)}
              reopenPending={reopenOppMutation.isPending}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* ── SHEET: GERENCIAR ETAPAS ── */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="w-[400px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Etapas — {pipeline.name}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-2">
              {pipeline.stages
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((stage) => (
                  <div key={stage.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                    <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                    <span className="flex-1 text-sm font-medium">{stage.name}</span>
                    <span className="text-xs text-muted-foreground">{stage.opportunities.length} oport.</span>
                    <Button
                      size="sm" variant="ghost"
                      className="text-red-500 hover:text-red-600 h-7 w-7 p-0"
                      onClick={() => deleteStageMutation.mutate(stage.id)}
                      disabled={deleteStageMutation.isPending || stage.opportunities.length > 0}
                      title={stage.opportunities.length > 0 ? 'Mova as oportunidades antes de remover' : 'Remover'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
            </div>
            <div className="border-t pt-4 space-y-3">
              <Label className="text-sm font-semibold">Adicionar etapa</Label>
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
                    if (e.key === 'Enter' && newStageName.trim())
                      addStageMutation.mutate({ name: newStageName.trim(), color: newStageColor })
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => { if (newStageName.trim()) addStageMutation.mutate({ name: newStageName.trim(), color: newStageColor }) }}
                  disabled={addStageMutation.isPending || !newStageName.trim()}
                >
                  {addStageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── DIALOG: NOVA OPORTUNIDADE ── */}
      <Dialog open={oppModalOpen} onOpenChange={(open) => { setOppModalOpen(open); if (!open) setContactSearch('') }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Oportunidade</DialogTitle></DialogHeader>
          <form onSubmit={handleOppSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input
                placeholder="Ex: Contrato Empresa XYZ"
                value={oppForm.title}
                onChange={(e) => setOppForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Etapa</Label>
              <Select value={oppForm.stageId} onValueChange={(v) => setOppForm((f) => ({ ...f, stageId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar etapa..." /></SelectTrigger>
                <SelectContent>
                  {pipeline.stages.sort((a, b) => a.sortOrder - b.sortOrder).map((s) => (
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
              <Label>Contato *</Label>
              <div className="space-y-2">
                <Input
                  placeholder="Buscar contato por nome ou telefone..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                />
                {selectedContact && (
                  <div className="flex items-center gap-2 rounded border px-3 py-2 bg-primary/5 text-sm">
                    <span className="flex-1 font-medium">{selectedContact.name}</span>
                    <button type="button" onClick={() => setOppForm((f) => ({ ...f, contactId: '' }))}>
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                )}
                {contactSearch && !oppForm.contactId && (
                  <div className="rounded border divide-y max-h-36 overflow-y-auto">
                    {(contactsData?.data ?? []).map((contact) => (
                      <button
                        key={contact.id} type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                        onClick={() => { setOppForm((f) => ({ ...f, contactId: contact.id })); setContactSearch('') }}
                      >
                        <span className="font-medium">{contact.name}</span>
                        {contact.phone && <span className="text-muted-foreground ml-2 text-xs">— {contact.phone}</span>}
                      </button>
                    ))}
                    {(contactsData?.data ?? []).length === 0 && (
                      <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum contato encontrado</p>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor (R$)</Label>
                <Input type="number" min="0" step="0.01" placeholder="0,00"
                  value={oppForm.value}
                  onChange={(e) => setOppForm((f) => ({ ...f, value: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Previsão de fechamento</Label>
                <Input type="date" value={oppForm.expectedCloseDate}
                  onChange={(e) => setOppForm((f) => ({ ...f, expectedCloseDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <textarea rows={2} placeholder="Observações..." value={oppForm.notes}
                onChange={(e) => setOppForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOppModalOpen(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1" disabled={createOppMutation.isPending}>
                {createOppMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</> : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: NOVO PIPELINE ── */}
      <Dialog open={newPipelineOpen} onOpenChange={setNewPipelineOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Novo Pipeline</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="Ex: Pipeline de Vendas"
                value={newPipelineForm.name}
                onChange={(e) => setNewPipelineForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={newPipelineForm.type} onValueChange={(v) => setNewPipelineForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[['SALES', 'Vendas'], ['TREATMENT', 'Tratamento'], ['RESCUE', 'Resgate'], ['RELATIONSHIP', 'Relacionamento'], ['CUSTOM', 'Personalizado']].map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setNewPipelineOpen(false)}>Cancelar</Button>
              <Button className="flex-1" disabled={createPipelineMutation.isPending || !newPipelineForm.name.trim()}
                onClick={() => createPipelineMutation.mutate(newPipelineForm)}
              >
                {createPipelineMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</> : 'Criar Pipeline'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── LISTA DE OPORTUNIDADES ABERTAS ──
interface ListOpp extends Opportunity { stageName: string; stageColor: string }

function ListViewTable({ opportunities }: { opportunities: ListOpp[]; onReopen: () => void }) {
  if (opportunities.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground">Nenhuma oportunidade encontrada</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground bg-muted/30">
            <th className="text-left px-4 py-2.5 font-medium">Título</th>
            <th className="text-left px-4 py-2.5 font-medium">Valor</th>
            <th className="text-left px-4 py-2.5 font-medium">Contato</th>
            <th className="text-left px-4 py-2.5 font-medium">Etapa</th>
            <th className="text-left px-4 py-2.5 font-medium">Responsável</th>
            <th className="text-left px-4 py-2.5 font-medium">Fechamento</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {opportunities.map((opp) => (
            <tr key={opp.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 font-medium">{opp.title}</td>
              <td className="px-4 py-3 text-muted-foreground">{opp.value ? formatCurrency(opp.value) : '—'}</td>
              <td className="px-4 py-3 text-muted-foreground">{opp.contact?.name ?? '—'}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: opp.stageColor }} />
                  <span className="text-muted-foreground">{opp.stageName}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{opp.assignedTo.name}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {opp.expectedCloseDate ? formatDate(opp.expectedCloseDate) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── TABELA DE FECHADOS ──
interface ClosedOppsTableProps {
  opportunities: Opportunity[]
  emptyMessage: string
  onReopen: (oppId: string) => void
  reopenPending: boolean
}

function ClosedOppsTable({ opportunities, emptyMessage, onReopen, reopenPending }: ClosedOppsTableProps) {
  if (opportunities.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  const total = opportunities.reduce((sum, o) => sum + (o.value ?? 0), 0)

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {total > 0 && (
        <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{opportunities.length} oportunidades</span>
          <span className="text-sm font-semibold">{formatCurrency(total)}</span>
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="text-left px-4 py-2.5 font-medium">Título</th>
            <th className="text-left px-4 py-2.5 font-medium">Valor</th>
            <th className="text-left px-4 py-2.5 font-medium">Contato</th>
            <th className="text-left px-4 py-2.5 font-medium">Responsável</th>
            <th className="text-left px-4 py-2.5 font-medium">Data</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {opportunities.map((opp) => (
            <tr key={opp.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 font-medium">{opp.title}</td>
              <td className="px-4 py-3 text-muted-foreground">{opp.value ? formatCurrency(opp.value) : '—'}</td>
              <td className="px-4 py-3 text-muted-foreground">{opp.contact?.name ?? '—'}</td>
              <td className="px-4 py-3 text-muted-foreground">{opp.assignedTo.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{formatDate(opp.updatedAt)}</td>
              <td className="px-4 py-3">
                <Button size="sm" variant="ghost" className="h-7 text-xs"
                  disabled={reopenPending} onClick={() => onReopen(opp.id)} title="Reabrir">
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />Reabrir
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
