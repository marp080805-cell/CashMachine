'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { Task, User, Contact } from '@/types'
import type { Opportunity } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  CheckSquare, Phone, Mail, Users, Calendar, FileText,
  Plus, Loader2, CheckCircle2, Circle, Filter, List, Columns,
  MoreVertical, Pencil, Clock, Copy, Trash2, X, ExternalLink,
  AlertCircle, RefreshCw, Settings2,
} from 'lucide-react'
import { cn, formatDateTime, formatDate, getInitials } from '@/lib/utils'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { CustomFieldsPanel } from '@/components/custom-fields/CustomFieldsPanel'
import { useAuthStore } from '@/stores/authStore'
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns'

// ── Task type maps ──

const taskTypeIcons: Record<string, React.ElementType> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Calendar,
  VISIT: Calendar,
  FIRST_CONTACT: Phone,
  FOLLOW_UP: Clock,
  QUALIFY: CheckSquare,
  SCHEDULE_MEETING: Calendar,
  SEND_PROPOSAL: FileText,
  FOLLOW_UP_PROPOSAL: FileText,
  CONFIRM_PRESENCE: CheckSquare,
  PREPARE_BRIEFING: FileText,
  REMINDER: Clock,
  RESCUE_CONTACT: Phone,
  CUSTOM: FileText,
}

const taskTypeLabels: Record<string, string> = {
  CALL: 'Ligação',
  EMAIL: 'Email',
  MEETING: 'Reunião',
  VISIT: 'Visita',
  FIRST_CONTACT: 'Primeiro Contato',
  FOLLOW_UP: 'Follow-up',
  QUALIFY: 'Qualificação',
  SCHEDULE_MEETING: 'Agendar Reunião',
  SEND_PROPOSAL: 'Enviar Proposta',
  FOLLOW_UP_PROPOSAL: 'Follow-up Proposta',
  CONFIRM_PRESENCE: 'Confirmar Presença',
  PREPARE_BRIEFING: 'Preparar Briefing',
  REMINDER: 'Lembrete',
  RESCUE_CONTACT: 'Resgatar Contato',
  CUSTOM: 'Outro',
}

const priorityLabels: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

const priorityColors: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700 border-gray-200',
  MEDIUM: 'bg-blue-100 text-blue-700 border-blue-200',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
  URGENT: 'bg-red-100 text-red-700 border-red-200',
}

const priorityBorderColors: Record<string, string> = {
  LOW: 'border-l-gray-300',
  MEDIUM: 'border-l-blue-400',
  HIGH: 'border-l-orange-400',
  URGENT: 'border-l-red-500',
}

const statusLabels: Record<string, string> = {
  PENDING: 'A Fazer',
  IN_PROGRESS: 'Em Andamento',
  COMPLETED: 'Concluída',
  OVERDUE: 'Atrasada',
  SKIPPED: 'Ignorada',
}

// ── Due date display helper ──

function getDueDateDisplay(dueDate: string | null, status: string): { label: string; className: string } {
  if (!dueDate) return { label: 'Sem prazo', className: 'text-muted-foreground' }
  const due = new Date(dueDate)
  const now = new Date()
  const isCompleted = status === 'COMPLETED'

  if (isCompleted) return { label: formatDateTime(dueDate), className: 'text-muted-foreground' }

  if (due < now) return { label: formatDateTime(dueDate), className: 'text-red-600 font-medium' }

  const today = new Date()
  today.setHours(23, 59, 59, 999)
  if (due <= today) return { label: formatDateTime(dueDate), className: 'text-green-600 font-medium' }

  return { label: formatDateTime(dueDate), className: 'text-muted-foreground' }
}

// ── Autocomplete hook ──

interface AutocompleteProps {
  placeholder: string
  searchFn: (term: string) => Promise<{ id: string; label: string; sub?: string }[]>
  onSelect: (id: string, label: string) => void
  selectedLabel?: string
  onClear: () => void
}

function Autocomplete({ placeholder, searchFn, onSelect, selectedLabel, onClear }: AutocompleteProps) {
  const [inputValue, setInputValue] = useState('')
  const [results, setResults] = useState<{ id: string; label: string; sub?: string }[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = useCallback((term: string) => {
    setInputValue(term)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!term.trim()) { setResults([]); setOpen(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await searchFn(term)
        setResults(r)
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [searchFn])

  if (selectedLabel) {
    return (
      <div className="flex items-center gap-2 rounded border px-3 py-2 bg-primary/5 text-sm">
        <span className="flex-1 font-medium">{selectedLabel}</span>
        <button type="button" onClick={() => { onClear(); setInputValue('') }}>
          <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Input
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover shadow-md divide-y max-h-40 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
              onMouseDown={() => { onSelect(r.id, r.label); setInputValue(''); setOpen(false) }}
            >
              <span className="font-medium">{r.label}</span>
              {r.sub && <span className="text-muted-foreground ml-2 text-xs">— {r.sub}</span>}
            </button>
          ))}
        </div>
      )}
      {open && results.length === 0 && !loading && inputValue.trim() && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover shadow-md px-3 py-2 text-sm text-muted-foreground">
          Nenhum resultado encontrado
        </div>
      )}
    </div>
  )
}

