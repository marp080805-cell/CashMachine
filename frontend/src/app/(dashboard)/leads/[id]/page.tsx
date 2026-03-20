'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Lead, Activity } from '@/types'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { formatPhone, formatDate } from '@/lib/utils'

type LeadDetail = Lead & { activities: Activity[] }

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => api.get<LeadDetail>(`/leads/${id}`),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!lead) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-bold">
          {lead.name[0]}
        </div>
        <div>
          <h2 className="text-2xl font-bold">{lead.name}</h2>
          <p className="text-muted-foreground">{lead.company?.name ?? 'Sem empresa'}</p>
        </div>
        <Badge variant="secondary" className="ml-auto">{lead.status}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informações</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm">{lead.email ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Telefone</p>
              <p className="text-sm">{lead.phone ? formatPhone(lead.phone) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">WhatsApp</p>
              <p className="text-sm">{lead.whatsapp ? formatPhone(lead.whatsapp) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cargo</p>
              <p className="text-sm">{lead.position ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Canal</p>
              <p className="text-sm">{lead.channel?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Criado em</p>
              <p className="text-sm">{formatDate(lead.createdAt)}</p>
            </div>
            {lead.notes && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Notas</p>
                <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <RecentActivities activities={lead.activities ?? []} />
      </div>
    </div>
  )
}
