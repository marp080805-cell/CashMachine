'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Pencil, Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'

interface CustomField {
  id: string
  name: string
  slug: string
  fieldType: string
  isRequiredGlobal: boolean
  placeholder?: string
  options?: string[]
}

interface CFGroup {
  id: string
  name: string
  entityType: string
  customFields: CustomField[]
}

const FIELD_TYPES = [
  { value: 'TEXT', label: 'Texto' },
  { value: 'NUMBER', label: 'Número' },
  { value: 'DATE', label: 'Data' },
  { value: 'SELECT', label: 'Seleção única' },
  { value: 'MULTISELECT', label: 'Seleção múltipla' },
  { value: 'BOOLEAN', label: 'Sim/Não' },
  { value: 'CURRENCY', label: 'Moeda' },
  { value: 'URL', label: 'URL' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'PHONE', label: 'Telefone' },
]

const ENTITY_TYPES = [
  { value: 'opportunity', label: 'Oportunidade' },
  { value: 'contact', label: 'Contato' },
  { value: 'company', label: 'Empresa' },
]

const emptyGroupForm = { name: '', entityType: 'opportunity' }
const emptyFieldForm = {
  name: '',
  slug: '',
  type: 'TEXT',
  isRequired: false,
  placeholder: '',
  options: '',
}