// ── Task Form (shared by create/edit) ──

interface TaskFormData {
  title: string
  type: string
  priority: string
  dueDate: string
  assignedToId: string
  opportunityId: string
  opportunityLabel: string
  contactId: string
  contactLabel: string
  leadId: string
  leadLabel: string
  companyId: string
  companyLabel: string
  description: string
}

const defaultTaskForm: TaskFormData = {
  title: '',
  type: 'CALL',
  priority: 'MEDIUM',
  dueDate: '',
  assignedToId: '',
  opportunityId: '',
  opportunityLabel: '',
  contactId: '',
  contactLabel: '',
  leadId: '',
  leadLabel: '',
  companyId: '',
  companyLabel: '',
  description: '',
}

interface TaskFormModalProps {
  open: boolean
  onClose: () => void
  initialData?: Partial<TaskFormData>
  taskId?: string
  users: User[]
  onSuccess: () => void
}

function TaskFormModal({ open, onClose, initialData, taskId, users, onSuccess }: TaskFormModalProps) {
  const [form, setForm] = useState<TaskFormData>({ ...defaultTaskForm, ...initialData })
  const [cfValues, setCfValues] = useState<Record<string, unknown>>({})
  const [cfAdminMode, setCfAdminMode] = useState(false)
  const { user } = useAuth()
  const authUser = useAuthStore((s) => s.user)
  const isTaskAdmin = authUser?.role === 'ADMIN' || authUser?.role === 'MANAGER'
  const queryClient = useQueryClient()

  useEffect(() => {
    if (open) {
      setForm({ ...defaultTaskForm, ...initialData })
      if (!taskId) { setCfValues({}); setCfAdminMode(false) }
    }
  }, [open, initialData, taskId])

  const isEdit = !!taskId

  const mutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const task = isEdit
        ? await api.put<Task>(`/tasks/${taskId}`, body)
        : await api.post<Task>('/tasks', body)
      // Save custom field values for new tasks
      if (!isEdit) {
        const cfEntries = Object.entries(cfValues).filter(([, v]) => v !== '' && v !== null && v !== undefined)
        if (cfEntries.length > 0) {
          await Promise.allSettled(
            cfEntries.map(([fieldId, value]) =>
              api.put('/custom-fields/values', { customFieldId: fieldId, entityType: 'task', entityId: task.id, valueText: typeof value === 'string' ? value : undefined, valueJson: typeof value !== 'string' ? value : undefined })
            )
          )
        }
      }
      return task
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Tarefa atualizada!' : 'Tarefa criada!')
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      onSuccess()
      onClose()
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e?.message ?? (isEdit ? 'Erro ao atualizar tarefa' : 'Erro ao criar tarefa'))
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Título é obrigatório'); return }
    if (!form.dueDate) { toast.error('Data de vencimento é obrigatória'); return }

    const assignId = form.assignedToId || user?.id
    if (!assignId) { toast.error('Responsável não identificado'); return }

    mutation.mutate({
      title: form.title,
      type: form.type,
      priority: form.priority,
      dueDate: new Date(form.dueDate).toISOString(),
      assignedToId: assignId,
      description: form.description || undefined,
      ...(form.opportunityId && { opportunityId: form.opportunityId }),
      ...(form.contactId && { contactId: form.contactId }),
      ...(form.companyId && { companyId: form.companyId }),
    })
  }

  const searchOpportunities = useCallback(async (term: string) => {
    const data = await api.get<{ data: Opportunity[] }>(`/opportunities?search=${encodeURIComponent(term)}&limit=10`)
    return (data.data ?? []).map((o) => ({ id: o.id, label: o.title }))
  }, [])

  const searchContacts = useCallback(async (term: string) => {
    const data = await api.get<{ data: Contact[] }>(`/contacts?search=${encodeURIComponent(term)}&limit=10`)
    return (data.data ?? []).map((c) => ({ id: c.id, label: c.name, sub: c.email ?? undefined }))
  }, [])

  const searchLeads = useCallback(async (term: string) => {
    const res = await api.get<{ data: Array<{ id: string; contact: { name: string } }> }>(
      `/leads?search=${encodeURIComponent(term)}&limit=8`
    )
    return (res?.data ?? []).map((l) => ({ id: l.id, label: l.contact?.name ?? l.id }))
  }, [])

  const searchCompanies = useCallback(async (term: string) => {
    const data = await api.get<{ data: Array<{ id: string; name: string }> }>(`/companies?search=${encodeURIComponent(term)}&limit=10`)
    return (data.data ?? []).map((c) => ({ id: c.id, label: c.name }))
  }, [])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Título <span className="text-red-500">*</span></Label>
            <Input
              placeholder="Ex: Ligar para o cliente"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(taskTypeLabels).map(([val, lbl]) => (
                    <SelectItem key={val} value={val}>{lbl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityLabels).map(([val, lbl]) => (
                    <SelectItem key={val} value={val}>{lbl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Vencimento <span className="text-red-500">*</span></Label>
            <Input
              type="datetime-local"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </div>
          {users.length > 0 && (
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select value={form.assignedToId} onValueChange={(v) => setForm((f) => ({ ...f, assignedToId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar responsável..." /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Vincular a oportunidade</Label>
            <Autocomplete
              placeholder="Buscar oportunidade..."
              searchFn={searchOpportunities}
              selectedLabel={form.opportunityLabel || undefined}
              onSelect={(id, label) => setForm((f) => ({ ...f, opportunityId: id, opportunityLabel: label }))}
              onClear={() => setForm((f) => ({ ...f, opportunityId: '', opportunityLabel: '' }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Vincular a contato</Label>
            <Autocomplete
              placeholder="Buscar contato..."
              searchFn={searchContacts}
              selectedLabel={form.contactLabel || undefined}
              onSelect={(id, label) => setForm((f) => ({ ...f, contactId: id, contactLabel: label }))}
              onClear={() => setForm((f) => ({ ...f, contactId: '', contactLabel: '' }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Vincular a lead</Label>
            <Autocomplete
              placeholder="Buscar lead..."
              searchFn={searchLeads}
              selectedLabel={form.leadLabel || undefined}
              onSelect={(id, label) => {
                api.get<{ id: string; contact: { id: string; name: string } }>(`/leads/${id}`)
                  .then((lead) => {
                    if (lead?.contact) {
                      setForm((f) => ({
                        ...f,
                        leadId: id,
                        leadLabel: label,
                        contactId: lead.contact.id,
                        contactLabel: lead.contact.name,
                      }))
                    } else {
                      setForm((f) => ({ ...f, leadId: id, leadLabel: label }))
                    }
                  })
                  .catch(() => setForm((f) => ({ ...f, leadId: id, leadLabel: label })))
              }}
              onClear={() => setForm((f) => ({ ...f, leadId: '', leadLabel: '' }))}
            />
            {form.leadId && form.contactId && (
              <p className="text-xs text-muted-foreground">Contato preenchido automaticamente do lead</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Vincular a empresa</Label>
            <Autocomplete
              placeholder="Buscar empresa..."
              searchFn={searchCompanies}
              selectedLabel={form.companyLabel || undefined}
              onSelect={(id, label) => setForm((f) => ({ ...f, companyId: id, companyLabel: label }))}
              onClear={() => setForm((f) => ({ ...f, companyId: '', companyLabel: '' }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              rows={3}
              placeholder="Descrição opcional..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="resize-none"
            />
          </div>
          {/* Campos personalizados */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Campos Personalizados</h3>
              {isTaskAdmin && (
                <Button
                  type="button"
                  variant={cfAdminMode ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => setCfAdminMode((v) => !v)}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  {cfAdminMode ? 'Sair da edição' : 'Personalizar campos'}
                </Button>
              )}
            </div>
            <CustomFieldsPanel
              entityType="task"
              entityId={isEdit ? taskId : undefined}
              values={isEdit ? undefined : cfValues}
              onChange={isEdit ? undefined : (id, v) => setCfValues((p) => ({ ...p, [id]: v }))}
              adminMode={cfAdminMode}
              onAdminModeChange={setCfAdminMode}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={mutation.isPending}>
              {mutation.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{isEdit ? 'Salvando...' : 'Criando...'}</>
                : isEdit ? 'Salvar alterações' : 'Criar Tarefa'
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Complete Task Modal ──

interface CompleteModalProps {
  taskId: string | null
  onClose: () => void
  onSuccess: () => void
}

function CompleteModal({ taskId, onClose, onSuccess }: CompleteModalProps) {
  const [notes, setNotes] = useState('')
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!taskId) setNotes('')
  }, [taskId])

  const mutation = useMutation({
    mutationFn: ({ id, completionNotes }: { id: string; completionNotes: string }) =>
      api.post<Task>(`/tasks/${id}/complete`, { completionNotes }),
    onSuccess: () => {
      toast.success('Tarefa concluída!')
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setNotes('')
      onSuccess()
      onClose()
    },
    onError: () => toast.error('Erro ao concluir tarefa'),
  })

  return (
    <Dialog open={!!taskId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Concluir Tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Adicione uma nota sobre a conclusão <span className="text-red-500">*</span></Label>
            <Textarea
              rows={4}
              placeholder="Descreva o que foi realizado..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button
              className="flex-1"
              disabled={!notes.trim() || mutation.isPending}
              onClick={() => { if (taskId) mutation.mutate({ id: taskId, completionNotes: notes }) }}
            >
              {mutation.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                : 'Confirmar conclusão'
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Task Detail Sheet ──

interface TaskDetailSheetProps {
  task: Task | null
  onClose: () => void
  onEdit: (task: Task) => void
  onComplete: (id: string) => void
  onDelete: (id: string) => void
}

function TaskDetailSheet({ task, onClose, onEdit, onComplete, onDelete }: TaskDetailSheetProps) {
  const Icon = task ? (taskTypeIcons[task.type] ?? FileText) : FileText
  const [cfAdminMode, setCfAdminMode] = useState(false)
  const authUser = useAuthStore((s) => s.user)
  const isAdmin = authUser?.role === 'ADMIN' || authUser?.role === 'MANAGER'
  const { data: activities } = useQuery({
    queryKey: ['activities', 'task', task?.id],
    queryFn: () => api.get<{ data: Array<{ id: string; type: string; description: string; createdAt: string; user: { name: string } }> }>(`/activities?taskId=${task!.id}&limit=10`),
    enabled: !!task?.id,
  })

  if (!task) return null

  const dueDisplay = getDueDateDisplay(task.dueDate, task.status)
  const isCompleted = task.status === 'COMPLETED'

  return (
    <Sheet open={!!task} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[480px] max-w-full flex flex-col p-0 overflow-y-auto">
        <SheetHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className={cn('text-base leading-tight', isCompleted && 'line-through text-muted-foreground')}>
                {task.title}
              </SheetTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className="text-xs">{taskTypeLabels[task.type] ?? task.type}</Badge>
                <span className={cn('text-xs px-1.5 py-0.5 rounded border', priorityColors[task.priority] ?? 'bg-gray-100 text-gray-600')}>
                  {priorityLabels[task.priority] ?? task.priority}
                </span>
                <span className={cn('text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground')}>
                  {statusLabels[task.status] ?? task.status}
                </span>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 px-6 py-4 space-y-5">
          {/* Due date */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Vencimento</p>
            <p className={cn('text-sm font-medium', dueDisplay.className)}>{dueDisplay.label}</p>
          </div>

          {/* Assigned to */}
          {task.assignedTo && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Responsável</p>
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {getInitials(task.assignedTo.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{task.assignedTo.name}</span>
              </div>
            </div>
          )}

          {/* Description */}
          {task.description && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Descrição</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Linked to */}
          {(task.opportunity || task.contact) && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Vinculada a</p>
              <div className="space-y-2">
                {task.opportunity && (
                  <Link href={`/oportunidades/${task.opportunity.id}`} className="block">
                    <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
                        <CheckSquare className="h-4 w-4 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.opportunity.title}</p>
                        <p className="text-xs text-muted-foreground">Oportunidade</p>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </div>
                  </Link>
                )}
                {task.contact && (
                  <Link href={`/contatos/${task.contact.id}`} className="block">
                    <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                        <Users className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.contact.name}</p>
                        <p className="text-xs text-muted-foreground">Contato</p>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </div>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Completion notes */}
          {task.completionNotes && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Notas de conclusão</p>
              <p className="text-sm text-foreground whitespace-pre-wrap bg-green-50 rounded-lg p-3 border border-green-100">{task.completionNotes}</p>
            </div>
          )}

          {/* Custom fields */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground font-medium">Campos Personalizados</p>
              {isAdmin && (
                <Button
                  variant={cfAdminMode ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 text-xs gap-1"
                  onClick={() => setCfAdminMode((v) => !v)}
                >
                  <Settings2 className="h-3 w-3" />
                  {cfAdminMode ? 'Sair da edição' : 'Personalizar'}
                </Button>
              )}
            </div>
            <CustomFieldsPanel entityType="task" entityId={task.id} adminMode={cfAdminMode} onAdminModeChange={setCfAdminMode} />
          </div>

          {/* Recent activities */}
          {(activities?.data?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Atividades recentes</p>
              <div className="space-y-2">
                {(activities?.data ?? []).map((a) => (
                  <div key={a.id} className="flex items-start gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                    <div>
                      <p className="text-sm text-foreground">{a.description}</p>
                      <p className="text-xs text-muted-foreground">{a.user.name} · {formatDate(a.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t flex gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => { onClose(); onEdit(task) }}
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Editar
          </Button>
          {!isCompleted && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-green-600 border-green-200 hover:bg-green-50"
              onClick={() => { onClose(); onComplete(task.id) }}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              Concluir
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="text-red-500 border-red-200 hover:bg-red-50"
            onClick={() => { onClose(); onDelete(task.id) }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Task Actions Menu ──

interface TaskActionsProps {
  task: Task
  onEdit: () => void
  onComplete: () => void
  onDelete: () => void
  onDuplicate: () => void
}

function TaskActionsMenu({ task, onEdit, onComplete, onDelete, onDuplicate }: TaskActionsProps) {
  const isCompleted = task.status === 'COMPLETED'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" />Editar
        </DropdownMenuItem>
        {!isCompleted && (
          <DropdownMenuItem onClick={onComplete}>
            <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />Concluir
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy className="h-4 w-4 mr-2" />Duplicar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-600" onClick={onDelete}>
          <Trash2 className="h-4 w-4 mr-2" />Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── List Task Row ──

interface TaskRowProps {
  task: Task
  onComplete: (id: string) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onDuplicate: (task: Task) => void
  onOpenDetail: (task: Task) => void
}

function TaskRow({ task, onComplete, onEdit, onDelete, onDuplicate, onOpenDetail }: TaskRowProps) {
  const isCompleted = task.status === 'COMPLETED'
  const Icon = taskTypeIcons[task.type] ?? FileText
  const dueDisplay = getDueDateDisplay(task.dueDate, task.status)

  return (
    <div className={cn(
      'group flex items-center gap-3 rounded-lg border bg-card p-3.5 hover:shadow-sm transition-shadow',
      isCompleted && 'opacity-60',
      (task.status === 'OVERDUE' || (!isCompleted && task.dueDate && new Date(task.dueDate) < new Date())) && 'border-red-200 bg-red-50/30',
    )}>
      {/* Checkbox */}
      <button
        onClick={() => !isCompleted && onComplete(task.id)}
        disabled={isCompleted}
        className="shrink-0"
        title={isCompleted ? 'Concluída' : 'Marcar como concluída'}
      >
        {isCompleted
          ? <CheckCircle2 className="h-5 w-5 text-green-500" />
          : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
        }
      </button>

      {/* Type icon */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <button
          className="text-sm font-medium text-left hover:text-primary transition-colors"
          onClick={() => onOpenDetail(task)}
        >
          <span className={cn(isCompleted && 'line-through text-muted-foreground')}>{task.title}</span>
        </button>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {task.opportunity && (
            <Link
              href={`/oportunidades/${task.opportunity.id}`}
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <CheckSquare className="h-3 w-3" />
              {task.opportunity.title}
            </Link>
          )}
          {task.opportunity && task.contact && <span className="text-xs text-muted-foreground">·</span>}
          {task.contact && (
            <Link
              href={`/contatos/${task.contact.id}`}
              className="text-xs text-muted-foreground hover:text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {task.contact.name}
            </Link>
          )}
        </div>
      </div>

      {/* Priority badge */}
      <span className={cn('hidden sm:inline-flex text-xs px-1.5 py-0.5 rounded border shrink-0', priorityColors[task.priority] ?? 'bg-gray-100 text-gray-600')}>
        {priorityLabels[task.priority] ?? task.priority}
      </span>

      {/* Due date */}
      <span className={cn('hidden md:block text-xs shrink-0 tabular-nums', dueDisplay.className)}>
        {dueDisplay.label}
      </span>

      {/* Assigned avatar */}
      {task.assignedTo && (
        <Avatar className="h-7 w-7 shrink-0 hidden sm:flex" title={task.assignedTo.name}>
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {getInitials(task.assignedTo.name)}
          </AvatarFallback>
        </Avatar>
      )}

      {/* Actions */}
      <TaskActionsMenu
        task={task}
        onEdit={() => onEdit(task)}
        onComplete={() => onComplete(task.id)}
        onDelete={() => onDelete(task.id)}
        onDuplicate={() => onDuplicate(task)}
      />
    </div>
  )
}

// ── Kanban Column ──

const kanbanColumns: { key: string; label: string; statuses: string[]; color: string }[] = [
  { key: 'todo', label: 'A Fazer', statuses: ['PENDING'], color: 'bg-gray-50 border-gray-200' },
  { key: 'inprogress', label: 'Em Andamento', statuses: ['IN_PROGRESS'], color: 'bg-blue-50 border-blue-200' },
  { key: 'completed', label: 'Concluídas', statuses: ['COMPLETED'], color: 'bg-green-50 border-green-200' },
  { key: 'overdue', label: 'Atrasadas', statuses: ['OVERDUE'], color: 'bg-red-50 border-red-200' },
]

interface KanbanCardProps {
  task: Task
  onStatusChange: (id: string, status: string) => void
  onComplete: (id: string) => void
  onEdit: (task: Task) => void
  onOpenDetail: (task: Task) => void
}

function KanbanCard({ task, onStatusChange, onComplete, onEdit, onOpenDetail }: KanbanCardProps) {
  const Icon = taskTypeIcons[task.type] ?? FileText
  const dueDisplay = getDueDateDisplay(task.dueDate, task.status)
  const isCompleted = task.status === 'COMPLETED'

  return (
    <div className={cn(
      'rounded-lg border bg-card p-3 shadow-sm hover:shadow-md transition-shadow cursor-default border-l-4',
      priorityBorderColors[task.priority] ?? 'border-l-gray-300',
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <button
          className="text-sm font-medium text-left hover:text-primary transition-colors flex-1 min-w-0"
          onClick={() => onOpenDetail(task)}
        >
          <span className={cn('leading-tight', isCompleted && 'line-through text-muted-foreground')}>
            {task.title}
          </span>
        </button>
        <div className="shrink-0 flex items-center gap-1">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
            <Icon className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Type + Priority badges */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <Badge variant="outline" className="text-xs h-5 px-1.5 py-0">
          {taskTypeLabels[task.type] ?? task.type}
        </Badge>
        <span className={cn('text-xs px-1.5 py-0.5 rounded border', priorityColors[task.priority] ?? 'bg-gray-100 text-gray-600')}>
          {priorityLabels[task.priority] ?? task.priority}
        </span>
      </div>

      {/* Opportunity link */}
      {task.opportunity && (
        <Link
          href={`/oportunidades/${task.opportunity.id}`}
          className="flex items-center gap-1 text-xs text-primary hover:underline mb-1.5"
        >
          <CheckSquare className="h-3 w-3 shrink-0" />
          <span className="truncate">{task.opportunity.title}</span>
        </Link>
      )}

      {/* Footer: due date + assignee */}
      <div className="flex items-center justify-between mt-2">
        <span className={cn('text-xs', dueDisplay.className)}>{dueDisplay.label}</span>
        {task.assignedTo && (
          <Avatar className="h-6 w-6" title={task.assignedTo.name}>
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {getInitials(task.assignedTo.name)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Status change select */}
      <div className="mt-2 pt-2 border-t">
        <Select
          value={task.status}
          onValueChange={(v) => {
            if (v === 'COMPLETED') { onComplete(task.id) }
            else { onStatusChange(task.id, v) }
          }}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(statusLabels).map(([val, lbl]) => (
              <SelectItem key={val} value={val} className="text-xs">{lbl}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Edit button */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full h-7 mt-1 text-xs text-muted-foreground"
        onClick={() => onEdit(task)}
      >
        <Pencil className="h-3 w-3 mr-1" />Editar
      </Button>
    </div>
  )
}

interface KanbanViewProps {
  tasks: Task[]
  onStatusChange: (id: string, status: string) => void
  onComplete: (id: string) => void
  onEdit: (task: Task) => void
  onOpenDetail: (task: Task) => void
}

function KanbanView({ tasks, onStatusChange, onComplete, onEdit, onOpenDetail }: KanbanViewProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 pt-1">
      {kanbanColumns.map((col) => {
        const colTasks = tasks.filter((t) => col.statuses.includes(t.status))
        return (
          <div key={col.key} className={cn('w-72 shrink-0 rounded-lg border p-3', col.color)}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">{col.label}</h3>
              <Badge variant="secondary" className="text-xs h-5 px-1.5">{colTasks.length}</Badge>
            </div>
            <div className="space-y-2">
              {colTasks.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhuma tarefa</p>
              )}
              {colTasks.map((task) => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  onStatusChange={onStatusChange}
                  onComplete={onComplete}
                  onEdit={onEdit}
                  onOpenDetail={onOpenDetail}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Delete Confirm Modal ──

interface DeleteModalProps {
  taskId: string | null
  onClose: () => void
  onSuccess: () => void
}

function DeleteModal({ taskId, onClose, onSuccess }: DeleteModalProps) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/tasks/${id}`),
    onSuccess: () => {
      toast.success('Tarefa excluída')
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      onSuccess()
      onClose()
    },
    onError: () => toast.error('Erro ao excluir tarefa'),
  })

  return (
    <Dialog open={!!taskId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Excluir tarefa
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita.
        </p>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button
            variant="destructive"
            className="flex-1"
            disabled={mutation.isPending}
            onClick={() => { if (taskId) mutation.mutate(taskId) }}
          >
            {mutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Excluindo...</> : 'Excluir'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ──

type ViewMode = 'list' | 'kanban'
type TabKey = 'today' | 'week' | 'overdue' | 'all'

interface Filters {
  type: string
  priority: string
  assignedToId: string
  opportunitySearch: string
}

export default function TarefasPage() {
  const [view, setView] = useState<ViewMode>('list')
  const [activeTab, setActiveTab] = useState<TabKey>('today')
  const [filters, setFilters] = useState<Filters>({ type: '', priority: '', assignedToId: '', opportunitySearch: '' })

  const [createOpen, setCreateOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [completeId, setCompleteId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [detailTask, setDetailTask] = useState<Task | null>(null)

  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Users for filters/form
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<{ users: User[] }>('/users'),
  })
  const users = usersData?.users ?? []

  function buildQueryParams(tab: TabKey) {
    const now = new Date()
    const params = new URLSearchParams()
    if (tab === 'today') {
      params.set('dueDate_gte', startOfDay(now).toISOString())
      params.set('dueDate_lte', endOfDay(now).toISOString())
    } else if (tab === 'week') {
      params.set('dueDate_gte', startOfWeek(now, { weekStartsOn: 1 }).toISOString())
      params.set('dueDate_lte', endOfWeek(now, { weekStartsOn: 1 }).toISOString())
    } else if (tab === 'overdue') {
      params.set('status', 'OVERDUE')
    }
    if (filters.type) params.set('type', filters.type)
    if (filters.priority) params.set('priority', filters.priority)
    if (filters.assignedToId) params.set('assignedToId', filters.assignedToId)
    return params.toString()
  }

  const { data: tasks, isLoading, refetch } = useQuery({
    queryKey: ['tasks', activeTab, filters, view],
    queryFn: () => {
      if (view === 'kanban') {
        // Fetch all for kanban
        const params = new URLSearchParams()
        params.set('limit', '200')
        if (filters.type) params.set('type', filters.type)
        if (filters.priority) params.set('priority', filters.priority)
        if (filters.assignedToId) params.set('assignedToId', filters.assignedToId)
        return api.get<Task[]>(`/tasks?${params.toString()}`)
      }
      return api.get<Task[]>(`/tasks?${buildQueryParams(activeTab)}`)
    },
  })

  // Status update mutation (for kanban)
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put<Task>(`/tasks/${id}`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: () => toast.error('Erro ao atualizar status'),
  })

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: (task: Task) => api.post<Task>('/tasks', {
      title: `${task.title} (cópia)`,
      type: task.type,
      priority: task.priority,
      dueDate: task.dueDate,
      assignedToId: task.assignedToId,
      description: task.description,
      ...(task.opportunityId && { opportunityId: task.opportunityId }),
      ...(task.contactId && { contactId: task.contactId }),
    }),
    onSuccess: () => {
      toast.success('Tarefa duplicada!')
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: () => toast.error('Erro ao duplicar tarefa'),
  })

  const filteredTasks = tasks ?? []

  // Client-side opportunity search filter
  const displayTasks = filters.opportunitySearch
    ? filteredTasks.filter((t) =>
        t.opportunity?.title.toLowerCase().includes(filters.opportunitySearch.toLowerCase())
      )
    : filteredTasks

  function getEditFormData(task: Task): Partial<TaskFormData> {
    // Format dueDate for datetime-local input
    const dueDateLocal = task.dueDate
      ? new Date(task.dueDate).toISOString().slice(0, 16)
      : ''
    return {
      title: task.title,
      type: task.type,
      priority: task.priority,
      dueDate: dueDateLocal,
      assignedToId: task.assignedToId,
      opportunityId: task.opportunityId ?? '',
      opportunityLabel: task.opportunity?.title ?? '',
      contactId: task.contactId ?? '',
      contactLabel: task.contact?.name ?? '',
      companyId: task.companyId ?? '',
      companyLabel: task.company?.name ?? '',
      description: task.description ?? '',
    }
  }

  const hasFilters = !!(filters.type || filters.priority || filters.assignedToId || filters.opportunitySearch)

  const tabLabels: Record<TabKey, string> = {
    today: 'Hoje',
    week: 'Esta Semana',
    overdue: 'Atrasadas',
    all: 'Todas',
  }

  return (
    <div className="space-y-4">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">Tarefas</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-md border bg-muted/40 p-0.5">
            <button
              onClick={() => setView('list')}
              title="Vista Lista"
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded transition-colors',
                view === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('kanban')}
              title="Vista Kanban"
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded transition-colors',
                view === 'kanban' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Columns className="h-4 w-4" />
            </button>
          </div>

          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Tarefa
          </Button>
        </div>
      </div>

      {/* ── FILTERS ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

        {/* Type filter */}
        <Select
          value={filters.type || 'ALL'}
          onValueChange={(v) => setFilters((f) => ({ ...f, type: v === 'ALL' ? '' : v }))}
        >
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os tipos</SelectItem>
            {Object.entries(taskTypeLabels).map(([val, lbl]) => (
              <SelectItem key={val} value={val} className="text-xs">{lbl}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Priority filter */}
        <Select
          value={filters.priority || 'ALL'}
          onValueChange={(v) => setFilters((f) => ({ ...f, priority: v === 'ALL' ? '' : v }))}
        >
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas as prioridades</SelectItem>
            {Object.entries(priorityLabels).map(([val, lbl]) => (
              <SelectItem key={val} value={val} className="text-xs">{lbl}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Responsible filter */}
        {users.length > 0 && (
          <Select
            value={filters.assignedToId || 'ALL'}
            onValueChange={(v) => setFilters((f) => ({ ...f, assignedToId: v === 'ALL' ? '' : v }))}
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os responsáveis</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Opportunity search */}
        <div className="relative">
          <Input
            placeholder="Buscar por oportunidade..."
            className="h-8 text-xs w-[200px]"
            value={filters.opportunitySearch}
            onChange={(e) => setFilters((f) => ({ ...f, opportunitySearch: e.target.value }))}
          />
          {filters.opportunitySearch && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => setFilters((f) => ({ ...f, opportunitySearch: '' }))}
            >
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        {/* Refresh */}
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => refetch()} title="Atualizar">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setFilters({ type: '', priority: '', assignedToId: '', opportunitySearch: '' })}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
          <TabsList>
            {(Object.entries(tabLabels) as [TabKey, string][]).map(([key, label]) => (
              <TabsTrigger key={key} value={key}>
                {label}
                {activeTab === key && displayTasks.length > 0 ? ` (${displayTasks.length})` : ''}
              </TabsTrigger>
            ))}
          </TabsList>

          {(['today', 'week', 'overdue', 'all'] as TabKey[]).map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-4">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : displayTasks.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">
                    {tab === 'today' ? 'Nenhuma tarefa para hoje'
                      : tab === 'week' ? 'Nenhuma tarefa esta semana'
                      : tab === 'overdue' ? 'Nenhuma tarefa atrasada'
                      : 'Nenhuma tarefa encontrada'}
                  </p>
                  <Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Tarefa
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onComplete={(id) => setCompleteId(id)}
                      onEdit={(t) => setEditTask(t)}
                      onDelete={(id) => setDeleteId(id)}
                      onDuplicate={(t) => duplicateMutation.mutate(t)}
                      onOpenDetail={(t) => setDetailTask(t)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* ── KANBAN VIEW ── */}
      {view === 'kanban' && (
        <>
          {isLoading ? (
            <div className="flex gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-72 shrink-0 space-y-2">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-[400px] w-full" />
                </div>
              ))}
            </div>
          ) : (
            <KanbanView
              tasks={displayTasks}
              onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
              onComplete={(id) => setCompleteId(id)}
              onEdit={(t) => setEditTask(t)}
              onOpenDetail={(t) => setDetailTask(t)}
            />
          )}
        </>
      )}

      {/* ── MODALS ── */}

      {/* Create Modal */}
      <TaskFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        users={users}
        onSuccess={() => {}}
      />

      {/* Edit Modal */}
      <TaskFormModal
        open={!!editTask}
        onClose={() => setEditTask(null)}
        initialData={editTask ? getEditFormData(editTask) : undefined}
        taskId={editTask?.id}
        users={users}
        onSuccess={() => setEditTask(null)}
      />

      {/* Complete Modal */}
      <CompleteModal
        taskId={completeId}
        onClose={() => setCompleteId(null)}
        onSuccess={() => setCompleteId(null)}
      />

      {/* Delete Modal */}
      <DeleteModal
        taskId={deleteId}
        onClose={() => setDeleteId(null)}
        onSuccess={() => setDeleteId(null)}
      />

      {/* Detail Sheet */}
      <TaskDetailSheet
        task={detailTask}
        onClose={() => setDetailTask(null)}
        onEdit={(t) => setEditTask(t)}
        onComplete={(id) => setCompleteId(id)}
        onDelete={(id) => setDeleteId(id)}
      />
    </div>
  )
}
