'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { api } from '@/lib/api'

interface Tag {
  id: string
  name: string
  color: string
  category: string
  isLocked: boolean
}

const CATEGORIES = ['SALES', 'SUPPORT', 'MARKETING', 'AI_CONTROL'] as const
const categoryLabels: Record<string, string> = {
  SALES: 'Vendas', SUPPORT: 'Suporte', MARKETING: 'Marketing', AI_CONTROL: 'IA',
}

const emptyForm = { name: '', color: '#6366f1', category: 'SALES', isLocked: false }

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Tag | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const data = await api.get<Tag[]>('/tags')
      setTags(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setOpen(true)
  }

  function openEdit(tag: Tag) {
    setEditing(tag)
    setForm({ name: tag.name, color: tag.color, category: tag.category, isLocked: tag.isLocked })
    setOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (editing) {
        const updated = await api.patch<Tag>(`/tags/${editing.id}`, form)
        setTags((prev) => prev.map((t) => (t.id === editing.id ? updated : t)))
      } else {
        const created = await api.post<Tag>('/tags', form)
        setTags((prev) => [...prev, created])
      }
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta tag?')) return
    await api.delete(`/tags/${id}`)
    setTags((prev) => prev.filter((t) => t.id !== id))
  }

  if (loading) return <div className="text-muted-foreground text-sm">Carregando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tags</h2>
          <p className="text-sm text-muted-foreground">Gerencie as tags para categorizar oportunidades e contatos</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nova Tag
        </Button>
      </div>

      <div className="border rounded-lg divide-y">
        {tags.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma tag cadastrada</div>
        )}
        {tags.map((tag) => (
          <div key={tag.id} className="flex items-center gap-3 px-4 py-3">
            <span
              className="h-4 w-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: tag.color }}
            />
            <span className="flex-1 font-medium text-sm">{tag.name}</span>
            <Badge variant="outline" className="text-xs">
              {categoryLabels[tag.category] ?? tag.category}
            </Badge>
            {tag.isLocked && (
              <Badge variant="secondary" className="text-xs">Bloqueada</Badge>
            )}
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tag)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {!tag.isLocked && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => void handleDelete(tag.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Tag' : 'Nova Tag'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: VIP, Hot Lead..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-9 w-16 rounded border cursor-pointer"
                />
                <Input
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="font-mono text-sm"
                  placeholder="#6366f1"
                />
              </div>
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
                    <SelectItem key={c} value={c}>{categoryLabels[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isLocked}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isLocked: v }))}
              />
              <Label>Bloqueada (não pode ser excluída)</Label>
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
