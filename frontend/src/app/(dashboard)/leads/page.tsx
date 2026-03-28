'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Lead, Contact, Pipeline } from '@/types'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, X, Loader2, Filter, Zap, Pencil } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { CustomFieldsPanel } from '@/components/custom-fields/CustomFieldsPanel'

// ── Status config ──

const statusLabels: Record<string, string> = {
  NEW: 'Novo',
  NURTURING: 'Nutrição',
  QUALIFIED: 'Qualificado',
  DISQUALIFIED: 'Desqualificado',
}

const statusColors: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700 border-blue-200',
  NURTURING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  QUALIFIED: 'bg-green-100 text-green-700 border-green-200',
  DISQUALIFIED: 'bg-gray-100 text-gray-600 border-gray-200',
}

// ── Score bar ──

function ScoreBar({ score }: { score: number }) {
  const color = score > 70 ? '#10b981' : score > 40 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 bg-muted rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${Math.min(100, Math.max(0, score))}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums w-6">{score}</span>
    </div>
  )
}

// ── Forms ──

interface LeadForm {
  contactId: string
  source: string
  status: string
  score: string
}

const defaultLeadForm: LeadForm = {
  contactId: '',
  source: '',
  status: 'NEW',
  score: '0',
}

interface QualifyForm {
  pipelineId: string
  stageId: string
}

interface EditLeadForm {
  contactId: string
  contactLabel: string
  contactSearch: string
  status: string
  score: string
  source: string
}

