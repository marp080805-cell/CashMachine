'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Pipeline, Opportunity, Stage } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { OpportunitySheet } from '@/components/kanban/OpportunitySheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Settings, Plus, Loader2, Trash2, RotateCcw, Columns, List,
  ChevronDown, Search, GitBranch, Trophy, XCircle, Settings2,
  GripVertical, Eye, EyeOff, User, Building2, CircleUser,
  DollarSign, Calendar, Thermometer, Star,
  Activity, Tag as TagIcon, Clock, Users, CheckCircle2, MessageSquare,
} from 'lucide-react'
import React, { useState, useEffect } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
import { PipelineTypeCombobox, PREDEFINED_PIPELINE_TYPES } from '@/components/shared/PipelineTypeCombobox'
import { EntityCombobox } from '@/components/shared/EntityCombobox'

type PipelineWithOpportunities = Omit<Pipeline, 'stages'> & {
  stages: Array<Stage & { opportunities: Opportunity[] }>
}

type ViewMode = 'kanban' | 'list'

const CARD_FIELD_DEFS: { key: string; label: string; Icon: React.ElementType }[] = [
  { key: 'contact',            label: 'Contato',                Icon: User },
  { key: 'company',            label: 'Empresa',                Icon: Building2 },
  { key: 'assignedTo',         label: 'Responsável',            Icon: CircleUser },
  { key: 'sdr',                label: 'SDR',                    Icon: Users },
  { key: 'closer',             label: 'Closer',                 Icon: Users },
  { key: 'value',              label: 'Valor',                  Icon: DollarSign },
  { key: 'expectedCloseDate',  label: 'Previsão de fechamento', Icon: Calendar },
  { key: 'origin',             label: 'Origem',                 Icon: GitBranch },
  { key: 'temperature',        label: 'Temperatura',            Icon: Thermometer },
  { key: 'qualificationScore', label: 'Score de qualificação',  Icon: Star },
  { key: 'status',             label: 'Status',                 Icon: Activity },
  { key: 'tags',               label: 'Tags',                   Icon: TagIcon },
  { key: 'createdAt',          label: 'Data de criação',        Icon: Clock },
  { key: 'tasks',               label: 'Tarefas',                      Icon: CheckCircle2 },
  { key: 'unrespondedMessage',  label: 'Mensagem sem resposta (WhatsApp)', Icon: MessageSquare },
]

