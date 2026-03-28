'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Company } from '@/types'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Search, Loader2, Building2, Users, TrendingUp, ExternalLink, X, GitBranch, Settings2, Trash2 } from 'lucide-react'
import { EntityCombobox } from '@/components/shared/EntityCombobox'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { CustomFieldsPanel } from '@/components/custom-fields/CustomFieldsPanel'
import { FieldWrapper } from '@/components/custom-fields/FieldWrapper'
import { useAuthStore } from '@/stores/authStore'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

interface ContactItem { id: string; name: string; email?: string; phone?: string }

interface OppItem { id: string; title: string; value?: number; status: string; pipeline?: { name: string }; stage?: { name: string } }

interface FlatOrigin { id: string; name: string; path: string; depth: number; parentId: string | null }

interface CompanyForm {
  name: string
  legalName: string
  cnpj: string
  category: string
  segment: string
  email: string
  phone: string
  whatsapp: string
  mobile: string
  fax: string
  extension: string
  website: string
  originId: string
  originLabel: string
  addrZip: string
  addrCountry: string
  addrState: string
  addrCity: string
  addrNeighborhood: string
  addrStreet: string
  addrNumber: string
  addrComplement: string
  socialLinkedin: string
  socialInstagram: string
  socialFacebook: string
  socialTwitter: string
  notes: string
  contactId: string
  contactLabel: string
  opportunityId: string
  opportunityLabel: string
  assignedToId: string
}

const defaultForm: CompanyForm = {
  name: '', legalName: '', cnpj: '', category: '', segment: '',
  email: '', phone: '', whatsapp: '', mobile: '', fax: '', extension: '', website: '',
  originId: '', originLabel: '',
  addrZip: '', addrCountry: '', addrState: '', addrCity: '', addrNeighborhood: '', addrStreet: '', addrNumber: '', addrComplement: '',
  socialLinkedin: '', socialInstagram: '', socialFacebook: '', socialTwitter: '',
  notes: '', contactId: '', contactLabel: '', opportunityId: '', opportunityLabel: '',
  assignedToId: '',
}

