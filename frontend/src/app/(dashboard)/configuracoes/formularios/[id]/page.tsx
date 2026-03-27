'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Save, Copy } from 'lucide-react'
import { api } from '@/lib/api'

interface FormField {
  id: string
  type: string
  label: string
  required: boolean
  placeholder?: string
  options?: string[]
}

interface Form {
  id: string
  name: string
  slug: string
  pipelineId: string
  stageId?: string
  defaultAssignedToId?: string
  redirectUrl?: string
  fields?: FormField[]
}

interface Pipeline {
  id: string
  name: string
  stages?: Stage[]
}

interface Stage {
  id: string
  name: string
}

interface User {
  id: string
  name: string
}

const FIELD_TYPES = [
  { type: 'text', label: 'Texto' },
  { type: 'email', label: 'E-mail' },
  { type: 'phone', label: 'Telefone' },
  { type: 'number', label: 'Número' },
  { type: 'select', label: 'Seleção' },
  { type: 'textarea', label: 'Texto longo' },
  { type: 'date', label: 'Data' },
]

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

function FieldPreview({ field }: { field: FormField }) {
  switch (field.type) {
    case 'textarea':
      return <textarea disabled placeholder={field.placeholder} className="w-full border rounded px-2 py-1.5 text-sm bg-muted/30 resize-none" rows={3} />
    case 'select':
      return (
        <select disabled className="w-full border rounded px-2 py-1.5 text-sm bg-muted/30">
          <option value="">{field.placeholder ?? 'Selecione...'}</option>
          {(field.options ?? []).map((opt) => <option key={opt}>{opt}</option>)}
        </select>
      )
    case 'date':
      return <input disabled type="date" className="w-full border rounded px-2 py-1.5 text-sm bg-muted/30" />
    default:
      return (
        <input
          disabled
          type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
          placeholder={field.placeholder}
          className="w-full border rounded px-2 py-1.5 text-sm bg-muted/30"
        />
      )
  }
}

