'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Camera, Download } from 'lucide-react'
import { api } from '@/lib/api'

interface AccountTemplate {
  id: string
  name: string
  description?: string
  category?: string
  createdAt: string
}

const CATEGORIES = [
  { value: 'SALES', label: 'Vendas' },
  { value: 'SUPPORT', label: 'Suporte' },
  { value: 'EDUCATION', label: 'Educação' },
  { value: 'HEALTH', label: 'Saúde' },
  { value: 'REAL_ESTATE', label: 'Imóveis' },
  { value: 'OTHER', label: 'Outro' },
]

const CATEGORY_COLORS: Record<string, string> = {
  SALES: 'bg-blue-100 text-blue-800',
  SUPPORT: 'bg-orange-100 text-orange-800',
  EDUCATION: 'bg-green-100 text-green-800',
  HEALTH: 'bg-red-100 text-red-800',
  REAL_ESTATE: 'bg-yellow-100 text-yellow-800',
  OTHER: 'bg-gray-100 text-gray-700',
}

const emptyForm = { name: '', description: '', category: 'OTHER' }

export default function SnapshotsPage() {
  const [templates, setTemplates] = useState<AccountTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const data = await api.get<AccountTemplate[]>('/account-templates')
      setTemplates(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function handleCreate() {
    setSaving(true)
    try {
      const created = await api.post<AccountTemplate>('/account-templates/snapshot', form)
      setTemplates((prev) => [created, ...prev])
      setOpen(false)
      setForm(emptyForm)
    } finally {
      setSaving(false)
    }
  }

  async function handleApply(id: string, name: string) {
    if (!confirm(`Aplicar o snapshot "${name}"? Isso pode sobrescrever configurações atuais.`)) return
    await api.post(`/account-templates/${id}/apply`, {})
    alert('Snapshot aplicado com sucesso!')
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este snapshot?')) return
    await api.delete(`/account-templates/${id}`)
    setTemplates((prev) => prev.filter((t) => t.id !== id))
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const getCategoryLabel = (cat?: string) =>
    CATEGORIES.find((c) => c.value === cat)?.label ?? cat ?? 'Outro'

  if (loading) return <div className="text-muted-foreground text-sm">Carregando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Snapshots</h2>
          <p className="text-sm text-muted-foreground">
            Salve o estado atual da conta como template ou aplique um snapshot existente
          </p>
        </div>
        <Button onClick={() => setOpen(true)} size="sm">
          <Camera className="h-4 w-4 mr-1" /> Criar Snapshot
        </Button>
      </div>

      <div className="border rounded-lg divide-y">
        {templates.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhum snapshot criado ainda
          </div>
        )}
        {templates.map((template) => (
          <div key={template.id} className="flex items-start gap-3 px-4 py-3">
            <Camera className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{template.name}</span>
                {template.category && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      CATEGORY_COLORS[template.category] ?? 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {getCategoryLabel(template.category)}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{formatDate(template.createdAt)}</span>
              </div>
              {template.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
              )}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => void handleApply(template.id, template.name)}
              >
                <Download className="h-3.5 w-3.5" /> Aplicar
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => void handleDelete(template.id)}
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
            <DialogTitle>Criar Snapshot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Um snapshot salva o estado atual do pipeline, etapas, tags, campos e configurações da conta.
            </p>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Setup inicial de vendas"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Descreva o que está incluído neste snapshot"
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleCreate()} disabled={!form.name || saving}>
              {saving ? 'Criando...' : 'Criar Snapshot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
