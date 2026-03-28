'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Company } from '@/types'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Search, Loader2, Building2, Users, TrendingUp, ExternalLink, X, User, Trophy, GitBranch, Settings2 } from 'lucide-react'
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
import { useFieldConfig } from '@/hooks/useFieldConfig'
import { useAuthStore } from '@/stores/authStore'

interface ContactItem { id: string; name: string; email?: string; phone?: string }

function ContactSearch({ value, label, onChange }: { value: string; label: string; onChange: (id: string, name: string) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['contacts-search-company', q],
    queryFn: () => api.get<{ data: ContactItem[] }>(`/contacts?search=${encodeURIComponent(q)}&limit=8`),
    enabled: q.length > 0,
  })

  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (value) return (
    <div className="flex items-center gap-2 border rounded-md px-3 py-2 text-sm bg-background">
      <User className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="flex-1 font-medium">{label}</span>
      <button type="button" onClick={() => onChange('', '')}><X className="h-3.5 w-3.5" /></button>
    </div>
  )

  return (
    <div ref={ref} className="relative">
      <Input
        placeholder="Buscar contato..."
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
              <span className="font-medium">{c.name}</span>
              {c.email && <span className="text-muted-foreground ml-2 text-xs">{c.email}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
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
}

const defaultForm: CompanyForm = {
  name: '', legalName: '', cnpj: '', category: '', segment: '',
  email: '', phone: '', whatsapp: '', mobile: '', fax: '', extension: '', website: '',
  originId: '', originLabel: '',
  addrZip: '', addrCountry: '', addrState: '', addrCity: '', addrNeighborhood: '', addrStreet: '', addrNumber: '', addrComplement: '',
  socialLinkedin: '', socialInstagram: '', socialFacebook: '', socialTwitter: '',
  notes: '', contactId: '', contactLabel: '', opportunityId: '', opportunityLabel: '',
}

interface OppOption { id: string; title: string }

function OppSearchCompany({ value, label, onChange }: { value: string; label: string; onChange: (id: string, name: string) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['opps-search-empresa', q],
    queryFn: () => api.get<{ data: OppOption[] }>(`/opportunities?search=${encodeURIComponent(q)}&limit=8`),
    enabled: q.length > 0,
  })

  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (value) return (
    <div className="flex items-center gap-2 border rounded-md px-3 py-2 text-sm bg-background">
      <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="flex-1 font-medium">{label}</span>
      <button type="button" onClick={() => onChange('', '')}><X className="h-3.5 w-3.5" /></button>
    </div>
  )

  return (
    <div ref={ref} className="relative">
      <Input
        placeholder="Buscar oportunidade..."
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => q && setOpen(true)}
      />
      {open && (data?.data?.length ?? 0) > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
          {data!.data.map((o) => (
            <button key={o.id} type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
              onMouseDown={() => { onChange(o.id, o.title); setQ(''); setOpen(false) }}>
              {o.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
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
  const [cfCreateValues, setCfCreateValues] = useState<Record<string, unknown>>({})
  const [adminMode, setAdminMode] = useState(false)
  const [adminModeEdit, setAdminModeEdit] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const queryClient = useQueryClient()
  const fieldConfig = useFieldConfig()
  const authUser = useAuthStore((s) => s.user)
  const isAdmin = authUser?.role === 'ADMIN' || authUser?.role === 'MANAGER'

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
      ...(hasAddress ? { addressJson: address } : {}),
      ...(hasSocial ? { socialProfiles } : {}),
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
      <Sheet open={!!selectedCompany} onOpenChange={(open) => { if (!open) { setSelectedCompany(null); setAdminModeEdit(false) } }}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-base">{selectedCompany?.name}</SheetTitle>
                {selectedCompany?.segment && <p className="text-xs text-muted-foreground">{selectedCompany.segment}</p>}
              </div>
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
            <TabsContent value="info" className="px-6 py-3 space-y-3 mt-0 overflow-y-auto">
              {selectedCompany?.cnpj && <div><p className="text-xs text-muted-foreground">CNPJ</p><p className="text-sm">{selectedCompany.cnpj}</p></div>}
              {selectedCompany?.website && <div><p className="text-xs text-muted-foreground">Website</p><a href={selectedCompany.website} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">{selectedCompany.website}</a></div>}
              {selectedCompany?.notes && <div><p className="text-xs text-muted-foreground">Notas</p><p className="text-sm">{selectedCompany.notes}</p></div>}
              <div><p className="text-xs text-muted-foreground">Criado em</p><p className="text-sm">{formatDate(selectedCompany?.createdAt ?? '')}</p></div>
              <div className="pt-2 border-t space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Campos Personalizados</p>
                <CustomFieldsPanel
                  entityType="company"
                  entityId={selectedCompany?.id}
                  adminMode={adminModeEdit}
                  onAdminModeChange={setAdminModeEdit}
                />
              </div>
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
                  <FieldWrapper entityType="company" slug="name" defaultRequired={true} adminMode={adminMode}>
                    <div className="space-y-1.5">
                      <Label>Nome {fieldConfig.isRequired('company', 'name', true) && <span className="text-red-500 ml-0.5">*</span>}</Label>
                      <Input placeholder="Nome da empresa" required={fieldConfig.isRequired('company', 'name', true)} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                    </div>
                  </FieldWrapper>
                </div>
                <div className="col-span-2">
                  <div className="space-y-1.5">
                    <Label>Razão Social</Label>
                    <Input placeholder="Razão social" value={form.legalName} onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <FieldWrapper entityType="company" slug="cnpj" defaultRequired={false} adminMode={adminMode}>
                    <div className="space-y-1.5">
                      <Label>CNPJ {fieldConfig.isRequired('company', 'cnpj', false) && <span className="text-red-500 ml-0.5">*</span>}</Label>
                      <Input placeholder="00.000.000/0001-00" required={fieldConfig.isRequired('company', 'cnpj', false)} value={form.cnpj} onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))} />
                    </div>
                  </FieldWrapper>
                </div>
                <div>
                  <div className="space-y-1.5">
                    <Label>Categoria</Label>
                    <Input placeholder="Ex: Cliente, Parceiro..." value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <FieldWrapper entityType="company" slug="segment" defaultRequired={false} adminMode={adminMode}>
                    <div className="space-y-1.5">
                      <Label>Setor {fieldConfig.isRequired('company', 'segment', false) && <span className="text-red-500 ml-0.5">*</span>}</Label>
                      <Input placeholder="Ex: Tecnologia, Saúde..." required={fieldConfig.isRequired('company', 'segment', false)} value={form.segment} onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value }))} />
                    </div>
                  </FieldWrapper>
                </div>
                <div>
                  <FieldWrapper entityType="company" slug="website" defaultRequired={false} adminMode={adminMode}>
                    <div className="space-y-1.5">
                      <Label>Website {fieldConfig.isRequired('company', 'website', false) && <span className="text-red-500 ml-0.5">*</span>}</Label>
                      <Input placeholder="https://empresa.com.br" required={fieldConfig.isRequired('company', 'website', false)} value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
                    </div>
                  </FieldWrapper>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Origem / Canal</Label>
                  <OriginSearchEmpresa value={form.originId} label={form.originLabel} onChange={(id, path) => setForm((f) => ({ ...f, originId: id, originLabel: path }))} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Descrição</Label>
                  <textarea rows={2} placeholder="Observações sobre a empresa..." value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                </div>
              </div>
            </div>

            {/* Informações para contato */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Informações para contato</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="space-y-1.5">
                    <Label>E-mail</Label>
                    <Input type="email" placeholder="contato@empresa.com.br" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <FieldWrapper entityType="company" slug="phone" defaultRequired={false} adminMode={adminMode}>
                    <div className="space-y-1.5">
                      <Label>Telefone {fieldConfig.isRequired('company', 'phone', false) && <span className="text-red-500 ml-0.5">*</span>}</Label>
                      <Input placeholder="(11) 3333-3333" required={fieldConfig.isRequired('company', 'phone', false)} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                    </div>
                  </FieldWrapper>
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dados de endereço</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>CEP</Label>
                  <Input placeholder="00000-000" value={form.addrZip} onChange={(e) => setForm((f) => ({ ...f, addrZip: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>País</Label>
                  <Input placeholder="Brasil" value={form.addrCountry} onChange={(e) => setForm((f) => ({ ...f, addrCountry: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Estado</Label>
                  <Input placeholder="SP" value={form.addrState} onChange={(e) => setForm((f) => ({ ...f, addrState: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cidade</Label>
                  <Input placeholder="São Paulo" value={form.addrCity} onChange={(e) => setForm((f) => ({ ...f, addrCity: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Bairro</Label>
                  <Input placeholder="Bairro" value={form.addrNeighborhood} onChange={(e) => setForm((f) => ({ ...f, addrNeighborhood: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Número</Label>
                  <Input placeholder="123" value={form.addrNumber} onChange={(e) => setForm((f) => ({ ...f, addrNumber: e.target.value }))} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Rua</Label>
                  <Input placeholder="Rua Example" value={form.addrStreet} onChange={(e) => setForm((f) => ({ ...f, addrStreet: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Complemento</Label>
                  <Input placeholder="Sala 10" value={form.addrComplement} onChange={(e) => setForm((f) => ({ ...f, addrComplement: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Redes sociais */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Redes sociais</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>LinkedIn</Label>
                  <Input placeholder="linkedin.com/company/..." value={form.socialLinkedin} onChange={(e) => setForm((f) => ({ ...f, socialLinkedin: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Instagram</Label>
                  <Input placeholder="instagram.com/empresa" value={form.socialInstagram} onChange={(e) => setForm((f) => ({ ...f, socialInstagram: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Facebook</Label>
                  <Input placeholder="facebook.com/empresa" value={form.socialFacebook} onChange={(e) => setForm((f) => ({ ...f, socialFacebook: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>X (Twitter)</Label>
                  <Input placeholder="x.com/empresa" value={form.socialTwitter} onChange={(e) => setForm((f) => ({ ...f, socialTwitter: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Vincular */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Vincular</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Vincular contato</Label>
                  <ContactSearch value={form.contactId} label={form.contactLabel} onChange={(id, name) => setForm((f) => ({ ...f, contactId: id, contactLabel: name }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Vincular oportunidade</Label>
                  <OppSearchCompany value={form.opportunityId} label={form.opportunityLabel} onChange={(id, name) => setForm((f) => ({ ...f, opportunityId: id, opportunityLabel: name }))} />
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
    </div>
  )
}
