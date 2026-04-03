'use client'

import { useState, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Trophy, X, Loader2, MessageSquare, Phone, ExternalLink,
  Pencil, Check, Trash2, CheckCircle2, Circle, Plus,
  Calendar, Mail, FileText, Users, Clock, Activity,
  Video, Handshake, Tag as TagIcon, AlertTriangle, Settings2, GitBranch,
  Sparkles, Bot, ChevronDown,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Link from 'next/link'
import type { Opportunity, WhatsappNumber, User, Task, Activity as ActivityType, Tag } from '@/types'
import { api } from '@/lib/api'
import { formatCurrency, formatDate, formatDateTime, getInitials, cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { ChatWindow } from '@/components/whatsapp/ChatWindow'
import { CustomFieldsPanel } from '@/components/custom-fields/CustomFieldsPanel'
import { FieldWrapper } from '@/components/custom-fields/FieldWrapper'
import { useAuthStore } from '@/stores/authStore'
import { EntityCombobox } from '@/components/shared/EntityCombobox'
import { TagField } from '@/components/shared/TagField'


interface FlatOrigin { id: string; name: string; path: string; depth: number; parentId: string | null }

function OriginSearch({ value, label, onChange }: { value: string; label: string; onChange: (id: string, path: string) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: origins = [] } = useQuery({
    queryKey: ['origins-flat'],
    queryFn: () => api.get<FlatOrigin[]>('/origins/flat'),
  })

  const filtered = origins.filter((o) => !q || o.path.toLowerCase().includes(q.toLowerCase()))

  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (value) return (
    <div className="flex items-center gap-2 border rounded-md px-3 py-2 text-sm bg-background">
      <GitBranch className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      <span className="flex-1 font-medium truncate">{label}</span>
      <button type="button" onClick={() => onChange('', '')}><X className="h-3.5 w-3.5" /></button>
    </div>
  )

  return (
    <div ref={ref} className="relative">
      <Input
        placeholder="Buscar origem (ex: Mídia Paga > Meta Ads)..."
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-52 overflow-y-auto">
          {filtered.map((o) => (
            <button key={o.id} type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
              style={{ paddingLeft: `${12 + o.depth * 16}px` }}
              onMouseDown={() => { onChange(o.id, o.path); setQ(''); setOpen(false) }}>
              <span className="text-muted-foreground text-xs">{o.depth > 0 ? '↳ ' : ''}</span>{o.name}
              {o.depth > 0 && <span className="text-xs text-muted-foreground ml-2 truncate">{o.path}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface OpportunitySheetProps {
  opportunity: Opportunity | null
  onClose: () => void
  pipelineId: string
}

interface EditData {
  title: string
  value: string
  expectedCloseDate: string
  notes: string
  stageId: string
  assignedToId: string
  originId: string
  originLabel: string
  contactId: string
  contactLabel: string
  companyId: string
  companyLabel: string
}

interface OppMeeting {
  id: string
  title?: string
  scheduledAt: string
  status: string
  type: string
}

interface OppConversation {
  id: string
  channel: string
  status: string
  lastMessageAt?: string
  contact?: { name: string }
  assignedTo?: { name: string }
  lastMessage?: string
}

interface TagAssignment {
  id: string
  tagId: string
  tag: Tag
}

interface OppWithTags extends Opportunity {
  tagAssignments?: TagAssignment[]
}

const activityTypeLabels: Record<string, string> = {
  NOTE: 'Nota',
  CALL: 'Ligação',
  EMAIL: 'Email',
  MEETING: 'Reunião',
  WHATSAPP_MESSAGE: 'WhatsApp',
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
  MEETING: Users,
  FIRST_CONTACT: Phone,
  FOLLOW_UP: Phone,
  SCHEDULE_MEETING: Calendar,
  SEND_PROPOSAL: FileText,
  FOLLOW_UP_PROPOSAL: FileText,
  CUSTOM: FileText,
}

const priorityColors: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700 border-gray-200',
  MEDIUM: 'bg-blue-100 text-blue-700 border-blue-200',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
  URGENT: 'bg-red-100 text-red-700 border-red-200',
}

const priorityLabels: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

const meetingStatusLabels: Record<string, string> = {
  SCHEDULED: 'Agendada',
  CONFIRMED: 'Confirmada',
  ATTENDED: 'Realizada',
  NO_SHOW: 'Não compareceu',
  CANCELLED: 'Cancelada',
}

const meetingStatusColors: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  ATTENDED: 'bg-emerald-100 text-emerald-700',
  NO_SHOW: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-700',
}

const channelLabels: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
  PHONE: 'Telefone',
  CHAT: 'Chat',
  INSTAGRAM: 'Instagram',
}

const activityIcons: Record<string, React.ElementType> = {
  NOTE: FileText,
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Video,
  WHATSAPP_MESSAGE: MessageSquare,
  OPPORTUNITY_MOVED: Activity,
  OPPORTUNITY_CREATED: Plus,
  OPPORTUNITY_WON: Trophy,
  OPPORTUNITY_LOST: X,
  TASK_COMPLETED: CheckCircle2,
  STAGE_CHANGED: Activity,
  HANDOFF: Handshake,
}

function getSlaColor(task: Task): string {
  if (task.status === 'COMPLETED') return 'bg-green-100 text-green-700'
  if (!task.dueDate) return 'bg-gray-100 text-gray-600'
  const due = new Date(task.dueDate)
  const now = new Date()
  if (due < now) return 'bg-red-100 text-red-700'
  const diffMs = due.getTime() - now.getTime()
  const diffH = diffMs / (1000 * 60 * 60)
  if (diffH < 2) return 'bg-orange-100 text-orange-700'
  return 'bg-green-100 text-green-700'
}

export function OpportunitySheet({ opportunity, onClose, pipelineId }: OpportunitySheetProps) {
  const [lostDialogOpen, setLostDialogOpen] = useState(false)
  const [lostReasonId, setLostReasonId] = useState('')
  const [wonDialogOpen, setWonDialogOpen] = useState(false)
  const [deleteOppDialogOpen, setDeleteOppDialogOpen] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>()
  const [startMessage, setStartMessage] = useState('')
  const [selectedNumberId, setSelectedNumberId] = useState('')
  const [activeTab, setActiveTab] = useState('details')

  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<EditData>({
    title: '', value: '', expectedCloseDate: '', notes: '', stageId: '', assignedToId: '', originId: '', originLabel: '',
    contactId: '', contactLabel: '', companyId: '', companyLabel: '',
  })

  const [activityType, setActivityType] = useState('NOTE')
  const [activityDesc, setActivityDesc] = useState('')

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [taskEditForm, setTaskEditForm] = useState<{ title: string; dueDate: string; type: string }>({
    title: '', dueDate: '', type: 'CALL',
  })
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)

  // New task modal state
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [newTaskForm, setNewTaskForm] = useState({ title: '', type: 'CALL', dueDate: '', priority: 'MEDIUM', assignedToId: '' })

  // Complete task modal state
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [completionNotes, setCompletionNotes] = useState('')

  // New meeting modal state
  const [newMeetingOpen, setNewMeetingOpen] = useState(false)
  const [newMeetingForm, setNewMeetingForm] = useState({ title: '', scheduledAt: '', type: 'VIDEO', hostId: '' })

  // New conversation modal state
  const [newConvOpen, setNewConvOpen] = useState(false)
  const [newConvChannel, setNewConvChannel] = useState('WHATSAPP')

  // Handoff state
  const [handoffCloserId, setHandoffCloserId] = useState('')
  const [handoffBriefing, setHandoffBriefing] = useState('')
  const [handoffDone, setHandoffDone] = useState(false)

  // Tags state
  const [showTagPicker, setShowTagPicker] = useState(false)
  const [showNewTagForm, setShowNewTagForm] = useState(false)
  const [newTagData, setNewTagData] = useState({ name: '', color: '#6366f1' })

  const [adminMode, setAdminMode] = useState(false)

  // IA por conversa
  const [convAiEnabled, setConvAiEnabled] = useState(true)
  const [convAiAgentId, setConvAiAgentId] = useState<string | null>(null)

  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  const queryClient = useQueryClient()

  // Agentes IA disponíveis
  const { data: aiAgents = [] } = useQuery({
    queryKey: ['ai-agents'],
    queryFn: () => api.get<Array<{ id: string; name: string; isActive: boolean }>>('/ai-agents'),
    select: (data) => data.filter((a) => a.isActive),
  })

  // Main opportunity detail
  const { data: oppDetail } = useQuery({
    queryKey: ['opportunity', opportunity?.id],
    queryFn: () => api.get<OppWithTags & { activities: Parameters<typeof RecentActivities>[0]['activities']; tasks: Task[] }>(`/opportunities/${opportunity!.id}`),
    enabled: !!opportunity?.id,
  })

  // WhatsApp numbers
  const { data: numbersData } = useQuery({
    queryKey: ['whatsapp-numbers'],
    queryFn: () => api.get<{ numbers: WhatsappNumber[] }>('/whatsapp/numbers'),
    enabled: !!opportunity?.contact && !activeConversationId,
  })

  // Existing WhatsApp conversation
  const { data: existingConvsData } = useQuery({
    queryKey: ['whatsapp-conversations-contact', opportunity?.contactId],
    queryFn: () =>
      api.get<{ conversations: Array<{ id: string; aiEnabled: boolean; aiAgentId: string | null }> }>(
        `/whatsapp/conversations?contactId=${opportunity!.contactId}&limit=1`
      ),
    enabled: !!opportunity?.contactId,
  })

  // Tasks tab
  const { data: tasksTabData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks-tab', opportunity?.id],
    queryFn: () => api.get<Task[]>(`/tasks?opportunityId=${opportunity!.id}`),
    enabled: activeTab === 'tasks' && !!opportunity?.id,
  })

  // Meetings tab
  const { data: meetingsData, isLoading: meetingsLoading } = useQuery({
    queryKey: ['meetings', opportunity?.id],
    queryFn: () => api.get<{ meetings: OppMeeting[]; total: number }>(`/meetings?opportunityId=${opportunity!.id}`),
    enabled: activeTab === 'meetings' && !!opportunity?.id,
  })

  // Conversations tab
  const { data: conversationsData, isLoading: convsLoading } = useQuery({
    queryKey: ['conversations', opportunity?.id],
    queryFn: () => api.get<{ conversations: OppConversation[]; total: number }>(`/conversations?opportunityId=${opportunity!.id}`),
    enabled: activeTab === 'conversations' && !!opportunity?.id,
  })

  // Timeline tab
  const { data: timelineData, isLoading: timelineLoading } = useQuery({
    queryKey: ['timeline', opportunity?.id],
    queryFn: () => api.get<ActivityType[]>(`/opportunities/${opportunity!.id}/timeline`),
    enabled: activeTab === 'timeline' && !!opportunity?.id,
  })

  // Tags tab
  const { data: tagsListData } = useQuery({
    queryKey: ['tags-list'],
    queryFn: () => api.get<Tag[]>('/tags'),
    enabled: activeTab === 'tags',
  })

  // Lost reasons
  const { data: lostReasonsData } = useQuery({
    queryKey: ['lost-reasons'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/lost-reasons'),
    enabled: lostDialogOpen,
  })
  const lostReasons = lostReasonsData ?? []

  // Closer users for handoff
  const { data: closersData } = useQuery({
    queryKey: ['users-closers'],
    queryFn: () => api.get<{ users: User[] }>('/users?role=CLOSER'),
    enabled: !opportunity?.closerId && !handoffDone,
  })

  // Users for forms
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<{ users: User[] }>('/users'),
    enabled: isEditing || newTaskOpen || newMeetingOpen,
  })

  const pipelineCache = queryClient.getQueryData<{ stages?: Array<{ id: string; name: string; color: string; sortOrder: number }> }>(['pipeline', pipelineId])
  const stages = (pipelineCache?.stages ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)

  // Reset on opportunity change
  useEffect(() => {
    setActiveConversationId(undefined)
    setActiveTab('details')
    setHandoffDone(false)
    setHandoffCloserId('')
    setHandoffBriefing('')
    setShowTagPicker(false)
    setAdminMode(false)
    setEditData({ title: '', value: '', expectedCloseDate: '', notes: '', stageId: '', assignedToId: '', originId: '', originLabel: '', contactId: '', contactLabel: '', companyId: '', companyLabel: '' })
  }, [opportunity?.id])

  // Auto-load existing WhatsApp conversation + sync AI config
  useEffect(() => {
    const conv = existingConvsData?.conversations?.[0]
    if (conv) {
      setActiveConversationId(conv.id)
      setConvAiEnabled(conv.aiEnabled ?? true)
      setConvAiAgentId(conv.aiAgentId ?? null)
    }
  }, [existingConvsData])

  // — Mutations —

  const convAiConfigMutation = useMutation({
    mutationFn: (body: { aiEnabled?: boolean; aiAgentId?: string | null }) =>
      api.patch(`/whatsapp/conversations/${activeConversationId}/ai-config`, body),
    onError: () => toast.error('Erro ao salvar configuração de IA'),
  })

  function handleConvAiToggle(enabled: boolean) {
    setConvAiEnabled(enabled)
    convAiConfigMutation.mutate({ aiEnabled: enabled })
  }

  function handleConvAgentSelect(agentId: string | null) {
    setConvAiAgentId(agentId)
    convAiConfigMutation.mutate({ aiAgentId: agentId })
  }

  const deleteOppMutation = useMutation({
    mutationFn: () => api.delete<void>(`/opportunities/${opportunity!.id}`),
    onSuccess: () => {
      toast.success('Oportunidade excluída')
      setDeleteOppDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['pipeline', pipelineId] })
      void queryClient.invalidateQueries({ queryKey: ['opportunities-won', pipelineId] })
      void queryClient.invalidateQueries({ queryKey: ['opportunities-lost', pipelineId] })
      onClose()
    },
    onError: () => toast.error('Erro ao excluir oportunidade'),
  })

  const wonMutation = useMutation({
    mutationFn: () => api.post<Opportunity>(`/opportunities/${opportunity!.id}/won`, {}),
    onSuccess: () => {
      toast.success('Oportunidade marcada como GANHA!')
      void queryClient.invalidateQueries({ queryKey: ['pipeline', pipelineId] })
      void queryClient.invalidateQueries({ queryKey: ['opportunities-won', pipelineId] })
      void queryClient.invalidateQueries({ queryKey: ['opportunities-lost', pipelineId] })
      onClose()
    },
    onError: () => toast.error('Erro ao marcar como ganha'),
  })

  const lostMutation = useMutation({
    mutationFn: (reasonId: string) => api.post<Opportunity>(`/opportunities/${opportunity!.id}/lost`, { lostReasonId: reasonId }),
    onSuccess: () => {
      toast.success('Oportunidade marcada como PERDIDA')
      void queryClient.invalidateQueries({ queryKey: ['pipeline', pipelineId] })
      void queryClient.invalidateQueries({ queryKey: ['opportunities-lost', pipelineId] })
      void queryClient.invalidateQueries({ queryKey: ['opportunities-won', pipelineId] })
      onClose()
    },
    onError: () => toast.error('Erro ao marcar como perdida'),
  })

  const editMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patch<Opportunity>(`/opportunities/${opportunity!.id}`, data),
    onSuccess: () => {
      toast.success('Oportunidade atualizada!')
      setIsEditing(false)
      void queryClient.invalidateQueries({ queryKey: ['pipeline', pipelineId] })
      void queryClient.invalidateQueries({ queryKey: ['opportunity', opportunity!.id] })
    },
    onError: (err: unknown) => toast.error((err as { message?: string })?.message ?? 'Erro ao atualizar oportunidade'),
  })

  const createActivityMutation = useMutation({
    mutationFn: (data: { type: string; description: string }) =>
      api.post<{ id: string }>('/activities', {
        ...data,
        opportunityId: opportunity!.id,
        ...(opportunity?.contactId ? { contactId: opportunity!.contactId } : {}),
      }),
    onSuccess: () => {
      toast.success('Atividade registrada!')
      setActivityDesc('')
      void queryClient.invalidateQueries({ queryKey: ['opportunity', opportunity!.id] })
    },
    onError: () => toast.error('Erro ao registrar atividade'),
  })

  const completeTaskMutation = useMutation({
    mutationFn: ({ taskId, notes }: { taskId: string; notes: string }) =>
      api.post<Task>(`/tasks/${taskId}/complete`, { completionNotes: notes }),
    onSuccess: () => {
      toast.success('Tarefa concluída!')
      setCompletingTaskId(null)
      setCompletionNotes('')
      void queryClient.invalidateQueries({ queryKey: ['opportunity', opportunity!.id] })
      void queryClient.invalidateQueries({ queryKey: ['tasks-tab', opportunity!.id] })
    },
    onError: () => toast.error('Erro ao completar tarefa'),
  })

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; title: string; dueDate: string; type: string }) =>
      api.put<Task>(`/tasks/${id}`, {
        title: data.title,
        type: data.type,
        dueDate: new Date(data.dueDate).toISOString(),
      }),
    onSuccess: () => {
      toast.success('Tarefa atualizada!')
      setEditingTaskId(null)
      void queryClient.invalidateQueries({ queryKey: ['opportunity', opportunity!.id] })
      void queryClient.invalidateQueries({ queryKey: ['tasks-tab', opportunity!.id] })
    },
    onError: () => toast.error('Erro ao atualizar tarefa'),
  })

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => api.delete<void>(`/tasks/${taskId}`),
    onSuccess: () => {
      toast.success('Tarefa excluída')
      setDeletingTaskId(null)
      void queryClient.invalidateQueries({ queryKey: ['opportunity', opportunity!.id] })
      void queryClient.invalidateQueries({ queryKey: ['tasks-tab', opportunity!.id] })
    },
    onError: () => toast.error('Erro ao excluir tarefa'),
  })

  const createTaskMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Task>('/tasks', data),
    onSuccess: () => {
      toast.success('Tarefa criada!')
      setNewTaskOpen(false)
      setNewTaskForm({ title: '', type: 'CALL', dueDate: '', priority: 'MEDIUM', assignedToId: '' })
      void queryClient.invalidateQueries({ queryKey: ['tasks-tab', opportunity!.id] })
    },
    onError: () => toast.error('Erro ao criar tarefa'),
  })

  const createMeetingMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<OppMeeting>('/meetings', data),
    onSuccess: () => {
      toast.success('Reunião agendada!')
      setNewMeetingOpen(false)
      setNewMeetingForm({ title: '', scheduledAt: '', type: 'VIDEO', hostId: '' })
      void queryClient.invalidateQueries({ queryKey: ['meetings', opportunity!.id] })
    },
    onError: () => toast.error('Erro ao agendar reunião'),
  })

  const createConvMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<OppConversation>('/conversations', data),
    onSuccess: () => {
      toast.success('Conversa criada!')
      setNewConvOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['conversations', opportunity!.id] })
    },
    onError: () => toast.error('Erro ao criar conversa'),
  })

  // Handoff mutation
  const handoffMutation = useMutation({
    mutationFn: ({ closerId, briefing }: { closerId: string; briefing: string }) =>
      api.post<Opportunity>(`/opportunities/${opportunity!.id}/handoff`, {
        closerId,
        sdrBriefing: briefing,
      }),
    onSuccess: () => {
      toast.success('Handoff realizado com sucesso!')
      setHandoffDone(true)
      void queryClient.invalidateQueries({ queryKey: ['opportunity', opportunity!.id] })
      void queryClient.invalidateQueries({ queryKey: ['pipeline', pipelineId] })
    },
    onError: (err: unknown) => {
      toast.error((err as { message?: string })?.message ?? 'Erro ao fazer handoff')
    },
  })

  // Add tag mutation
  const addTagMutation = useMutation({
    mutationFn: (tagId: string) =>
      api.post<{ id: string }>(`/opportunities/${opportunity!.id}/tags`, { tagId }),
    onSuccess: () => {
      toast.success('Tag adicionada!')
      setShowTagPicker(false)
      void queryClient.invalidateQueries({ queryKey: ['opportunity', opportunity!.id] })
    },
    onError: () => toast.error('Erro ao adicionar tag'),
  })

  // Remove tag mutation
  const removeTagMutation = useMutation({
    mutationFn: (tagId: string) =>
      api.delete<void>(`/opportunities/${opportunity!.id}/tags/${tagId}`),
    onSuccess: () => {
      toast.success('Tag removida!')
      void queryClient.invalidateQueries({ queryKey: ['opportunity', opportunity!.id] })
    },
    onError: () => toast.error('Erro ao remover tag'),
  })

  // Create tag mutation (admin/manager only)
  const createTagMutation = useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      api.post<Tag>('/tags', { name: data.name, color: data.color, category: 'CUSTOM' }),
    onSuccess: (createdTag) => {
      toast.success('Tag criada!')
      setShowNewTagForm(false)
      setNewTagData({ name: '', color: '#6366f1' })
      void queryClient.invalidateQueries({ queryKey: ['tags-list'] })
      // Also add it to the opportunity
      addTagMutation.mutate(createdTag.id)
    },
    onError: () => toast.error('Erro ao criar tag'),
  })

  const startConversationMutation = useMutation({
    mutationFn: ({ contactId, numberId, text }: { contactId: string; numberId: string; text: string }) =>
      api.post<{ conversation: { id: string }; message: unknown }>('/whatsapp/conversations/start', {
        contactId,
        numberId,
        text,
      }),
    onSuccess: (data) => {
      toast.success('Conversa iniciada!')
      setActiveConversationId(data.conversation.id)
      setStartMessage('')
    },
    onError: (err: unknown) => {
      const msg = (err as { message?: string })?.message ?? 'Erro ao iniciar conversa'
      toast.error(msg)
    },
  })

  if (!opportunity) return null

  const numbers = numbersData?.numbers ?? []
  const effectiveNumberId = selectedNumberId || numbers[0]?.id || ''
  const tasks = oppDetail?.tasks ?? []
  const tabTasks = tasksTabData ?? []
  const meetings = meetingsData?.meetings ?? []
  const conversations = conversationsData?.conversations ?? []
  const timeline = timelineData ?? []

  function openEdit() {
    const opp = oppDetail ?? opportunity!
    setEditData({
      title: opp.title,
      value: opp.value !== null ? String(opp.value) : '',
      expectedCloseDate: opp.expectedCloseDate ? opp.expectedCloseDate.slice(0, 10) : '',
      notes: opp.notes ?? '',
      stageId: opp.stageId,
      assignedToId: opp.assignedToId,
      originId: opp.originId ?? '',
      originLabel: opp.origin?.name ?? '',
      contactId: opp.contactId ?? '',
      contactLabel: opp.contact?.name ?? '',
      companyId: opp.companyId ?? '',
      companyLabel: opp.company?.name ?? '',
    })
    setIsEditing(true)
  }

  function handleSaveEdit() {
    if (!editData.title.trim()) { toast.error('Título é obrigatório'); return }
    editMutation.mutate({
      title: editData.title,
      ...(editData.value !== '' ? { value: parseFloat(editData.value) } : {}),
      ...(editData.expectedCloseDate ? { expectedCloseDate: new Date(editData.expectedCloseDate).toISOString() } : {}),
      ...(editData.notes ? { notes: editData.notes } : {}),
      ...(editData.stageId ? { stageId: editData.stageId } : {}),
      ...(editData.assignedToId ? { assignedToId: editData.assignedToId } : {}),
      ...(editData.originId ? { originId: editData.originId } : {}),
      ...(editData.contactId ? { contactId: editData.contactId } : {}),
      ...(editData.companyId ? { companyId: editData.companyId } : { companyId: null }),
    })
  }

  function handleStartConversation() {
    if (!opportunity?.contactId || !effectiveNumberId || !startMessage.trim()) return
    startConversationMutation.mutate({
      contactId: opportunity!.contactId,
      numberId: effectiveNumberId,
      text: startMessage.trim(),
    })
  }

  function openTaskEdit(task: Task) {
    setEditingTaskId(task.id)
    setTaskEditForm({
      title: task.title,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
      type: task.type,
    })
  }

  function handleCreateTask() {
    if (!newTaskForm.title.trim()) { toast.error('Título é obrigatório'); return }
    if (!newTaskForm.dueDate) { toast.error('Data de vencimento é obrigatória'); return }
    createTaskMutation.mutate({
      title: newTaskForm.title,
      type: newTaskForm.type,
      priority: newTaskForm.priority,
      dueDate: new Date(newTaskForm.dueDate).toISOString(),
      opportunityId: opportunity!.id,
      ...(newTaskForm.assignedToId ? { assignedToId: newTaskForm.assignedToId } : {}),
    })
  }

  function handleCreateMeeting() {
    if (!newMeetingForm.scheduledAt) { toast.error('Data/hora é obrigatória'); return }
    createMeetingMutation.mutate({
      title: newMeetingForm.title || undefined,
      scheduledAt: new Date(newMeetingForm.scheduledAt).toISOString(),
      type: newMeetingForm.type,
      opportunityId: opportunity!.id,
      ...(newMeetingForm.hostId ? { hostId: newMeetingForm.hostId } : {}),
    })
  }

  function handleCreateConv() {
    createConvMutation.mutate({
      channel: newConvChannel,
      opportunityId: opportunity!.id,
      ...(opportunity!.contactId ? { contactId: opportunity!.contactId } : {}),
    })
  }

  const contact = opportunity.contact
  const contactPhone = contact?.phone ?? null

  return (
    <>
      <Sheet open={!!opportunity} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="right"
          className="p-0 flex flex-col"
          style={{ width: '90vw', maxWidth: '1100px' }}
        >
          {/* Header */}
          <SheetHeader className="px-6 py-4 border-b flex-shrink-0">
            <div className="flex items-start gap-2 pr-8">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <SheetTitle className="truncate text-base flex-1">{opportunity.title}</SheetTitle>
                  <button
                    type="button"
                    title="Excluir oportunidade"
                    className="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={() => setDeleteOppDialogOpen(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {contact && (
                  <Link
                    href={`/contatos/${opportunity.contactId}`}
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline truncate block"
                  >
                    {contact.name}
                  </Link>
                )}
                {opportunity.company && (
                  <Link
                    href={`/empresas/${opportunity.companyId}`}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline truncate block mt-0.5"
                  >
                    {opportunity.company.name}
                  </Link>
                )}
              </div>
            </div>
          </SheetHeader>

          {/* Handoff Banner — shown when no closer assigned */}
          {!opportunity.closerId && !handoffDone && (
            <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm font-medium text-amber-800">
                  Esta oportunidade ainda não foi transferida para um Closer
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={handoffCloserId} onValueChange={setHandoffCloserId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecionar Closer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(closersData?.users ?? []).map((u) => (
                      <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-8 text-xs bg-amber-600 hover:bg-amber-700"
                  disabled={!handoffCloserId || handoffMutation.isPending}
                  onClick={() => handoffMutation.mutate({ closerId: handoffCloserId, briefing: handoffBriefing })}
                >
                  {handoffMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Handshake className="h-3 w-3 mr-1" />}
                  Fazer Handoff
                </Button>
              </div>
              <textarea
                rows={2}
                placeholder="Briefing para o closer (opcional)..."
                value={handoffBriefing}
                onChange={(e) => setHandoffBriefing(e.target.value)}
                className="w-full rounded-md border border-amber-200 bg-white px-2 py-1.5 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 resize-none"
              />
            </div>
          )}

          {/* Two-column body */}
          <div className="flex flex-1 overflow-hidden">
            {/* LEFT PANEL — multi-tab */}
            <div className="w-[480px] shrink-0 border-r overflow-y-auto flex flex-col">
              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap items-center px-4 py-3 border-b">
                <Button
                  size="sm"
                  onClick={() => setWonDialogOpen(true)}
                  disabled={wonMutation.isPending || opportunity.status !== 'OPEN'}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {wonMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                  <span className="ml-1">Ganho</span>
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setLostDialogOpen(true)}
                  disabled={lostMutation.isPending || opportunity.status !== 'OPEN'}
                >
                  {lostMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  <span className="ml-1">Perdido</span>
                </Button>
                <div className="ml-auto flex items-center gap-1">
                  {isEditing ? (
                    <>
                      {isAdmin && (
                        <Button type="button" variant={adminMode ? 'default' : 'ghost'} size="sm" className="h-8 text-xs gap-1.5"
                          onClick={() => setAdminMode(v => !v)}>
                          <Settings2 className="h-3.5 w-3.5" />
                          {adminMode ? 'Sair' : 'Personalizar'}
                        </Button>
                      )}
                      <Button size="sm" onClick={handleSaveEdit} disabled={editMutation.isPending} className="h-8 px-3">
                        {editMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        <span className="ml-1">Salvar</span>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setIsEditing(false); setAdminMode(false) }} className="h-8 px-2">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={openEdit} className="h-8 px-2">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <TabsList className="w-full rounded-none border-b grid grid-cols-5 h-auto px-0">
                  <TabsTrigger value="details" className="text-xs py-2">Detalhes</TabsTrigger>
                  <TabsTrigger value="tasks" className="text-xs py-2">
                    Tarefas {tasks.length > 0 ? `(${tasks.length})` : ''}
                  </TabsTrigger>
                  <TabsTrigger value="meetings" className="text-xs py-2">Reuniões</TabsTrigger>
                  <TabsTrigger value="conversations" className="text-xs py-2">Conversas</TabsTrigger>
                  <TabsTrigger value="timeline" className="text-xs py-2">Histórico</TabsTrigger>
                </TabsList>

                {/* ── Tab: Detalhes ── */}
                <TabsContent value="details" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
                  {isEditing ? (
                    <div className="space-y-3">
                      <FieldWrapper entityType="opportunity" slug="title" label="Título" placeholder="Título da oportunidade" defaultRequired={true} adminMode={adminMode}>
                        <Input
                          value={editData.title}
                          onChange={(e) => setEditData((d) => ({ ...d, title: e.target.value }))}
                        />
                      </FieldWrapper>
                      <div className="grid grid-cols-2 gap-3">
                        <FieldWrapper entityType="opportunity" slug="value" label="Valor (R$)" placeholder="0,00" adminMode={adminMode}>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editData.value}
                            onChange={(e) => setEditData((d) => ({ ...d, value: e.target.value }))}
                          />
                        </FieldWrapper>
                        <FieldWrapper entityType="opportunity" slug="closeDate" label="Fechamento previsto" adminMode={adminMode}>
                          <Input
                            type="date"
                            value={editData.expectedCloseDate}
                            onChange={(e) => setEditData((d) => ({ ...d, expectedCloseDate: e.target.value }))}
                          />
                        </FieldWrapper>
                        <FieldWrapper entityType="opportunity" slug="stage" label="Etapa" defaultRequired={true} adminMode={adminMode}>
                          {stages.length > 0 ? (
                            <Select value={editData.stageId} onValueChange={(v) => setEditData((d) => ({ ...d, stageId: v }))}>
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {stages.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    <div className="flex items-center gap-2">
                                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                                      {s.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input value={opportunity.stage?.name ?? '—'} disabled />
                          )}
                        </FieldWrapper>
                        <FieldWrapper entityType="opportunity" slug="responsible" label="Responsável" adminMode={adminMode}>
                          {(usersData?.users ?? []).length > 0 ? (
                            <Select value={editData.assignedToId} onValueChange={(v) => setEditData((d) => ({ ...d, assignedToId: v }))}>
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(usersData?.users ?? []).map((u) => (
                                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input value={opportunity.assignedTo.name} disabled />
                          )}
                        </FieldWrapper>
                      </div>
                      <FieldWrapper entityType="opportunity" slug="origin" label="Origem / Canal" adminMode={adminMode}>
                        <OriginSearch
                          value={editData.originId}
                          label={editData.originLabel}
                          onChange={(id, path) => setEditData((d) => ({ ...d, originId: id, originLabel: path }))}
                        />
                      </FieldWrapper>
                      <FieldWrapper entityType="opportunity" slug="contact" label="Contato" adminMode={adminMode}>
                        <EntityCombobox
                          entityType="contact"
                          value={editData.contactId}
                          label={editData.contactLabel}
                          allowCreate
                          placeholder="Buscar contato..."
                          onChange={async (id, lbl) => {
                            setEditData((d) => ({ ...d, contactId: id, contactLabel: lbl }))
                            if (id) {
                              try {
                                const c = await api.get<{ companyId?: string; company?: { name: string } }>(`/contacts/${id}`)
                                if (c.companyId && c.company?.name) {
                                  setEditData((d) => ({ ...d, companyId: c.companyId!, companyLabel: c.company!.name }))
                                }
                              } catch { /* ignore */ }
                            }
                          }}
                        />
                      </FieldWrapper>
                      <FieldWrapper entityType="opportunity" slug="company" label="Empresa" adminMode={adminMode}>
                        <EntityCombobox
                          entityType="company"
                          value={editData.companyId}
                          label={editData.companyLabel}
                          allowCreate
                          placeholder="Buscar empresa..."
                          onChange={async (id, lbl) => {
                            setEditData((d) => ({ ...d, companyId: id, companyLabel: lbl }))
                            if (id) {
                              try {
                                const res = await api.get<{ data: { id: string; name: string }[] }>(`/contacts?companyId=${id}&limit=1`)
                                const first = res.data?.[0]
                                if (first) setEditData((d) => d.contactId ? d : { ...d, contactId: first.id, contactLabel: first.name })
                              } catch {}
                            }
                          }}
                        />
                      </FieldWrapper>
                      <FieldWrapper entityType="opportunity" slug="description" label="Notas" placeholder="Observações..." adminMode={adminMode}>
                        <Textarea
                          rows={3}
                          value={editData.notes}
                          onChange={(e) => setEditData((d) => ({ ...d, notes: e.target.value }))}
                          className="resize-none"
                        />
                      </FieldWrapper>
                      {/* Campos personalizados no modo edição */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Campos Personalizados</p>
                        <CustomFieldsPanel
                          entityType="opportunity"
                          entityId={opportunity?.id}
                          adminMode={adminMode}
                          onAdminModeChange={setAdminMode}
                        />
                      </div>
                      {/* Tags */}
                      <TagField
                        entityType="opportunity"
                        entityId={opportunity!.id}
                        queryKey={['opportunity', opportunity!.id]}
                        queryKeys={[['pipeline', pipelineId]]}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(() => {
                        const opp = oppDetail ?? opportunity
                        return (
                          <div className="grid grid-cols-2 gap-3">
                            {contact && (
                              <div className="col-span-2">
                                <p className="text-xs text-muted-foreground mb-1">Contato</p>
                                <Link
                                  href={`/contatos/${opp.contactId}`}
                                  className="text-sm font-medium hover:underline text-primary"
                                >
                                  {contact.name}
                                </Link>
                                {contact.email && <p className="text-xs text-muted-foreground">{contact.email}</p>}
                                {contact.phone && <p className="text-xs text-muted-foreground">{contact.phone}</p>}
                              </div>
                            )}
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Valor</p>
                              <p className="text-sm font-semibold">{formatCurrency(opp.value)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Status</p>
                              <Badge variant={opp.status === 'OPEN' ? 'secondary' : opp.status === 'WON' ? 'success' : 'danger'}>
                                {opp.status === 'OPEN' ? 'Aberto' : opp.status === 'WON' ? 'Ganho' : 'Perdido'}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Fechamento Previsto</p>
                              <p className="text-sm">{opp.expectedCloseDate ? formatDate(opp.expectedCloseDate) : '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Etapa</p>
                              <div className="flex items-center gap-1.5">
                                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: opp.stage?.color ?? '#888' }} />
                                <p className="text-sm">{opp.stage?.name ?? '—'}</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Responsável</p>
                              <p className="text-sm">{opp.assignedTo.name}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Origem</p>
                              <p className="text-sm">{opp.origin ? `${opp.origin.name}${opp.subOrigin ? ` / ${opp.subOrigin.name}` : ''}` : '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Criado em</p>
                              <p className="text-sm">{formatDate(opp.createdAt)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Dias na oportunidade</p>
                              <p className="text-sm">{Math.floor((Date.now() - new Date(opp.createdAt).getTime()) / 86400000)} dias</p>
                            </div>
                            {opp.sdr && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Criado por</p>
                                <p className="text-sm">{opp.sdr.name}</p>
                              </div>
                            )}
                            {opp.closer && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Closer</p>
                                <p className="text-sm">{opp.closer.name}</p>
                              </div>
                            )}
                            {opp.company && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Empresa</p>
                                <Link href={`/empresas/${opp.companyId}`} className="text-sm hover:underline text-primary">
                                  {opp.company.name}
                                </Link>
                              </div>
                            )}
                            {opp.notes && (
                              <div className="col-span-2">
                                <p className="text-xs text-muted-foreground mb-1">Notas</p>
                                <p className="text-sm whitespace-pre-wrap">{opp.notes}</p>
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {/* Campos personalizados (view) */}
                      <CustomFieldsPanel
                        entityType="opportunity"
                        entityId={opportunity?.id}
                        adminMode={false}
                        onAdminModeChange={() => {}}
                      />

                      {/* Tags */}
                      <TagField
                        entityType="opportunity"
                        entityId={opportunity!.id}
                        queryKey={['opportunity', opportunity!.id]}
                        queryKeys={[['pipeline', pipelineId]]}
                      />

                      {/* Registrar atividade */}
                      <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                        <p className="text-xs font-medium text-muted-foreground">Registrar atividade</p>
                        <Select value={activityType} onValueChange={setActivityType}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(activityTypeLabels).map(([val, lbl]) => (
                              <SelectItem key={val} value={val} className="text-xs">{lbl}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Textarea
                          rows={2}
                          placeholder="Descreva a atividade..."
                          value={activityDesc}
                          onChange={(e) => setActivityDesc(e.target.value)}
                          className="text-xs resize-none"
                        />
                        <Button
                          size="sm"
                          className="w-full h-7 text-xs"
                          disabled={!activityDesc.trim() || createActivityMutation.isPending}
                          onClick={() => createActivityMutation.mutate({ type: activityType, description: activityDesc.trim() })}
                        >
                          {createActivityMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                          Registrar
                        </Button>
                      </div>

                      {/* Recent activities */}
                      {oppDetail?.activities && (
                        <RecentActivities activities={oppDetail.activities} />
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* ── Tab: Tarefas ── */}
                <TabsContent value="tasks" className="flex-1 overflow-y-auto p-4 space-y-3 mt-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">{tabTasks.length} tarefa(s)</p>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setNewTaskOpen(true)}>
                      <Plus className="h-3 w-3 mr-1" />
                      Nova Tarefa
                    </Button>
                  </div>

                  {tasksLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
                  ) : tabTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma tarefa vinculada</p>
                  ) : (
                    tabTasks.map((task) => {
                      const isCompleted = task.status === 'COMPLETED'
                      const TaskIcon = taskTypeIcons[task.type] ?? FileText
                      return (
                        <div key={task.id} className="rounded-lg border p-3 space-y-2">
                          {editingTaskId === task.id ? (
                            <div className="space-y-2">
                              <Input
                                value={taskEditForm.title}
                                onChange={(e) => setTaskEditForm((f) => ({ ...f, title: e.target.value }))}
                                placeholder="Título da tarefa"
                                className="h-8 text-sm"
                              />
                              <div className="flex gap-2">
                                <Input
                                  type="date"
                                  value={taskEditForm.dueDate}
                                  onChange={(e) => setTaskEditForm((f) => ({ ...f, dueDate: e.target.value }))}
                                  className="h-8 text-sm flex-1"
                                />
                                <Select value={taskEditForm.type} onValueChange={(v) => setTaskEditForm((f) => ({ ...f, type: v }))}>
                                  <SelectTrigger className="h-8 text-xs flex-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(taskTypeLabels).map(([val, lbl]) => (
                                      <SelectItem key={val} value={val} className="text-xs">{lbl}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex gap-1">
                                <Button size="sm" className="h-7 text-xs flex-1" disabled={updateTaskMutation.isPending}
                                  onClick={() => updateTaskMutation.mutate({ id: task.id, ...taskEditForm })}>
                                  {updateTaskMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                  Salvar
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingTaskId(null)}>
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <button
                                className="mt-0.5 shrink-0"
                                onClick={() => { if (!isCompleted) { setCompletingTaskId(task.id) } }}
                                disabled={isCompleted}
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
                                <p className={cn('text-sm font-medium leading-tight', isCompleted && 'line-through text-muted-foreground')}>
                                  {task.title}
                                </p>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  <span className={cn('text-xs px-1.5 py-0.5 rounded border', priorityColors[task.priority] ?? 'bg-gray-100 text-gray-600')}>
                                    {priorityLabels[task.priority] ?? task.priority}
                                  </span>
                                  <span className={cn('text-xs px-1.5 py-0.5 rounded', getSlaColor(task))}>
                                    {task.dueDate ? formatDate(task.dueDate) : '—'}
                                  </span>
                                  {task.assignedTo && (
                                    <span className="text-xs text-muted-foreground">{task.assignedTo.name}</span>
                                  )}
                                </div>
                              </div>
                              {!isCompleted && (
                                <div className="flex gap-0.5 shrink-0">
                                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openTaskEdit(task)}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                                    onClick={() => setDeletingTaskId(task.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </TabsContent>

                {/* ── Tab: Reuniões ── */}
                <TabsContent value="meetings" className="flex-1 overflow-y-auto p-4 space-y-3 mt-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">{meetings.length} reunião(ões)</p>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setNewMeetingOpen(true)}>
                      <Plus className="h-3 w-3 mr-1" />
                      Agendar
                    </Button>
                  </div>
                  {meetingsLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
                  ) : meetings.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma reunião agendada</p>
                  ) : (
                    meetings.map((meeting) => (
                      <div key={meeting.id} className="rounded-lg border p-3 flex items-start gap-3">
                        <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-full bg-blue-100">
                          <Video className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{meeting.title ?? 'Reunião'}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(meeting.scheduledAt)}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={cn('text-xs px-1.5 py-0.5 rounded', meetingStatusColors[meeting.status] ?? 'bg-gray-100 text-gray-600')}>
                              {meetingStatusLabels[meeting.status] ?? meeting.status}
                            </span>
                            <span className="text-xs text-muted-foreground">{meeting.type}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                {/* ── Tab: Conversas ── */}
                <TabsContent value="conversations" className="flex-1 overflow-y-auto p-4 space-y-3 mt-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">{conversations.length} conversa(s)</p>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setNewConvOpen(true)}>
                      <Plus className="h-3 w-3 mr-1" />
                      Nova Conversa
                    </Button>
                  </div>
                  {convsLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
                  ) : conversations.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma conversa</p>
                  ) : (
                    conversations.map((conv) => (
                      <div key={conv.id} className="rounded-lg border p-3 flex items-start gap-3">
                        <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-full bg-green-100">
                          <MessageSquare className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{channelLabels[conv.channel] ?? conv.channel}</p>
                            <Badge variant="secondary" className="text-xs">{conv.status}</Badge>
                          </div>
                          {conv.assignedTo && (
                            <p className="text-xs text-muted-foreground mt-0.5">Responsável: {conv.assignedTo.name}</p>
                          )}
                          {conv.lastMessageAt && (
                            <p className="text-xs text-muted-foreground">{formatDateTime(conv.lastMessageAt)}</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                {/* ── Tab: Histórico / Timeline ── */}
                <TabsContent value="timeline" className="flex-1 overflow-y-auto p-4 space-y-3 mt-0">
                  {timelineLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
                  ) : timeline.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade registrada</p>
                  ) : (
                    <div className="space-y-3">
                      {timeline.map((item) => {
                        const ItemIcon = activityIcons[item.type] ?? Activity
                        return (
                          <div key={item.id} className="flex items-start gap-3">
                            <div className="h-7 w-7 shrink-0 flex items-center justify-center rounded-full bg-muted mt-0.5">
                              <ItemIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">{item.description}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {item.user && <span className="text-xs text-muted-foreground">{item.user.name}</span>}
                                <span className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* Tags tab removed — tags are now a native field in the Details tab */}
                {(false) && <TabsContent value="__tags_removed__" className="flex-1 overflow-y-auto p-4 space-y-3 mt-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">
                      {(oppDetail?.tagAssignments ?? []).length} tag(s) vinculada(s)
                    </p>
                    <div className="flex gap-1.5">
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant={showNewTagForm ? 'default' : 'outline'}
                          className="h-7 text-xs gap-1"
                          onClick={() => { setShowNewTagForm((v) => !v); setShowTagPicker(false) }}
                        >
                          <Plus className="h-3 w-3" />
                          Nova tag
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={showTagPicker ? 'default' : 'outline'}
                        className="h-7 text-xs"
                        onClick={() => { setShowTagPicker((v) => !v); setShowNewTagForm(false) }}
                      >
                        <TagIcon className="h-3 w-3 mr-1" />
                        {showTagPicker ? 'Fechar' : '+ Tag'}
                      </Button>
                    </div>
                  </div>

                  {/* Inline new tag form (admin only) */}
                  {showNewTagForm && (
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                      <p className="text-xs font-medium text-muted-foreground">Nova tag</p>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Nome</Label>
                          <Input
                            value={newTagData.name}
                            onChange={(e) => setNewTagData((d) => ({ ...d, name: e.target.value }))}
                            placeholder="Ex: Quente, VIP..."
                            className="h-8 text-sm"
                            autoFocus
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Cor</Label>
                          <input
                            type="color"
                            value={newTagData.color}
                            onChange={(e) => setNewTagData((d) => ({ ...d, color: e.target.value }))}
                            className="h-8 w-12 rounded border cursor-pointer p-0.5"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost" size="sm" className="h-7 text-xs"
                          onClick={() => { setShowNewTagForm(false); setNewTagData({ name: '', color: '#6366f1' }) }}
                        >
                          <X className="h-3 w-3 mr-1" /> Cancelar
                        </Button>
                        <Button
                          size="sm" className="h-7 text-xs"
                          disabled={!newTagData.name || createTagMutation.isPending}
                          onClick={() => createTagMutation.mutate(newTagData)}
                        >
                          {createTagMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                          Criar e adicionar
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Tag picker */}
                  {showTagPicker && (
                    <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
                      <p className="text-xs text-muted-foreground font-medium">Selecionar tag para adicionar:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(tagsListData ?? [])
                          .filter((t) => !(oppDetail?.tagAssignments ?? []).some((ta) => ta.tagId === t.id))
                          .map((tag) => (
                            <button
                              key={tag.id}
                              onClick={() => addTagMutation.mutate(tag.id)}
                              disabled={addTagMutation.isPending}
                              className="px-2 py-0.5 rounded text-xs font-medium border transition-opacity hover:opacity-80"
                              style={{
                                backgroundColor: tag.color + '22',
                                color: tag.color,
                                borderColor: tag.color + '55',
                              }}
                            >
                              {tag.name}
                            </button>
                          ))}
                        {(tagsListData ?? []).filter((t) => !(oppDetail?.tagAssignments ?? []).some((ta) => ta.tagId === t.id)).length === 0 && (
                          <p className="text-xs text-muted-foreground">Todas as tags já foram adicionadas</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Current tags */}
                  <div className="flex flex-wrap gap-2">
                    {(oppDetail?.tagAssignments ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center w-full py-4">
                        Nenhuma tag vinculada
                      </p>
                    ) : (
                      (oppDetail?.tagAssignments ?? []).map((ta) => (
                        <div
                          key={ta.id}
                          className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border"
                          style={{
                            backgroundColor: ta.tag.color + '22',
                            color: ta.tag.color,
                            borderColor: ta.tag.color + '55',
                          }}
                        >
                          {ta.tag.name}
                          <button
                            onClick={() => removeTagMutation.mutate(ta.tagId)}
                            disabled={removeTagMutation.isPending}
                            className="ml-0.5 hover:opacity-70"
                            title="Remover tag"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>}
              </Tabs>
            </div>

            {/* RIGHT PANEL — WhatsApp chat */}
            <div className="flex-1 flex flex-col overflow-hidden bg-muted/20">
              {!contact ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/30" />
                  <p className="font-medium text-muted-foreground">Sem contato vinculado</p>
                  <p className="text-sm text-muted-foreground">
                    Vincule um contato a esta oportunidade para ver e enviar mensagens WhatsApp.
                  </p>
                </div>
              ) : activeConversationId ? (
                <>
                  <div className="flex items-center gap-2 px-3 py-2 border-b bg-card flex-shrink-0">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-xs bg-green-100 text-green-700">
                        {getInitials(contact.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{contact.name}</p>
                    </div>
                    {/* Controles IA */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn('h-7 gap-1 text-xs px-2', !convAiEnabled && 'opacity-50')}
                          disabled={!convAiEnabled}
                        >
                          <Bot className="h-3 w-3" />
                          <span className="max-w-[70px] truncate hidden sm:inline">
                            {aiAgents.find((a) => a.id === convAiAgentId)?.name ?? 'Padrão'}
                          </span>
                          <ChevronDown className="h-3 w-3 opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel className="text-xs text-muted-foreground">Agente de IA</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleConvAgentSelect(null)}
                          className={cn('text-xs', !convAiAgentId && 'font-medium text-primary')}
                        >
                          Agente padrão
                        </DropdownMenuItem>
                        {aiAgents.length > 0 && <DropdownMenuSeparator />}
                        {aiAgents.map((a) => (
                          <DropdownMenuItem
                            key={a.id}
                            onClick={() => handleConvAgentSelect(a.id)}
                            className={cn('text-xs', convAiAgentId === a.id && 'font-medium text-primary')}
                          >
                            {a.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <div className="flex items-center gap-1">
                      <Sparkles className={cn('h-3.5 w-3.5', convAiEnabled ? 'text-violet-500' : 'text-muted-foreground')} />
                      <Switch
                        checked={convAiEnabled}
                        onCheckedChange={handleConvAiToggle}
                        disabled={convAiConfigMutation.isPending}
                      />
                    </div>
                    <Link href="/whatsapp" target="_blank">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Abrir no WhatsApp">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                  <ChatWindow conversationId={activeConversationId} />
                </>
              ) : !contactPhone ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                  <Phone className="h-12 w-12 text-muted-foreground/30" />
                  <p className="font-medium text-muted-foreground">Contato sem número de WhatsApp</p>
                  <p className="text-sm text-muted-foreground">
                    Adicione um número de telefone ao contato para iniciar uma conversa.
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                  <div className="w-full max-w-sm space-y-4">
                    <div className="text-center">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-3">
                        <MessageSquare className="h-6 w-6 text-green-600" />
                      </div>
                      <p className="font-medium">Iniciar conversa com {contact.name}</p>
                      <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
                        <Phone className="h-3 w-3" />
                        {contactPhone}
                      </p>
                    </div>

                    {numbers.length > 1 && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground font-medium">Enviar de:</p>
                        <Select value={effectiveNumberId} onValueChange={setSelectedNumberId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar número..." />
                          </SelectTrigger>
                          <SelectContent>
                            {numbers.map((n) => (
                              <SelectItem key={n.id} value={n.id}>
                                {n.phone} — {n.instanceName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {numbers.length === 0 && (
                      <p className="text-xs text-amber-600 text-center">
                        Nenhum número WhatsApp conectado.{' '}
                        <Link href="/configuracoes/whatsapp" className="underline">
                          Configurar agora
                        </Link>
                      </p>
                    )}

                    <Textarea
                      rows={3}
                      placeholder="Digite a primeira mensagem..."
                      value={startMessage}
                      onChange={(e) => setStartMessage(e.target.value)}
                      className="resize-none"
                    />

                    <Button
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={handleStartConversation}
                      disabled={!startMessage.trim() || !effectiveNumberId || startConversationMutation.isPending}
                    >
                      {startConversationMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
                      ) : (
                        <><MessageSquare className="h-4 w-4 mr-2" />Iniciar conversa</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Won / Lost / Delete Dialogs */}
      <ConfirmDialog
        open={wonDialogOpen}
        onOpenChange={setWonDialogOpen}
        title="Marcar como Ganha"
        description={`Confirma que a oportunidade "${opportunity.title}" foi ganha?`}
        confirmLabel="Sim, marcar como ganha"
        variant="default"
        onConfirm={() => { setWonDialogOpen(false); wonMutation.mutate() }}
      />
      <Dialog open={lostDialogOpen} onOpenChange={(v) => { setLostDialogOpen(v); if (!v) setLostReasonId('') }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Marcar como Perdida</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Selecione o motivo da perda para continuar.
            </p>
            <div className="space-y-1.5">
              <Label>Motivo da perda <span className="text-destructive">*</span></Label>
              <Select value={lostReasonId} onValueChange={setLostReasonId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar motivo..." />
                </SelectTrigger>
                <SelectContent>
                  {lostReasons.length === 0 && (
                    <SelectItem value="_none" disabled>Nenhum motivo cadastrado</SelectItem>
                  )}
                  {lostReasons.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lostReasons.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Cadastre motivos em Configurações → Motivos Perda
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setLostDialogOpen(false); setLostReasonId('') }}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={!lostReasonId || lostMutation.isPending}
              onClick={() => { setLostDialogOpen(false); lostMutation.mutate(lostReasonId); setLostReasonId('') }}
            >
              {lostMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar perda'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleteOppDialogOpen}
        onOpenChange={setDeleteOppDialogOpen}
        title="Excluir Oportunidade"
        description={`Tem certeza que deseja excluir "${opportunity.title}"? Todas as tarefas, atividades e histórico vinculados serão perdidos.`}
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteOppMutation.mutate()}
      />
      <ConfirmDialog
        open={!!deletingTaskId}
        onOpenChange={(open) => !open && setDeletingTaskId(null)}
        title="Excluir Tarefa"
        description="Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deletingTaskId && deleteTaskMutation.mutate(deletingTaskId)}
      />

      {/* Complete Task Modal */}
      <Dialog open={!!completingTaskId} onOpenChange={(open) => { if (!open) { setCompletingTaskId(null); setCompletionNotes('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Concluir Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Notas de conclusão <span className="text-red-500">*</span></Label>
              <Textarea
                rows={4}
                placeholder="Descreva o que foi realizado..."
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                className="resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setCompletingTaskId(null); setCompletionNotes('') }}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                disabled={!completionNotes.trim() || completeTaskMutation.isPending}
                onClick={() => { if (completingTaskId) { completeTaskMutation.mutate({ taskId: completingTaskId, notes: completionNotes }) } }}
              >
                {completeTaskMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : 'Concluir'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Task Modal */}
      <Dialog open={newTaskOpen} onOpenChange={(open) => { setNewTaskOpen(open); if (!open) setNewTaskForm({ title: '', type: 'CALL', dueDate: '', priority: 'MEDIUM', assignedToId: '' }) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Ex: Ligar para o cliente"
                value={newTaskForm.title}
                onChange={(e) => setNewTaskForm((f) => ({ ...f, title: e.target.value }))}
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
              <Label>Vencimento <span className="text-red-500">*</span></Label>
              <Input
                type="datetime-local"
                value={newTaskForm.dueDate}
                onChange={(e) => setNewTaskForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
            {(usersData?.users ?? []).length > 0 && (
              <div className="space-y-1.5">
                <Label>Responsável</Label>
                <Select value={newTaskForm.assignedToId} onValueChange={(v) => setNewTaskForm((f) => ({ ...f, assignedToId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {(usersData?.users ?? []).map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setNewTaskOpen(false)}>Cancelar</Button>
              <Button className="flex-1" disabled={createTaskMutation.isPending} onClick={handleCreateTask}>
                {createTaskMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</> : 'Criar Tarefa'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Meeting Modal */}
      <Dialog open={newMeetingOpen} onOpenChange={(open) => { setNewMeetingOpen(open); if (!open) setNewMeetingForm({ title: '', scheduledAt: '', type: 'VIDEO', hostId: '' }) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agendar Reunião</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                placeholder="Ex: Reunião de apresentação"
                value={newMeetingForm.title}
                onChange={(e) => setNewMeetingForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data/Hora <span className="text-red-500">*</span></Label>
                <Input
                  type="datetime-local"
                  value={newMeetingForm.scheduledAt}
                  onChange={(e) => setNewMeetingForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={newMeetingForm.type} onValueChange={(v) => setNewMeetingForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIDEO">Videoconferência</SelectItem>
                    <SelectItem value="IN_PERSON">Presencial</SelectItem>
                    <SelectItem value="PHONE">Telefone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(usersData?.users ?? []).length > 0 && (
              <div className="space-y-1.5">
                <Label>Anfitrião</Label>
                <Select value={newMeetingForm.hostId} onValueChange={(v) => setNewMeetingForm((f) => ({ ...f, hostId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {(usersData?.users ?? []).map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setNewMeetingOpen(false)}>Cancelar</Button>
              <Button className="flex-1" disabled={createMeetingMutation.isPending} onClick={handleCreateMeeting}>
                {createMeetingMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Agendando...</> : 'Agendar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Conversation Modal */}
      <Dialog open={newConvOpen} onOpenChange={setNewConvOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Conversa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Canal</Label>
              <Select value={newConvChannel} onValueChange={setNewConvChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(channelLabels).map(([val, lbl]) => (
                    <SelectItem key={val} value={val}>{lbl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setNewConvOpen(false)}>Cancelar</Button>
              <Button className="flex-1" disabled={createConvMutation.isPending} onClick={handleCreateConv}>
                {createConvMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</> : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
