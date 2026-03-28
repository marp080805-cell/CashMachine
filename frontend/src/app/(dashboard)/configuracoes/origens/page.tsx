'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Pencil, Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'

interface OriginNode {
  id: string
  name: string
  isActive: boolean
  parentId: string | null
  children: OriginNode[]
}

type ModalMode = 'create-root' | 'create-child' | 'edit'

function OriginTreeNode({
  node,
  depth,
  expanded,
  onToggle,
  onEdit,
  onCreateChild,
  onToggleActive,
}: {
  node: OriginNode
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  onEdit: (node: OriginNode) => void
  onCreateChild: (parentId: string) => void
  onToggleActive: (node: OriginNode) => void
}) {
  const isExpanded = expanded.has(node.id)
  const hasChildren = node.children.length > 0
  const indent = depth * 20

  return (
    <div>
      <div
        className="flex items-center gap-2 px-4 py-2.5 hover:bg-muted/20"
        style={{ paddingLeft: `${16 + indent}px` }}
      >
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          className="text-muted-foreground hover:text-foreground w-5 flex-shrink-0"
        >
          {hasChildren
            ? isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            : <span className="h-4 w-4 block" />}
        </button>
        <span className="flex-1 text-sm font-medium">{node.name}</span>
        {hasChildren && (
          <span className="text-xs text-muted-foreground mr-1">{node.children.length} sub</span>
        )}
        <Switch
          checked={node.isActive}
          onCheckedChange={() => onToggleActive(node)}
        />
        <Button
          variant="ghost" size="sm" className="h-7 text-xs px-2"
          onClick={() => onCreateChild(node.id)}
          title="Adicionar sub-origem"
        >
          <Plus className="h-3 w-3 mr-1" /> Sub
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(node)}>
          <Pencil className="h-3 w-3" />
        </Button>
      </div>
      {isExpanded && hasChildren && (
        <div className="border-t border-border/50">
          {node.children.map((child) => (
            <OriginTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onEdit={onEdit}
              onCreateChild={onCreateChild}
              onToggleActive={onToggleActive}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function updateNodeInTree(nodes: OriginNode[], id: string, updater: (n: OriginNode) => OriginNode): OriginNode[] {
  return nodes.map((n) => {
    if (n.id === id) return updater(n)
    if (n.children.length > 0) return { ...n, children: updateNodeInTree(n.children, id, updater) }
    return n
  })
}

function addChildToTree(nodes: OriginNode[], parentId: string, child: OriginNode): OriginNode[] {
  return nodes.map((n) => {
    if (n.id === parentId) return { ...n, children: [...n.children, child] }
    if (n.children.length > 0) return { ...n, children: addChildToTree(n.children, parentId, child) }
    return n
  })
}

export default function OrigensPage() {
  const [origins, setOrigins] = useState<OriginNode[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<ModalMode>('create-root')
  const [editingNode, setEditingNode] = useState<OriginNode | null>(null)
  const [parentId, setParentId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const data = await api.get<OriginNode[]>('/origins')
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

  function openCreateRoot() {
    setMode('create-root')
    setEditingNode(null)
    setParentId(null)
    setName('')
    setOpen(true)
  }

  function openCreateChild(pid: string) {
    setMode('create-child')
    setEditingNode(null)
    setParentId(pid)
    setName('')
    setOpen(true)
    // Auto-expand parent
    setExpanded((prev) => new Set(Array.from(prev).concat(pid)))
  }

  function openEdit(node: OriginNode) {
    setMode('edit')
    setEditingNode(node)
    setParentId(null)
    setName(node.name)
    setOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (mode === 'edit' && editingNode) {
        const updated = await api.patch<OriginNode>(`/origins/${editingNode.id}`, { name })
        setOrigins((prev) => updateNodeInTree(prev, editingNode.id, (n) => ({ ...n, name: updated.name })))
      } else if (mode === 'create-child' && parentId) {
        const created = await api.post<OriginNode>('/origins', { name, parentId })
        const newNode: OriginNode = { ...created, children: [] }
        setOrigins((prev) => addChildToTree(prev, parentId, newNode))
      } else {
        const created = await api.post<OriginNode>('/origins', { name })
        setOrigins((prev) => [...prev, { ...created, children: [] }])
      }
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(node: OriginNode) {
    const updated = await api.patch<OriginNode>(`/origins/${node.id}`, { isActive: !node.isActive })
    setOrigins((prev) => updateNodeInTree(prev, node.id, (n) => ({ ...n, isActive: updated.isActive })))
  }

  const modalTitle = mode === 'edit'
    ? 'Editar Origem'
    : mode === 'create-child'
    ? 'Nova Sub-origem'
    : 'Nova Origem'

  if (loading) return <div className="text-muted-foreground text-sm">Carregando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Origens e Canais</h2>
          <p className="text-sm text-muted-foreground">
            Estrutura de canais de captação com profundidade ilimitada (ex: Mídia Paga → Meta Ads → Campanha)
          </p>
        </div>
        <Button onClick={openCreateRoot} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nova Origem
        </Button>
      </div>

      <div className="border rounded-lg divide-y">
        {origins.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma origem cadastrada
          </div>
        )}
        {origins.map((node) => (
          <OriginTreeNode
            key={node.id}
            node={node}
            depth={0}
            expanded={expanded}
            onToggle={toggleExpand}
            onEdit={openEdit}
            onCreateChild={openCreateChild}
            onToggleActive={handleToggleActive}
          />
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
              placeholder={
                mode === 'create-child'
                  ? 'Ex: Meta Ads, Google Search, Campanha...'
                  : 'Ex: Mídia Paga, Orgânico, Indicação...'
              }
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && name) void handleSave() }}
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
