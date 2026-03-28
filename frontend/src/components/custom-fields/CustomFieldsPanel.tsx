'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Loader2, Check, X, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { NATIVE_FIELDS } from '@/constants/native-fields'
import { useFieldConfig } from '@/hooks/useFieldConfig'

type EntityType = 'opportunity' | 'contact' | 'company' | 'lead' | 'task'

interface CFField {
  id: string
  name: string
  slug: string
  fieldType: string
  isRequiredGlobal: boolean
  placeholder?: string
  options?: string[]
  sortOrder: number
}

interface CFGroup {
  id: string
  name: string
  entityType: string
  customFields: CFField[]
}

interface FieldValue {
  customFieldId: string
  valueText?: string | null
  valueNumber?: number | null
  valueDate?: string | null
  valueJson?: unknown
}

interface Props {
  entityType: EntityType
  entityId?: string          // se fornecido, carrega e salva valores no banco (modo edição)
  values?: Record<string, unknown>   // valores controlados (para formulários novos)
  onChange?: (fieldId: string, value: unknown) => void  // callback para formulários novos
  adminMode?: boolean        // controlado externamente
  onAdminModeChange?: (v: boolean) => void
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  TEXT: 'Texto', TEXTAREA: 'Texto longo', NUMBER: 'Número', DATE: 'Data',
  DATETIME: 'Data/hora', SELECT: 'Seleção', MULTISELECT: 'Múltipla seleção',
  BOOLEAN: 'Sim/Não', CURRENCY: 'Moeda', URL: 'URL', EMAIL: 'E-mail', PHONE: 'Telefone',
}

const FIELD_TYPES_OPTIONS = Object.entries(FIELD_TYPE_LABELS)

