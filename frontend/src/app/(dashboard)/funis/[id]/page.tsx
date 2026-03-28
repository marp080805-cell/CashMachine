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
  ChevronDown, Search, GitBranch, Trophy, XCircle, Building2, Settings2,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { CustomFieldsPanel } from '@/components/custom-fields/CustomFieldsPanel'
import { FieldWrapper } from '@/components/custom-fields/FieldWrapper'
import { useFieldConfig } from '@/hooks/useFieldConfig'
import { useAuthStore } from '@/stores/authStore'
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
    companyId: '', companyLabel: '',
  })
  const [cfOppValues, setCfOppValues] = useState<Record<string, unknown>>({})
  const [adminModeOpp, setAdminModeOpp] = useState(false)
  const [contactSearch, setContactSearch] = useState('')
  const fieldConfig = useFieldConfig()
  const authUser = useAuthStore((s) => s.user)
  const isAdmin = authUser?.role === 'ADMIN' || authUser?.role === 'MANAGER'
  const [companySearch, setCompanySearch] = useState('')
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

  const { data: companiesData } = useQuery({
    queryKey: ['companies-search-opp', companySearch],
    queryFn: () =>
      api.get<{ data: Array<{ id: string; name: string }> }>(`/companies?search=${encodeURIComponent(companySearch)}&limit=8`),
    enabled: oppModalOpen && companySearch.length > 0,
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

  const { data: tenantData } = useQuery({
    queryKey: ['tenant-current'],
    queryFn: () => api.get<{ settings?: { allowReopenLost?: boolean } }>('/tenants/current'),
  })
  const allowReopenLost = tenantData?.settings?.allowReopenLost !== false

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
    mutationFn: async (body: Record<string, unknown>) => {
      const opp = await api.post<Opportunity>('/opportunities', body)
      // Save custom field values
      const cfEntries = Object.entries(cfOppValues).filter(([, v]) => v !== '' && v !== null && v !== undefined)
      if (cfEntries.length > 0) {
        await Promise.allSettled(
          cfEntries.map(([fieldId, value]) =>
            api.put('/custom-fields/values', { customFieldId: fieldId, entityType: 'opportunity', entityId: opp.id, valueText: typeof value === 'string' ? value : undefined, valueJson: typeof value !== 'string' ? value : undefined })
          )
        )
      }
      return opp
    },
    onSuccess: () => {
      toast.success('Oportunidade criada!')
      setOppModalOpen(false)
      setOppForm({ title: '', value: '', stageId: '', contactId: '', notes: '', expectedCloseDate: '', companyId: '', companyLabel: '' })
      setContactSearch('')
      setCfOppValues({})
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
      toast.success('Funil criado!')
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
    setOppForm((f) => ({ ...f, stageId: stageId ?? pipeline?.stages[0]?.id ?? '', companyId: '', companyLabel: '' }))
    setCompanySearch('')
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
      ...(oppForm.companyId && { companyId: oppForm.companyId }),
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

  const lostCount = lostOpps?.data.length ?? 0
  const wonCount = wonOpps?.data.length ?? 0
  const closedCount = lostCount + wonCount

  const allOpenOpps = pipeline.stages.flatMap((s) =>
    s.opportunities.map((o) => ({ ...o, stageName: s.name, stageColor: s.color }))
  )
  const totalOpenOpps = allOpenOpps.length
  const totalOpenValue = allOpenOpps.reduce((sum, o) => sum + Number(o.value ?? 0), 0)

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
              Novo funil
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

      {/* ── BOTÕES FIXOS: PERDIDAS / GANHAS ── */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2 items-end">
        <button
          onClick={() => { setClosedTab('won'); setClosedOpen(true) }}
          className="flex items-center gap-2 bg-background border shadow-md rounded-full px-4 py-2 text-sm font-medium hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-colors"
        >
          <Trophy className="h-4 w-4 text-green-500" />
          <span>{wonCount} ganha{wonCount !== 1 ? 's' : ''}</span>
        </button>
        <button
          onClick={() => { setClosedTab('lost'); setClosedOpen(true) }}
          className="flex items-center gap-2 bg-background border shadow-md rounded-full px-4 py-2 text-sm font-medium hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors"
        >
          <XCircle className="h-4 w-4 text-red-400" />
          <span>{lostCount} perdida{lostCount !== 1 ? 's' : ''}</span>
        </button>
      </div>

      {/* ── SHEET: FECHADOS (Perdidos + Ganhos) ── */}
      <Sheet open={closedOpen} onOpenChange={setClosedOpen}>
        <SheetContent side="right" className="flex flex-col p-0" style={{ width: 'min(960px, 90vw)', maxWidth: 'min(960px, 90vw)' }}>
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
              canReopen={isAdmin && allowReopenLost}
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
      <Dialog open={oppModalOpen} onOpenChange={(open) => { setOppModalOpen(open); if (!open) { setContactSearch(''); setCompanySearch(''); setCfOppValues({}); setAdminModeOpp(false) } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between pr-8">
            <DialogTitle>Nova Oportunidade</DialogTitle>
            {isAdmin && (
              <Button type="button" variant={adminModeOpp ? 'default' : 'ghost'} size="sm" className="h-7 text-xs gap-1.5"
                onClick={() => setAdminModeOpp(v => !v)}>
                <Settings2 className="h-3.5 w-3.5" />
                {adminModeOpp ? 'Sair' : 'Personalizar'}
              </Button>
            )}
          </DialogHeader>
          <form onSubmit={handleOppSubmit} className="space-y-4 py-2">
            <FieldWrapper entityType="opportunity" slug="title" label="Título" defaultRequired={true} adminMode={adminModeOpp}>
              <div className="space-y-1.5">
                <Label>Título {fieldConfig.isRequired('opportunity', 'title', true) && <span className="text-red-500 ml-0.5">*</span>}</Label>
                <Input
                  placeholder="Ex: Contrato Empresa XYZ"
                  required={fieldConfig.isRequired('opportunity', 'title', true)}
                  value={oppForm.title}
                  onChange={(e) => setOppForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
            </FieldWrapper>
            <FieldWrapper entityType="opportunity" slug="stage" label="Etapa" defaultRequired={true} adminMode={adminModeOpp}>
              <div className="space-y-1.5">
                <Label>Etapa {fieldConfig.isRequired('opportunity', 'stage', true) && <span className="text-red-500 ml-0.5">*</span>}</Label>
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
            </FieldWrapper>
            <FieldWrapper entityType="opportunity" slug="contact" label="Contato" defaultRequired={false} adminMode={adminModeOpp}>
              <div className="space-y-1.5">
              <Label>Contato {fieldConfig.isRequired('opportunity', 'contact', false) && <span className="text-red-500 ml-0.5">*</span>}</Label>
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
            </FieldWrapper>
            <FieldWrapper entityType="opportunity" slug="company" label="Empresa" defaultRequired={false} adminMode={adminModeOpp}>
              <div className="space-y-1.5">
                <Label>Empresa {fieldConfig.isRequired('opportunity', 'company', false) && <span className="text-red-500 ml-0.5">*</span>}</Label>
                {oppForm.companyId ? (
                  <div className="flex items-center gap-2 border rounded-md px-3 py-2 text-sm bg-background">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1 font-medium">{oppForm.companyLabel}</span>
                    <button type="button" onClick={() => setOppForm((f) => ({ ...f, companyId: '', companyLabel: '' }))}><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      placeholder="Buscar empresa..."
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                    />
                    {(companiesData?.data?.length ?? 0) > 0 && companySearch && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
                        {companiesData!.data.map((c) => (
                          <button key={c.id} type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                            onMouseDown={() => { setOppForm((f) => ({ ...f, companyId: c.id, companyLabel: c.name })); setCompanySearch('') }}>
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </FieldWrapper>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldWrapper entityType="opportunity" slug="value" label="Valor" defaultRequired={false} adminMode={adminModeOpp}>
                  <div className="space-y-1.5">
                    <Label>Valor (R$) {fieldConfig.isRequired('opportunity', 'value', false) && <span className="text-red-500 ml-0.5">*</span>}</Label>
                    <Input type="number" min="0" step="0.01" placeholder="0,00"
                      required={fieldConfig.isRequired('opportunity', 'value', false)}
                      value={oppForm.value}
                      onChange={(e) => setOppForm((f) => ({ ...f, value: e.target.value }))}
                    />
                  </div>
                </FieldWrapper>
              </div>
              <div>
                <FieldWrapper entityType="opportunity" slug="closeDate" label="Fechamento previsto" defaultRequired={false} adminMode={adminModeOpp}>
                  <div className="space-y-1.5">
                    <Label>Previsão de fechamento {fieldConfig.isRequired('opportunity', 'closeDate', false) && <span className="text-red-500 ml-0.5">*</span>}</Label>
                    <Input type="date"
                      required={fieldConfig.isRequired('opportunity', 'closeDate', false)}
                      value={oppForm.expectedCloseDate}
                      onChange={(e) => setOppForm((f) => ({ ...f, expectedCloseDate: e.target.value }))}
                    />
                  </div>
                </FieldWrapper>
              </div>
            </div>
            <FieldWrapper entityType="opportunity" slug="description" label="Descrição" defaultRequired={false} adminMode={adminModeOpp}>
              <div className="space-y-1.5">
                <Label>Notas {fieldConfig.isRequired('opportunity', 'description', false) && <span className="text-red-500 ml-0.5">*</span>}</Label>
                <textarea rows={2} placeholder="Observações..." value={oppForm.notes}
                  onChange={(e) => setOppForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>
            </FieldWrapper>
            {/* Campos personalizados */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Campos Personalizados</h3>
              <CustomFieldsPanel
                entityType="opportunity"
                values={cfOppValues}
                onChange={(id2, v) => setCfOppValues((p) => ({ ...p, [id2]: v }))}
                adminMode={adminModeOpp}
                onAdminModeChange={setAdminModeOpp}
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
          <DialogHeader><DialogTitle>Novo Funil</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="Ex: Funil de Vendas"
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
                {createPipelineMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</> : 'Criar Funil'}
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
  canReopen: boolean
}

function ClosedOppsTable({ opportunities, emptyMessage, onReopen, reopenPending, canReopen }: ClosedOppsTableProps) {
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
                {canReopen && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs"
                    disabled={reopenPending} onClick={() => onReopen(opp.id)} title="Reabrir">
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />Reabrir
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