export default function CamposPage() {
  const [activeTab, setActiveTab] = useState('opportunity')
  const [groups, setGroups] = useState<CFGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Group modal
  const [groupOpen, setGroupOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<CFGroup | null>(null)
  const [groupForm, setGroupForm] = useState(emptyGroupForm)
  const [savingGroup, setSavingGroup] = useState(false)

  // Field modal
  const [fieldOpen, setFieldOpen] = useState(false)
  const [editingField, setEditingField] = useState<CustomField | null>(null)
  const [fieldGroupId, setFieldGroupId] = useState<string | null>(null)
  const [fieldForm, setFieldForm] = useState(emptyFieldForm)
  const [savingField, setSavingField] = useState(false)

  async function load(entityType: string) {
    setLoading(true)
    try {
      const data = await api.get<CFGroup[]>(`/custom-fields/groups?entityType=${entityType}`)
      setGroups(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load(activeTab) }, [activeTab])

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function openCreateGroup() {
    setEditingGroup(null)
    setGroupForm({ name: '', entityType: activeTab })
    setGroupOpen(true)
  }

  function openEditGroup(group: CFGroup) {
    setEditingGroup(group)
    setGroupForm({ name: group.name, entityType: group.entityType })
    setGroupOpen(true)
  }

  async function handleSaveGroup() {
    setSavingGroup(true)
    try {
      if (editingGroup) {
        const updated = await api.patch<CFGroup>(`/custom-fields/groups/${editingGroup.id}`, { name: groupForm.name })
        setGroups((prev) => prev.map((g) => g.id === editingGroup.id ? { ...g, ...updated } : g))
      } else {
        const created = await api.post<CFGroup>('/custom-fields/groups', groupForm)
        setGroups((prev) => [...prev, { ...created, customFields: [] }])
      }
      setGroupOpen(false)
    } finally {
      setSavingGroup(false)
    }
  }

  async function handleDeleteGroup(id: string) {
    if (!confirm('Excluir este grupo e todos seus campos?')) return
    await api.delete(`/custom-fields/groups/${id}`)
    setGroups((prev) => prev.filter((g) => g.id !== id))
  }

  function openCreateField(groupId: string) {
    setEditingField(null)
    setFieldGroupId(groupId)
    setFieldForm(emptyFieldForm)
    setFieldOpen(true)
  }

  function openEditField(field: CustomField, groupId: string) {
    setEditingField(field)
    setFieldGroupId(groupId)
    setFieldForm({
      name: field.name,
      slug: field.slug,
      type: field.fieldType,
      isRequired: field.isRequiredGlobal,
      placeholder: field.placeholder ?? '',
      options: field.options ? field.options.join(', ') : '',
    })
    setFieldOpen(true)
  }

  async function handleSaveField() {
    if (!fieldGroupId) return
    setSavingField(true)
    try {
      const hasOptions = fieldForm.type === 'SELECT' || fieldForm.type === 'MULTISELECT'
      const slug = fieldForm.slug || fieldForm.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      const options = hasOptions && fieldForm.options
        ? fieldForm.options.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined
      if (editingField) {
        const payload = {
          name: fieldForm.name,
          fieldType: fieldForm.type,
          isRequiredGlobal: fieldForm.isRequired,
          placeholder: fieldForm.placeholder || undefined,
          options,
        }
        const updated = await api.patch<CustomField>(`/custom-fields/${editingField.id}`, payload)
        setGroups((prev) => prev.map((g) =>
          g.id === fieldGroupId
            ? { ...g, customFields: g.customFields.map((f) => f.id === editingField.id ? updated : f) }
            : g
        ))
      } else {
        const payload = {
          groupId: fieldGroupId,
          entityType: activeTab,
          name: fieldForm.name,
          slug,
          fieldType: fieldForm.type,
          isRequiredGlobal: fieldForm.isRequired,
          placeholder: fieldForm.placeholder || undefined,
          options,
        }
        const created = await api.post<CustomField>('/custom-fields', payload)
        setGroups((prev) => prev.map((g) =>
          g.id === fieldGroupId ? { ...g, customFields: [...g.customFields, created] } : g
        ))
      }
      setFieldOpen(false)
    } finally {
      setSavingField(false)
    }
  }

  async function handleDeleteField(fieldId: string, groupId: string) {
    if (!confirm('Excluir este campo?')) return
    await api.delete(`/custom-fields/${fieldId}`)
    setGroups((prev) => prev.map((g) =>
      g.id === groupId ? { ...g, customFields: g.customFields.filter((f) => f.id !== fieldId) } : g
    ))
  }

  const typeBadgeColor: Record<string, string> = {
    TEXT: 'bg-blue-100 text-blue-700',
    NUMBER: 'bg-purple-100 text-purple-700',
    DATE: 'bg-green-100 text-green-700',
    SELECT: 'bg-orange-100 text-orange-700',
    MULTISELECT: 'bg-orange-100 text-orange-700',
    BOOLEAN: 'bg-pink-100 text-pink-700',
    CURRENCY: 'bg-emerald-100 text-emerald-700',
    URL: 'bg-gray-100 text-gray-700',
    EMAIL: 'bg-sky-100 text-sky-700',
    PHONE: 'bg-teal-100 text-teal-700',
  }

  const hasOptions = fieldForm.type === 'SELECT' || fieldForm.type === 'MULTISELECT'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Campos Personalizados</h2>
          <p className="text-sm text-muted-foreground">Adicione campos extras às entidades do CRM</p>
        </div>
        <Button onClick={openCreateGroup} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Novo Grupo
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {ENTITY_TYPES.map((et) => (
            <TabsTrigger key={et.value} value={et.value}>{et.label}</TabsTrigger>
          ))}
        </TabsList>

        {ENTITY_TYPES.map((et) => (
          <TabsContent key={et.value} value={et.value} className="mt-4">
            {loading ? (
              <div className="text-muted-foreground text-sm">Carregando...</div>
            ) : groups.length === 0 ? (
              <div className="border rounded-lg py-8 text-center text-sm text-muted-foreground">
                Nenhum grupo de campos cadastrado
              </div>
            ) : (
              <div className="border rounded-lg divide-y">
                {groups.map((group) => (
                  <div key={group.id}>
                    <div className="flex items-center gap-2 px-4 py-3">
                      <button
                        onClick={() => toggleExpand(group.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {expanded.has(group.id)
                          ? <ChevronDown className="h-4 w-4" />
                          : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <span className="flex-1 font-medium text-sm">{group.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {group.customFields?.length ?? 0} campos
                      </span>
                      <Button
                        variant="ghost" size="sm" className="h-7 text-xs"
                        onClick={() => openCreateField(group.id)}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Campo
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => openEditGroup(group)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => void handleDeleteGroup(group.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {expanded.has(group.id) && (
                      <div className="divide-y border-t">
                        {(group.customFields ?? []).length === 0 ? (
                          <div className="px-4 py-3 pl-12 text-sm text-muted-foreground italic">
                            Nenhum campo neste grupo
                          </div>
                        ) : (
                          group.customFields.map((field) => (
                            <div key={field.id} className="flex items-center gap-3 px-4 py-2.5 pl-12 bg-muted/30">
                              <span className="flex-1 text-sm font-medium">{field.name}</span>
                              <span className="text-xs text-muted-foreground font-mono">{field.slug}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${typeBadgeColor[field.fieldType] ?? 'bg-gray-100 text-gray-700'}`}>
                                {FIELD_TYPES.find((t) => t.value === field.fieldType)?.label ?? field.fieldType}
                              </span>
                              {field.isRequiredGlobal && (
                                <Badge variant="secondary" className="text-xs">Obrigatório</Badge>
                              )}
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7"
                                onClick={() => openEditField(field, group.id)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => void handleDeleteField(field.id, group.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Group Modal */}
      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Editar Grupo' : 'Novo Grupo de Campos'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome do grupo</Label>
              <Input
                value={groupForm.name}
                onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Informações adicionais"
              />
            </div>
            {!editingGroup && (
              <div className="space-y-1.5">
                <Label>Entidade</Label>
                <Select
                  value={groupForm.entityType}
                  onValueChange={(v) => setGroupForm((f) => ({ ...f, entityType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((et) => (
                      <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSaveGroup()} disabled={!groupForm.name || savingGroup}>
              {savingGroup ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Field Modal */}
      <Dialog open={fieldOpen} onOpenChange={setFieldOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingField ? 'Editar Campo' : 'Novo Campo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  value={fieldForm.name}
                  onChange={(e) => setFieldForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Segmento"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Slug</Label>
                <Input
                  value={fieldForm.slug}
                  onChange={(e) => setFieldForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="auto-gerado"
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={fieldForm.type}
                onValueChange={(v) => setFieldForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Placeholder</Label>
              <Input
                value={fieldForm.placeholder}
                onChange={(e) => setFieldForm((f) => ({ ...f, placeholder: e.target.value }))}
                placeholder="Texto de ajuda no campo"
              />
            </div>
            {hasOptions && (
              <div className="space-y-1.5">
                <Label>Opções (separadas por vírgula)</Label>
                <Textarea
                  value={fieldForm.options}
                  onChange={(e) => setFieldForm((f) => ({ ...f, options: e.target.value }))}
                  placeholder="Opção 1, Opção 2, Opção 3"
                  rows={3}
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch
                checked={fieldForm.isRequired}
                onCheckedChange={(v) => setFieldForm((f) => ({ ...f, isRequired: v }))}
              />
              <Label>Campo obrigatório</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFieldOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSaveField()} disabled={!fieldForm.name || savingField}>
              {savingField ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