export default function FormBuilderPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [form, setForm] = useState<Form | null>(null)
  const [fields, setFields] = useState<FormField[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [settings, setSettings] = useState({
    pipelineId: '',
    stageId: '',
    defaultAssignedToId: '',
    redirectUrl: '',
  })
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  async function load() {
    try {
      const [formData, pipelinesData, usersData] = await Promise.all([
        api.get<Form>(`/forms/${id}`),
        api.get<Pipeline[]>('/pipelines'),
        api.get<User[]>('/users'),
      ])
      setForm(formData)
      setFields(formData.fields ?? [])
      setPipelines(pipelinesData)
      setUsers(usersData)
      setSettings({
        pipelineId: formData.pipelineId ?? '',
        stageId: formData.stageId ?? '',
        defaultAssignedToId: formData.defaultAssignedToId ?? '',
        redirectUrl: formData.redirectUrl ?? '',
      })
      const pipeline = pipelinesData.find((p) => p.id === formData.pipelineId)
      setStages(pipeline?.stages ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [id])

  function handlePipelineChange(pipelineId: string) {
    setSettings((s) => ({ ...s, pipelineId, stageId: '' }))
    const pipeline = pipelines.find((p) => p.id === pipelineId)
    setStages(pipeline?.stages ?? [])
  }

  function addField(type: string) {
    const newField: FormField = {
      id: generateId(),
      type,
      label: FIELD_TYPES.find((f) => f.type === type)?.label ?? type,
      required: false,
      placeholder: '',
    }
    setFields((prev) => [...prev, newField])
    setSelectedFieldId(newField.id)
  }

  function removeField(fieldId: string) {
    setFields((prev) => prev.filter((f) => f.id !== fieldId))
    if (selectedFieldId === fieldId) setSelectedFieldId(null)
  }

  function moveField(fieldId: string, direction: 'up' | 'down') {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === fieldId)
      if (idx < 0) return prev
      const newArr = [...prev]
      if (direction === 'up' && idx > 0) {
        ;[newArr[idx - 1], newArr[idx]] = [newArr[idx], newArr[idx - 1]]
      } else if (direction === 'down' && idx < newArr.length - 1) {
        ;[newArr[idx], newArr[idx + 1]] = [newArr[idx + 1], newArr[idx]]
      }
      return newArr
    })
  }

  function updateField(fieldId: string, updates: Partial<FormField>) {
    setFields((prev) => prev.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await api.patch<Form>(`/forms/${id}`, { fields, ...settings })
    } finally {
      setSaving(false)
    }
  }

  function copyEmbedLink() {
    const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? window.location.origin
    void navigator.clipboard.writeText(`${appUrl}/forms/${form?.slug ?? id}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className="text-muted-foreground text-sm p-6">Carregando...</div>
  if (!form) return <div className="text-muted-foreground text-sm p-6">Formulário não encontrado.</div>

  const selectedField = fields.find((f) => f.id === selectedFieldId) ?? null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push('/configuracoes/formularios')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{form.name}</p>
          <p className="text-xs text-muted-foreground font-mono">/forms/{form.slug}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={copyEmbedLink}>
          <Copy className="h-3.5 w-3.5" /> {copied ? 'Copiado!' : 'Copiar link'}
        </Button>
        <Button size="sm" onClick={() => void handleSave()} disabled={saving} className="gap-1">
          <Save className="h-3.5 w-3.5" /> {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left — field types + settings */}
        <div className="w-52 border-r bg-muted/30 p-3 overflow-y-auto flex-shrink-0 space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Campos</p>
            <div className="space-y-1">
              {FIELD_TYPES.map((ft) => (
                <button
                  key={ft.type}
                  onClick={() => addField(ft.type)}
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent flex items-center gap-2 transition-colors"
                >
                  <Plus className="h-3 w-3 flex-shrink-0" />
                  <span>{ft.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Configurações</p>
            <div className="space-y-1">
              <Label className="text-xs">Pipeline</Label>
              <Select value={settings.pipelineId} onValueChange={handlePipelineChange}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {stages.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Etapa</Label>
                <Select value={settings.stageId} onValueChange={(v) => setSettings((s) => ({ ...s, stageId: v }))}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((st) => (
                      <SelectItem key={st.id} value={st.id} className="text-xs">{st.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Responsável padrão</Label>
              <Select
                value={settings.defaultAssignedToId}
                onValueChange={(v) => setSettings((s) => ({ ...s, defaultAssignedToId: v }))}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL de redirect</Label>
              <Input
                value={settings.redirectUrl}
                onChange={(e) => setSettings((s) => ({ ...s, redirectUrl: e.target.value }))}
                className="h-7 text-xs"
                placeholder="https://..."
              />
            </div>
          </div>
        </div>

        {/* Center — fields list + field config */}
        <div className="flex-1 p-4 overflow-y-auto">
          {fields.length === 0 && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground">
              Clique em um tipo de campo na barra lateral para adicionar campos ao formulário.
            </div>
          )}

          <div className="space-y-2">
            {fields.map((field, idx) => (
              <div
                key={field.id}
                onClick={() => setSelectedFieldId(field.id === selectedFieldId ? null : field.id)}
                className={`border rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                  selectedFieldId === field.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{field.label}</span>
                      <Badge variant="outline" className="text-xs">{field.type}</Badge>
                      {field.required && <Badge variant="secondary" className="text-xs">Obrigatório</Badge>}
                    </div>
                    {field.placeholder && (
                      <p className="text-xs text-muted-foreground mt-0.5">{field.placeholder}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground w-5 text-right">{idx + 1}</span>
                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => { e.stopPropagation(); moveField(field.id, 'up') }}
                      disabled={idx === 0}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => { e.stopPropagation(); moveField(field.id, 'down') }}
                      disabled={idx === fields.length - 1}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); removeField(field.id) }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Inline config when selected */}
                {selectedFieldId === field.id && (
                  <div
                    className="mt-3 space-y-2 border-t pt-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Label</Label>
                        <Input
                          value={field.label}
                          onChange={(e) => updateField(field.id, { label: e.target.value })}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Placeholder</Label>
                        <Input
                          value={field.placeholder ?? ''}
                          onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                    {field.type === 'select' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Opções (uma por linha)</Label>
                        <textarea
                          className="w-full border rounded px-2 py-1.5 text-xs resize-none h-16"
                          value={(field.options ?? []).join('\n')}
                          onChange={(e) =>
                            updateField(field.id, {
                              options: e.target.value.split('\n').filter(Boolean),
                            })
                          }
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={field.required}
                        onCheckedChange={(v) => updateField(field.id, { required: v })}
                      />
                      <Label className="text-xs">Obrigatório</Label>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right — Preview */}
        <div className="w-72 border-l p-4 overflow-y-auto flex-shrink-0">
          <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Preview</p>
          {fields.length === 0 ? (
            <p className="text-xs text-muted-foreground">Adicione campos para ver o preview.</p>
          ) : (
            <div className="border rounded-lg p-4 bg-background space-y-3">
              <p className="font-semibold text-sm">{form.name}</p>
              {fields.map((field) => (
                <div key={field.id} className="space-y-1">
                  <label className="text-xs font-medium">
                    {field.label}
                    {field.required && <span className="text-destructive ml-0.5">*</span>}
                  </label>
                  <FieldPreview field={field} />
                </div>
              ))}
              <button
                disabled
                className="w-full bg-primary text-primary-foreground text-sm py-2 rounded font-medium opacity-70"
              >
                Enviar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