function SortableFieldRow({
  field,
  onToggle,
}: {
  field: { key: string; visible: boolean }
  onToggle: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.key })
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : undefined }
  const def = CARD_FIELD_DEFS.find((d) => d.key === field.key)!
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded-md border bg-card select-none transition-opacity ${!field.visible ? 'opacity-40' : ''} ${isDragging ? 'shadow-lg' : ''}`}
    >
      <button
        type="button"
        className="cursor-grab text-muted-foreground hover:text-foreground flex-shrink-0 touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <def.Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      <span className="flex-1 text-sm">{def.label}</span>
      <button
        type="button"
        onClick={onToggle}
        className={field.visible ? 'text-primary hover:text-primary/80' : 'text-muted-foreground hover:text-foreground'}
        title={field.visible ? 'Ocultar' : 'Mostrar'}
      >
        {field.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
    </div>
  )
}

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
    title: '', value: '', stageId: '', contactId: '', contactLabel: '', notes: '', expectedCloseDate: '',
    companyId: '', companyLabel: '',
  })
  const [cfOppValues, setCfOppValues] = useState<Record<string, unknown>>({})
  const [adminModeOpp, setAdminModeOpp] = useState(false)
  const fieldConfig = useFieldConfig()
  const authUser = useAuthStore((s) => s.user)
  const isAdmin = authUser?.role === 'ADMIN' || authUser?.role === 'MANAGER'
  const [newStageName, setNewStageName] = useState('')
  const [newStageColor, setNewStageColor] = useState('#6366f1')
  const [editingStageId, setEditingStageId] = useState<string | null>(null)
  const [editingStageName, setEditingStageName] = useState('')
  const [deleteStageTarget, setDeleteStageTarget] = useState<{ id: string; name: string; count: number } | null>(null)
  const [transferToStageId, setTransferToStageId] = useState('')
  const [newPipelineForm, setNewPipelineForm] = useState({ name: '', description: '', type: 'SALES', typeName: '' })
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null)
  const [localFields, setLocalFields] = useState<{ key: string; visible: boolean }[]>([])
  const [fieldsDirty, setFieldsDirty] = useState(false)

  const { data: allPipelines } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => api.get<Pipeline[]>('/pipelines'),
  })

  const { data: pipeline, isLoading } = useQuery({
    queryKey: ['pipeline', id],
    queryFn: () => api.get<PipelineWithOpportunities>(`/pipelines/${id}`),
    enabled: !!id,
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
    queryFn: () => api.get<{ settings?: { allowReopenLost?: boolean; pipelineTypeFreeInput?: boolean } }>('/tenants/current'),
  })
  const allowReopenLost = tenantData?.settings?.allowReopenLost !== false
  const pipelineTypeFreeInput = tenantData?.settings?.pipelineTypeFreeInput === true

  const toggleReopenMutation = useMutation({
    mutationFn: (value: boolean) => api.patch('/tenants/current/settings', { allowReopenLost: value }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['tenant-current'] }),
    onError: () => toast.error('Erro ao salvar configuração'),
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
    mutationFn: ({ stageId, transferToStageId: transferId }: { stageId: string; transferToStageId?: string }) => {
      const token = useAuthStore.getState().token
      const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3011'
      return fetch(`${apiUrl}/pipelines/${id}/stages/${stageId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ transferToStageId: transferId }),
      }).then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(data?.error ?? 'Erro ao remover etapa')
        }
      })
    },
    onSuccess: () => {
      toast.success('Etapa removida!')
      setDeleteStageTarget(null)
      setTransferToStageId('')
      void queryClient.invalidateQueries({ queryKey: ['pipeline', id] })
    },
    onError: () => toast.error('Erro ao remover etapa'),
  })

  const renameStageMutation = useMutation({
    mutationFn: ({ stageId, name }: { stageId: string; name: string }) =>
      api.patch(`/pipelines/${id}/stages/${stageId}`, { name }),
    onSuccess: () => {
      toast.success('Etapa renomeada!')
      setEditingStageId(null)
      void queryClient.invalidateQueries({ queryKey: ['pipeline', id] })
    },
    onError: () => toast.error('Erro ao renomear etapa'),
  })

  useEffect(() => {
    const DEFAULT_KEYS = ['contact', 'company', 'assignedTo', 'value', 'expectedCloseDate']
    const saved: string[] = JSON.parse(pipeline?.cardFields ?? JSON.stringify(DEFAULT_KEYS))
    const allKeys = CARD_FIELD_DEFS.map((f) => f.key)
    const visible = saved.filter((k) => allKeys.includes(k)).map((k) => ({ key: k, visible: true }))
    const hidden = allKeys.filter((k) => !saved.includes(k)).map((k) => ({ key: k, visible: false }))
    setLocalFields([...visible, ...hidden])
    setFieldsDirty(false)
  }, [pipeline?.cardFields, pipeline?.id])

  const updateCardFieldsMutation = useMutation({
    mutationFn: (fields: string[]) =>
      api.patch(`/pipelines/${id}`, { cardFields: JSON.stringify(fields) }),
    onSuccess: () => {
      setFieldsDirty(false)
      void queryClient.invalidateQueries({ queryKey: ['pipeline', id] })
    },
    onError: () => toast.error('Erro ao salvar configuração'),
  })

  const updateCardTaskStatusesMutation = useMutation({
    mutationFn: (statuses: string[]) =>
      api.patch(`/pipelines/${id}`, { cardTaskStatuses: JSON.stringify(statuses) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['pipeline', id] }),
    onError: () => toast.error('Erro ao salvar configuração'),
  })

  const fieldSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleFieldDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setLocalFields((prev: { key: string; visible: boolean }[]) => {
      const oldIdx = prev.findIndex((f: { key: string }) => f.key === active.id)
      const newIdx = prev.findIndex((f: { key: string }) => f.key === over.id)
      return arrayMove(prev, oldIdx, newIdx)
    })
    setFieldsDirty(true)
  }

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
      setOppForm({ title: '', value: '', stageId: '', contactId: '', contactLabel: '', notes: '', expectedCloseDate: '', companyId: '', companyLabel: '' })
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
      const pl = await api.post<Pipeline>('/pipelines', {
        ...body,
        ...(newPipelineForm.typeName ? { typeName: newPipelineForm.typeName } : {}),
      })
      await api.post(`/pipelines/${pl.id}/stages`, { name: 'Novo', color: '#6366f1', sortOrder: 0 })
      await api.post(`/pipelines/${pl.id}/stages`, { name: 'Em contato', color: '#f59e0b', sortOrder: 1 })
      await api.post(`/pipelines/${pl.id}/stages`, { name: 'Proposta', color: '#10b981', sortOrder: 2 })
      await api.post(`/pipelines/${pl.id}/stages`, { name: 'Fechamento', color: '#8b5cf6', sortOrder: 3 })
      return pl
    },
    onSuccess: (pl) => {
      toast.success('Funil criado!')
      setNewPipelineOpen(false)
      setNewPipelineForm({ name: '', description: '', type: 'SALES', typeName: '' })
      void queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      router.push(`/funis/${pl.id}`)
    },
    onError: () => toast.error('Erro ao criar pipeline'),
  })

  const reopenOppMutation = useMutation({
    mutationFn: (oppId: string) => api.post(`/opportunities/${oppId}/reopen`, {}),
    onSuccess: () => {
      toast.success('Oportunidade reaberta!')
      void queryClient.invalidateQueries({ queryKey: ['pipeline', id] })
      void queryClient.invalidateQueries({ queryKey: ['opportunities-lost', id] })
      void queryClient.invalidateQueries({ queryKey: ['opportunities-won', id] })
    },
    onError: (err: unknown) => toast.error((err as { message?: string })?.message ?? 'Erro ao reabrir oportunidade'),
  })

  function openNewOpp(stageId?: string) {
    setOppForm((f) => ({ ...f, stageId: stageId ?? pipeline?.stages[0]?.id ?? '', companyId: '', companyLabel: '' }))
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
  const wonValue = (wonOpps?.data ?? []).reduce((sum, o) => sum + Number(o.value ?? 0), 0)

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

        {/* Fechados — ganhas e perdidas separados */}
        {(wonCount > 0 || lostCount > 0) && (
          <div className="flex items-center gap-1">
            {wonCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                onClick={() => { setClosedTab('won'); setClosedOpen(true) }}
              >
                <Trophy className="h-3.5 w-3.5" />
                <span>{wonCount} ganha{wonCount !== 1 ? 's' : ''}</span>
                {wonValue > 0 && <span className="font-semibold">{formatCurrency(wonValue)}</span>}
              </Button>
            )}
            {lostCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => { setClosedTab('lost'); setClosedOpen(true) }}
              >
                <XCircle className="h-3.5 w-3.5" />
                <span>{lostCount} perdida{lostCount !== 1 ? 's' : ''}</span>
              </Button>
            )}
          </div>
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
        <KanbanBoard
          pipeline={pipeline}
          onNewOpportunity={openNewOpp}
          cardFields={JSON.parse(pipeline.cardFields ?? '["contact","company","assignedTo","value","expectedCloseDate"]')}
        />
      ) : (
        <ListViewTable
          opportunities={filteredOpps}
          onReopen={() => {}}
          onSelect={(opp) => setSelectedOpp(opp)}
        />
      )}


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
              {isAdmin && (
                <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Reabrir perdidas</span>
                  <Switch
                    checked={allowReopenLost}
                    onCheckedChange={(v) => toggleReopenMutation.mutate(v)}
                    disabled={toggleReopenMutation.isPending}
                  />
                </div>
              )}
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-6">
            <ClosedOppsTable
              opportunities={closedTab === 'lost' ? (lostOpps?.data ?? []) : (wonOpps?.data ?? [])}
              emptyMessage={closedTab === 'lost' ? 'Nenhuma oportunidade perdida' : 'Nenhuma oportunidade ganha'}
              onReopen={(oppId) => reopenOppMutation.mutate(oppId)}
              reopenPending={reopenOppMutation.isPending}
              canReopen={isAdmin && allowReopenLost}
              onSelect={(opp) => setSelectedOpp(opp)}
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
                    <input
                      type="color"
                      value={stage.color}
                      className="h-6 w-6 rounded-full border cursor-pointer bg-transparent flex-shrink-0"
                      style={{ padding: '1px' }}
                      onChange={() => { /* atualização otimista não necessária — só chama ao soltar */ }}
                      onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                        if (e.target.value !== stage.color) {
                          void api.patch(`/pipelines/${id}/stages/${stage.id}`, { color: e.target.value })
                            .then(() => queryClient.invalidateQueries({ queryKey: ['pipeline', id] }))
                            .catch(() => toast.error('Erro ao salvar cor'))
                        }
                      }}
                      title="Clique para alterar a cor"
                    />
                    {editingStageId === stage.id ? (
                      <Input
                        className="flex-1 h-7 text-sm"
                        value={editingStageName}
                        autoFocus
                        onChange={(e) => setEditingStageName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && editingStageName.trim()) {
                            renameStageMutation.mutate({ stageId: stage.id, name: editingStageName.trim() })
                          }
                          if (e.key === 'Escape') setEditingStageId(null)
                        }}
                        onBlur={() => {
                          if (editingStageName.trim() && editingStageName !== stage.name) {
                            renameStageMutation.mutate({ stageId: stage.id, name: editingStageName.trim() })
                          } else {
                            setEditingStageId(null)
                          }
                        }}
                      />
                    ) : (
                      <span
                        className="flex-1 text-sm font-medium cursor-pointer hover:underline"
                        onClick={() => { setEditingStageId(stage.id); setEditingStageName(stage.name) }}
                        title="Clique para editar"
                      >
                        {stage.name}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{stage.opportunities.length} oport.</span>
                    <Button
                      size="sm" variant="ghost"
                      className="text-red-500 hover:text-red-600 h-7 w-7 p-0"
                      onClick={() => {
                        if (stage.opportunities.length > 0) {
                          setDeleteStageTarget({ id: stage.id, name: stage.name, count: stage.opportunities.length })
                          setTransferToStageId('')
                        } else {
                          deleteStageMutation.mutate({ stageId: stage.id })
                        }
                      }}
                      disabled={deleteStageMutation.isPending}
                      title="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
            </div>

            {/* Campos do card — Notion-style */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Campos exibidos no card</Label>
                <Button
                  size="sm"
                  onClick={() => {
                    const visibleFields = localFields.filter((f) => f.visible).map((f) => f.key)
                    updateCardFieldsMutation.mutate(visibleFields)
                  }}
                  disabled={!fieldsDirty || updateCardFieldsMutation.isPending}
                >
                  {updateCardFieldsMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Salvar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Arraste para reordenar · clique no olho para mostrar/ocultar</p>
              <DndContext
                sensors={fieldSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleFieldDragEnd}
              >
                <SortableContext items={localFields.map((f) => f.key)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1">
                    {localFields.map((field) => (
                      <SortableFieldRow
                        key={field.key}
                        field={field}
                        onToggle={() => {
                          setLocalFields((prev: { key: string; visible: boolean }[]) =>
                            prev.map((f) => (f.key === field.key ? { ...f, visible: !f.visible } : f))
                          )
                          setFieldsDirty(true)
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
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
      <Dialog open={oppModalOpen} onOpenChange={(open) => { setOppModalOpen(open); if (!open) { setCfOppValues({}); setAdminModeOpp(false) } }}>
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
                <EntityCombobox
                  entityType="contact"
                  value={oppForm.contactId}
                  label={oppForm.contactLabel}
                  allowCreate
                  placeholder="Buscar contato..."
                  onChange={async (id, lbl) => {
                    setOppForm((f) => ({ ...f, contactId: id, contactLabel: lbl }))
                    if (id) {
                      try {
                        const c = await api.get<{ companyId?: string; company?: { name: string } }>(`/contacts/${id}`)
                        if (c.companyId && c.company?.name) {
                          setOppForm((f) => ({ ...f, companyId: c.companyId!, companyLabel: c.company!.name }))
                        }
                      } catch { /* ignore */ }
                    }
                  }}
                />
              </div>
            </FieldWrapper>
            <FieldWrapper entityType="opportunity" slug="company" label="Empresa" defaultRequired={false} adminMode={adminModeOpp}>
              <div className="space-y-1.5">
                <Label>Empresa {fieldConfig.isRequired('opportunity', 'company', false) && <span className="text-red-500 ml-0.5">*</span>}</Label>
                <EntityCombobox
                  entityType="company"
                  value={oppForm.companyId}
                  label={oppForm.companyLabel}
                  allowCreate
                  placeholder="Buscar empresa..."
                  onChange={async (id, lbl) => {
                    setOppForm((f) => ({ ...f, companyId: id, companyLabel: lbl }))
                    if (id) {
                      try {
                        const res = await api.get<{ data: { id: string; name: string }[] }>(`/contacts?companyId=${id}&limit=1`)
                        const first = res.data?.[0]
                        if (first) setOppForm((f) => f.contactId ? f : { ...f, contactId: first.id, contactLabel: first.name })
                      } catch {}
                    }
                  }}
                />
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

      {/* ── SHEET: OPORTUNIDADE ── */}
      <OpportunitySheet
        opportunity={selectedOpp}
        pipelineId={id}
        onClose={() => setSelectedOpp(null)}
      />

      {/* ── DIALOG: REMOVER ETAPA COM TRANSFERÊNCIA ── */}
      <Dialog open={!!deleteStageTarget} onOpenChange={(o) => !o && setDeleteStageTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover etapa &quot;{deleteStageTarget?.name}&quot;</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta etapa tem <strong>{deleteStageTarget?.count} oportunidade(s)</strong>. Selecione para qual etapa transferi-las:
          </p>
          <Select value={transferToStageId} onValueChange={setTransferToStageId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecionar etapa de destino..." />
            </SelectTrigger>
            <SelectContent>
              {pipeline.stages
                .filter((s) => s.id !== deleteStageTarget?.id)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setDeleteStageTarget(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={!transferToStageId || deleteStageMutation.isPending}
              onClick={() => deleteStageMutation.mutate({ stageId: deleteStageTarget!.id, transferToStageId })}
            >
              {deleteStageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Transferir e Remover
            </Button>
          </div>
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
              {pipelineTypeFreeInput ? (
                <PipelineTypeCombobox
                  value={newPipelineForm.type}
                  typeName={newPipelineForm.typeName}
                  existingTypeNames={Array.from(new Set((allPipelines ?? []).filter((p) => (p as { typeName?: string }).typeName).map((p) => (p as { typeName?: string }).typeName as string)))}
                  onChange={(type, typeName) => setNewPipelineForm((f) => ({ ...f, type, typeName }))}
                />
              ) : (
                <Select value={newPipelineForm.type} onValueChange={(v) => setNewPipelineForm((f) => ({ ...f, type: v, typeName: '' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PREDEFINED_PIPELINE_TYPES.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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

function ListViewTable({ opportunities, onSelect }: { opportunities: ListOpp[]; onReopen: () => void; onSelect: (opp: Opportunity) => void }) {
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
            <tr key={opp.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => onSelect(opp)}>
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
  onSelect: (opp: Opportunity) => void
}

function ClosedOppsTable({ opportunities, emptyMessage, onReopen, reopenPending, canReopen, onSelect }: ClosedOppsTableProps) {
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
            <tr key={opp.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => onSelect(opp)}>
              <td className="px-4 py-3 font-medium">{opp.title}</td>
              <td className="px-4 py-3 text-muted-foreground">{opp.value ? formatCurrency(opp.value) : '—'}</td>
              <td className="px-4 py-3 text-muted-foreground">{opp.contact?.name ?? '—'}</td>
              <td className="px-4 py-3 text-muted-foreground">{opp.assignedTo.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{formatDate(opp.updatedAt)}</td>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