export default function LeadsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [scoreMin, setScoreMin] = useState('')
  const [scoreMax, setScoreMax] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<LeadForm>(defaultLeadForm)
  const [contactSearch, setContactSearch] = useState('')

  const [qualifyLead, setQualifyLead] = useState<Lead | null>(null)
  const [qualifyForm, setQualifyForm] = useState<QualifyForm>({ pipelineId: '', stageId: '' })

  const [editLead, setEditLead] = useState<Lead | null>(null)
  const [editForm, setEditForm] = useState<EditLeadForm>({
    contactId: '', contactLabel: '', contactSearch: '', status: 'NEW', score: '0', source: '',
  })
  const [editContactSearch, setEditContactSearch] = useState('')

  const [cfCreateValues, setCfCreateValues] = useState<Record<string, unknown>>({})

  const queryClient = useQueryClient()

  // Leads query
  const { data, isLoading } = useQuery({
    queryKey: ['leads', page, search, statusFilter, scoreMin, scoreMax],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (scoreMin) params.set('score_gte', scoreMin)
      if (scoreMax) params.set('score_lte', scoreMax)
      return api.get<{ data: Lead[]; total: number; page: number; limit: number }>(
        `/leads?${params.toString()}`
      )
    },
  })

  // Contact search for create modal
  const { data: contactsData } = useQuery({
    queryKey: ['contacts-search-lead', contactSearch],
    queryFn: () => api.get<{ data: Contact[] }>(`/contacts?limit=20${contactSearch ? `&search=${encodeURIComponent(contactSearch)}` : ''}`),
    enabled: createOpen,
  })

  // Contact search for edit modal
  const { data: editContactsData } = useQuery({
    queryKey: ['contacts-search-lead-edit', editContactSearch],
    queryFn: () => api.get<{ data: Contact[] }>(`/contacts?limit=20${editContactSearch ? `&search=${encodeURIComponent(editContactSearch)}` : ''}`),
    enabled: !!editLead,
  })

  // Pipelines for qualify modal
  const { data: pipelinesData } = useQuery({
    queryKey: ['pipelines-list'],
    queryFn: () => api.get<Pipeline[]>('/pipelines'),
    enabled: !!qualifyLead,
  })

  // Create lead
  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const lead = await api.post<Lead>('/leads', body)
      // Save custom field values
      const cfEntries = Object.entries(cfCreateValues).filter(([, v]) => v !== '' && v !== null && v !== undefined)
      if (cfEntries.length > 0) {
        await Promise.allSettled(
          cfEntries.map(([fieldId, value]) =>
            api.put('/custom-fields/values', { customFieldId: fieldId, entityType: 'lead', entityId: lead.id, valueText: typeof value === 'string' ? value : undefined, valueJson: typeof value !== 'string' ? value : undefined })
          )
        )
      }
      return lead
    },
    onSuccess: () => {
      toast.success('Lead criado com sucesso!')
      setCreateOpen(false)
      setForm(defaultLeadForm)
      setContactSearch('')
      setCfCreateValues({})
      void queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
    onError: (err: unknown) => {
      toast.error((err as { message?: string })?.message ?? 'Erro ao criar lead')
    },
  })

  // Qualify lead
  const qualifyMutation = useMutation({
    mutationFn: ({ leadId, pipelineId, stageId }: { leadId: string; pipelineId: string; stageId: string }) =>
      api.post<{ opportunity: { id: string } }>(`/leads/${leadId}/qualify`, { pipelineId, stageId }),
    onSuccess: () => {
      toast.success('Lead qualificado com sucesso!')
      setQualifyLead(null)
      setQualifyForm({ pipelineId: '', stageId: '' })
      void queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
    onError: (err: unknown) => {
      toast.error((err as { message?: string })?.message ?? 'Erro ao qualificar lead')
    },
  })

  // Edit lead
  const editMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch<Lead>(`/leads/${id}`, body),
    onSuccess: () => {
      toast.success('Lead atualizado com sucesso!')
      setEditLead(null)
      setEditContactSearch('')
      void queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
    onError: (err: unknown) => {
      toast.error((err as { message?: string })?.message ?? 'Erro ao atualizar lead')
    },
  })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.contactId) { toast.error('Selecione um contato'); return }
    createMutation.mutate({
      contactId: form.contactId,
      ...(form.source && { source: form.source }),
      status: form.status,
      score: parseInt(form.score, 10) || 0,
    })
  }

  function handleQualify(e: React.FormEvent) {
    e.preventDefault()
    if (!qualifyLead) return
    if (!qualifyForm.pipelineId) { toast.error('Selecione um funil'); return }
    if (!qualifyForm.stageId) { toast.error('Selecione uma etapa'); return }
    qualifyMutation.mutate({
      leadId: qualifyLead.id,
      pipelineId: qualifyForm.pipelineId,
      stageId: qualifyForm.stageId,
    })
  }

  function openEditLead(lead: Lead) {
    setEditLead(lead)
    setEditForm({
      contactId: lead.contactId ?? '',
      contactLabel: lead.contact?.name ?? '',
      contactSearch: '',
      status: lead.status,
      score: String(lead.score),
      source: lead.source ?? '',
    })
    setEditContactSearch('')
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editLead) return
    editMutation.mutate({
      id: editLead.id,
      body: {
        status: editForm.status as 'NEW' | 'NURTURING' | 'QUALIFIED' | 'DISQUALIFIED',
        score: parseInt(editForm.score, 10) || 0,
        ...(editForm.source && { source: editForm.source }),
      },
    })
  }

  const selectedContact = contactsData?.data?.find((c) => c.id === form.contactId)
  const pages = data ? Math.ceil(data.total / data.limit) : 1

  // Selected pipeline stages for qualify form
  const selectedPipeline = pipelinesData?.find((p) => p.id === qualifyForm.pipelineId)
  const pipelineStages = selectedPipeline?.stages ?? []

  const columns = [
    {
      key: 'contact',
      header: 'Contato',
      render: (row: Lead) => (
        <span className="font-medium">{row.contact?.name ?? '—'}</span>
      ),
    },
    {
      key: 'phone',
      header: 'Telefone',
      render: (row: Lead) => (
        <span className="text-sm text-muted-foreground">{row.contact?.phone ?? '—'}</span>
      ),
    },
    {
      key: 'source',
      header: 'Origem',
      render: (row: Lead) => {
        const parts = [
          row.contact?.origin?.name,
          row.contact?.subOrigin?.name,
          row.source,
        ].filter(Boolean)
        return <span className="text-sm">{parts.join(' / ') || '—'}</span>
      },
    },
    {
      key: 'score',
      header: 'Score',
      render: (row: Lead) => <ScoreBar score={row.score} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: Lead) => (
        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${statusColors[row.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {statusLabels[row.status] ?? row.status}
        </span>
      ),
    },
    {
      key: 'company',
      header: 'Empresa',
      render: (row: Lead) => (
        <span className="text-sm text-muted-foreground">{row.contact?.company?.name ?? '—'}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Criado em',
      render: (row: Lead) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row: Lead) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            title="Editar lead"
            onClick={(e) => {
              e.stopPropagation()
              openEditLead(row)
            }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          {row.status !== 'QUALIFIED' && row.status !== 'DISQUALIFIED' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                setQualifyLead(row)
                setQualifyForm({ pipelineId: '', stageId: '' })
              }}
            >
              <Zap className="h-3 w-3 mr-1" />
              Qualificar
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {/* Status filter */}
          <Select
            value={statusFilter || 'ALL'}
            onValueChange={(v) => { setStatusFilter(v === 'ALL' ? '' : v); setPage(1) }}
          >
            <SelectTrigger className="h-9 w-[160px]">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os status</SelectItem>
              {Object.entries(statusLabels).map(([val, lbl]) => (
                <SelectItem key={val} value={val}>{lbl}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Score range */}
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min="0"
              max="100"
              placeholder="Score min"
              className="h-9 w-24 text-xs"
              value={scoreMin}
              onChange={(e) => { setScoreMin(e.target.value); setPage(1) }}
            />
            <span className="text-muted-foreground text-xs">–</span>
            <Input
              type="number"
              min="0"
              max="100"
              placeholder="Score max"
              className="h-9 w-24 text-xs"
              value={scoreMax}
              onChange={(e) => { setScoreMax(e.target.value); setPage(1) }}
            />
          </div>

          {(statusFilter || scoreMin || scoreMax) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => { setStatusFilter(''); setScoreMin(''); setScoreMax(''); setPage(1) }}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Limpar
            </Button>
          )}

          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Lead
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        rowKey={(row) => row.id}
        pagination={data ? {
          page: data.page,
          pages,
          total: data.total,
          onPageChange: setPage,
        } : undefined}
        emptyMessage="Nenhum lead encontrado"
      />

      {/* Create Lead Modal */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) { setForm(defaultLeadForm); setContactSearch(''); setCfCreateValues({}) } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Contato <span className="text-red-500">*</span></Label>
              <div className="space-y-2">
                <Input
                  placeholder="Buscar contato por nome ou telefone..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                />
                {selectedContact && (
                  <div className="flex items-center gap-2 rounded border px-3 py-2 bg-primary/5 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{selectedContact.name}</p>
                      {selectedContact.phone && <p className="text-xs text-muted-foreground">{selectedContact.phone}</p>}
                      {(selectedContact as Contact & { company?: { name: string } }).company?.name && (
                        <p className="text-xs text-muted-foreground">🏢 {(selectedContact as Contact & { company?: { name: string } }).company!.name}</p>
                      )}
                    </div>
                    <button type="button" onClick={() => setForm((f) => ({ ...f, contactId: '' }))}>
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                )}
                {contactSearch && !form.contactId && (
                  <div className="rounded border divide-y max-h-36 overflow-y-auto">
                    {(contactsData?.data ?? []).map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                        onClick={() => { setForm((f) => ({ ...f, contactId: contact.id })); setContactSearch('') }}
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
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([val, lbl]) => (
                      <SelectItem key={val} value={val}>{lbl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Score (0–100)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={form.score}
                  onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Input
                placeholder="Ex: Google Ads, Indicação..."
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              />
            </div>

            {/* Campos personalizados */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Campos Personalizados</h3>
              <CustomFieldsPanel
                entityType="lead"
                values={cfCreateValues}
                onChange={(id, v) => setCfCreateValues((p) => ({ ...p, [id]: v }))}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                {createMutation.isPending
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                  : 'Criar Lead'
                }
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Lead Modal */}
      <Dialog open={!!editLead} onOpenChange={(open) => { if (!open) { setEditLead(null); setEditContactSearch('') } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Lead</DialogTitle>
          </DialogHeader>
          {editLead && (
            <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Contato</Label>
                {editForm.contactId ? (
                  <div className="flex items-center gap-2 rounded border px-3 py-2 bg-primary/5 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{editForm.contactLabel}</p>
                    </div>
                    <button type="button" onClick={() => setEditForm((f) => ({ ...f, contactId: '', contactLabel: '' }))}>
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      placeholder="Buscar contato por nome ou telefone..."
                      value={editContactSearch}
                      onChange={(e) => setEditContactSearch(e.target.value)}
                    />
                    {editContactSearch && (
                      <div className="rounded border divide-y max-h-36 overflow-y-auto">
                        {(editContactsData?.data ?? []).map((contact) => (
                          <button
                            key={contact.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                            onClick={() => { setEditForm((f) => ({ ...f, contactId: contact.id, contactLabel: contact.name })); setEditContactSearch('') }}
                          >
                            <span className="font-medium">{contact.name}</span>
                            {contact.phone && <span className="text-muted-foreground ml-2 text-xs">— {contact.phone}</span>}
                          </button>
                        ))}
                        {(editContactsData?.data ?? []).length === 0 && (
                          <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum contato encontrado</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {editLead.contact?.company?.name && (
                  <p className="text-xs text-muted-foreground">Empresa: {editLead.contact.company.name}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([val, lbl]) => (
                        <SelectItem key={val} value={val}>{lbl}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Score (0–100)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={editForm.score}
                    onChange={(e) => setEditForm((f) => ({ ...f, score: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Origem</Label>
                <Input
                  placeholder="Ex: Google Ads, Indicação..."
                  value={editForm.source}
                  onChange={(e) => setEditForm((f) => ({ ...f, source: e.target.value }))}
                />
              </div>

              {/* Campos personalizados */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Campos Personalizados</h3>
                <CustomFieldsPanel
                  entityType="lead"
                  entityId={editLead.id}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditLead(null)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={editMutation.isPending}>
                  {editMutation.isPending
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                    : 'Salvar'
                  }
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Qualify Lead Modal */}
      <Dialog open={!!qualifyLead} onOpenChange={(open) => { if (!open) { setQualifyLead(null); setQualifyForm({ pipelineId: '', stageId: '' }) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Qualificar Lead</DialogTitle>
          </DialogHeader>
          {qualifyLead && (
            <form onSubmit={handleQualify} className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Qualificando: <span className="font-medium text-foreground">{qualifyLead.contact?.name}</span>
              </p>

              <div className="space-y-1.5">
                <Label>Funil <span className="text-red-500">*</span></Label>
                <Select
                  value={qualifyForm.pipelineId}
                  onValueChange={(v) => setQualifyForm((f) => ({ ...f, pipelineId: v, stageId: '' }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecionar funil..." /></SelectTrigger>
                  <SelectContent>
                    {(pipelinesData ?? []).filter((p) => p.isActive).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {qualifyForm.pipelineId && (
                <div className="space-y-1.5">
                  <Label>Etapa <span className="text-red-500">*</span></Label>
                  <Select
                    value={qualifyForm.stageId}
                    onValueChange={(v) => setQualifyForm((f) => ({ ...f, stageId: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecionar etapa..." /></SelectTrigger>
                    <SelectContent>
                      {pipelineStages
                        .slice()
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                              {s.name}
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setQualifyLead(null)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={!qualifyForm.pipelineId || !qualifyForm.stageId || qualifyMutation.isPending}
                >
                  {qualifyMutation.isPending
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Qualificando...</>
                    : <><Zap className="h-4 w-4 mr-1" />Qualificar</>
                  }
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
