'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Company } from '@/types'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Search, Loader2, Building2, Users, TrendingUp, ExternalLink } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface ContactItem { id: string; name: string; email?: string; phone?: string }
interface OppItem { id: string; title: string; value?: number; status: string; pipeline?: { name: string }; stage?: { name: string } }

interface CompanyForm {
  name: string
  cnpj: string
  segment: string
  website: string
  notes: string
}

const defaultForm: CompanyForm = { name: '', cnpj: '', segment: '', website: '', notes: '' }

export default function EmpresasPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<CompanyForm>(defaultForm)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const queryClient = useQueryClient()

  const { data: companyContacts } = useQuery({
    queryKey: ['company-contacts', selectedCompany?.id],
    queryFn: () => api.get<ContactItem[]>(`/companies/${selectedCompany!.id}/contacts`),
    enabled: !!selectedCompany,
  })

  const { data: companyOpps } = useQuery({
    queryKey: ['company-opps', selectedCompany?.id],
    queryFn: () => api.get<OppItem[]>(`/companies/${selectedCompany!.id}/opportunities`),
    enabled: !!selectedCompany,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['companies', page, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      return api.get<{ data: Company[]; total: number; page: number; limit: number }>(
        `/companies?${params.toString()}`
      )
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Company>('/companies', body),
    onSuccess: () => {
      toast.success('Empresa criada!')
      setModalOpen(false)
      setForm(defaultForm)
      void queryClient.invalidateQueries({ queryKey: ['companies'] })
    },
    onError: (err: unknown) => {
      toast.error((err as { message?: string })?.message ?? 'Erro ao criar empresa')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return }
    createMutation.mutate({
      name: form.name,
      ...(form.cnpj && { cnpj: form.cnpj }),
      ...(form.segment && { segment: form.segment }),
      ...(form.website && { website: form.website }),
      ...(form.notes && { notes: form.notes }),
    })
  }

  const pages = data ? Math.ceil(data.total / data.limit) : 1

  const columns = [
    {
      key: 'name',
      header: 'Nome',
      render: (row: Company) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'cnpj',
      header: 'CNPJ',
      render: (row: Company) => <span className="text-sm text-muted-foreground">{row.cnpj ?? '—'}</span>,
    },
    {
      key: 'segment',
      header: 'Segmento',
      render: (row: Company) => <span className="text-sm">{row.segment ?? '—'}</span>,
    },
    {
      key: 'contacts',
      header: 'Contatos',
      render: (row: Company) => (
        <span className="text-sm text-muted-foreground">{row._count?.contacts ?? 0}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Criado em',
      render: (row: Company) => <span className="text-sm text-muted-foreground">{formatDate(row.createdAt)}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CNPJ..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Empresa
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        rowKey={(row) => row.id}
        onRowClick={(row) => setSelectedCompany(row)}
        pagination={data ? { page: data.page, pages, total: data.total, onPageChange: setPage } : undefined}
        emptyMessage="Nenhuma empresa encontrada"
      />

      {/* Company Detail Sheet */}
      <Sheet open={!!selectedCompany} onOpenChange={(open) => !open && setSelectedCompany(null)}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-base">{selectedCompany?.name}</SheetTitle>
                {selectedCompany?.segment && <p className="text-xs text-muted-foreground">{selectedCompany.segment}</p>}
              </div>
            </div>
          </SheetHeader>
          <Tabs defaultValue="contacts" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-6 mt-4 w-auto justify-start">
              <TabsTrigger value="contacts"><Users className="h-3.5 w-3.5 mr-1" />Contatos ({companyContacts?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="opps"><TrendingUp className="h-3.5 w-3.5 mr-1" />Oportunidades ({companyOpps?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="info">Dados</TabsTrigger>
            </TabsList>
            <TabsContent value="contacts" className="flex-1 overflow-y-auto px-6 py-3 space-y-2 mt-0">
              {(companyContacts ?? []).length === 0
                ? <p className="text-sm text-muted-foreground py-4">Nenhum contato vinculado</p>
                : (companyContacts ?? []).map((c) => (
                  <Link key={c.id} href={`/contatos/${c.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
                    onClick={() => setSelectedCompany(null)}>
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{c.name}</p>
                      {c.email && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                ))}
            </TabsContent>
            <TabsContent value="opps" className="flex-1 overflow-y-auto px-6 py-3 space-y-2 mt-0">
              {(companyOpps ?? []).length === 0
                ? <p className="text-sm text-muted-foreground py-4">Nenhuma oportunidade vinculada</p>
                : (companyOpps ?? []).map((o) => (
                  <div key={o.id} className="p-3 rounded-lg border space-y-1">
                    <p className="text-sm font-medium">{o.title}</p>
                    <div className="flex items-center gap-2">
                      {o.pipeline && <span className="text-xs text-muted-foreground">{o.pipeline.name}</span>}
                      {o.stage && <><span className="text-xs text-muted-foreground">›</span><span className="text-xs text-muted-foreground">{o.stage.name}</span></>}
                      <Badge variant="outline" className="text-xs ml-auto">{o.status}</Badge>
                    </div>
                    {o.value && <p className="text-xs font-medium text-green-600">R$ {o.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>}
                  </div>
                ))}
            </TabsContent>
            <TabsContent value="info" className="px-6 py-3 space-y-3 mt-0">
              {selectedCompany?.cnpj && <div><p className="text-xs text-muted-foreground">CNPJ</p><p className="text-sm">{selectedCompany.cnpj}</p></div>}
              {selectedCompany?.website && <div><p className="text-xs text-muted-foreground">Website</p><a href={selectedCompany.website} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">{selectedCompany.website}</a></div>}
              {selectedCompany?.notes && <div><p className="text-xs text-muted-foreground">Notas</p><p className="text-sm">{selectedCompany.notes}</p></div>}
              <div><p className="text-xs text-muted-foreground">Criado em</p><p className="text-sm">{formatDate(selectedCompany?.createdAt ?? '')}</p></div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <Dialog open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) setForm(defaultForm) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Empresa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input
                placeholder="Nome da empresa"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>CNPJ</Label>
                <Input
                  placeholder="00.000.000/0001-00"
                  value={form.cnpj}
                  onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Segmento</Label>
                <Input
                  placeholder="Ex: Tecnologia, Saúde..."
                  value={form.segment}
                  onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input
                placeholder="https://empresa.com.br"
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
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
                ) : 'Criar Empresa'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
