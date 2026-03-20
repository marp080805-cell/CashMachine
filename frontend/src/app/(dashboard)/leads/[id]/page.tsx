'use client'

import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Lead, Activity, Channel } from '@/types'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { formatPhone, formatDate } from '@/lib/utils'
import { Pencil, Plus, X, Loader2, Save } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'

const statusLabels: Record<string, string> = {
  NEW: 'Novo',
  CONTACTED: 'Contatado',
  QUALIFIED: 'Qualificado',
  UNQUALIFIED: 'Desqualificado',
  CUSTOMER: 'Cliente',
  LOST: 'Perdido',
}

type LeadDetail = Lead & { activities: Activity[] }

interface CustomField { key: string; value: string }

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<{
    name: string; email: string; phone: string; whatsapp: string
    position: string; status: string; notes: string; tags: string
    customFields: CustomField[]
  } | null>(null)

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => api.get<LeadDetail>(`/leads/${id}`),
    enabled: !!id,
  })

  const { data: channelsData } = useQuery({
    queryKey: ['channels'],
    queryFn: () => api.get<{ channels: Channel[] }>('/channels'),
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
    const existingCustomFields = lead.customFields
      ? Object.entries(lead.customFields as Record<string, string>).map(([key, value]) => ({ key, value: String(value) }))
      : []
    setEditForm({
      name: lead.name,
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      whatsapp: lead.whatsapp ?? '',
      position: lead.position ?? '',
      status: lead.status,
      notes: lead.notes ?? '',
      tags: lead.tags.join(', '),
      customFields: existingCustomFields,
    })
    setEditOpen(true)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editForm) return

    const customFieldsObj = editForm.customFields.reduce<Record<string, string>>((acc, f) => {
      if (f.key.trim()) acc[f.key.trim()] = f.value
      return acc
    }, {})

    updateMutation.mutate({
      name: editForm.name,
      email: editForm.email || undefined,
      phone: editForm.phone || undefined,
      whatsapp: editForm.whatsapp || undefined,
      position: editForm.position || undefined,
      status: editForm.status,
      notes: editForm.notes || undefined,
      tags: editForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
      customFields: Object.keys(customFieldsObj).length ? customFieldsObj : undefined,
    })
  }

  function addCustomField() {
    setEditForm((f) => f ? { ...f, customFields: [...f.customFields, { key: '', value: '' }] } : f)
  }

  function removeCustomField(idx: number) {
    setEditForm((f) => f ? { ...f, customFields: f.customFields.filter((_, i) => i !== idx) } : f)
  }

  function updateCustomField(idx: number, part: 'key' | 'value', val: string) {
    setEditForm((f) => f ? {
      ...f,
      customFields: f.customFields.map((cf, i) => i === idx ? { ...cf, [part]: val } : cf),
    } : f)
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

  const customFields = lead.customFields as Record<string, unknown> | null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-bold">
          {lead.name[0]}
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{lead.name}</h2>
          <p className="text-muted-foreground">{lead.company?.name ?? 'Sem empresa'}</p>
        </div>
        <Badge variant="secondary">{statusLabels[lead.status] ?? lead.status}</Badge>
        <Button size="sm" variant="outline" onClick={openEdit}>
          <Pencil className="h-4 w-4 mr-2" />
          Editar
        </Button>
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
            {lead.tags.length > 0 && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {lead.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}
            {lead.notes && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Notas</p>
                <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {customFields && Object.keys(customFields).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campos adicionais</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {Object.entries(customFields).map(([key, value]) => (
                <div key={key}>
                  <p className="text-xs text-muted-foreground capitalize">{key}</p>
                  <p className="text-sm">{String(value)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <RecentActivities activities={lead.activities ?? []} />
      </div>

      {/* Edit Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Lead</DialogTitle>
          </DialogHeader>
          {editForm && (
            <form onSubmit={handleSave} className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Nome *</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => f ? { ...f, name: e.target.value } : f)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => f ? { ...f, email: e.target.value } : f)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input
                    value={editForm.phone}
                    onChange={(e) => setEditForm((f) => f ? { ...f, phone: e.target.value } : f)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>WhatsApp</Label>
                  <Input
                    value={editForm.whatsapp}
                    onChange={(e) => setEditForm((f) => f ? { ...f, whatsapp: e.target.value } : f)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Cargo</Label>
                  <Input
                    value={editForm.position}
                    onChange={(e) => setEditForm((f) => f ? { ...f, position: e.target.value } : f)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Canal</Label>
                  <Select
                    value={lead.channelId ?? ''}
                    onValueChange={(v) => setEditForm((f) => f ? { ...f } : f)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(channelsData?.channels ?? []).map((ch) => (
                        <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                <div className="col-span-2 space-y-1.5">
                  <Label>Tags <span className="text-muted-foreground text-xs">(separadas por vírgula)</span></Label>
                  <Input
                    value={editForm.tags}
                    onChange={(e) => setEditForm((f) => f ? { ...f, tags: e.target.value } : f)}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Notas</Label>
                  <textarea
                    rows={2}
                    value={editForm.notes}
                    onChange={(e) => setEditForm((f) => f ? { ...f, notes: e.target.value } : f)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                </div>
              </div>

              {/* Custom Fields */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Campos adicionais</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addCustomField}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
                  </Button>
                </div>
                {editForm.customFields.map((cf, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      placeholder="Campo"
                      value={cf.key}
                      onChange={(e) => updateCustomField(idx, 'key', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Valor"
                      value={cf.value}
                      onChange={(e) => updateCustomField(idx, 'value', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeCustomField(idx)}
                      className="text-red-500 hover:text-red-600 shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
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
