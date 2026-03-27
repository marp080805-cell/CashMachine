'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Pencil, Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'

interface SubOrigin {
  id: string
  name: string
  isActive: boolean
  originId: string
}

interface Origin {
  id: string
  name: string
  isActive: boolean
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
      const data = await api.get<Origin[]>('/origins')
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
        // PATCH /origins/:parentId/sub-origins/:subId
        const updated = await api.patch<SubOrigin>(
          `/origins/${editingSubOrigin.parentId}/sub-origins/${editingSubOrigin.sub.id}`,
          { name }
        )
        setOrigins((prev) => prev.map((o) =>
          o.id === editingSubOrigin.parentId
            ? { ...o, subOrigins: o.subOrigins.map((s) => s.id === editingSubOrigin.sub.id ? updated : s) }
            : o
        ))
      } else if (newSubOriginFor) {
        // POST /origins/:id/sub-origins
        const created = await api.post<SubOrigin>(`/origins/${newSubOriginFor}/sub-origins`, { name })
        setOrigins((prev) => prev.map((o) =>
          o.id === newSubOriginFor ? { ...o, subOrigins: [...(o.subOrigins ?? []), created] } : o
        ))
      } else if (editingOrigin) {
        const updated = await api.patch<Origin>(`/origins/${editingOrigin.id}`, { name })
        setOrigins((prev) => prev.map((o) => (o.id === editingOrigin.id ? { ...o, ...updated } : o)))
      } else {
        const created = await api.post<Origin>('/origins', { name })
        setOrigins((prev) => [...prev, { ...created, subOrigins: [] }])
      }
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function toggleOriginActive(origin: Origin) {
    const updated = await api.patch<Origin>(`/origins/${origin.id}`, { isActive: !origin.isActive })
    setOrigins((prev) => prev.map((o) => (o.id === origin.id ? { ...o, ...updated } : o)))
  }

  async function toggleSubOriginActive(sub: SubOrigin, parentId: string) {
    const updated = await api.patch<SubOrigin>(`/origins/${parentId}/sub-origins/${sub.id}`, { isActive: !sub.isActive })
    setOrigins((prev) => prev.map((o) =>
      o.id === parentId
        ? { ...o, subOrigins: o.subOrigins.map((s) => s.id === sub.id ? updated : s) }
        : o
    ))
  }

  async function deleteOrigin(id: string) {
    if (!confirm('Desativar esta origem? Ela será marcada como inativa.')) return
    await api.patch(`/origins/${id}`, { isActive: false })
    setOrigins((prev) => prev.filter((o) => o.id !== id))
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
          <h2 className="text-lg font-semibold">Origens e Sub-origens</h2>
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
              <Switch
                checked={origin.isActive}
                onCheckedChange={() => void toggleOriginActive(origin)}
                title={origin.isActive ? 'Ativa — clique para desativar' : 'Inativa — clique para ativar'}
              />
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
                title="Desativar origem"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {expanded.has(origin.id) && (
              <div className="border-t divide-y">
                {(origin.subOrigins?.length ?? 0) === 0 ? (
                  <div className="px-4 py-2 pl-12 text-sm text-muted-foreground italic">
                    Nenhuma sub-origem
                  </div>
                ) : (
                  origin.subOrigins.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-2 px-4 py-2 pl-12 bg-muted/30">
                      <span className="flex-1 text-sm">{sub.name}</span>
                      <Switch
                        checked={sub.isActive}
                        onCheckedChange={() => void toggleSubOriginActive(sub, origin.id)}
                      />
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => openEditSubOrigin(sub, origin.id)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
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
              placeholder={newSubOriginFor ? 'Ex: Stories, Feed, DM...' : 'Ex: Instagram, Google Ads, Indicação...'}
              autoFocus
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