export function CustomFieldsPanel({ entityType, entityId, values, onChange, adminMode: adminModeProp, onAdminModeChange }: Props) {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER'
  const qc = useQueryClient()
  const fieldConfig = useFieldConfig()

  const [adminModeInternal, setAdminModeInternal] = useState(false)
  const adminMode = adminModeProp !== undefined ? adminModeProp : adminModeInternal
  function setAdminMode(v: boolean | ((prev: boolean) => boolean)) {
    const next = typeof v === 'function' ? v(adminMode) : v
    if (onAdminModeChange) onAdminModeChange(next)
    else setAdminModeInternal(next)
  }

  const [addingFieldToGroup, setAddingFieldToGroup] = useState<string | null>(null)
  const [newField, setNewField] = useState({ name: '', fieldType: 'TEXT', isRequiredGlobal: false, options: '' })
  const [savingField, setSavingField] = useState(false)
  const [savingValues, setSavingValues] = useState<Record<string, boolean>>({})

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['custom-fields-groups', entityType],
    queryFn: () => api.get<CFGroup[]>(`/custom-fields/groups?entityType=${entityType}`),
  })

  const { data: savedValues = [] } = useQuery({
    queryKey: ['custom-field-values', entityType, entityId],
    queryFn: () => api.get<FieldValue[]>(`/custom-fields/values/${entityType}/${entityId}`),
    enabled: !!entityId,
  })

  const allFields = groups.flatMap((g) => g.customFields ?? [])
  if (allFields.length === 0 && !isAdmin) return null

  function getStoredValue(fieldId: string): unknown {
    if (values) return values[fieldId]
    const sv = savedValues.find((v) => v.customFieldId === fieldId)
    if (!sv) return ''
    return sv.valueText ?? sv.valueNumber ?? sv.valueDate ?? sv.valueJson ?? ''
  }

  async function handleValueChange(field: CFField, rawValue: unknown) {
    if (onChange) {
      onChange(field.id, rawValue)
      return
    }
    if (!entityId) return
    setSavingValues((prev) => ({ ...prev, [field.id]: true }))
    try {
      const payload: Record<string, unknown> = { customFieldId: field.id, entityType, entityId }
      if (['TEXT', 'TEXTAREA', 'URL', 'EMAIL', 'PHONE', 'SELECT'].includes(field.fieldType)) {
        payload.valueText = rawValue as string
      } else if (['NUMBER', 'CURRENCY'].includes(field.fieldType)) {
        payload.valueNumber = rawValue === '' ? null : Number(rawValue)
      } else if (['DATE', 'DATETIME'].includes(field.fieldType)) {
        payload.valueDate = rawValue as string || null
      } else {
        payload.valueJson = rawValue
      }
      await api.put('/custom-fields/values', payload)
      void qc.invalidateQueries({ queryKey: ['custom-field-values', entityType, entityId] })
    } catch {
      toast.error('Erro ao salvar campo')
    } finally {
      setSavingValues((prev) => ({ ...prev, [field.id]: false }))
    }
  }

  async function toggleRequired(field: CFField) {
    try {
      await api.patch(`/custom-fields/${field.id}`, { isRequiredGlobal: !field.isRequiredGlobal })
      void qc.invalidateQueries({ queryKey: ['custom-fields-groups', entityType] })
      toast.success(field.isRequiredGlobal ? 'Campo agora é opcional' : 'Campo agora é obrigatório')
    } catch {
      toast.error('Erro ao alterar campo')
    }
  }

  async function handleAddField(groupId: string) {
    if (!newField.name) { toast.error('Nome é obrigatório'); return }
    setSavingField(true)
    try {
      const slug = newField.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      const options = ['SELECT', 'MULTISELECT'].includes(newField.fieldType) && newField.options
        ? newField.options.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined
      await api.post('/custom-fields', {
        groupId, entityType, name: newField.name,
        slug: slug || `field_${Date.now()}`,
        fieldType: newField.fieldType, isRequiredGlobal: newField.isRequiredGlobal, options,
      })
      toast.success('Campo criado!')
      setAddingFieldToGroup(null)
      setNewField({ name: '', fieldType: 'TEXT', isRequiredGlobal: false, options: '' })
      void qc.invalidateQueries({ queryKey: ['custom-fields-groups', entityType] })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar campo')
    } finally {
      setSavingField(false)
    }
  }

  function renderFieldInput(field: CFField) {
    const value = getStoredValue(field.id)
    const isSaving = savingValues[field.id]

    switch (field.fieldType) {
      case 'TEXT': case 'URL': case 'EMAIL': case 'PHONE':
        return (
          <div className="relative">
            <Input defaultValue={String(value ?? '')} placeholder={field.placeholder || field.name}
              onBlur={(e) => void handleValueChange(field, e.target.value)}
              className={isSaving ? 'pr-8' : ''} />
            {isSaving && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        )
      case 'TEXTAREA':
        return <Textarea defaultValue={String(value ?? '')} placeholder={field.placeholder || field.name}
          rows={3} onBlur={(e) => void handleValueChange(field, e.target.value)} />
      case 'NUMBER': case 'CURRENCY':
        return <Input type="number" defaultValue={String(value ?? '')} placeholder={field.placeholder || '0'}
          onBlur={(e) => void handleValueChange(field, e.target.value)} />
      case 'DATE': case 'DATETIME':
        return <Input type={field.fieldType === 'DATE' ? 'date' : 'datetime-local'}
          defaultValue={String(value ?? '')} onChange={(e) => void handleValueChange(field, e.target.value)} />
      case 'SELECT':
        return (
          <Select defaultValue={String(value ?? '')} onValueChange={(v) => void handleValueChange(field, v)}>
            <SelectTrigger><SelectValue placeholder={`Selecionar ${field.name}...`} /></SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        )
      case 'BOOLEAN':
        return (
          <div className="flex items-center gap-2 h-9">
            <Switch checked={!!value} onCheckedChange={(v) => void handleValueChange(field, v)} />
            <span className="text-sm text-muted-foreground">{value ? 'Sim' : 'Não'}</span>
          </div>
        )
      default:
        return <Input defaultValue={String(value ?? '')} placeholder={field.placeholder || field.name}
          onBlur={(e) => void handleValueChange(field, e.target.value)} />
    }
  }

  if (isLoading) return <div className="text-sm text-muted-foreground py-2">Carregando campos...</div>
  if (allFields.length === 0 && !isAdmin) return null

  return (
    <>
      {/* Admin toggle — shown when there are fields or groups to manage */}
      {isAdmin && (groups.length > 0 || allFields.length > 0) && (
        <div className="col-span-full flex justify-end mb-1">
          <Button
            type="button"
            variant={adminMode ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setAdminMode((v) => !v)}
          >
            <Settings2 className="h-3.5 w-3.5" />
            {adminMode ? 'Sair da personalização' : 'Personalizar campos'}
          </Button>
        </div>
      )}

      {/* Native fields config — admin mode only */}
      {adminMode && (NATIVE_FIELDS[entityType] ?? []).length > 0 && (
        <div className="col-span-full space-y-3 mb-4">
          <div className="border-b pb-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Campos do formulário
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Defina quais campos são obrigatórios</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(NATIVE_FIELDS[entityType] ?? []).map((field) => (
              <div key={field.slug} className="flex items-center justify-between rounded-md border px-3 py-2 bg-muted/30">
                <span className="text-sm font-medium">{field.label}</span>
                <div className="flex items-center gap-2">
                  {fieldConfig.isRequired(entityType, field.slug, field.defaultRequired)
                    ? <span className="text-xs text-red-500 font-medium">Obrigatório</span>
                    : <span className="text-xs text-muted-foreground">Opcional</span>
                  }
                  <Switch
                    checked={fieldConfig.isRequired(entityType, field.slug, field.defaultRequired)}
                    onCheckedChange={(v) => fieldConfig.setRequired(entityType, field.slug, v)}
                    disabled={fieldConfig.isUpdating}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {groups.map((group) => (
        <div key={group.id}>
          {((group.customFields ?? []).length > 0 || adminMode) && (
            <div className="col-span-full">
              {/* Group header: subtle label + optional add-field button */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {group.name}
                </h3>
                {adminMode && (
                  <Button
                    type="button"
                    variant="ghost" size="sm" className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setAddingFieldToGroup(addingFieldToGroup === group.id ? null : group.id)}
                  >
                    <Plus className="h-3 w-3" /> Novo campo
                  </Button>
                )}
              </div>

              {/* Fields grid — same style as rest of form */}
              <div className="grid grid-cols-2 gap-3">
                {(group.customFields ?? []).map((field) => (
                  <div key={field.id} className={`space-y-1.5 ${field.fieldType === 'TEXTAREA' ? 'col-span-2' : ''}`}>
                    <div className="flex items-center gap-2">
                      <Label>
                        {field.name}
                        {field.isRequiredGlobal && <span className="text-red-500 ml-0.5">*</span>}
                      </Label>
                      {adminMode && (
                        <div className="ml-auto flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">Obrigatório</span>
                          <Switch
                            checked={field.isRequiredGlobal}
                            onCheckedChange={() => void toggleRequired(field)}
                            className="h-4 w-7 scale-75"
                          />
                        </div>
                      )}
                    </div>
                    {renderFieldInput(field)}
                  </div>
                ))}
              </div>

              {/* Inline add-field form */}
              {adminMode && addingFieldToGroup === group.id && (
                <div className="mt-3 rounded-lg border bg-muted/20 p-3 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">Novo campo em &quot;{group.name}&quot;</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Nome do campo</Label>
                      <Input value={newField.name} onChange={(e) => setNewField((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Ex: Segmento, Cargo..." className="h-8 text-sm" autoFocus />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo</Label>
                      <Select value={newField.fieldType} onValueChange={(v) => setNewField((f) => ({ ...f, fieldType: v }))}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPES_OPTIONS.map(([v, l]) => <SelectItem key={v} value={v} className="text-sm">{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {['SELECT', 'MULTISELECT'].includes(newField.fieldType) && (
                    <div className="space-y-1">
                      <Label className="text-xs">Opções (separadas por vírgula)</Label>
                      <Input value={newField.options} onChange={(e) => setNewField((f) => ({ ...f, options: e.target.value }))}
                        placeholder="Opção 1, Opção 2" className="h-8 text-sm" />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Switch checked={newField.isRequiredGlobal}
                        onCheckedChange={(v) => setNewField((f) => ({ ...f, isRequiredGlobal: v }))}
                        className="h-4 w-7 scale-75" />
                      Obrigatório por padrão
                    </label>
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs"
                        onClick={() => { setAddingFieldToGroup(null); setNewField({ name: '', fieldType: 'TEXT', isRequiredGlobal: false, options: '' }) }}>
                        <X className="h-3 w-3 mr-1" /> Cancelar
                      </Button>
                      <Button type="button" size="sm" className="h-7 text-xs"
                        onClick={() => void handleAddField(group.id)}
                        disabled={savingField || !newField.name}>
                        {savingField ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                        Criar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {groups.length === 0 && isAdmin && (
        <div className="col-span-full text-center py-4 text-xs text-muted-foreground border border-dashed rounded-lg">
          Nenhum grupo configurado. Vá em <strong>Configurações → Campos</strong> para criar grupos.
        </div>
      )}
    </>
  )
}
