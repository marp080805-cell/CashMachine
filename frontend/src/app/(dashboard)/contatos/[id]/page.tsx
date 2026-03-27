'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { Contact, Task, Activity as ActivityType, Tag } from '@/types'
import { formatDate, formatDateTime, formatCurrency, getInitials, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Mail, Phone, Building2, ArrowLeft, Pencil, Plus, MoreVertical,
  Loader2, CheckCircle2, Circle, FileText, Calendar, Clock,
  MessageSquare, Activity, Trophy, X, Check, AlertTriangle, Search,
} from 'lucide-react'
import { OpportunitySheet } from '@/components/kanban/OpportunitySheet'
import type { Opportunity } from '@/types'

// ─── Local interfaces ───────────────────────────────────────────────────────

interface ContactDetail extends Contact {
  isBlacklisted?: boolean
  cpf?: string | null
  dateOfBirth?: string | null
  role?: string | null
  tagAssignments?: Array<{ id: string; tag: Tag }>
}

interface ContactOpportunity {
  id: string
  title: string
  status: string
  value: number | null
  createdAt: string
  pipeline: { id: string; name: string; prefix: string | null }
  stage: { id: string; name: string; color: string }
  contact: { id: string; name: string; phone: string | null; email: string | null }
  assignedTo: { id: string; name: string; avatarUrl: string | null }
  companyId: string | null
  company: { id: string; name: string } | null
  stageId: string
  pipelineId: string
  sdrId: string | null
  sdr: { id: string; name: string } | null
  closerId: string | null
  closer: { id: string; name: string } | null
  assignedToId: string
  contactId: string
  tenantId: string
  originId: string | null
  origin: { id: string; name: string } | null
  subOriginId: string | null
  subOrigin: { id: string; name: string } | null
  expectedCloseDate: string | null
  closedAt: string | null
  lostReasonId: string | null
  lostReason: { id: string; name: string } | null
  rescueEligible: boolean
  temperature: string | null
  qualificationScore: number | null
  position: number
  handoffAt: string | null
  sdrBriefing: string | null
  slaFirstContactAt: string | null
  notes: string | null
  updatedAt: string
}

interface ContactConversation {
  id: string
  channel: string
  status: string
  lastMessage: string | null
  lastMessageAt: string | null
}

interface Pipeline {
  id: string
  name: string
}

interface EditContactForm {
  name: string
  email: string
  phone: string
  role: string
  cpf: string
  birthday: string
  notes: string
  companyId: string
  companyLabel: string
}

interface CompanyOption { id: string; name: string }

