'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Lead, Contact } from '@/types'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, X, Loader2, Filter } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'

const statusLabels: Record<string, string> = {
  NEW: 'Novo',
  QUALIFIED: 'Qualificado',
  DISQUALIFIED: 'Desqualificado',
}

const statusVariants: Record<string, 'default' | 'secondary' | 'success' | 'danger'> = {
  NEW: 'secondary',
  QUALIFIED: 'success',
  DISQUALIFIED: 'danger',
}

interface LeadForm {
  contactId: string
  source: string
  status: string
  score: string
}

const defaultForm: LeadForm = {
  contactId: '',
  source: '',
  status: 'NEW',
  score: '0',
}

export default function LeadsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<LeadForm>(defaultForm)
  const [contactSearch, setContactSearch] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['leads', page, search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      return api.get<{ data: Lead[]; total: number; page: number; limit: number }>(
        `/leads?${params.toString()}`
      )
    },
  })

  const { data: contactsData } = useQuery({
    queryKey: ['contacts-search-lead', contactSearch],
    queryFn: () => api.get<{ data: Contact[] }>(`/contacts?limit=20${contactSearch ? `&search=${encodeURIComponent(contactSearch)}` : ''}`),
    enabled: modalOpen,
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Lead>('/leads', body),
    onSuccess: () => {
      toast.success('Lead criado com sucesso!')
      setModalOpen(false)
      setForm(defaultForm)
      setContactSearch('')
      void queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
    onError: (err: unknown) => {
      toast.error((err as { message?: string })?.message ?? 'Erro ao criar lead')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.contactId) { toast.error('Selecione um contato'); return }

    createMutation.mutate({
      contactId: form.contactId,
      ...(form.source && { source: form.source }),
      status: form.status,
      score: parseInt(form.score, 10) || 0,
    })
  }

  const selectedContact = contactsData?.data?.find((c) => c.id === form.contactId)
  const pages = data ? Math.ceil(data.total / data.limit) : 1

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
      render: (row: Lead) => (
        <span className="text-sm">{row.source ?? '—'}</span>
      ),
    },
    {
      key: 'score',
      header: 'Score',
      render: (row: Lead) => (
        <span className="text-sm font-medium">{row.score}</span>
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
            placeholder="Buscar por nome ou telefone..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <div className="flex gap-2 items-center flex-wrap">
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

          {statusFilter && (
            <Button variant="ghost" size="sm" onClick={() => { setStatusFilter(''); setPage(1) }} className="h-9">
              <X className="h-3.5 w-3.5 mr-1" />
              Limpar
            </Button>
          )}

          <Button size="sm" onClick={() => setModalOpen(true)}>
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

      {/* Novo Lead Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) { setForm(defaultForm); setContactSearch('') } }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
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
