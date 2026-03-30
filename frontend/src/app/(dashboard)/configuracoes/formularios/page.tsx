'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Settings, Copy, FileText, Eye } from 'lucide-react'
import { api } from '@/lib/api'

interface FormField {
  id: string
  type: string
  label: string
}

interface Form {
  id: string
  name: string
  slug: string
  pipelineId?: string | null
  fields?: FormField[]
  _count?: { submissions: number }
}

interface Pipeline {
  id: string
  name: string
}

interface Submission {
  id: string
  data: Record<string, string>
  createdAt: string
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
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

  // Submissions viewer
  const [viewForm, setViewForm] = useState<Form | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [submissionsTotal, setSubmissionsTotal] = useState(0)
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)

  async function load() {
    try {
      const [formsData, pipelinesData] = await Promise.all([
        api.get<Form[]>('/forms'),
        api.get<Pipeline[]>('/pipelines'),
      ])
      setForms(Array.isArray(formsData) ? formsData : [])
      setPipelines(Array.isArray(pipelinesData) ? pipelinesData : [])
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
    if (!confirm('Excluir este formulário? Os envios também serão perdidos.')) return
    await api.delete(`/forms/${id}`)
    setForms((prev) => prev.filter((f) => f.id !== id))
  }

  function copyLink(form: Form) {
    const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? window.location.origin
    void navigator.clipboard.writeText(`${appUrl}/forms/${form.slug}`)
    setCopiedId(form.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function openSubmissions(form: Form) {
    setViewForm(form)
    setLoadingSubmissions(true)
    try {
      const res = await api.get<{ submissions: Submission[]; total: number }>(`/forms/${form.id}/submissions`)
      setSubmissions(res.submissions ?? [])
      setSubmissionsTotal(res.total ?? 0)
    } finally {
      setLoadingSubmissions(false)
    }
  }

  const getPipelineName = (id?: string | null) =>
    id ? (pipelines.find((p) => p.id === id)?.name ?? id) : '—'

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
                {form.pipelineId && (
                  <Badge variant="secondary" className="text-xs">{getPipelineName(form.pipelineId)}</Badge>
                )}
                {typeof form._count?.submissions === 'number' && (
                  <span className="text-xs text-muted-foreground">{form._count.submissions} envio{form._count.submissions !== 1 ? 's' : ''}</span>
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
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => void openSubmissions(form)}
                title="Ver respostas"
              >
                <Eye className="h-3.5 w-3.5" />
                Respostas
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

      {/* Create dialog */}
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
              disabled={!formData.name || !formData.slug || saving}
            >
              {saving ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submissions viewer */}
      <Dialog open={!!viewForm} onOpenChange={(o) => { if (!o) setViewForm(null) }}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Respostas — {viewForm?.name}
              {submissionsTotal > 0 && (
                <Badge variant="secondary">{submissionsTotal}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {loadingSubmissions ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Carregando respostas...</p>
            ) : submissions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma resposta recebida ainda.</p>
            ) : (
              <SubmissionsTable
                submissions={submissions}
                fields={viewForm?.fields ?? []}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SubmissionsTable({ submissions, fields }: { submissions: Submission[]; fields: FormField[] }) {
  // Build columns from fields that have actual data
  const columns = fields.length > 0 ? fields : []

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function getCellValue(submission: Submission, field: FormField): string {
    // Try by field id first, then by field label key (legacy), then by type
    const byId = submission.data[field.id]
    if (byId !== undefined && byId !== '') return byId

    const byLabel = submission.data[field.label.toLowerCase().replace(/[^a-z0-9]+/g, '_')]
    if (byLabel !== undefined && byLabel !== '') return byLabel

    // Legacy: direct name/email/phone keys
    if (field.type === 'email') return submission.data.email ?? ''
    if (field.type === 'phone') return submission.data.phone ?? ''

    return ''
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap">Data/Hora</th>
            {columns.map((f) => (
              <th key={f.id} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap">
                {f.label}
              </th>
            ))}
            {/* Show raw keys if no configured fields */}
            {columns.length === 0 && submissions[0] && Object.keys(submissions[0].data)
              .filter(k => !['name', 'email', 'phone'].includes(k) || true)
              .slice(0, 8)
              .map((k) => (
                <th key={k} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap">
                  {k}
                </th>
              ))
            }
            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">UTM</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {submissions.map((sub) => (
            <tr key={sub.id} className="hover:bg-muted/30">
              <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                {formatDate(sub.createdAt)}
              </td>
              {columns.length > 0
                ? columns.map((f) => (
                    <td key={f.id} className="px-3 py-2 text-xs max-w-[200px] truncate" title={getCellValue(sub, f)}>
                      {getCellValue(sub, f) || <span className="text-muted-foreground">—</span>}
                    </td>
                  ))
                : Object.entries(sub.data).slice(0, 8).map(([k, v]) => (
                    <td key={k} className="px-3 py-2 text-xs max-w-[200px] truncate" title={String(v)}>
                      {String(v) || <span className="text-muted-foreground">—</span>}
                    </td>
                  ))
              }
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {[sub.utmSource, sub.utmMedium, sub.utmCampaign].filter(Boolean).join(' / ') || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