function OriginSearchEmpresa({ value, label, onChange }: { value: string; label: string; onChange: (id: string, path: string) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: origins = [] } = useQuery({
    queryKey: ['origins-flat'],
    queryFn: () => api.get<FlatOrigin[]>('/origins/flat'),
  })

  const filtered = origins.filter((o) => !q || o.path.toLowerCase().includes(q.toLowerCase()))

  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (value) return (
    <div className="flex items-center gap-2 border rounded-md px-3 py-2 text-sm bg-background">
      <GitBranch className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      <span className="flex-1 font-medium truncate">{label}</span>
      <button type="button" onClick={() => onChange('', '')}><X className="h-3.5 w-3.5" /></button>
    </div>
  )

  return (
    <div ref={ref} className="relative">
      <Input
        placeholder="Buscar origem..."
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
          {filtered.map((o) => (
            <button key={o.id} type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
              style={{ paddingLeft: `${12 + o.depth * 16}px` }}
              onMouseDown={() => { onChange(o.id, o.path); setQ(''); setOpen(false) }}>
              <span className="text-muted-foreground text-xs">{o.depth > 0 ? '↳ ' : ''}</span>{o.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function EmpresasPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<CompanyForm>(defaultForm)
  const [editForm, setEditForm] = useState<CompanyForm>(defaultForm)
  const [cfCreateValues, setCfCreateValues] = useState<Record<string, unknown>>({})
  const [adminMode, setAdminMode] = useState(false)
  const [adminModeEdit, setAdminModeEdit] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null)
  const queryClient = useQueryClient()
  const authUser = useAuthStore((s) => s.user)
  const isAdmin = authUser?.role === 'ADMIN' || authUser?.role === 'MANAGER'

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<{ users: Array<{ id: string; name: string }> }>('/users'),
  })
  const users = usersData?.users ?? []

  // Populate editForm when selectedCompany changes
  useEffect(() => {
    if (!selectedCompany) return
    const c = selectedCompany as Company & {
      legalName?: string; cnpj?: string; category?: string; segment?: string
      email?: string; phone?: string; whatsapp?: string; mobile?: string; fax?: string; extension?: string
      website?: string; originId?: string; notes?: string
      addressJson?: { zip?: string; country?: string; state?: string; city?: string; neighborhood?: string; street?: string; number?: string; complement?: string }
      socialProfiles?: { linkedin?: string; instagram?: string; facebook?: string; twitter?: string }
    }
    setEditForm({
      name: c.name ?? '',
      legalName: c.legalName ?? '',
      cnpj: c.cnpj ?? '',
      category: c.category ?? '',
      segment: c.segment ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      whatsapp: c.whatsapp ?? '',
      mobile: c.mobile ?? '',
      fax: c.fax ?? '',
      extension: c.extension ?? '',
      website: c.website ?? '',
      originId: c.originId ?? '',
      originLabel: '',
      notes: c.notes ?? '',
      addrZip: c.addressJson?.zip ?? '',
      addrCountry: c.addressJson?.country ?? '',
      addrState: c.addressJson?.state ?? '',
      addrCity: c.addressJson?.city ?? '',
      addrNeighborhood: c.addressJson?.neighborhood ?? '',
      addrStreet: c.addressJson?.street ?? '',
      addrNumber: c.addressJson?.number ?? '',
      addrComplement: c.addressJson?.complement ?? '',
      socialLinkedin: c.socialProfiles?.linkedin ?? '',
      socialInstagram: c.socialProfiles?.instagram ?? '',
      socialFacebook: c.socialProfiles?.facebook ?? '',
      socialTwitter: c.socialProfiles?.twitter ?? '',
      contactId: '',
      contactLabel: '',
      opportunityId: '',
      opportunityLabel: '',
      assignedToId: (selectedCompany as Company & { assignedToId?: string })?.assignedToId ?? '',
    })
  }, [selectedCompany])

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
    mutationFn: async (body: Record<string, unknown>) => {
      const company = await api.post<Company>('/companies', body)
      await Promise.all([
        form.contactId && api.patch(`/contacts/${form.contactId}`, { companyId: company.id }),
        form.opportunityId && api.patch(`/opportunities/${form.opportunityId}`, { companyId: company.id }),
      ])
      // Save custom field values
      const cfEntries = Object.entries(cfCreateValues).filter(([, v]) => v !== '' && v !== null && v !== undefined)
      if (cfEntries.length > 0) {
        await Promise.allSettled(
          cfEntries.map(([fieldId, value]) =>
            api.put('/custom-fields/values', { customFieldId: fieldId, entityType: 'company', entityId: company.id, valueText: typeof value === 'string' ? value : undefined, valueJson: typeof value !== 'string' ? value : undefined })
          )
        )
      }
      return company
    },
    onSuccess: () => {
      toast.success('Empresa criada!')
      setModalOpen(false)
      setForm(defaultForm)
      setCfCreateValues({})
      void queryClient.invalidateQueries({ queryKey: ['companies'] })
      void queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
    onError: (err: unknown) => {
      toast.error((err as { message?: string })?.message ?? 'Erro ao criar empresa')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/companies/${id}`),
    onSuccess: () => {
      toast.success('Empresa excluída')
      setDeletingCompany(null)
      setSelectedCompany(null)
      void queryClient.invalidateQueries({ queryKey: ['companies'] })
    },
    onError: () => toast.error('Erro ao excluir empresa'),
  })

  const editMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch<Company>(`/companies/${selectedCompany!.id}`, body),
    onSuccess: (updated) => {
      toast.success('Empresa atualizada!')
      setSelectedCompany(updated)
      void queryClient.invalidateQueries({ queryKey: ['companies'] })
    },
    onError: (err: unknown) => {
      toast.error((err as { message?: string })?.message ?? 'Erro ao atualizar empresa')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return }
    const address = { zip: form.addrZip, country: form.addrCountry, state: form.addrState, city: form.addrCity, neighborhood: form.addrNeighborhood, street: form.addrStreet, number: form.addrNumber, complement: form.addrComplement }
    const hasAddress = Object.values(address).some(Boolean)
    const socialProfiles = { linkedin: form.socialLinkedin, instagram: form.socialInstagram, facebook: form.socialFacebook, twitter: form.socialTwitter }
    const hasSocial = Object.values(socialProfiles).some(Boolean)
    createMutation.mutate({
      name: form.name,
      legalName: form.legalName || undefined,
      cnpj: form.cnpj || undefined,
      category: form.category || undefined,
      segment: form.segment || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      whatsapp: form.whatsapp || undefined,
      mobile: form.mobile || undefined,
      fax: form.fax || undefined,
      extension: form.extension || undefined,
      website: form.website || undefined,
      originId: form.originId || undefined,
      notes: form.notes || undefined,
      assignedToId: form.assignedToId || undefined,
      ...(hasAddress ? { addressJson: address } : {}),
      ...(hasSocial ? { socialProfiles } : {}),
    })
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editForm.name.trim()) { toast.error('Nome é obrigatório'); return }
    const address = { zip: editForm.addrZip, country: editForm.addrCountry, state: editForm.addrState, city: editForm.addrCity, neighborhood: editForm.addrNeighborhood, street: editForm.addrStreet, number: editForm.addrNumber, complement: editForm.addrComplement }
    const hasAddress = Object.values(address).some(Boolean)
    const socialProfiles = { linkedin: editForm.socialLinkedin, instagram: editForm.socialInstagram, facebook: editForm.socialFacebook, twitter: editForm.socialTwitter }
    const hasSocial = Object.values(socialProfiles).some(Boolean)
    editMutation.mutate({
      name: editForm.name,
      legalName: editForm.legalName || undefined,
      cnpj: editForm.cnpj || undefined,
      category: editForm.category || undefined,
      segment: editForm.segment || undefined,
      email: editForm.email || undefined,
      phone: editForm.phone || undefined,
      whatsapp: editForm.whatsapp || undefined,
      mobile: editForm.mobile || undefined,
      website: editForm.website || undefined,
      originId: editForm.originId || undefined,
      notes: editForm.notes || undefined,
      assignedToId: editForm.assignedToId || undefined,
      ...(hasAddress ? { addressJson: address } : {}),
      ...(hasSocial ? { socialProfiles } : {}),
    })
  }

  const pages = data ? Math.ceil(data.total / data.limit) : 1

  const columns = [
    {
      key: 'name',
      header: 'Nome',
      render: (row: Company) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.name}</span>
          <Link
            href={`/empresas/${row.id}`}
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={(e) => e.stopPropagation()}
            title="Abrir página da empresa"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      ),
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
      <Sheet open={!!selectedCompany} onOpenChange={(open) => { if (!open) { setSelectedCompany(null); setAdminModeEdit(false) } }}>
        <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0">
          <SheetHeader className="px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-base">{selectedCompany?.name}</SheetTitle>
                {selectedCompany?.segment && <p className="text-xs text-muted-foreground">{selectedCompany.segment}</p>}
              </div>
              <Button
                type="button" variant="ghost" size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                title="Excluir empresa"
                onClick={() => selectedCompany && setDeletingCompany(selectedCompany)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              {isAdmin && (
                <Button type="button" variant={adminModeEdit ? 'default' : 'ghost'} size="sm" className="h-7 text-xs gap-1.5 shrink-0"
                  onClick={() => setAdminModeEdit(v => !v)}>
                  <Settings2 className="h-3.5 w-3.5" />
                  {adminModeEdit ? 'Sair' : 'Personalizar'}
                </Button>
              )}
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
            <TabsContent value="info" className="flex-1 overflow-y-auto px-6 py-4 mt-0">
              <form onSubmit={handleEditSubmit} className="space-y-6">

                {/* Dados básicos */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dados básicos</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <FieldWrapper entityType="company" slug="name" label="Nome da empresa" placeholder="Nome da empresa" defaultRequired={true} adminMode={adminModeEdit}>
                        <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                      </FieldWrapper>
                    </div>
                    <div className="col-span-2">
                      <FieldWrapper entityType="company" slug="legalName" label="Razão Social" placeholder="Razão social" adminMode={adminModeEdit}>
                        <Input value={editForm.legalName} onChange={(e) => setEditForm((f) => ({ ...f, legalName: e.target.value }))} />
                      </FieldWrapper>
                    </div>
                    <div>
                      <FieldWrapper entityType="company" slug="cnpj" label="CNPJ" placeholder="00.000.000/0001-00" adminMode={adminModeEdit}>
                        <Input value={editForm.cnpj} onChange={(e) => setEditForm((f) => ({ ...f, cnpj: e.target.value }))} />
                      </FieldWrapper>
                    </div>
                    <div>
                      <FieldWrapper entityType="company" slug="category" label="Categoria" placeholder="Ex: Cliente, Parceiro..." adminMode={adminModeEdit}>
                        <Input value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))} />
                      </FieldWrapper>
                    </div>
                    <div>
                      <FieldWrapper entityType="company" slug="segment" label="Segmento" placeholder="Ex: Tecnologia, Saúde..." adminMode={adminModeEdit}>
                        <Input value={editForm.segment} onChange={(e) => setEditForm((f) => ({ ...f, segment: e.target.value }))} />
                      </FieldWrapper>
                    </div>
                    <div>
                      <FieldWrapper entityType="company" slug="website" label="Site" placeholder="https://empresa.com.br" adminMode={adminModeEdit}>
                        <Input value={editForm.website} onChange={(e) => setEditForm((f) => ({ ...f, website: e.target.value }))} />
                      </FieldWrapper>
                    </div>
                    <div className="col-span-2">
                      <FieldWrapper entityType="company" slug="origin" label="Origem / Canal" adminMode={adminModeEdit}>
                        <OriginSearchEmpresa value={editForm.originId} label={editForm.originLabel} onChange={(id, path) => setEditForm((f) => ({ ...f, originId: id, originLabel: path }))} />
                      </FieldWrapper>
                    </div>
                    <div className="col-span-2">
                      <div className="space-y-1.5">
                        <Label>Responsável</Label>
                        <Select value={editForm.assignedToId || undefined} onValueChange={(v) => setEditForm((f) => ({ ...f, assignedToId: v }))}>
                          <SelectTrigger><SelectValue placeholder="Selecionar responsável..." /></SelectTrigger>
                          <SelectContent>
                            {users.map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <FieldWrapper entityType="company" slug="notes" label="Descrição" placeholder="Observações sobre a empresa..." adminMode={adminModeEdit}>
                        <textarea rows={2} value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                      </FieldWrapper>
                    </div>
                  </div>
                </div>

                {/* Informações para contato */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Informações para contato</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FieldWrapper entityType="company" slug="email" label="E-mail" placeholder="contato@empresa.com.br" adminMode={adminModeEdit}>
                        <Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                      </FieldWrapper>
                    </div>
                    <div>
                      <FieldWrapper entityType="company" slug="phone" label="Telefone" placeholder="(11) 3333-3333" adminMode={adminModeEdit}>
                        <Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
                      </FieldWrapper>
                    </div>
                    <div>
                      <FieldWrapper entityType="company" slug="whatsapp" label="WhatsApp" placeholder="(11) 99999-9999" adminMode={adminModeEdit}>
                        <Input value={editForm.whatsapp} onChange={(e) => setEditForm((f) => ({ ...f, whatsapp: e.target.value }))} />
                      </FieldWrapper>
                    </div>
                    <div>
                      <FieldWrapper entityType="company" slug="mobile" label="Celular" placeholder="(11) 99999-9999" adminMode={adminModeEdit}>
                        <Input value={editForm.mobile} onChange={(e) => setEditForm((f) => ({ ...f, mobile: e.target.value }))} />
                      </FieldWrapper>
                    </div>
                  </div>
                </div>

                {/* Endereço */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dados de endereço</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FieldWrapper entityType="company" slug="addrZip" label="CEP" placeholder="00000-000" adminMode={adminModeEdit}>
                        <Input value={editForm.addrZip} onChange={(e) => setEditForm((f) => ({ ...f, addrZip: e.target.value }))} />
                      </FieldWrapper>
                    </div>
                    <div>
                      <FieldWrapper entityType="company" slug="addrCountry" label="País" placeholder="Brasil" adminMode={adminModeEdit}>
                        <Input value={editForm.addrCountry} onChange={(e) => setEditForm((f) => ({ ...f, addrCountry: e.target.value }))} />
                      </FieldWrapper>
                    </div>
                    <div>
                      <FieldWrapper entityType="company" slug="addrState" label="Estado" placeholder="SP" adminMode={adminModeEdit}>
                        <Input value={editForm.addrState} onChange={(e) => setEditForm((f) => ({ ...f, addrState: e.target.value }))} />
                      </FieldWrapper>
                    </div>
                    <div>
                      <FieldWrapper entityType="company" slug="addrCity" label="Cidade" placeholder="São Paulo" adminMode={adminModeEdit}>
                        <Input value={editForm.addrCity} onChange={(e) => setEditForm((f) => ({ ...f, addrCity: e.target.value }))} />
                      </FieldWrapper>
                    </div>
                    <div>
                      <FieldWrapper entityType="company" slug="addrNeighborhood" label="Bairro" placeholder="Bairro" adminMode={adminModeEdit}>
                        <Input value={editForm.addrNeighborhood} onChange={(e) => setEditForm((f) => ({ ...f, addrNeighborhood: e.target.value }))} />
                      </FieldWrapper>
                    </div>
                    <div>
                      <FieldWrapper entityType="company" slug="addrNumber" label="Número" placeholder="123" adminMode={adminModeEdit}>
                        <Input value={editForm.addrNumber} onChange={(e) => setEditForm((f) => ({ ...f, addrNumber: e.target.value }))} />
                      </FieldWrapper>
                    </div>
                    <div className="col-span-2">
                      <FieldWrapper entityType="company" slug="addrStreet" label="Rua" placeholder="Rua Example" adminMode={adminModeEdit}>
                        <Input value={editForm.addrStreet} onChange={(e) => setEditForm((f) => ({ ...f, addrStreet: e.target.value }))} />
                      </FieldWrapper>
                    </div>
                    <div>
                      <FieldWrapper entityType="company" slug="addrComplement" label="Complemento" placeholder="Sala 10" adminMode={adminModeEdit}>
                        <Input value={editForm.addrComplement} onChange={(e) => setEditForm((f) => ({ ...f, addrComplement: e.target.value }))} />
                      </FieldWrapper>
                    </div>
                  </div>
                </div>

                {/* Redes sociais */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Redes sociais</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FieldWrapper entityType="company" slug="socialLinkedin" label="LinkedIn" placeholder="linkedin.com/company/..." adminMode={adminModeEdit}>
                        <Input value={editForm.socialLinkedin} onChange={(e) => setEditForm((f) => ({ ...f, socialLinkedin: e.target.value }))} />
                      </FieldWrapper>
                    </div>
                    <div>
                      <FieldWrapper entityType="company" slug="socialInstagram" label="Instagram" placeholder="instagram.com/empresa" adminMode={adminModeEdit}>
                        <Input value={editForm.socialInstagram} onChange={(e) => setEditForm((f) => ({ ...f, socialInstagram: e.target.value }))} />
                      </FieldWrapper>
                    </div>
                    <div>
                      <FieldWrapper entityType="company" slug="socialFacebook" label="Facebook" placeholder="facebook.com/empresa" adminMode={adminModeEdit}>
                        <Input value={editForm.socialFacebook} onChange={(e) => setEditForm((f) => ({ ...f, socialFacebook: e.target.value }))} />
                      </FieldWrapper>
                    </div>
                    <div>
                      <FieldWrapper entityType="company" slug="socialTwitter" label="X (Twitter)" placeholder="x.com/empresa" adminMode={adminModeEdit}>
                        <Input value={editForm.socialTwitter} onChange={(e) => setEditForm((f) => ({ ...f, socialTwitter: e.target.value }))} />
                      </FieldWrapper>
                    </div>
                  </div>
                </div>

                {/* Campos personalizados */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Campos Personalizados</h3>
                  <CustomFieldsPanel
                    entityType="company"
                    entityId={selectedCompany?.id}
                    adminMode={adminModeEdit}
                    onAdminModeChange={setAdminModeEdit}
                  />
                </div>

                <div className="flex gap-2 pt-1 border-t">
                  <Button type="submit" className="flex-1" disabled={editMutation.isPending}>
                    {editMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : 'Salvar alterações'}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <Dialog open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) { setForm(defaultForm); setCfCreateValues({}); setAdminMode(false) } }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between pr-8">
            <DialogTitle>Nova Empresa</DialogTitle>
            {isAdmin && (
              <Button type="button" variant={adminMode ? 'default' : 'ghost'} size="sm" className="h-7 text-xs gap-1.5"
                onClick={() => setAdminMode(v => !v)}>
                <Settings2 className="h-3.5 w-3.5" />
                {adminMode ? 'Sair' : 'Personalizar'}
              </Button>
            )}
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 py-2">

            {/* Dados básicos */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dados básicos</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <FieldWrapper entityType="company" slug="name" label="Nome da empresa" placeholder="Nome da empresa" defaultRequired={true} adminMode={adminMode}>
                    <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div className="col-span-2">
                  <FieldWrapper entityType="company" slug="legalName" label="Razão Social" placeholder="Razão social" adminMode={adminMode}>
                    <Input value={form.legalName} onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div>
                  <FieldWrapper entityType="company" slug="cnpj" label="CNPJ" placeholder="00.000.000/0001-00" adminMode={adminMode}>
                    <Input value={form.cnpj} onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div>
                  <FieldWrapper entityType="company" slug="category" label="Categoria" placeholder="Ex: Cliente, Parceiro..." adminMode={adminMode}>
                    <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div>
                  <FieldWrapper entityType="company" slug="segment" label="Segmento" placeholder="Ex: Tecnologia, Saúde..." adminMode={adminMode}>
                    <Input value={form.segment} onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div>
                  <FieldWrapper entityType="company" slug="website" label="Site" placeholder="https://empresa.com.br" adminMode={adminMode}>
                    <Input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div className="col-span-2">
                  <FieldWrapper entityType="company" slug="origin" label="Origem / Canal" adminMode={adminMode}>
                    <OriginSearchEmpresa value={form.originId} label={form.originLabel} onChange={(id, path) => setForm((f) => ({ ...f, originId: id, originLabel: path }))} />
                  </FieldWrapper>
                </div>
                <div className="col-span-2">
                  <div className="space-y-1.5">
                    <Label>Responsável</Label>
                    <Select value={form.assignedToId || undefined} onValueChange={(v) => setForm((f) => ({ ...f, assignedToId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecionar responsável..." /></SelectTrigger>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="col-span-2">
                  <FieldWrapper entityType="company" slug="notes" label="Descrição" placeholder="Observações sobre a empresa..." adminMode={adminMode}>
                    <textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                  </FieldWrapper>
                </div>
              </div>
            </div>

            {/* Informações para contato */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Informações para contato</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldWrapper entityType="company" slug="email" label="E-mail" placeholder="contato@empresa.com.br" adminMode={adminMode}>
                    <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div>
                  <FieldWrapper entityType="company" slug="phone" label="Telefone" placeholder="(11) 3333-3333" adminMode={adminMode}>
                    <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                  </FieldWrapper>
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dados de endereço</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <FieldWrapper entityType="company" slug="addrZip" label="CEP" placeholder="00000-000" adminMode={adminMode}>
                    <Input value={form.addrZip} onChange={(e) => setForm((f) => ({ ...f, addrZip: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div>
                  <FieldWrapper entityType="company" slug="addrCountry" label="País" placeholder="Brasil" adminMode={adminMode}>
                    <Input value={form.addrCountry} onChange={(e) => setForm((f) => ({ ...f, addrCountry: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div>
                  <FieldWrapper entityType="company" slug="addrState" label="Estado" placeholder="SP" adminMode={adminMode}>
                    <Input value={form.addrState} onChange={(e) => setForm((f) => ({ ...f, addrState: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div>
                  <FieldWrapper entityType="company" slug="addrCity" label="Cidade" placeholder="São Paulo" adminMode={adminMode}>
                    <Input value={form.addrCity} onChange={(e) => setForm((f) => ({ ...f, addrCity: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div>
                  <FieldWrapper entityType="company" slug="addrNeighborhood" label="Bairro" placeholder="Bairro" adminMode={adminMode}>
                    <Input value={form.addrNeighborhood} onChange={(e) => setForm((f) => ({ ...f, addrNeighborhood: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div>
                  <FieldWrapper entityType="company" slug="addrNumber" label="Número" placeholder="123" adminMode={adminMode}>
                    <Input value={form.addrNumber} onChange={(e) => setForm((f) => ({ ...f, addrNumber: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div className="col-span-2">
                  <FieldWrapper entityType="company" slug="addrStreet" label="Rua" placeholder="Rua Example" adminMode={adminMode}>
                    <Input value={form.addrStreet} onChange={(e) => setForm((f) => ({ ...f, addrStreet: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div>
                  <FieldWrapper entityType="company" slug="addrComplement" label="Complemento" placeholder="Sala 10" adminMode={adminMode}>
                    <Input value={form.addrComplement} onChange={(e) => setForm((f) => ({ ...f, addrComplement: e.target.value }))} />
                  </FieldWrapper>
                </div>
              </div>
            </div>

            {/* Redes sociais */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Redes sociais</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldWrapper entityType="company" slug="socialLinkedin" label="LinkedIn" placeholder="linkedin.com/company/..." adminMode={adminMode}>
                    <Input value={form.socialLinkedin} onChange={(e) => setForm((f) => ({ ...f, socialLinkedin: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div>
                  <FieldWrapper entityType="company" slug="socialInstagram" label="Instagram" placeholder="instagram.com/empresa" adminMode={adminMode}>
                    <Input value={form.socialInstagram} onChange={(e) => setForm((f) => ({ ...f, socialInstagram: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div>
                  <FieldWrapper entityType="company" slug="socialFacebook" label="Facebook" placeholder="facebook.com/empresa" adminMode={adminMode}>
                    <Input value={form.socialFacebook} onChange={(e) => setForm((f) => ({ ...f, socialFacebook: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div>
                  <FieldWrapper entityType="company" slug="socialTwitter" label="X (Twitter)" placeholder="x.com/empresa" adminMode={adminMode}>
                    <Input value={form.socialTwitter} onChange={(e) => setForm((f) => ({ ...f, socialTwitter: e.target.value }))} />
                  </FieldWrapper>
                </div>
              </div>
            </div>

            {/* Vincular */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Vincular</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Vincular contato</Label>
                  <EntityCombobox
                    entityType="contact"
                    value={form.contactId}
                    label={form.contactLabel}
                    onChange={(id, lbl) => setForm((f) => ({ ...f, contactId: id, contactLabel: lbl }))}
                    allowCreate
                    placeholder="Buscar ou criar contato..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Vincular oportunidade</Label>
                  <EntityCombobox
                    entityType="opportunity"
                    value={form.opportunityId}
                    label={form.opportunityLabel}
                    onChange={(id, lbl) => setForm((f) => ({ ...f, opportunityId: id, opportunityLabel: lbl }))}
                    placeholder="Buscar oportunidade..."
                  />
                </div>
              </div>
            </div>

            {/* Campos personalizados */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Campos Personalizados</h3>
              <CustomFieldsPanel
                entityType="company"
                values={cfCreateValues}
                onChange={(id, v) => setCfCreateValues((p) => ({ ...p, [id]: v }))}
                adminMode={adminMode}
                onAdminModeChange={setAdminMode}
              />
            </div>

            <div className="flex gap-2 pt-1 border-t">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                {createMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</> : 'Criar Empresa'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletingCompany}
        onOpenChange={(open) => !open && setDeletingCompany(null)}
        title="Excluir Empresa"
        description={`Tem certeza que deseja excluir "${deletingCompany?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deletingCompany && deleteMutation.mutate(deletingCompany.id)}
      />
    </div>
  )
}
