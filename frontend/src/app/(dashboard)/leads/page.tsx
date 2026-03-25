'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Lead, Channel } from '@/types'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Upload, X, Loader2, Filter } from 'lucide-react'
import { formatDate, formatPhone } from '@/lib/utils'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'

const statusLabels: Record<string, string> = {
  NEW: 'Novo',
  CONTACTED: 'Contatado',
  QUALIFIED: 'Qualificado',
  UNQUALIFIED: 'Desqualificado',
  CUSTOMER: 'Cliente',
  LOST: 'Perdido',
}

const statusVariants: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'danger'> = {
  NEW: 'default',
  CONTACTED: 'secondary',
  QUALIFIED: 'success',
  UNQUALIFIED: 'danger',
  CUSTOMER: 'success',
  LOST: 'danger',
}

interface CustomField { key: string; value: string }

interface LeadForm {
  name: string
  email: string
  phone: string
  whatsapp: string
  position: string
  companyName: string
  channelId: string
  status: string
  notes: string
  tags: string
  customFields: CustomField[]
}

const defaultForm: LeadForm = {
  name: '',
  email: '',
  phone: '',
  whatsapp: '',
  position: '',
  companyName: '',
  channelId: '',
  status: 'NEW',
  notes: '',
  tags: '',
  customFields: [],
}

export default function LeadsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<LeadForm>(defaultForm)
  const queryClient = useQueryClient()

  const hasFilters = !!statusFilter || !!channelFilter

  const { data, isLoading } = useQuery({
    queryKey: ['leads', page, search, statusFilter, channelFilter],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (channelFilter) params.set('channelId', channelFilter)
      return api.get<{ leads: Lead[]; pagination: { page: number; pages: number; total: number; limit: number } }>(
        `/leads?${params.toString()}`
      )
    },
  })

  const { data: channelsData } = useQuery({
    queryKey: ['channels'],
    queryFn: () => api.get<{ channels: Channel[] }>('/channels'),
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Lead>('/leads', body),
    onSuccess: () => {
      toast.success('Lead criado com sucesso!')
      setModalOpen(false)
      setForm(defaultForm)
      void queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
    onError: (err: unknown) => {
      toast.error((err as { message?: string })?.message ?? 'Erro ao criar lead')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return }

    const customFieldsObj = form.customFields.reduce<Record<string, string>>((acc, f) => {
      if (f.key.trim()) acc[f.key.trim()] = f.value
      return acc
    }, {})

    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean)

    createMutation.mutate({
      name: form.name,
      ...(form.email && { email: form.email }),
      ...(form.phone && { phone: form.phone }),
      ...(form.whatsapp && { whatsapp: form.whatsapp }),
      ...(form.position && { position: form.position }),
      ...(form.channelId && { channelId: form.channelId }),
      status: form.status,
      ...(form.notes && { notes: form.notes }),
      ...(tags.length && { tags }),
      ...(Object.keys(customFieldsObj).length && { customFields: customFieldsObj }),
    })
  }

  function addCustomField() {
    setForm((f) => ({ ...f, customFields: [...f.customFields, { key: '', value: '' }] }))
  }

  function removeCustomField(idx: number) {
    setForm((f) => ({ ...f, customFields: f.customFields.filter((_, i) => i !== idx) }))
  }

  function updateCustomField(idx: number, part: 'key' | 'value', val: string) {
    setForm((f) => ({
      ...f,
      customFields: f.customFields.map((cf, i) => i === idx ? { ...cf, [part]: val } : cf),
    }))
  }

  function clearFilters() {
    setStatusFilter('')
    setChannelFilter('')
    setPage(1)
  }

  const columns = [
    {
      key: 'name',
      header: 'Nome',
      render: (row: Lead) => (
        <Link href={`/leads/${row.id}`} className="font-medium text-primary hover:underline">
          {row.name}
        </Link>
      ),
    },
    {
      key: 'company',
      header: 'Empresa',
      render: (row: Lead) => <span className="text-sm">{row.company?.name ?? '—'}</span>,
    },
    {
      key: 'phone',
      header: 'Telefone',
      render: (row: Lead) => (
        <span className="text-sm text-muted-foreground">
          {row.phone ? formatPhone(row.phone) : '—'}
        </span>
      ),
    },
    {
      key: 'channel',
      header: 'Canal',
      render: (row: Lead) => (
        <span className="text-sm">{row.channel?.name ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: Lead) => (
        <Badge variant={statusVariants[row.status] ?? 'secondary'}>
          {statusLabels[row.status] ?? row.status}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Criado em',
      render: (row: Lead) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.createdAt)}</span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou telefone..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {/* Status filter */}
          <Select
            value={statusFilter}
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

          {/* Channel filter */}
          <Select
            value={channelFilter}
            onValueChange={(v) => { setChannelFilter(v === 'ALL' ? '' : v); setPage(1) }}
          >
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="Canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os canais</SelectItem>
              {(channelsData?.channels ?? []).map((ch) => (
                <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear filters */}
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
              <X className="h-3.5 w-3.5 mr-1" />
              Limpar
            </Button>
          )}

          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Importar CSV
          </Button>
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Lead
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.leads ?? []}
        isLoading={isLoading}
        rowKey={(row) => row.id}
        pagination={data?.pagination ? {
          page: data.pagination.page,
          pages: data.pagination.pages,
          total: data.pagination.total,
          onPageChange: setPage,
        } : undefined}
        emptyMessage="Nenhum lead encontrado"
      />

      {/* Novo Lead Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) setForm(defaultForm) }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Dados básicos */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Nome *</Label>
                <Input
                  placeholder="Nome completo"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  placeholder="(11) 99999-9999"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>WhatsApp</Label>
                <Input
                  placeholder="5511999999999"
                  value={form.whatsapp}
                  onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Input
                  placeholder="Ex: CEO, Diretor..."
                  value={form.position}
                  onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Empresa</Label>
                <Input
                  placeholder="Nome da empresa"
                  value={form.companyName}
                  onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Canal de aquisição</Label>
                <Select value={form.channelId} onValueChange={(v) => setForm((f) => ({ ...f, channelId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(channelsData?.channels ?? []).map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([val, lbl]) => (
                      <SelectItem key={val} value={val}>{lbl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Tags <span className="text-muted-foreground text-xs">(separadas por vírgula)</span></Label>
                <Input
                  placeholder="hot, indicação, B2B..."
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notas</Label>
                <textarea
                  rows={2}
                  placeholder="Observações sobre o lead..."
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>
            </div>

            {/* Campos adicionais */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Campos adicionais</Label>
                <Button type="button" size="sm" variant="outline" onClick={addCustomField}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Adicionar campo
                </Button>
              </div>
              {form.customFields.map((cf, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    placeholder="Nome do campo"
                    value={cf.key}
                    onChange={(e) => updateCustomField(idx, 'key', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Valor"
                    value={cf.value}
                    onChange={(e) => updateCustomField(idx, 'value', e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeCustomField(idx)}
                    className="text-red-500 hover:text-red-600 shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                ) : 'Criar Lead'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
