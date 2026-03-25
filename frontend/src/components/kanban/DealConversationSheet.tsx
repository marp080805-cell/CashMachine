'use client'

import { useState } from 'react'
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Snowflake, Trophy, X, Loader2, MessageSquare, Phone, ExternalLink,
  Pencil, Check, Trash2, CheckCircle2, Circle,
} from 'lucide-react'
import Link from 'next/link'
import type { Deal, WhatsappNumber, User, Task } from '@/types'
import { api } from '@/lib/api'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { ChatWindow } from '@/components/whatsapp/ChatWindow'

interface DealConversationSheetProps {
  deal: Deal | null
  onClose: () => void
  funnelId: string
}

interface EditData {
  title: string
  value: string
  probability: string
  expectedClose: string
  notes: string
  stageId: string
  assignedToId: string
}

const activityTypeLabels: Record<string, string> = {
  NOTE: 'Nota',
  CALL: 'Ligação',
  EMAIL: 'Email',
  MEETING: 'Reunião',
  WHATSAPP_MESSAGE: 'WhatsApp',
}

const taskTypeLabels: Record<string, string> = {
  CALL: 'Ligação',
  EMAIL: 'Email',
  MEETING: 'Reunião',
  VISIT: 'Visita',
  PROPOSAL: 'Proposta',
  FOLLOW_UP: 'Follow-up',
  OTHER: 'Outro',
}

