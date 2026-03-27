'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'

interface LostReason {
  id: string
  name: string
  isActive: boolean
}

export default function MotivosPerdaPage() {
  const [reasons, setReasons] = useState<LostReason[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<LostReason | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const data = await api.get<LostReason[]>('/lost-reasons')
      setReasons(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  function openCreate() {
    setEditing(null)
    setName('')
    setOpen(true)
  }

  function openEdit(r: LostReason) {
    setEditing(r)
    setName(r.name)
    setOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (editing) {
        const updated = await api.patch<LostReason>(`/lost-reasons/${editing.id}`, { name })
        setReasons((prev) => prev.map((r) => (r.id === editing.id ? updated : r)))
      } else {
        const created = await api.post<LostReason>('/lost-reasons', { name })
        setReasons((prev) => [...prev, created])
      }
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(reason: LostReason) {
    const updated = await api.patch<LostReason>(`/lost-reasons/${reason.id}`, { isActive: !reason.isActive })
    setReasons((prev) => prev.map((r) => (r.id === reason.id ? updated : r)))
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este motivo de perda?')) return
    await api.delete(`/lost-reasons/${id}`)
    setReasons((prev) => prev.filter((r) => r.id !== id))
  }

  if (loading) return <div className="text-muted-foreground text-sm">Carregando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Motivos de Perda</h2>
          <p className="text-sm text-muted-foreground">Motivos usados ao fechar oportunidades como perdidas</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Novo Motivo
        </Button>
      </div>

      <div className="border rounded-lg divide-y">
        {reasons.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">Nenhum motivo cadastrado</div>
        )}
        {reasons.map((reason) => (
          <div key={reason.id} className="flex items-center gap-3 px-4 py-3">
            <span className="flex-1 text-sm font-medium">{reason.name}</span>
            <Badge variant={reason.isActive ? 'default' : 'outline'} className="text-xs">
              {reason.isActive ? 'Ativo' : 'Inativo'}
            </Badge>
            <Switch
              checked={reason.isActive}
              onCheckedChange={() => void toggleActive(reason)}
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(reason)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => void handleDelete(reason.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Motivo' : 'Novo Motivo de Perda'}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label>Nome</Label>
            <Input
              className="mt-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Preço alto, Concorrente, Sem orçamento..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSave()} disabled={!name || saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
