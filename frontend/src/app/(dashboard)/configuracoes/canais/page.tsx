'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Plus, Pencil, Loader2, Radio } from 'lucide-react'
import { toast } from 'sonner'
import type { Channel } from '@/types'

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  ONLINE_PAID: 'Online Pago',
  ONLINE_ORGANIC: 'Online Orgânico',
  PRESENTIAL_EVENT: 'Presencial — Evento',
  PRESENTIAL_COMMUNITY: 'Presencial — Comunidade',
  OFFLINE_REFERRAL_PARTNER: 'Indicação — Parceiro',
  OFFLINE_REFERRAL_CLIENT: 'Indicação — Cliente',
  OUTBOUND: 'Outbound',
  CUSTOM: 'Personalizado',
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativo',
  PAUSED: 'Pausado',
  TESTING: 'Testando',
  INACTIVE: 'Inativo',
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-amber-100 text-amber-700',
  TESTING: 'bg-blue-100 text-blue-700',
  INACTIVE: 'bg-muted text-muted-foreground',
}

const channelSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  type: z.string().min(1, 'Tipo obrigatório'),
  cplTarget: z.coerce.number().min(0).optional(),
  cacTarget: z.coerce.number().min(0).optional(),
  leadToCallRate: z.coerce.number().min(0).max(1).optional(),
  callToContractRate: z.coerce.number().min(0).max(1).optional(),
  priority: z.coerce.number().min(1).max(5).optional(),
})
type ChannelForm = z.infer<typeof channelSchema>

export default function CanaisPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Channel | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['channels'],
    queryFn: () => api.get<{ channels: Channel[] }>('/channels'),
  })

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<ChannelForm>({
    resolver: zodResolver(channelSchema),
  })

  const openCreate = () => {
    setEditing(null)
    reset({})
    setModalOpen(true)
  }

  const openEdit = (channel: Channel) => {
    setEditing(channel)
    reset({
      name: channel.name,
      type: channel.type,
      cplTarget: channel.cplTarget ?? undefined,
      cacTarget: channel.cacTarget ?? undefined,
      leadToCallRate: channel.leadToCallRate,
      callToContractRate: channel.callToContractRate,
      priority: channel.priority,
    })
    setModalOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: (form: ChannelForm) =>
      editing
        ? api.patch(`/channels/${editing.id}`, form)
        : api.post('/channels', form),
    onSuccess: () => {
      toast.success(editing ? 'Canal atualizado!' : 'Canal criado!')
      setModalOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['channels'] })
    },
    onError: () => toast.error('Erro ao salvar canal'),
  })

  const channels = data?.channels ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{channels.length} canal(is) cadastrado(s)</p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Canal
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left">Canal</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-right">CPL Alvo</th>
                <th className="px-4 py-3 text-right">CAC Alvo</th>
                <th className="px-4 py-3 text-center">Prioridade</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {channels.map((channel) => (
                <tr key={channel.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium flex items-center gap-2">
                    <Radio className="h-4 w-4 text-muted-foreground" />
                    {channel.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {CHANNEL_TYPE_LABELS[channel.type] ?? channel.type}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {channel.cplTarget ? `R$ ${channel.cplTarget.toFixed(0)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {channel.cacTarget ? `R$ ${channel.cacTarget.toFixed(0)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {'★'.repeat(channel.priority)}{'☆'.repeat(5 - channel.priority)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={STATUS_COLORS[channel.status] ?? ''}>
                      {STATUS_LABELS[channel.status] ?? channel.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(channel)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Canal' : 'Novo Canal'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input {...register('name')} className="mt-1" placeholder="Google Ads – Pesquisa" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Label>Tipo</Label>
              <Select
                defaultValue={editing?.type}
                onValueChange={(v) => setValue('type', v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CHANNEL_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type && <p className="text-xs text-red-500 mt-1">{errors.type.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CPL Alvo (R$)</Label>
                <Input type="number" {...register('cplTarget')} className="mt-1" placeholder="100" />
              </div>
              <div>
                <Label>CAC Alvo (R$)</Label>
                <Input type="number" {...register('cacTarget')} className="mt-1" placeholder="2000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Taxa Lead → Call</Label>
                <Input type="number" step="0.01" {...register('leadToCallRate')} className="mt-1" placeholder="0.20" />
              </div>
              <div>
                <Label>Taxa Call → Contrato</Label>
                <Input type="number" step="0.01" {...register('callToContractRate')} className="mt-1" placeholder="0.25" />
              </div>
            </div>
            <div>
              <Label>Prioridade (1–5)</Label>
              <Input type="number" min={1} max={5} {...register('priority')} className="mt-1" placeholder="3" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editing ? 'Salvar' : 'Criar Canal'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
