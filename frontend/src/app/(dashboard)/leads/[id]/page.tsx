'use client'

import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Lead } from '@/types'
import { CustomFieldsPanel } from '@/components/custom-fields/CustomFieldsPanel'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pencil, Loader2, Save } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
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

const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  NEW: 'secondary',
  QUALIFIED: 'default',
  DISQUALIFIED: 'destructive',
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<{ status: string; score: string; source: string } | null>(null)

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => api.get<Lead>(`/leads/${id}`),
    enabled: !!id,
  })

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/leads/${id}`, body),
    onSuccess: () => {
      toast.success('Lead atualizado!')
      setEditOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['lead', id] })
    },
    onError: () => toast.error('Erro ao atualizar lead'),
  })

  function openEdit() {
    if (!lead) return
    setEditForm({
      status: lead.status,
      score: String(lead.score),
      source: lead.source ?? '',
    })
    setEditOpen(true)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editForm) return
    updateMutation.mutate({
      status: editForm.status,
      score: parseInt(editForm.score, 10) || 0,
      source: editForm.source || undefined,
    })
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!lead) return null

  const contact = lead.contact

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-bold">
          {contact?.name?.[0] ?? 'L'}
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{contact?.name ?? 'Lead sem contato'}</h2>
          <p className="text-muted-foreground">{contact?.phone ?? contact?.email ?? '—'}</p>
        </div>
        <Badge variant={statusVariants[lead.status] ?? 'secondary'}>
          {statusLabels[lead.status] ?? lead.status}
        </Badge>
        <Button size="sm" variant="outline" onClick={openEdit}>
          <Pencil className="h-4 w-4 mr-2" />
          Editar
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informações do Lead</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Score</p>
              <p className="text-sm font-semibold">{lead.score}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Origem</p>
              <p className="text-sm">{lead.source ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Criado em</p>
              <p className="text-sm">{formatDate(lead.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Atualizado em</p>
              <p className="text-sm">{formatDate(lead.updatedAt)}</p>
            </div>
          </CardContent>
        </Card>

        {contact && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contato Vinculado</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Nome</p>
                <p className="text-sm">{contact.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm">{contact.email ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Telefone</p>
                <p className="text-sm">{contact.phone ?? '—'}</p>
              </div>
              {contact.company && (
                <div>
                  <p className="text-xs text-muted-foreground">Empresa</p>
                  <p className="text-sm">{contact.company.name}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campos Personalizados</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomFieldsPanel entityType="lead" entityId={id} />
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Lead</DialogTitle>
          </DialogHeader>
          {editForm && (
            <form onSubmit={handleSave} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => f ? { ...f, status: v } : f)}>
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
                  value={editForm.score}
                  onChange={(e) => setEditForm((f) => f ? { ...f, score: e.target.value } : f)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Origem</Label>
                <Input
                  placeholder="Ex: Google Ads, Indicação..."
                  value={editForm.source}
                  onChange={(e) => setEditForm((f) => f ? { ...f, source: e.target.value } : f)}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" />Salvar</>
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
