'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Contact } from '@/types'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Search, X, Loader2, ExternalLink, GitBranch, Settings2 } from 'lucide-react'
import { EntityCombobox } from '@/components/shared/EntityCombobox'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { CustomFieldsPanel } from '@/components/custom-fields/CustomFieldsPanel'
import { FieldWrapper } from '@/components/custom-fields/FieldWrapper'
import { useAuthStore } from '@/stores/authStore'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

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
  assignedToId: string
}

const defaultForm: ContactForm = {
  name: '', email: '', phone: '', notes: '', companyId: '', companyLabel: '', opportunityId: '', opportunityLabel: '',
  cpf: '', role: '', nationality: '', category: '', website: '', birthday: '',
  addrZip: '', addrCountry: '', addrState: '', addrCity: '', addrNeighborhood: '', addrStreet: '', addrNumber: '', addrComplement: '',
  socialLinkedin: '', socialInstagram: '', socialFacebook: '', socialTwitter: '',
  originId: '', originLabel: '',
  assignedToId: '',
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
  const [cfValues, setCfValues] = useState<Record<string, unknown>>({})
  const [adminModeCreate, setAdminModeCreate] = useState(false)
  const queryClient = useQueryClient()
  const authUser = useAuthStore((s) => s.user)
  const isAdmin = authUser?.role === 'ADMIN' || authUser?.role === 'MANAGER'

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<{ users: Array<{ id: string; name: string }> }>('/users'),
  })
  const users = usersData?.users ?? []

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
      // Save custom field values
      const cfEntries = Object.entries(cfValues).filter(([, v]) => v !== '' && v !== null && v !== undefined)
      if (cfEntries.length > 0) {
        await Promise.allSettled(
          cfEntries.map(([fieldId, value]) =>
            api.put('/custom-fields/values', { customFieldId: fieldId, entityType: 'contact', entityId: contact.id, valueText: typeof value === 'string' ? value : undefined, valueJson: typeof value !== 'string' ? value : undefined })
          )
        )
      }
      return contact
    },
    onSuccess: () => {
      toast.success('Contato criado!')
      setModalOpen(false)
      setForm(defaultForm)
      setCfValues({})
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
      assignedToId: form.assignedToId || undefined,
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

      <Dialog open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) { setForm(defaultForm); setCfValues({}); setAdminModeCreate(false) } }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between pr-8">
            <DialogTitle>Novo Contato</DialogTitle>
            {isAdmin && (
              <Button type="button" variant={adminModeCreate ? 'default' : 'ghost'} size="sm" className="h-7 text-xs gap-1.5"
                onClick={() => setAdminModeCreate(v => !v)}>
                <Settings2 className="h-3.5 w-3.5" />
                {adminModeCreate ? 'Sair' : 'Personalizar'}
              </Button>
            )}
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 py-2">

            {/* Dados básicos */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dados básicos</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <FieldWrapper entityType="contact" slug="name" label="Nome" placeholder="Nome completo" defaultRequired={true} adminMode={adminModeCreate}>
                    <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div>
                  <FieldWrapper entityType="contact" slug="cpf" label="CPF" placeholder="000.000.000-00" defaultRequired={false} adminMode={adminModeCreate}>
                    <Input value={form.cpf} onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div>
                  <FieldWrapper entityType="contact" slug="nationality" label="Nacionalidade" placeholder="Ex: Brasileira" defaultRequired={false} adminMode={adminModeCreate}>
                    <Input value={form.nationality} onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div className="col-span-2">
                  <FieldWrapper entityType="contact" slug="company" label="Empresa" defaultRequired={false} adminMode={adminModeCreate}>
                    <EntityCombobox
                      entityType="company"
                      value={form.companyId}
                      label={form.companyLabel}
                      onChange={(id, lbl) => setForm((f) => ({ ...f, companyId: id, companyLabel: lbl }))}
                      allowCreate
                      placeholder="Buscar ou criar empresa..."
                    />
                  </FieldWrapper>
                </div>
                <div>
                  <FieldWrapper entityType="contact" slug="jobTitle" label="Cargo" placeholder="Ex: Diretor Comercial" defaultRequired={false} adminMode={adminModeCreate}>
                    <Input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div>
                  <FieldWrapper entityType="contact" slug="category" label="Categoria" placeholder="Ex: Cliente, Parceiro..." defaultRequired={false} adminMode={adminModeCreate}>
                    <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div>
                  <FieldWrapper entityType="contact" slug="dateOfBirth" label="Aniversário" defaultRequired={false} adminMode={adminModeCreate}>
                    <Input type="date" value={form.birthday} onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div>
                  <FieldWrapper entityType="contact" slug="website" label="Site" placeholder="https://..." defaultRequired={false} adminMode={adminModeCreate}>
                    <Input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div className="col-span-2">
                  <FieldWrapper entityType="contact" slug="origin" label="Origem / Canal" defaultRequired={false} adminMode={adminModeCreate}>
                    <OriginSearch value={form.originId} label={form.originLabel} onChange={(id, path) => setForm((f) => ({ ...f, originId: id, originLabel: path }))} />
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
                  <FieldWrapper entityType="contact" slug="notes" label="Descrição" defaultRequired={false} adminMode={adminModeCreate}>
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
                  <FieldWrapper entityType="contact" slug="email" label="E-mail" placeholder="email@exemplo.com" defaultRequired={false} adminMode={adminModeCreate}>
                    <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <div>
                  <FieldWrapper entityType="contact" slug="phone" label="Telefone" placeholder="(11) 99999-9999" defaultRequired={false} adminMode={adminModeCreate}>
                    <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                  </FieldWrapper>
                </div>
              </div>
            </div>

            {/* Dados de endereço */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dados de endereço</h3>
              <div className="grid grid-cols-3 gap-3">
                <FieldWrapper entityType="contact" slug="addrZip" label="CEP" placeholder="00000-000" defaultRequired={false} adminMode={adminModeCreate}>
                  <Input value={form.addrZip} onChange={(e) => setForm((f) => ({ ...f, addrZip: e.target.value }))} />
                </FieldWrapper>
                <FieldWrapper entityType="contact" slug="addrCountry" label="País" placeholder="Brasil" defaultRequired={false} adminMode={adminModeCreate}>
                  <Input value={form.addrCountry} onChange={(e) => setForm((f) => ({ ...f, addrCountry: e.target.value }))} />
                </FieldWrapper>
                <FieldWrapper entityType="contact" slug="addrState" label="Estado" placeholder="SP" defaultRequired={false} adminMode={adminModeCreate}>
                  <Input value={form.addrState} onChange={(e) => setForm((f) => ({ ...f, addrState: e.target.value }))} />
                </FieldWrapper>
                <FieldWrapper entityType="contact" slug="addrCity" label="Cidade" placeholder="São Paulo" defaultRequired={false} adminMode={adminModeCreate}>
                  <Input value={form.addrCity} onChange={(e) => setForm((f) => ({ ...f, addrCity: e.target.value }))} />
                </FieldWrapper>
                <FieldWrapper entityType="contact" slug="addrNeighborhood" label="Bairro" placeholder="Bairro" defaultRequired={false} adminMode={adminModeCreate}>
                  <Input value={form.addrNeighborhood} onChange={(e) => setForm((f) => ({ ...f, addrNeighborhood: e.target.value }))} />
                </FieldWrapper>
                <FieldWrapper entityType="contact" slug="addrNumber" label="Número" placeholder="123" defaultRequired={false} adminMode={adminModeCreate}>
                  <Input value={form.addrNumber} onChange={(e) => setForm((f) => ({ ...f, addrNumber: e.target.value }))} />
                </FieldWrapper>
                <div className="col-span-2">
                  <FieldWrapper entityType="contact" slug="addrStreet" label="Rua" placeholder="Rua Example" defaultRequired={false} adminMode={adminModeCreate}>
                    <Input value={form.addrStreet} onChange={(e) => setForm((f) => ({ ...f, addrStreet: e.target.value }))} />
                  </FieldWrapper>
                </div>
                <FieldWrapper entityType="contact" slug="addrComplement" label="Complemento" placeholder="Sala 10" defaultRequired={false} adminMode={adminModeCreate}>
                  <Input value={form.addrComplement} onChange={(e) => setForm((f) => ({ ...f, addrComplement: e.target.value }))} />
                </FieldWrapper>
              </div>
            </div>

            {/* Redes sociais */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Redes sociais</h3>
              <div className="grid grid-cols-2 gap-3">
                <FieldWrapper entityType="contact" slug="socialLinkedin" label="LinkedIn" placeholder="linkedin.com/in/usuario" defaultRequired={false} adminMode={adminModeCreate}>
                  <Input value={form.socialLinkedin} onChange={(e) => setForm((f) => ({ ...f, socialLinkedin: e.target.value }))} />
                </FieldWrapper>
                <FieldWrapper entityType="contact" slug="socialInstagram" label="Instagram" placeholder="instagram.com/usuario" defaultRequired={false} adminMode={adminModeCreate}>
                  <Input value={form.socialInstagram} onChange={(e) => setForm((f) => ({ ...f, socialInstagram: e.target.value }))} />
                </FieldWrapper>
                <FieldWrapper entityType="contact" slug="socialFacebook" label="Facebook" placeholder="facebook.com/usuario" defaultRequired={false} adminMode={adminModeCreate}>
                  <Input value={form.socialFacebook} onChange={(e) => setForm((f) => ({ ...f, socialFacebook: e.target.value }))} />
                </FieldWrapper>
                <FieldWrapper entityType="contact" slug="socialTwitter" label="X (Twitter)" placeholder="x.com/usuario" defaultRequired={false} adminMode={adminModeCreate}>
                  <Input value={form.socialTwitter} onChange={(e) => setForm((f) => ({ ...f, socialTwitter: e.target.value }))} />
                </FieldWrapper>
              </div>
            </div>

            {/* Vincular */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Vincular</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Vincular a oportunidade</Label>
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
                entityType="contact"
                values={cfValues}
                onChange={(id, v) => setCfValues((p) => ({ ...p, [id]: v }))}
                adminMode={adminModeCreate}
                onAdminModeChange={setAdminModeCreate}
              />
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
