'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CustomFieldDefinition, CustomFieldOption, CustomFieldType } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, GripVertical, X, ChevronUp, ChevronDown } from 'lucide-react'

const TYPE_LABELS: Record<CustomFieldType, string> = {
  TEXT: 'Texto',
  NUMBER: 'Número',
  SELECT: 'Seleção única',
  MULTI_SELECT: 'Seleção múltipla',
  DATE: 'Data',
  BOOLEAN: 'Sim/Não',
  URL: 'URL',
}

const TYPE_COLORS: Record<CustomFieldType, string> = {
  TEXT: 'bg-blue-100 text-blue-700',
  NUMBER: 'bg-purple-100 text-purple-700',
  SELECT: 'bg-green-100 text-green-700',
  MULTI_SELECT: 'bg-teal-100 text-teal-700',
  DATE: 'bg-orange-100 text-orange-700',
  BOOLEAN: 'bg-pink-100 text-pink-700',
  URL: 'bg-gray-100 text-gray-700',
}

interface FieldForm {
  label: string
  type: CustomFieldType
  required: boolean
  options: CustomFieldOption[]
}

const EMPTY_FORM: FieldForm = {
  label: '',
  type: 'TEXT',
  required: false,
  options: [],
}

export default function CamposLeadsPage() {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FieldForm>(EMPTY_FORM)
  const [newOption, setNewOption] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['custom-fields', 'lead'],
    queryFn: () => api.get<{ fields: CustomFieldDefinition[] }>('/settings/custom-fields?entity=lead'),
  })

  const fields = data?.fields ?? []

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/settings/custom-fields', body),
    onSuccess: () => {
      toast.success('Campo criado!')
      setModalOpen(false)
      void qc.invalidateQueries({ queryKey: ['custom-fields'] })
    },
    onError: () => toast.error('Erro ao criar campo'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/settings/custom-fields/${id}`, body),
    onSuccess: () => {
      toast.success('Campo atualizado!')
      setModalOpen(false)
      void qc.invalidateQueries({ queryKey: ['custom-fields'] })
    },
    onError: () => toast.error('Erro ao atualizar campo'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/custom-fields/${id}`),
    onSuccess: () => {
      toast.success('Campo removido!')
      void qc.invalidateQueries({ queryKey: ['custom-fields'] })
    },
    onError: () => toast.error('Erro ao remover campo'),
  })

  const reorderMutation = useMutation({
    mutationFn: (items: { id: string; position: number }[]) =>
      api.put('/settings/custom-fields/reorder', { items }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['custom-fields'] }),
  })

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(field: CustomFieldDefinition) {
    setEditingId(field.id)
    setForm({
      label: field.label,
      type: field.type,
      required: field.required,
      options: field.options ?? [],
    })
    setModalOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const body: Record<string, unknown> = {
      label: form.label,
      type: form.type,
      required: form.required,
      entity: 'lead',
    }
    if (['SELECT', 'MULTI_SELECT'].includes(form.type)) {
      body.options = form.options
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, body })
    } else {
      createMutation.mutate(body)
    }
  }

  function addOption() {
    const trimmed = newOption.trim()
    if (!trimmed) return
    const value = trimmed.toLowerCase().replace(/\s+/g, '_')
    setForm((f) => ({ ...f, options: [...f.options, { label: trimmed, value }] }))
    setNewOption('')
  }

  function removeOption(idx: number) {
    setForm((f) => ({ ...f, options: f.options.filter((_, i) => i !== idx) }))
  }

  function moveField(idx: number, dir: -1 | 1) {
    const newFields = [...fields]
    const target = idx + dir
    if (target < 0 || target >= newFields.length) return
    const items = newFields.map((f, i) => {
      if (i === idx) return { id: f.id, position: target }
      if (i === target) return { id: f.id, position: idx }
      return { id: f.id, position: f.position }
    })
    reorderMutation.mutate(items)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Campos de Leads</h2>
          <p className="text-sm text-muted-foreground">
            Defina campos personalizados que aparecem em todos os leads
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Campo
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Campos configurados ({fields.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
          ) : fields.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground text-sm">Nenhum campo criado ainda</p>
              <Button variant="outline" className="mt-3" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Criar primeiro campo
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {fields.map((field, idx) => (
                <div
                  key={field.id}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-muted/30 transition-colors"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{field.label}</span>
                      {field.required && (
                        <span className="text-xs text-red-500 font-medium">*obrigatório</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[field.type]}`}>
                        {TYPE_LABELS[field.type]}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">{field.name}</span>
                      {field.options && field.options.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {field.options.length} opções
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => moveField(idx, -1)}
                      disabled={idx === 0}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => moveField(idx, 1)}
                      disabled={idx === fields.length - 1}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(field)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 hover:text-red-600"
                      onClick={() => deleteMutation.mutate(field.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">
            <strong>Como funciona:</strong> Os campos criados aqui aparecem automaticamente no formulário de edição de qualquer lead.
            Os dados ficam salvos no campo <code className="bg-muted px-1 rounded">customFields</code> do lead e são exibidos na página de detalhes.
          </p>
        </CardContent>
      </Card>

      {/* Modal criar/editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Campo' : 'Novo Campo'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome do campo *</Label>
              <Input
                placeholder="Ex: Segmento, Origem, Cargo do decisor..."
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as CustomFieldType, options: [] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as CustomFieldType[]).map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="required"
                checked={form.required}
                onChange={(e) => setForm((f) => ({ ...f, required: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="required" className="cursor-pointer">Campo obrigatório</Label>
            </div>

            {['SELECT', 'MULTI_SELECT'].includes(form.type) && (
              <div className="space-y-2">
                <Label>Opções</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Adicionar opção..."
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); addOption() }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addOption}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {form.options.map((opt, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 pr-1">
                      {opt.label}
                      <button type="button" onClick={() => removeOption(i)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                {form.options.length === 0 && (
                  <p className="text-xs text-muted-foreground">Adicione pelo menos uma opção</p>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isPending || !form.label.trim()}
              >
                {isPending ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar Campo'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