export function DealConversationSheet({ deal, onClose, funnelId }: DealConversationSheetProps) {
  const [lostDialogOpen, setLostDialogOpen] = useState(false)
  const [wonDialogOpen, setWonDialogOpen] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>()
  const [startMessage, setStartMessage] = useState('')
  const [selectedNumberId, setSelectedNumberId] = useState('')

  // Edit state
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<EditData>({
    title: '', value: '', probability: '', expectedClose: '', notes: '', stageId: '', assignedToId: '',
  })

  // Activity creation state
  const [activityType, setActivityType] = useState('NOTE')
  const [activityDesc, setActivityDesc] = useState('')

  // Task edit state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [taskEditForm, setTaskEditForm] = useState<{ title: string; dueDate: string; type: string }>({
    title: '', dueDate: '', type: 'CALL',
  })
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)

  const queryClient = useQueryClient()
  const conversationId = activeConversationId ?? deal?.lead?.conversations?.[0]?.id

  const { data: dealDetail } = useQuery({
    queryKey: ['deal', deal?.id],
    queryFn: () => api.get<Deal & { activities: Parameters<typeof RecentActivities>[0]['activities']; tasks: Task[] }>(`/deals/${deal!.id}`),
    enabled: !!deal?.id,
  })

  const { data: numbersData } = useQuery({
    queryKey: ['whatsapp-numbers'],
    queryFn: () => api.get<{ numbers: WhatsappNumber[] }>('/whatsapp/numbers'),
    enabled: !!deal?.lead && !conversationId,
  })

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<{ users: User[] }>('/users'),
    enabled: isEditing,
  })

  // Use cached funnel data for stages select
  const funnelCache = queryClient.getQueryData<{ stages?: Array<{ id: string; name: string; color: string; position: number }> }>(['funnel', funnelId])
  const stages = (funnelCache?.stages ?? []).slice().sort((a, b) => a.position - b.position)

  // — Mutations —

  const wonMutation = useMutation({
    mutationFn: () => api.post(`/deals/${deal!.id}/won`),
    onSuccess: () => {
      toast.success('Deal marcado como GANHO!')
      void queryClient.invalidateQueries({ queryKey: ['funnel', funnelId] })
      onClose()
    },
    onError: () => toast.error('Erro ao marcar como ganho'),
  })

  const lostMutation = useMutation({
    mutationFn: () => api.post(`/deals/${deal!.id}/lost`, { lossReason: 'Não especificado' }),
    onSuccess: () => {
      toast.success('Deal marcado como PERDIDO')
      void queryClient.invalidateQueries({ queryKey: ['funnel', funnelId] })
      onClose()
    },
    onError: () => toast.error('Erro ao marcar como perdido'),
  })

  const freezeMutation = useMutation({
    mutationFn: () => api.patch(`/deals/${deal!.id}/freeze`),
    onSuccess: () => {
      toast.success(deal?.isFrozen ? 'Deal descongelado' : 'Deal congelado')
      void queryClient.invalidateQueries({ queryKey: ['funnel', funnelId] })
    },
    onError: () => toast.error('Erro ao congelar/descongelar'),
  })

  const editMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patch(`/deals/${deal!.id}`, data),
    onSuccess: () => {
      toast.success('Deal atualizado!')
      setIsEditing(false)
      void queryClient.invalidateQueries({ queryKey: ['funnel', funnelId] })
      void queryClient.invalidateQueries({ queryKey: ['deal', deal!.id] })
    },
    onError: () => toast.error('Erro ao atualizar deal'),
  })

  const createActivityMutation = useMutation({
    mutationFn: (data: { type: string; description: string }) =>
      api.post('/activities', {
        ...data,
        dealId: deal!.id,
        ...(deal?.leadId ? { leadId: deal.leadId } : {}),
      }),
    onSuccess: () => {
      toast.success('Atividade registrada!')
      setActivityDesc('')
      void queryClient.invalidateQueries({ queryKey: ['deal', deal!.id] })
    },
    onError: () => toast.error('Erro ao registrar atividade'),
  })

  const completeTaskMutation = useMutation({
    mutationFn: (taskId: string) => api.post(`/tasks/${taskId}/complete`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['deal', deal!.id] }),
    onError: () => toast.error('Erro ao completar tarefa'),
  })

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; title: string; dueDate: string; type: string }) =>
      api.patch(`/tasks/${id}`, {
        title: data.title,
        type: data.type,
        dueDate: new Date(data.dueDate).toISOString(),
      }),
    onSuccess: () => {
      toast.success('Tarefa atualizada!')
      setEditingTaskId(null)
      void queryClient.invalidateQueries({ queryKey: ['deal', deal!.id] })
    },
    onError: () => toast.error('Erro ao atualizar tarefa'),
  })

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => api.delete(`/tasks/${taskId}`),
    onSuccess: () => {
      toast.success('Tarefa excluída')
      setDeletingTaskId(null)
      void queryClient.invalidateQueries({ queryKey: ['deal', deal!.id] })
    },
    onError: () => toast.error('Erro ao excluir tarefa'),
  })

  const startConversationMutation = useMutation({
    mutationFn: ({ leadId, numberId, text }: { leadId: string; numberId: string; text: string }) =>
      api.post<{ conversation: { id: string }; message: unknown }>('/whatsapp/conversations/start', {
        leadId,
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

  if (!deal) return null

  const numbers = numbersData?.numbers ?? []
  const effectiveNumberId = selectedNumberId || numbers[0]?.id || ''
  const tasks = dealDetail?.tasks ?? []

  function openEdit() {
    setEditData({
      title: deal!.title,
      value: deal!.value !== null ? String(deal!.value) : '',
      probability: deal!.probability !== null ? String(deal!.probability) : '',
      expectedClose: deal!.expectedClose ? deal!.expectedClose.slice(0, 10) : '',
      notes: deal!.notes ?? '',
      stageId: deal!.stageId,
      assignedToId: deal!.assignedToId,
    })
    setIsEditing(true)
  }

  function handleSaveEdit() {
    if (!editData.title.trim()) { toast.error('Título é obrigatório'); return }
    editMutation.mutate({
      title: editData.title,
      ...(editData.value !== '' ? { value: parseFloat(editData.value) } : {}),
      ...(editData.probability !== '' ? { probability: parseInt(editData.probability, 10) } : {}),
      ...(editData.expectedClose ? { expectedClose: new Date(editData.expectedClose).toISOString() } : {}),
      notes: editData.notes,
      stageId: editData.stageId,
      assignedToId: editData.assignedToId,
    })
  }

  function handleStartConversation() {
    if (!deal?.lead?.id || !effectiveNumberId || !startMessage.trim()) return
    startConversationMutation.mutate({
      leadId: deal.lead.id,
      numberId: effectiveNumberId,
      text: startMessage.trim(),
    })
  }

  function openTaskEdit(task: Task) {
    setEditingTaskId(task.id)
    setTaskEditForm({
      title: task.title,
      dueDate: task.dueDate.slice(0, 10),
      type: task.type,
    })
  }

  return (
    <>
      <Sheet open={!!deal} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="right"
          className="p-0 flex flex-col"
          style={{ width: '90vw', maxWidth: '1100px' }}
        >
          {/* Header */}
          <SheetHeader className="px-6 py-4 border-b flex-shrink-0">
            <div className="flex items-start gap-2 pr-8">
              {deal.isFrozen && <Snowflake className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />}
              <div className="min-w-0 flex-1">
                <SheetTitle className="truncate text-base">{deal.title}</SheetTitle>
                {deal.lead && (
                  <p className="text-sm text-muted-foreground truncate">{deal.lead.name}</p>
                )}
              </div>
            </div>
          </SheetHeader>

          {/* Two-column body */}
          <div className="flex flex-1 overflow-hidden">
            {/* LEFT PANEL */}
            <div className="w-[420px] shrink-0 border-r overflow-y-auto p-5 space-y-5">
              {/* Actions */}
              <div className="flex gap-2 flex-wrap items-center">
                <Button
                  size="sm"
                  onClick={() => setWonDialogOpen(true)}
                  disabled={wonMutation.isPending || deal.status !== 'OPEN'}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {wonMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                  <span className="ml-1">Ganho</span>
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setLostDialogOpen(true)}
                  disabled={lostMutation.isPending || deal.status !== 'OPEN'}
                >
                  {lostMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  <span className="ml-1">Perdido</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => freezeMutation.mutate()}
                  disabled={freezeMutation.isPending}
                >
                  <Snowflake className="h-4 w-4 mr-1" />
                  {deal.isFrozen ? 'Descongelar' : 'Congelar'}
                </Button>
                <div className="ml-auto">
                  {isEditing ? (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={editMutation.isPending}
                        className="h-8 px-3"
                      >
                        {editMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        <span className="ml-1">Salvar</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsEditing(false)}
                        className="h-8 px-2"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={openEdit} className="h-8 px-2">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Info grid or Edit form */}
              {isEditing ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Título</p>
                    <Input
                      value={editData.title}
                      onChange={(e) => setEditData((d) => ({ ...d, title: e.target.value }))}
                      placeholder="Título do deal"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Valor (R$)</p>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editData.value}
                        onChange={(e) => setEditData((d) => ({ ...d, value: e.target.value }))}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Probabilidade (%)</p>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={editData.probability}
                        onChange={(e) => setEditData((d) => ({ ...d, probability: e.target.value }))}
                        placeholder="50"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Fechamento previsto</p>
                      <Input
                        type="date"
                        value={editData.expectedClose}
                        onChange={(e) => setEditData((d) => ({ ...d, expectedClose: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Etapa</p>
                      {stages.length > 0 ? (
                        <Select value={editData.stageId} onValueChange={(v) => setEditData((d) => ({ ...d, stageId: v }))}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
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
                        <Input value={deal.stage.name} disabled />
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Responsável</p>
                    {(usersData?.users ?? []).length > 0 ? (
                      <Select value={editData.assignedToId} onValueChange={(v) => setEditData((d) => ({ ...d, assignedToId: v }))}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(usersData?.users ?? []).map((u) => (
                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={deal.assignedTo.name} disabled />
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Notas</p>
                    <textarea
                      rows={3}
                      value={editData.notes}
                      onChange={(e) => setEditData((d) => ({ ...d, notes: e.target.value }))}
                      placeholder="Observações sobre o deal..."
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Valor</p>
                    <p className="text-sm font-semibold">{formatCurrency(deal.value)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Probabilidade</p>
                    <p className="text-sm font-semibold">{deal.probability ?? 50}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Fechamento Previsto</p>
                    <p className="text-sm">{deal.expectedClose ? formatDate(deal.expectedClose) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <Badge variant={deal.status === 'OPEN' ? 'secondary' : deal.status === 'WON' ? 'success' : 'danger'}>
                      {deal.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Etapa</p>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: deal.stage.color }} />
                      <p className="text-sm">{deal.stage.name}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Responsável</p>
                    <p className="text-sm">{deal.assignedTo.name}</p>
                  </div>
                  {deal.company && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Empresa</p>
                      <p className="text-sm">{deal.company.name}</p>
                    </div>
                  )}
                  {deal.notes && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">Notas</p>
                      <p className="text-sm whitespace-pre-wrap">{deal.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tabs */}
              <Tabs defaultValue="activities">
                <TabsList className="w-full">
                  <TabsTrigger value="activities" className="flex-1">Atividades</TabsTrigger>
                  <TabsTrigger value="tasks" className="flex-1">
                    Tarefas {tasks.length > 0 && `(${tasks.length})`}
                  </TabsTrigger>
                </TabsList>

                {/* Activities tab */}
                <TabsContent value="activities" className="mt-4 space-y-4">
                  {/* Manual activity form */}
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
                    <textarea
                      rows={2}
                      placeholder="Descreva a atividade..."
                      value={activityDesc}
                      onChange={(e) => setActivityDesc(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
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

                  {/* Activity list */}
                  {dealDetail?.activities ? (
                    <RecentActivities
                      activities={dealDetail.activities}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
                  )}
                </TabsContent>

                {/* Tasks tab */}
                <TabsContent value="tasks" className="mt-4 space-y-2">
                  {tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma tarefa vinculada</p>
                  ) : (
                    tasks.map((task) => (
                      <div key={task.id} className="rounded-lg border p-3 space-y-2">
                        {editingTaskId === task.id ? (
                          /* Edit form */
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
                              <Select
                                value={taskEditForm.type}
                                onValueChange={(v) => setTaskEditForm((f) => ({ ...f, type: v }))}
                              >
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
                              <Button
                                size="sm"
                                className="h-7 text-xs flex-1"
                                disabled={updateTaskMutation.isPending}
                                onClick={() => updateTaskMutation.mutate({ id: task.id, ...taskEditForm })}
                              >
                                {updateTaskMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                Salvar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() => setEditingTaskId(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* View mode */
                          <div className="flex items-start gap-2">
                            <button
                              className="mt-0.5 shrink-0"
                              onClick={() => !task.isCompleted && completeTaskMutation.mutate(task.id)}
                              disabled={task.isCompleted || completeTaskMutation.isPending}
                              title={task.isCompleted ? 'Concluída' : 'Marcar como concluída'}
                            >
                              {task.isCompleted ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium leading-tight ${task.isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                                {task.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {taskTypeLabels[task.type] ?? task.type} · {formatDate(task.dueDate)}
                                {task.isCompleted && ' · Concluída'}
                              </p>
                            </div>
                            {!task.isCompleted && (
                              <div className="flex gap-0.5 shrink-0">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => openTaskEdit(task)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                                  onClick={() => setDeletingTaskId(task.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* RIGHT PANEL — WhatsApp chat */}
            <div className="flex-1 flex flex-col overflow-hidden bg-muted/20">
              {!deal.lead ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/30" />
                  <p className="font-medium text-muted-foreground">Sem lead vinculado</p>
                  <p className="text-sm text-muted-foreground">
                    Vincule um lead a este deal para ver e enviar mensagens WhatsApp.
                  </p>
                </div>
              ) : conversationId ? (
                <>
                  <div className="flex items-center gap-3 px-4 py-3 border-b bg-card flex-shrink-0">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-green-100 text-green-700">
                        {getInitials(deal.lead.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{deal.lead.name}</p>
                      {deal.lead.phone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {deal.lead.phone}
                        </p>
                      )}
                    </div>
                    <Link href="/whatsapp" target="_blank">
                      <Button size="sm" variant="ghost" title="Abrir no WhatsApp">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                  <ChatWindow conversationId={conversationId} />
                </>
              ) : !deal.lead.phone ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                  <Phone className="h-12 w-12 text-muted-foreground/30" />
                  <p className="font-medium text-muted-foreground">Lead sem número de WhatsApp</p>
                  <p className="text-sm text-muted-foreground">
                    Adicione um número de telefone ao lead para iniciar uma conversa.
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                  <div className="w-full max-w-sm space-y-4">
                    <div className="text-center">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-3">
                        <MessageSquare className="h-6 w-6 text-green-600" />
                      </div>
                      <p className="font-medium">Iniciar conversa com {deal.lead.name}</p>
                      <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
                        <Phone className="h-3 w-3" />
                        {deal.lead.phone}
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

                    <textarea
                      rows={3}
                      placeholder="Digite a primeira mensagem..."
                      value={startMessage}
                      onChange={(e) => setStartMessage(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    />

                    <Button
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={handleStartConversation}
                      disabled={
                        !startMessage.trim() ||
                        !effectiveNumberId ||
                        startConversationMutation.isPending
                      }
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

      <ConfirmDialog
        open={wonDialogOpen}
        onOpenChange={setWonDialogOpen}
        title="Marcar como Ganho"
        description={`Confirma que o deal "${deal.title}" foi ganho?`}
        confirmLabel="Sim, marcar como ganho"
        variant="default"
        onConfirm={() => { setWonDialogOpen(false); wonMutation.mutate() }}
      />

      <ConfirmDialog
        open={lostDialogOpen}
        onOpenChange={setLostDialogOpen}
        title="Marcar como Perdido"
        description={`Confirma que o deal "${deal.title}" foi perdido?`}
        confirmLabel="Sim, marcar como perdido"
        variant="destructive"
        onConfirm={() => { setLostDialogOpen(false); lostMutation.mutate() }}
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
    </>
  )
}
