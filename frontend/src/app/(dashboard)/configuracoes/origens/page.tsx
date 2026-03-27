'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Pencil, Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'

interface SubOrigin {
  id: string
  name: string
}

interface Origin {
  id: string
  name: string
  subOrigins: SubOrigin[]
}

export default function OrigensPage() {
  const [origins, setOrigins] = useState<Origin[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const [editingOrigin, setEditingOrigin] = useState<Origin | null>(null)
  const [editingSubOrigin, setEditingSubOrigin] = useState<{ sub: SubOrigin; parentId: string } | null>(null)
  const [newSubOriginFor, setNewSubOriginFor] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const data = await api.get('/origins?includeSubOrigins=true')
      setOrigins(data)
    } catch {
      const data = await api.get('/origins')
      setOrigins(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function openCreateOrigin() {
    setEditingOrigin(null)
    setEditingSubOrigin(null)
    setNewSubOriginFor(null)
    setName('')
    setOpen(true)
  }

  function openEditOrigin(origin: Origin) {
    setEditingOrigin(origin)
    setEditingSubOrigin(null)
    setNewSubOriginFor(null)
    setName(origin.name)
    setOpen(true)
  }

  function openCreateSubOrigin(parentId: string) {
    setEditingOrigin(null)
    setEditingSubOrigin(null)
    setNewSubOriginFor(parentId)
    setName('')
    setOpen(true)
  }

  function openEditSubOrigin(sub: SubOrigin, parentId: string) {
    setEditingSubOrigin({ sub, parentId })
    setEditingOrigin(null)
    setNewSubOriginFor(null)
    setName(sub.name)
    setOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (editingSubOrigin) {
        const updated = await api.patch(`/origins/sub-origins/${editingSubOrigin.sub.id}`, { name })
        setOrigins((prev) => prev.map((o) =>
          o.id === editingSubOrigin.parentId
            ? { ...o, subOrigins: o.subOrigins.map((s) => s.id === editingSubOrigin.sub.id ? updated : s) }
            : o
        ))
      } else if (newSubOriginFor) {
        const created = await api.post(`/origins/${newSubOriginFor}/sub-origins`, { name })
        setOrigins((prev) => prev.map((o) =>
          o.id === newSubOriginFor ? { ...o, subOrigins: [...(o.subOrigins || []), created] } : o
        ))
      } else if (editingOrigin) {
        const updated = await api.patch(`/origins/${editingOrigin.id}`, { name })
        setOrigins((prev) => prev.map((o) => (o.id === editingOrigin.id ? { ...o, ...updated } : o)))
      } else {
        const created = await api.post('/origins', { name })
        setOrigins((prev) => [...prev, { ...created, subOrigins: [] }])
      }
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function deleteOrigin(id: string) {
    if (!confirm('Excluir esta origem e todas as sub-origens?')) return
    await api.delete(`/origins/${id}`)
    setOrigins((prev) => prev.filter((o) => o.id !== id))
  }

  async function deleteSubOrigin(subId: string, parentId: string) {
    if (!confirm('Excluir esta sub-origem?')) return
    await api.delete(`/origins/sub-origins/${subId}`)
    setOrigins((prev) => prev.map((o) =>
      o.id === parentId ? { ...o, subOrigins: o.subOrigins.filter((s) => s.id !== subId) } : o
    ))
  }

  const modalTitle = editingSubOrigin ? 'Editar Sub-origem'
    : newSubOriginFor ? 'Nova Sub-origem'
    : editingOrigin ? 'Editar Origem'
    : 'Nova Origem'

  if (loading) return <div className="text-muted-foreground text-sm">Carregando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Origens</h2>
          <p className="text-sm text-muted-foreground">De onde vêm seus leads (canais de captação)</p>
        </div>
        <Button onClick={openCreateOrigin} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nova Origem
        </Button>
      </div>

      <div className="border rounded-lg divide-y">
        {origins.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma origem cadastrada</div>
        )}
        {origins.map((origin) => (
          <div key={origin.id}>
            <div className="flex items-center gap-2 px-4 py-3">
              <button
                onClick={() => toggleExpand(origin.id)}
                className="text-muted-foreground hover:text-foreground"
              >
                {expanded.has(origin.id)
                  ? <ChevronDown className="h-4 w-4" />
                  : <ChevronRight className="h-4 w-4" />}
              </button>
              <span className="flex-1 font-medium text-sm">{origin.name}</span>
              <span className="text-xs text-muted-foreground">
                {origin.subOrigins?.length ?? 0} sub-origens
              </span>
              <Button
                variant="ghost" size="sm" className="h-7 text-xs"
                onClick={() => openCreateSubOrigin(origin.id)}
              >
                <Plus className="h-3 w-3 mr-1" /> Sub-origem
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditOrigin(origin)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => void deleteOrigin(origin.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {expanded.has(origin.id) && origin.subOrigins?.map((sub) => (
              <div key={sub.id} className="flex items-center gap-2 px-4 py-2 pl-12 bg-muted/30">
                <span className="flex-1 text-sm text-muted-foreground">{sub.name}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSubOrigin(sub, origin.id)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => void deleteSubOrigin(sub.id, origin.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label>Nome</Label>
            <Input
              className="mt-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Instagram, Google Ads, Indicação..."
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
