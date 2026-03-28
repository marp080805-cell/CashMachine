'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Building2, Users, TrendingUp, ExternalLink, Phone, Mail } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'

interface ContactItem {
  id: string
  name: string
  email?: string | null
  phone?: string | null
}

interface OppItem {
  id: string
  title: string
  status: string
  value?: number | null
  pipeline?: { name: string }
  stage?: { name: string; color?: string }
}

interface CompanyDetail {
  id: string
  tenantId: string
  name: string
  cnpj: string | null
  segment: string | null
  website: string | null
  address: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  _count?: { contacts: number; opportunities: number }
  legalName?: string | null
  category?: string | null
  contacts?: ContactItem[]
  opportunities?: OppItem[]
}

const statusLabels: Record<string, string> = {
  OPEN: 'Em aberto',
  WON: 'Ganha',
  LOST: 'Perdida',
}

const statusColors: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700 border-blue-200',
  WON: 'bg-green-100 text-green-700 border-green-200',
  LOST: 'bg-red-100 text-red-700 border-red-200',
}

export default function EmpresaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data: company, isLoading } = useQuery({
    queryKey: ['company-detail', id],
    queryFn: () => api.get<CompanyDetail>(`/companies/${id}`),
    enabled: !!id,
  })

  const { data: contacts, isLoading: loadingContacts } = useQuery({
    queryKey: ['company-contacts', id],
    queryFn: () => api.get<ContactItem[]>(`/companies/${id}/contacts`),
    enabled: !!id,
  })

  const { data: opportunities, isLoading: loadingOpps } = useQuery({
    queryKey: ['company-opps', id],
    queryFn: () => api.get<OppItem[]>(`/companies/${id}/opportunities`),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Building2 className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Empresa não encontrada</p>
        <Button variant="outline" onClick={() => router.push('/empresas')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 mt-0.5" onClick={() => router.push('/empresas')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold truncate">{company.name}</h1>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {company.segment && (
                  <span className="text-sm text-muted-foreground">{company.segment}</span>
                )}
                {company.category && (
                  <Badge variant="outline" className="text-xs">{company.category}</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick info */}
      {(company.email || company.phone || company.website || company.cnpj) && (
        <div className="flex flex-wrap gap-4 p-4 rounded-lg border bg-muted/30">
          {company.cnpj && (
            <div className="text-sm">
              <span className="text-muted-foreground">CNPJ: </span>
              <span className="font-medium">{company.cnpj}</span>
            </div>
          )}
          {company.email && (
            <a href={`mailto:${company.email}`} className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              {company.email}
            </a>
          )}
          {company.phone && (
            <a href={`tel:${company.phone}`} className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              {company.phone}
            </a>
          )}
          {company.website && (
            <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors">
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              {company.website}
            </a>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts">
            <Users className="h-3.5 w-3.5 mr-1.5" />
            Contatos ({contacts?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="opportunities">
            <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
            Oportunidades ({opportunities?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* Contacts tab */}
        <TabsContent value="contacts" className="mt-4">
          {loadingContacts ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (contacts?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Users className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum contato vinculado a esta empresa</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(contacts ?? []).map((contact) => (
                <Link
                  key={contact.id}
                  href={`/contatos/${contact.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{contact.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {contact.email && <span className="text-xs text-muted-foreground truncate">{contact.email}</span>}
                      {contact.phone && <span className="text-xs text-muted-foreground">{contact.phone}</span>}
                    </div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Opportunities tab */}
        <TabsContent value="opportunities" className="mt-4">
          {loadingOpps ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (opportunities?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma oportunidade vinculada a esta empresa</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(opportunities ?? []).map((opp) => (
                <div key={opp.id} className="p-3 rounded-lg border space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{opp.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded border font-medium shrink-0 ${statusColors[opp.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {statusLabels[opp.status] ?? opp.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {opp.pipeline && (
                      <span className="text-xs text-muted-foreground">{opp.pipeline.name}</span>
                    )}
                    {opp.stage && (
                      <>
                        <span className="text-xs text-muted-foreground">›</span>
                        <span className="text-xs text-muted-foreground">{opp.stage.name}</span>
                      </>
                    )}
                    {opp.value != null && opp.value > 0 && (
                      <>
                        <span className="text-xs text-muted-foreground ml-auto">·</span>
                        <span className="text-xs font-medium text-green-600">{formatCurrency(opp.value)}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Notes */}
      {company.notes && (
        <div className="p-4 rounded-lg border bg-muted/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Observações</p>
          <p className="text-sm whitespace-pre-wrap">{company.notes}</p>
        </div>
      )}
    </div>
  )
}
