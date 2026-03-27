'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Contact } from '@/types'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Search, X, Building2, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'

interface ContactForm {
  name: string
  email: string
  phone: string
  notes: string
  companyId: string
  companyLabel: string
}

const defaultForm: ContactForm = { name: '', email: '', phone: '', notes: '', companyId: '', companyLabel: '' }

interface Company { id: string; name: string }

function CompanySearch({ value, label, onChange }: { value: string; label: string; onChange: (id: string, name: string) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['companies-search', q],
    queryFn: () => api.get<{ data: Company[] }>(`/companies?search=${encodeURIComponent(q)}&limit=8`),
    enabled: q.length > 0,
  })

  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (value) return (
    <div className="flex items-center gap-2 border rounded-md px-3 py-2 text-sm bg-background">
      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="flex-1 font-medium">{label}</span>
      <button type="button" onClick={() => onChange('', '')}><X className="h-3.5 w-3.5" /></button>
    </div>
  )

  return (
    <div ref={ref} className="relative">
      <Input
        placeholder="Buscar empresa..."
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => q && setOpen(true)}
      />
      {open && (data?.data?.length ?? 0) > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
          {data!.data.map((c) => (
            <button key={c.id} type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
              onMouseDown={() => { onChange(c.id, c.name); setQ(''); setOpen(false) }}>
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ContatosPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<ContactForm>(defaultForm)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', page, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      return api.get<{ data: Contact[]; total: number; page: number; limit: number }>(
        `/contacts?${params.toString()}`
      )
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Contact>('/contacts', body),
    onSuccess: () => {
      toast.success('Contato criado!')
      setModalOpen(false)
      setForm(defaultForm)
      void queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
    onError: (err: unknown) => {
      toast.error((err as { message?: string })?.message ?? 'Erro ao criar contato')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return }
    createMutation.mutate({
      name: form.name,
      ...(form.email && { email: form.email }),
      ...(form.phone && { phone: form.phone }),
      ...(form.notes && { notes: form.notes }),
      ...(form.companyId && { companyId: form.companyId }),
    })
  }

  const pages = data ? Math.ceil(data.total / data.limit) : 1

  const columns = [
    {
      key: 'name',
      header: 'Nome',
      render: (row: Contact) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (row: Contact) => <span className="text-sm text-muted-foreground">{row.email ?? '—'}</span>,
    },
    {
      key: 'phone',
      header: 'Telefone',
      render: (row: Contact) => <span className="text-sm text-muted-foreground">{row.phone ?? '—'}</span>,
    },
    {
      key: 'company',
      header: 'Empresa',
      render: (row: Contact) => <span className="text-sm">{row.company?.name ?? '—'}</span>,
    },
    {
      key: 'createdAt',
      header: 'Criado em',
      render: (row: Contact) => <span className="text-sm text-muted-foreground">{formatDate(row.createdAt)}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou telefone..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Contato
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        rowKey={(row) => row.id}
        pagination={data ? { page: data.page, pages, total: data.total, onPageChange: setPage } : undefined}
        emptyMessage="Nenhum contato encontrado"
      />

      <Dialog open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) setForm(defaultForm) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Contato</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input
                placeholder="Nome completo"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <CompanySearch
                value={form.companyId}
                label={form.companyLabel}
                onChange={(id, name) => setForm((f) => ({ ...f, companyId: id, companyLabel: name }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <textarea
                rows={2}
                placeholder="Observações..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</>
                ) : 'Criar Contato'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
