'use client'

import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Lead, Activity, Channel, CustomFieldDefinition } from '@/types'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { formatPhone, formatDate } from '@/lib/utils'
import { Pencil, Plus, X, Loader2, Save, MessageCircle, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { WhatsappNumber } from '@/types'

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
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [waOpen, setWaOpen] = useState(false)
  const [waNumberId, setWaNumberId] = useState('')
  const [waText, setWaText] = useState('')
  const [editForm, setEditForm] = useState<{
    name: string; email: string; phone: string; whatsapp: string
    position: string; channelId: string; status: string; notes: string; tags: string
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

  const { data: customFieldDefs } = useQuery({
    queryKey: ['custom-fields', 'lead'],
    queryFn: () => api.get<{ fields: CustomFieldDefinition[] }>('/settings/custom-fields?entity=lead'),
  })

  const fieldDefs = customFieldDefs?.fields ?? []

  const { data: waNumbers } = useQuery({
    queryKey: ['whatsapp-numbers'],
    queryFn: () => api.get<{ numbers: WhatsappNumber[] }>('/whatsapp/numbers'),
  })
  const connectedNumbers = (waNumbers?.numbers ?? []).filter((n) => n.status === 'CONNECTED')

  const startConversationMutation = useMutation({
    mutationFn: (body: { leadId: string; numberId: string; text: string }) =>
      api.post<{ conversation: { id: string } }>('/whatsapp/conversations/start', body),
    onSuccess: (res) => {
      toast.success('Conversa iniciada!')
      setWaOpen(false)
      setWaText('')
      router.push(`/whatsapp`)
    },
    onError: () => toast.error('Erro ao iniciar conversa'),
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
      channelId: lead.channelId ?? '',
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
      channelId: editForm.channelId || undefined,
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
        <Button
          size="sm"
          variant="outline"
          className="text-green-600 border-green-300 hover:bg-green-50"
          onClick={() => {
            if (connectedNumbers.length === 1) setWaNumberId(connectedNumbers[0]!.id)
            setWaOpen(true)
          }}
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          WhatsApp
        </Button>
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

        {(fieldDefs.length > 0 || (customFields && Object.keys(customFields).length > 0)) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campos adicionais</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {fieldDefs.length > 0
                ? fieldDefs.map((def) => {
                    const val = customFields?.[def.name]
                    return (
                      <div key={def.id}>
                        <p className="text-xs text-muted-foreground">{def.label}</p>
                        <p className="text-sm">{val !== undefined && val !== null ? String(val) : '—'}</p>
                      </div>
                    )
                  })
                : customFields && Object.entries(customFields).map(([key, value]) => (
                    <div key={key}>
                      <p className="text-xs text-muted-foreground capitalize">{key}</p>
                      <p className="text-sm">{String(value)}</p>
                    </div>
                  ))
              }
            </CardContent>
          </Card>
        )}

        <RecentActivities activities={lead.activities ?? []} />
      </div>

      {/* WhatsApp Modal */}
      <Dialog open={waOpen} onOpenChange={setWaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              Iniciar conversa — {lead.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {connectedNumbers.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-3">
                  Nenhum número WhatsApp conectado.
                </p>
                <Button variant="outline" size="sm" onClick={() => router.push('/configuracoes/whatsapp')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Conectar WhatsApp
                </Button>
              </div>
            ) : (
              <>
                {!(lead.whatsapp ?? lead.phone) && (
                  <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                    Este lead não tem WhatsApp/telefone cadastrado. Edite o lead antes de enviar.
                  </p>
                )}
                {connectedNumbers.length > 1 && (
                  <div className="space-y-1.5">
                    <Label>Enviar pelo número</Label>
                    <Select value={waNumberId} onValueChange={setWaNumberId}>
                      <SelectTrigger><SelectValue placeholder="Selecionar número..." /></SelectTrigger>
                      <SelectContent>
                        {connectedNumbers.map((n) => (
                          <SelectItem key={n.id} value={n.id}>{n.phone}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Mensagem</Label>
                  <Textarea
                    rows={4}
                    placeholder={`Olá ${lead.name}, tudo bem?`}
                    value={waText}
                    onChange={(e) => setWaText(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setWaOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    disabled={!waText.trim() || !waNumberId || startConversationMutation.isPending}
                    onClick={() => startConversationMutation.mutate({ leadId: id, numberId: waNumberId, text: waText })}
                  >
                    {startConversationMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
                    ) : (
                      <><MessageCircle className="h-4 w-4 mr-2" />Enviar</>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
                    value={editForm.channelId}
                    onValueChange={(v) => setEditForm((f) => f ? { ...f, channelId: v } : f)}
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

              {/* Custom Fields from definitions */}
              {fieldDefs.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Campos adicionais</Label>
                  {fieldDefs.map((def) => {
                    const currentVal = editForm.customFields.find((cf) => cf.key === def.name)?.value ?? ''
                    const setValue = (val: string) => {
                      setEditForm((f) => {
                        if (!f) return f
                        const exists = f.customFields.find((cf) => cf.key === def.name)
                        if (exists) {
                          return { ...f, customFields: f.customFields.map((cf) => cf.key === def.name ? { ...cf, value: val } : cf) }
                        }
                        return { ...f, customFields: [...f.customFields, { key: def.name, value: val }] }
                      })
                    }
                    return (
                      <div key={def.id} className="space-y-1.5">
                        <Label>{def.label}{def.required && <span className="text-red-500 ml-1">*</span>}</Label>
                        {def.type === 'BOOLEAN' ? (
                          <Select value={currentVal || 'false'} onValueChange={setValue}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">Sim</SelectItem>
                              <SelectItem value="false">Não</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : def.type === 'SELECT' || def.type === 'MULTI_SELECT' ? (
                          <Select value={currentVal} onValueChange={setValue}>
                            <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                            <SelectContent>
                              {(def.options ?? []).map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type={def.type === 'NUMBER' ? 'number' : def.type === 'DATE' ? 'date' : def.type === 'URL' ? 'url' : 'text'}
                            value={currentVal}
                            onChange={(e) => setValue(e.target.value)}
                            required={def.required}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Legacy free-form custom fields (shown only if no definitions configured) */}
              {fieldDefs.length === 0 && (
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
              )}

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
