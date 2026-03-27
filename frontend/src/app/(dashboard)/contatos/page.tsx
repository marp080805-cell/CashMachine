'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Contact } from '@/types'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Search, X, Building2, Loader2, TrendingUp, ExternalLink, GitBranch } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'

interface FlatOrigin { id: string; name: string; path: string; depth: number; parentId: string | null }

interface ContactForm {
  name: string
  email: string
  phone: string
  notes: string
  companyId: string
  companyLabel: string
  opportunityId: string
  opportunityLabel: string
  cpf: string
  role: string
  nationality: string
  category: string
  website: string
  birthday: string
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
  originId: string
  originLabel: string
}

const defaultForm: ContactForm = {
  name: '', email: '', phone: '', notes: '', companyId: '', companyLabel: '', opportunityId: '', opportunityLabel: '',
  cpf: '', role: '', nationality: '', category: '', website: '', birthday: '',
  addrZip: '', addrCountry: '', addrState: '', addrCity: '', addrNeighborhood: '', addrStreet: '', addrNumber: '', addrComplement: '',
  socialLinkedin: '', socialInstagram: '', socialFacebook: '', socialTwitter: '',
  originId: '', originLabel: '',
}

interface Opportunity { id: string; title: string }

function OppSearch({ value, label, onChange }: { value: string; label: string; onChange: (id: string, name: string) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['opps-search-contact', q],
    queryFn: () => api.get<{ data: Opportunity[] }>(`/opportunities?search=${encodeURIComponent(q)}&limit=8`),
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

function OriginSearch({ value, label, onChange }: { value: string; label: string; onChange: (id: string, path: string) => void }) {
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
        placeholder="Buscar origem (ex: Mídia Paga > Meta Ads)..."
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-52 overflow-y-auto">
          {filtered.map((o) => (
            <button key={o.id} type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
              style={{ paddingLeft: `${12 + o.depth * 16}px` }}
              onMouseDown={() => { onChange(o.id, o.path); setQ(''); setOpen(false) }}>
              <span className="text-muted-foreground text-xs">{o.depth > 0 ? '↳ ' : ''}</span>{o.name}
              {o.depth > 0 && <span className="text-xs text-muted-foreground ml-2 truncate">{o.path}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ContatosPage() {
  const router = useRouter()
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
    mutationFn: async (body: Record<string, unknown>) => {
      const contact = await api.post<Contact>('/contacts', body)
      if (form.opportunityId) {
        await api.patch(`/opportunities/${form.opportunityId}`, { contactId: contact.id })
      }
      return contact
    },
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
    const address = { zip: form.addrZip, country: form.addrCountry, state: form.addrState, city: form.addrCity, neighborhood: form.addrNeighborhood, street: form.addrStreet, number: form.addrNumber, complement: form.addrComplement }
    const hasAddress = Object.values(address).some(Boolean)
    const socialProfiles = { linkedin: form.socialLinkedin, instagram: form.socialInstagram, facebook: form.socialFacebook, twitter: form.socialTwitter }
    const hasSocial = Object.values(socialProfiles).some(Boolean)
    createMutation.mutate({
      name: form.name,
      email: form.email || undefined,
      phone: form.phone || undefined,
      notes: form.notes || undefined,
      cpf: form.cpf || undefined,
      role: form.role || undefined,
      nationality: form.nationality || undefined,
      category: form.category || undefined,
      website: form.website || undefined,
      dateOfBirth: form.birthday ? new Date(form.birthday).toISOString() : undefined,
      companyId: form.companyId || undefined,
      originId: form.originId || undefined,
      ...(hasAddress ? { address } : {}),
      ...(hasSocial ? { socialProfiles } : {}),
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
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (row: Contact) => (
        <button
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          onClick={(e) => { e.stopPropagation(); router.push(`/contatos/${row.id}`) }}
          title="Ver perfil"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      ),
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
        onRowClick={(row) => router.push(`/contatos/${row.id}`)}
        pagination={data ? { page: data.page, pages, total: data.total, onPageChange: setPage } : undefined}
        emptyMessage="Nenhum contato encontrado"
      />

      <Dialog open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) setForm(defaultForm) }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Contato</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 py-2">

            {/* Dados básicos */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dados básicos</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Nome *</Label>
                  <Input placeholder="Nome completo" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>CPF</Label>
                  <Input placeholder="000.000.000-00" value={form.cpf} onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nacionalidade</Label>
                  <Input placeholder="Ex: Brasileira" value={form.nationality} onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Empresa</Label>
                  <CompanySearch value={form.companyId} label={form.companyLabel} onChange={(id, name) => setForm((f) => ({ ...f, companyId: id, companyLabel: name }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cargo</Label>
                  <Input placeholder="Ex: Diretor Comercial" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Input placeholder="Ex: Cliente, Parceiro..." value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Aniversário</Label>
                  <Input type="date" value={form.birthday} onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Site</Label>
                  <Input placeholder="https://..." value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Origem / Canal</Label>
                  <OriginSearch value={form.originId} label={form.originLabel} onChange={(id, path) => setForm((f) => ({ ...f, originId: id, originLabel: path }))} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Descrição</Label>
                  <textarea rows={2} placeholder="Observações..." value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                </div>
              </div>
            </div>

            {/* Informações para contato */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Informações para contato</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input type="email" placeholder="email@exemplo.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input placeholder="(11) 99999-9999" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Dados de endereço */}
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
                  <Input placeholder="linkedin.com/in/usuario" value={form.socialLinkedin} onChange={(e) => setForm((f) => ({ ...f, socialLinkedin: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Instagram</Label>
                  <Input placeholder="instagram.com/usuario" value={form.socialInstagram} onChange={(e) => setForm((f) => ({ ...f, socialInstagram: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Facebook</Label>
                  <Input placeholder="facebook.com/usuario" value={form.socialFacebook} onChange={(e) => setForm((f) => ({ ...f, socialFacebook: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>X (Twitter)</Label>
                  <Input placeholder="x.com/usuario" value={form.socialTwitter} onChange={(e) => setForm((f) => ({ ...f, socialTwitter: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Vincular */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Vincular</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Vincular a oportunidade</Label>
                  <OppSearch value={form.opportunityId} label={form.opportunityLabel} onChange={(id, name) => setForm((f) => ({ ...f, opportunityId: id, opportunityLabel: name }))} />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1 border-t">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                {createMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</> : 'Criar Contato'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
