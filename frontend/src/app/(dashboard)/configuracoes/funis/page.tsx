'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Pencil, Trash2, Plus, Settings } from 'lucide-react'
import { api } from '@/lib/api'
import Link from 'next/link'
import { toast } from 'sonner'

interface Stage {
  id: string
  name: string
  type: string
  sortOrder: number
}

interface Pipeline {
  id: string
  name: string
  type: string
  description?: string
  stages?: Stage[]
}

const PIPELINE_TYPES = [
  { value: 'SALES', label: 'Vendas' },
  { value: 'TREATMENT', label: 'Atendimento' },
  { value: 'RESCUE', label: 'Resgate' },
  { value: 'RELATIONSHIP', label: 'Relacionamento' },
]

const typeBadgeVariant: Record<string, string> = {
  SALES: 'bg-blue-100 text-blue-700',
  TREATMENT: 'bg-green-100 text-green-700',
  RESCUE: 'bg-amber-100 text-amber-700',
  RELATIONSHIP: 'bg-purple-100 text-purple-700',
}

const emptyForm = { name: '', type: 'SALES', description: '' }

export default function FunisConfigPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Pipeline | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const { data: pipelines = [], isLoading: loadingPipelines } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => api.get<Pipeline[]>('/pipelines'),
  })

  const { data: tenantData } = useQuery({
    queryKey: ['tenant-current'],
    queryFn: () => api.get<{ settings?: { allowReopenLost?: boolean } }>('/tenants/current'),
  })
  const allowReopenLost = tenantData?.settings?.allowReopenLost !== false

  const toggleReopenMutation = useMutation({
    mutationFn: (value: boolean) => api.patch('/tenants/current/settings', { allowReopenLost: value }),
    onSuccess: (_data, value) => {
      void queryClient.invalidateQueries({ queryKey: ['tenant-current'] })
      toast.success(value ? 'Reabertura de perdidas ativada' : 'Reabertura de perdidas desativada')
    },
    onError: () => toast.error('Erro ao salvar configuração'),
  })

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setOpen(true)
  }

  function openEdit(pipeline: Pipeline) {
    setEditing(pipeline)
    setForm({
      name: pipeline.name,
      type: pipeline.type,
      description: pipeline.description ?? '',
    })
    setOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        type: form.type,
        description: form.description || undefined,
      }
      if (editing) {
        await api.patch<Pipeline>(`/pipelines/${editing.id}`, payload)
      } else {
        await api.post<Pipeline>('/pipelines', payload)
      }
      void queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este funil? Esta ação não pode ser desfeita.')) return
    await api.delete(`/pipelines/${id}`)
    void queryClient.invalidateQueries({ queryKey: ['pipelines'] })
  }

  if (loadingPipelines) return <div className="text-muted-foreground text-sm">Carregando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Funis</h2>
          <p className="text-sm text-muted-foreground">Configure seus funis de vendas e atendimento</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Novo Funil
        </Button>
      </div>

      {/* Configurações gerais */}
      <div className="border rounded-lg px-4 py-2.5 bg-card flex items-center justify-between gap-4">
        <span className="text-sm text-muted-foreground">Permitir que admins reabram oportunidades perdidas</span>
        <Switch checked={allowReopenLost} onCheckedChange={(v) => toggleReopenMutation.mutate(v)} disabled={toggleReopenMutation.isPending} />
      </div>

      {pipelines.length === 0 ? (
        <div className="border rounded-lg py-12 text-center text-sm text-muted-foreground">
          Nenhum funil cadastrado
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pipelines.map((pipeline) => (
            <Card key={pipeline.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{pipeline.name}</CardTitle>
                    {pipeline.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {pipeline.description}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${typeBadgeVariant[pipeline.type] ?? 'bg-gray-100 text-gray-700'}`}>
                    {PIPELINE_TYPES.find((t) => t.value === pipeline.type)?.label ?? pipeline.type}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {pipeline.stages?.length ?? 0} etapas
                  </span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                      <Link href={`/configuracoes/funis/${pipeline.id}`}>
                        <Settings className="h-3 w-3 mr-1" />
                        Etapas
                      </Link>
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => openEdit(pipeline)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => void handleDelete(pipeline.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Funil' : 'Novo Funil'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Funil de Vendas Principal"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Descreva o objetivo deste funil"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSave()} disabled={!form.name || saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