function CompanySearchEdit({ value, label, onChange }: { value: string; label: string; onChange: (id: string, name: string) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['companies-search-edit', q],
    queryFn: () => api.get<{ data: CompanyOption[] }>(`/companies?search=${encodeURIComponent(q)}&limit=8`),
    enabled: q.length > 0,
  })

  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (value) return (
    <div className="flex items-center gap-2 border rounded-md px-3 py-2 text-sm bg-background">
      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="flex-1 font-medium">{label}</span>
      <button type="button" onClick={() => onChange('', '')}><X className="h-3.5 w-3.5" /></button>
    </div>
  )

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Buscar empresa..."
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => q && setOpen(true)}
        />
      </div>
      {open && (data?.data?.length ?? 0) > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
          {data!.data.map((c) => (
            <button key={c.id} type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
              onMouseDown={() => { onChange(c.id, c.name); setQ(''); setOpen(false) }}>
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface NewOppForm {
  title: string
  pipelineId: string
  value: string
  companyId: string
  companyLabel: string
}

interface NewTaskForm {
  title: string
  type: string
  priority: string
  dueDate: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  WON: 'bg-green-100 text-green-700',
  LOST: 'bg-red-100 text-red-700',
}

const statusLabels: Record<string, string> = {
  OPEN: 'Aberto',
  WON: 'Ganho',
  LOST: 'Perdido',
}

const taskTypeLabels: Record<string, string> = {
  FIRST_CONTACT: 'Primeiro Contato',
  FOLLOW_UP: 'Follow-up',
  QUALIFY: 'Qualificação',
  SCHEDULE_MEETING: 'Agendar Reunião',
  SEND_PROPOSAL: 'Enviar Proposta',
  FOLLOW_UP_PROPOSAL: 'Follow-up Proposta',
  CALL: 'Ligação',
  MEETING: 'Reunião',
  EMAIL: 'Email',
  CUSTOM: 'Outro',
}

const taskTypeIcons: Record<string, React.ElementType> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Calendar,
  FIRST_CONTACT: Phone,
  FOLLOW_UP: Clock,
  SCHEDULE_MEETING: Calendar,
  SEND_PROPOSAL: FileText,
  FOLLOW_UP_PROPOSAL: FileText,
  CUSTOM: FileText,
}

const priorityColors: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700 border-gray-200',
  MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
  URGENT: 'bg-red-100 text-red-700 border-red-200',
}

const priorityLabels: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

const activityIcons: Record<string, React.ElementType> = {
  NOTE: FileText,
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Calendar,
  WHATSAPP_MESSAGE: MessageSquare,
  OPPORTUNITY_MOVED: Activity,
  OPPORTUNITY_CREATED: Plus,
  OPPORTUNITY_WON: Trophy,
  OPPORTUNITY_LOST: X,
  TASK_COMPLETED: CheckCircle2,
  STAGE_CHANGED: Activity,
}

const activityTypeLabels: Record<string, string> = {
  NOTE: 'Nota',
  CALL: 'Ligação',
  EMAIL: 'Email',
  MEETING: 'Reunião',
  WHATSAPP_MESSAGE: 'WhatsApp',
  OPPORTUNITY_MOVED: 'Oportunidade movida',
  OPPORTUNITY_CREATED: 'Oportunidade criada',
  OPPORTUNITY_WON: 'Oportunidade ganha',
  OPPORTUNITY_LOST: 'Oportunidade perdida',
  TASK_COMPLETED: 'Tarefa concluída',
  STAGE_CHANGED: 'Etapa alterada',
}

const channelLabels: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
  PHONE: 'Telefone',
  CHAT: 'Chat',
  INSTAGRAM: 'Instagram',
}

function getNameColor(name: string): string {
  const colors = [
    'bg-violet-500', 'bg-blue-500', 'bg-green-500', 'bg-amber-500',
    'bg-rose-500', 'bg-cyan-500', 'bg-teal-500', 'bg-indigo-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length] ?? 'bg-violet-500'
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `há ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `há ${hrs}h`
  const days = Math.floor(hrs / 24)
  return `há ${days}d`
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function ContactProfilePage() {
  const params = useParams()
  const router = useRouter()
  const contactId = params['id'] as string
  const queryClient = useQueryClient()

  // State
  const [activeTab, setActiveTab] = useState('opportunities')
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<EditContactForm>({
    name: '', email: '', phone: '', role: '', cpf: '', birthday: '', notes: '', companyId: '', companyLabel: '',
  })
  const [newOppOpen, setNewOppOpen] = useState(false)
  const [newOppForm, setNewOppForm] = useState<NewOppForm>({ title: '', pipelineId: '', value: '', companyId: '', companyLabel: '' })
  const [oppCompanySearch, setOppCompanySearch] = useState('')
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [newTaskForm, setNewTaskForm] = useState<NewTaskForm>({ title: '', type: 'CALL', priority: 'MEDIUM', dueDate: '' })
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [completionNotes, setCompletionNotes] = useState('')
  const [selectedOpp, setSelectedOpp] = useState<ContactOpportunity | null>(null)

  // Queries
  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => api.get<ContactDetail>(`/contacts/${contactId}`),
    enabled: !!contactId,
  })

  const { data: oppsData, isLoading: oppsLoading } = useQuery({
    queryKey: ['contact-opportunities', contactId],
    queryFn: () => api.get<ContactOpportunity[]>(`/contacts/${contactId}/opportunities`),
    enabled: activeTab === 'opportunities' && !!contactId,
  })

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['contact-tasks', contactId],
    queryFn: () => api.get<Task[]>(`/contacts/${contactId}/tasks`),
    enabled: activeTab === 'tasks' && !!contactId,
  })

  const { data: convsData, isLoading: convsLoading } = useQuery({
    queryKey: ['contact-conversations', contactId],
    queryFn: () => api.get<ContactConversation[]>(`/contacts/${contactId}/conversations`),
    enabled: activeTab === 'conversations' && !!contactId,
  })

  const { data: activitiesData, isLoading: activitiesLoading } = useQuery({
    queryKey: ['contact-activities', contactId],
    queryFn: () => api.get<ActivityType[]>(`/contacts/${contactId}/activities`),
    enabled: activeTab === 'activities' && !!contactId,
  })

  const { data: pipelinesData } = useQuery({
    queryKey: ['pipelines-list'],
    queryFn: () => api.get<{ pipelines: Pipeline[] }>('/pipelines'),
    enabled: newOppOpen,
  })

  const { data: oppCompaniesData } = useQuery({
    queryKey: ['companies-search-contact-opp', oppCompanySearch],
    queryFn: () => api.get<{ data: Array<{ id: string; name: string }> }>(`/companies?search=${encodeURIComponent(oppCompanySearch)}&limit=8`),
    enabled: newOppOpen && oppCompanySearch.length > 0,
  })

  // Mutations
  const editMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patch<ContactDetail>(`/contacts/${contactId}`, data),
    onSuccess: () => {
      toast.success('Contato atualizado!')
      setEditOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['contact', contactId] })
    },
    onError: (err: unknown) => {
      toast.error((err as { message?: string })?.message ?? 'Erro ao atualizar contato')
    },
  })

  const blacklistMutation = useMutation({
    mutationFn: (blacklist: boolean) =>
      api.patch<ContactDetail>(`/contacts/${contactId}`, { isBlacklisted: blacklist }),
    onSuccess: () => {
      toast.success('Contato atualizado!')
      void queryClient.invalidateQueries({ queryKey: ['contact', contactId] })
    },
    onError: () => toast.error('Erro ao atualizar'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete<void>(`/contacts/${contactId}`),
    onSuccess: () => {
      toast.success('Contato excluído')
      router.push('/contatos')
    },
    onError: () => toast.error('Erro ao excluir contato'),
  })

  const createOppMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<{ id: string }>('/opportunities', data),
    onSuccess: () => {
      toast.success('Oportunidade criada!')
      setNewOppOpen(false)
      setNewOppForm({ title: '', pipelineId: '', value: '', companyId: '', companyLabel: '' })
      setOppCompanySearch('')
      void queryClient.invalidateQueries({ queryKey: ['contact-opportunities', contactId] })
    },
    onError: (err: unknown) => {
      toast.error((err as { message?: string })?.message ?? 'Erro ao criar oportunidade')
    },
  })

  const createTaskMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Task>('/tasks', data),
    onSuccess: () => {
      toast.success('Tarefa criada!')
      setNewTaskOpen(false)
      setNewTaskForm({ title: '', type: 'CALL', priority: 'MEDIUM', dueDate: '' })
      void queryClient.invalidateQueries({ queryKey: ['contact-tasks', contactId] })
    },
    onError: () => toast.error('Erro ao criar tarefa'),
  })

  const completeTaskMutation = useMutation({
    mutationFn: ({ taskId, notes }: { taskId: string; notes: string }) =>
      api.post<Task>(`/tasks/${taskId}/complete`, { completionNotes: notes }),
    onSuccess: () => {
      toast.success('Tarefa concluída!')
      setCompletingTaskId(null)
      setCompletionNotes('')
      void queryClient.invalidateQueries({ queryKey: ['contact-tasks', contactId] })
    },
    onError: () => toast.error('Erro ao concluir tarefa'),
  })

  // Handlers
  function openEdit() {
    if (!contact) return
    setEditForm({
      name: contact.name,
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      role: contact.role ?? '',
      cpf: contact.cpf ?? '',
      birthday: contact.dateOfBirth ? contact.dateOfBirth.slice(0, 10) : '',
      notes: contact.notes ?? '',
      companyId: contact.companyId ?? '',
      companyLabel: contact.company?.name ?? '',
    })
    setEditOpen(true)
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editForm.name.trim()) { toast.error('Nome é obrigatório'); return }
    editMutation.mutate({
      name: editForm.name,
      ...(editForm.email ? { email: editForm.email } : {}),
      ...(editForm.phone ? { phone: editForm.phone } : {}),
      ...(editForm.role ? { role: editForm.role } : {}),
      ...(editForm.cpf ? { cpf: editForm.cpf } : {}),
      ...(editForm.birthday ? { dateOfBirth: new Date(editForm.birthday).toISOString() } : {}),
      ...(editForm.notes ? { notes: editForm.notes } : {}),
      ...(editForm.companyId ? { companyId: editForm.companyId } : { companyId: null }),
    })
  }

  function handleCreateOpp(e: React.FormEvent) {
    e.preventDefault()
    if (!newOppForm.title.trim()) { toast.error('Título é obrigatório'); return }
    if (!newOppForm.pipelineId) { toast.error('Selecione um funil'); return }
    createOppMutation.mutate({
      title: newOppForm.title,
      pipelineId: newOppForm.pipelineId,
      contactId,
      ...(newOppForm.value ? { value: parseFloat(newOppForm.value) } : {}),
      ...(newOppForm.companyId ? { companyId: newOppForm.companyId } : {}),
    })
  }

  function handleCreateTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTaskForm.title.trim()) { toast.error('Título é obrigatório'); return }
    if (!newTaskForm.dueDate) { toast.error('Data de vencimento é obrigatória'); return }
    createTaskMutation.mutate({
      title: newTaskForm.title,
      type: newTaskForm.type,
      priority: newTaskForm.priority,
      dueDate: new Date(newTaskForm.dueDate).toISOString(),
      contactId,
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="text-center py-24">
        <p className="text-muted-foreground">Contato não encontrado</p>
        <Button variant="link" onClick={() => router.push('/contatos')}>Voltar</Button>
      </div>
    )
  }

  const opps = oppsData ?? []
  const tasks = tasksData ?? []
  const convs = convsData ?? []
  const activities = activitiesData ?? []
  const pipelines = pipelinesData?.pipelines ?? []
  const avatarColor = getNameColor(contact.name)

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back */}
      <Button variant="ghost" size="sm" className="gap-2" onClick={() => router.push('/contatos')}>
        <ArrowLeft className="h-4 w-4" />
        Contatos
      </Button>

      {/* Header Card */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <Avatar className="h-16 w-16 shrink-0">
            <AvatarFallback className={cn('text-xl font-semibold text-white', avatarColor)}>
              {getInitials(contact.name)}
            </AvatarFallback>
          </Avatar>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{contact.name}</h1>
              {contact.isBlacklisted && (
                <Badge className="bg-red-500 text-white text-xs font-bold">BLACKLIST</Badge>
              )}
            </div>

            {contact.role && (
              <p className="text-sm text-muted-foreground mt-0.5">{contact.role}</p>
            )}

            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {contact.email}
                </a>
              )}
              {contact.phone && (
                <a
                  href={`tel:${contact.phone}`}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {contact.phone}
                </a>
              )}
              {contact.company && (
                <Link
                  href={`/empresas/${contact.companyId}`}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  {contact.company.name}
                </Link>
              )}
            </div>

            {/* Tags */}
            {contact.tagAssignments && contact.tagAssignments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {contact.tagAssignments.map((ta) => (
                  <Badge
                    key={ta.id}
                    variant="secondary"
                    className="text-xs"
                    style={{
                      backgroundColor: ta.tag.color + '22',
                      color: ta.tag.color,
                      borderColor: ta.tag.color + '44',
                    }}
                  >
                    {ta.tag.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={openEdit}>
              <Pencil className="h-4 w-4 mr-1.5" />
              Editar
            </Button>
            <Button size="sm" onClick={() => setNewOppOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Nova Oportunidade
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/whatsapp">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Enviar WhatsApp
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => blacklistMutation.mutate(!contact.isBlacklisted)}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  {contact.isBlacklisted ? 'Remover do Blacklist' : 'Adicionar ao Blacklist'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={() => {
                    if (confirm('Tem certeza que deseja excluir este contato? Esta ação não pode ser desfeita.')) {
                      deleteMutation.mutate()
                    }
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Excluir Contato
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="opportunities">Oportunidades</TabsTrigger>
          <TabsTrigger value="tasks">Tarefas</TabsTrigger>
          <TabsTrigger value="conversations">Conversas</TabsTrigger>
          <TabsTrigger value="activities">Atividades</TabsTrigger>
        </TabsList>

        {/* ── Tab: Oportunidades ── */}
        <TabsContent value="opportunities" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                {opps.filter((o) => o.status === 'OPEN').length} abertas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                {opps.filter((o) => o.status === 'WON').length} ganhas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                {opps.filter((o) => o.status === 'LOST').length} perdidas
              </span>
            </div>
            <Button size="sm" onClick={() => setNewOppOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />Nova Oportunidade
            </Button>
          </div>

          {oppsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : opps.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p>Nenhuma oportunidade ainda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {opps.map((opp) => (
                <div
                  key={opp.id}
                  className={cn(
                    'rounded-lg border bg-card p-4 cursor-pointer hover:bg-accent/50 transition-colors',
                    opp.status === 'WON' && 'border-green-200 bg-green-50/30',
                    opp.status === 'LOST' && 'border-red-200 bg-red-50/30',
                  )}
                  onClick={() => setSelectedOpp(opp)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{opp.title}</p>
                        <Badge
                          variant="secondary"
                          className={cn('text-xs', statusColors[opp.status] ?? '')}
                        >
                          {statusLabels[opp.status] ?? opp.status}
                        </Badge>
                      </div>

                      {/* Pipeline → Stage */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                        <span>{opp.pipeline.name}</span>
                        <span className="opacity-40">›</span>
                        <div className="flex items-center gap-1">
                          <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: opp.stage.color }} />
                          <span>{opp.stage.name}</span>
                        </div>
                        {opp.origin && (
                          <>
                            <span className="opacity-40">•</span>
                            <span>{opp.origin.name}</span>
                          </>
                        )}
                      </div>

                      {/* Assignees */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {opp.sdr && <span>SDR: <span className="font-medium text-foreground">{opp.sdr.name}</span></span>}
                        {opp.closer && <span>Closer: <span className="font-medium text-foreground">{opp.closer.name}</span></span>}
                        {!opp.sdr && !opp.closer && <span>Resp: <span className="font-medium text-foreground">{opp.assignedTo.name}</span></span>}
                      </div>

                      {/* Dates row */}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>Criado {formatDate(opp.createdAt)}</span>
                        {opp.status === 'WON' && opp.closedAt && (
                          <span className="text-green-600 font-medium">Ganho {formatDate(opp.closedAt)}</span>
                        )}
                        {opp.status === 'LOST' && opp.closedAt && (
                          <span className="text-red-600 font-medium">
                            Perdido {formatDate(opp.closedAt)}
                            {opp.lostReason && `: ${opp.lostReason.name}`}
                          </span>
                        )}
                        {opp.expectedCloseDate && opp.status === 'OPEN' && (
                          <span>Prev. fechamento {formatDate(opp.expectedCloseDate)}</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className={cn(
                        'text-sm font-bold',
                        opp.status === 'WON' && 'text-green-600',
                        opp.status === 'LOST' && 'text-red-500 line-through',
                      )}>
                        {opp.value != null ? formatCurrency(opp.value) : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Tarefas ── */}
        <TabsContent value="tasks" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setNewTaskOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Nova Tarefa
            </Button>
          </div>

          {tasksLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">Nenhuma tarefa vinculada</p>
          ) : (
            tasks.map((task) => {
              const isCompleted = task.status === 'COMPLETED'
              const TaskIcon = taskTypeIcons[task.type] ?? FileText
              const isDue = !!(task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted)

              return (
                <div key={task.id} className="rounded-lg border p-3 flex items-start gap-3">
                  <button
                    className="mt-0.5 shrink-0"
                    disabled={isCompleted}
                    onClick={() => { if (!isCompleted) setCompletingTaskId(task.id) }}
                    title={isCompleted ? 'Concluída' : 'Marcar como concluída'}
                  >
                    {isCompleted
                      ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                      : <Circle className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    }
                  </button>
                  <div className="h-7 w-7 shrink-0 flex items-center justify-center rounded-full bg-muted">
                    <TaskIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium', isCompleted && 'line-through text-muted-foreground')}>
                      {task.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className={cn('text-xs px-1.5 py-0.5 rounded border', priorityColors[task.priority] ?? '')}>
                        {priorityLabels[task.priority] ?? task.priority}
                      </span>
                      {task.dueDate && (
                        <span className={cn(
                          'text-xs px-1.5 py-0.5 rounded',
                          isDue ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                        )}>
                          {formatDate(task.dueDate)}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {taskTypeLabels[task.type] ?? task.type}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </TabsContent>

        {/* ── Tab: Conversas ── */}
        <TabsContent value="conversations" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Link href="/whatsapp">
              <Button size="sm">
                <MessageSquare className="h-4 w-4 mr-1.5" />
                Iniciar Conversa
              </Button>
            </Link>
          </div>

          {convsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : convs.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">Nenhuma conversa</p>
          ) : (
            convs.map((conv) => (
              <div key={conv.id} className="rounded-lg border p-4 flex items-start gap-3">
                <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-full bg-green-100">
                  <MessageSquare className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{channelLabels[conv.channel] ?? conv.channel}</p>
                    <Badge variant="secondary" className="text-xs">
                      {conv.status === 'OPEN' ? 'Aberta' : 'Fechada'}
                    </Badge>
                  </div>
                  {conv.lastMessage && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{conv.lastMessage}</p>
                  )}
                  {conv.lastMessageAt && (
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(conv.lastMessageAt)}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* ── Tab: Atividades ── */}
        <TabsContent value="activities" className="mt-4">
          {activitiesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : activities.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">Nenhuma atividade registrada</p>
          ) : (
            <div className="relative pl-8 space-y-0">
              {activities.map((item, idx) => {
                const ItemIcon = activityIcons[item.type] ?? Activity
                return (
                  <div key={item.id} className="relative flex items-start gap-4 pb-6">
                    {/* Vertical line */}
                    {idx < activities.length - 1 && (
                      <div className="absolute left-[-17px] top-6 bottom-0 w-px bg-border" />
                    )}
                    {/* Dot */}
                    <div className="absolute left-[-24px] top-1 h-6 w-6 flex items-center justify-center rounded-full bg-muted border border-border">
                      <ItemIcon className="h-3 w-3 text-muted-foreground" />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {activityTypeLabels[item.type] ?? item.type}
                        </p>
                        <span className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</span>
                      </div>
                      <p className="text-sm mt-0.5">{item.description}</p>
                      {item.user && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.user.name}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Modal: Editar Contato ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Contato</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nome completo"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Input
                  value={editForm.role}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                  placeholder="Ex: Diretor Comercial"
                />
              </div>
              <div className="space-y-1.5">
                <Label>CPF</Label>
                <Input
                  value={editForm.cpf}
                  onChange={(e) => setEditForm((f) => ({ ...f, cpf: e.target.value }))}
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Data de Nascimento</Label>
                <Input
                  type="date"
                  value={editForm.birthday}
                  onChange={(e) => setEditForm((f) => ({ ...f, birthday: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <CompanySearchEdit
                value={editForm.companyId}
                label={editForm.companyLabel}
                onChange={(id, name) => setEditForm((f) => ({ ...f, companyId: id, companyLabel: name }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <textarea
                rows={3}
                placeholder="Observações..."
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={editMutation.isPending}>
                {editMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                ) : 'Salvar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Nova Oportunidade ── */}
      <Dialog open={newOppOpen} onOpenChange={setNewOppOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Oportunidade</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateOpp} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input
                value={newOppForm.title}
                onChange={(e) => setNewOppForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Proposta Plano Pro"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Funil *</Label>
              <Select value={newOppForm.pipelineId} onValueChange={(v) => setNewOppForm((f) => ({ ...f, pipelineId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar funil..." />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={newOppForm.value}
                onChange={(e) => setNewOppForm((f) => ({ ...f, value: e.target.value }))}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              {newOppForm.companyId ? (
                <div className="flex items-center gap-2 border rounded-md px-3 py-2 text-sm bg-background">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 font-medium">{newOppForm.companyLabel}</span>
                  <button type="button" onClick={() => { setNewOppForm((f) => ({ ...f, companyId: '', companyLabel: '' })); setOppCompanySearch('') }}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    placeholder="Buscar empresa..."
                    value={oppCompanySearch}
                    onChange={(e) => setOppCompanySearch(e.target.value)}
                  />
                  {(oppCompaniesData?.data?.length ?? 0) > 0 && oppCompanySearch && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
                      {oppCompaniesData!.data.map((c) => (
                        <button key={c.id} type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                          onMouseDown={() => { setNewOppForm((f) => ({ ...f, companyId: c.id, companyLabel: c.name })); setOppCompanySearch('') }}>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setNewOppOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={createOppMutation.isPending}>
                {createOppMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</>
                ) : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Nova Tarefa ── */}
      <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input
                value={newTaskForm.title}
                onChange={(e) => setNewTaskForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Ligar para o cliente"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={newTaskForm.type} onValueChange={(v) => setNewTaskForm((f) => ({ ...f, type: v }))}>
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
                <Select value={newTaskForm.priority} onValueChange={(v) => setNewTaskForm((f) => ({ ...f, priority: v }))}>
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
              <Label>Vencimento *</Label>
              <Input
                type="datetime-local"
                value={newTaskForm.dueDate}
                onChange={(e) => setNewTaskForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setNewTaskOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={createTaskMutation.isPending}>
                {createTaskMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</>
                ) : 'Criar Tarefa'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Concluir Tarefa ── */}
      <Dialog
        open={!!completingTaskId}
        onOpenChange={(open) => { if (!open) { setCompletingTaskId(null); setCompletionNotes('') } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Concluir Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Notas de conclusão *</Label>
              <textarea
                rows={4}
                placeholder="Descreva o que foi realizado..."
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setCompletingTaskId(null); setCompletionNotes('') }}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                disabled={!completionNotes.trim() || completeTaskMutation.isPending}
                onClick={() => {
                  if (completingTaskId) {
                    completeTaskMutation.mutate({ taskId: completingTaskId, notes: completionNotes })
                  }
                }}
              >
                {completeTaskMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                ) : (
                  <><Check className="h-4 w-4 mr-1.5" />Concluir</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* OpportunitySheet — abre quando usuário clica "Ver detalhes" */}
      {selectedOpp && (
        <OpportunitySheet
          opportunity={selectedOpp as unknown as Opportunity}
          onClose={() => setSelectedOpp(null)}
          pipelineId={selectedOpp.pipeline.id}
        />
      )}
    </div>
  )
}
