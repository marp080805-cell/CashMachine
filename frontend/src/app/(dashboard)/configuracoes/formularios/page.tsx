'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Settings, Copy, FileText } from 'lucide-react'
import { api } from '@/lib/api'

interface Form {
  id: string
  name: string
  slug: string
  pipelineId: string
  stageId?: string
  submissionCount?: number
}

interface Pipeline {
  id: string
  name: string
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const emptyForm = { name: '', slug: '', pipelineId: '' }

export default function FormulariosPage() {
  const router = useRouter()
  const [forms, setForms] = useState<Form[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function load() {
    try {
      const [formsData, pipelinesData] = await Promise.all([
        api.get<Form[]>('/forms'),
        api.get<Pipeline[]>('/pipelines'),
      ])
      setForms(formsData)
      setPipelines(pipelinesData)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  function handleNameChange(name: string) {
    setFormData((f) => ({ ...f, name, slug: slugify(name) }))
  }

  async function handleCreate() {
    setSaving(true)
    try {
      const created = await api.post<Form>('/forms', formData)
      setForms((prev) => [...prev, created])
      setOpen(false)
      setFormData(emptyForm)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este formulário?')) return
    await api.delete(`/forms/${id}`)
    setForms((prev) => prev.filter((f) => f.id !== id))
  }

  function copyLink(form: Form) {
    const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? window.location.origin
    void navigator.clipboard.writeText(`${appUrl}/forms/${form.slug}`)
    setCopiedId(form.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getPipelineName = (id: string) => pipelines.find((p) => p.id === id)?.name ?? id

  if (loading) return <div className="text-muted-foreground text-sm">Carregando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Formulários</h2>
          <p className="text-sm text-muted-foreground">Crie formulários públicos para captura de leads</p>
        </div>
        <Button onClick={() => setOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Novo Formulário
        </Button>
      </div>

      <div className="border rounded-lg divide-y">
        {forms.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">Nenhum formulário cadastrado</div>
        )}
        {forms.map((form) => (
          <div key={form.id} className="flex items-center gap-3 px-4 py-3">
            <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{form.name}</span>
                <Badge variant="outline" className="text-xs font-mono">{form.slug}</Badge>
                <Badge variant="secondary" className="text-xs">{getPipelineName(form.pipelineId)}</Badge>
                {typeof form.submissionCount === 'number' && (
                  <span className="text-xs text-muted-foreground">{form.submissionCount} envios</span>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => copyLink(form)}
              >
                <Copy className="h-3.5 w-3.5" />
                {copiedId === form.id ? 'Copiado!' : 'Copiar link'}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => router.push(`/configuracoes/formularios/${form.id}`)}
                title="Configurar"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => void handleDelete(form.id)}
                title="Excluir"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Formulário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Formulário de contato"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Slug (URL)</Label>
              <Input
                value={formData.slug}
                onChange={(e) => setFormData((f) => ({ ...f, slug: e.target.value }))}
                placeholder="formulario-de-contato"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                URL pública: /forms/<span className="font-mono">{formData.slug || 'slug'}</span>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Pipeline destino</Label>
              <Select
                value={formData.pipelineId}
                onValueChange={(v) => setFormData((f) => ({ ...f, pipelineId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => void handleCreate()}
              disabled={!formData.name || !formData.slug || !formData.pipelineId || saving}
            >
              {saving ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
