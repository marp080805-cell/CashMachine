'use client'

import { useState, use } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { OpportunitySummary, Task, Activity } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Mail, Phone, MapPin, ExternalLink, Pencil, Loader2,
  AlertTriangle, ShieldOff, ShieldCheck, FileText,
  Activity as ActivityIcon, CheckSquare, Plus, Building2, Calendar,
} from 'lucide-react'
import Link from 'next/link'
import { formatDate, formatDateTime, formatCurrency, getInitials, cn } from '@/lib/utils'

// ── Contact type (extended) ──

interface ContactDetail {
  id: string
  name: string
  email: string | null
  phone: string | null
  cpfCnpj: string | null
  dateOfBirth: string | null
  avatarUrl: string | null
  isBlacklisted: boolean
  notes: string | null
  address: string | null
  socialProfiles: Record<string, string> | null
  company: { id: string; name: string } | null
  origin: { id: string; name: string } | null
  subOrigin: { id: string; name: string } | null
  tags: Array<{ tag: { name: string; color: string } }>
  createdAt: string
  updatedAt: string
}

interface EditContactForm {
  name: string
  email: string
  phone: string
  cpfCnpj: string
  dateOfBirth: string
  address: string
  notes: string
}

const socialIcons: Record<string, { label: string; icon: React.ElementType }> = {
  instagram: { label: 'Instagram', icon: ExternalLink },
  linkedin: { label: 'LinkedIn', icon: ExternalLink },
  facebook: { label: 'Facebook', icon: ExternalLink },
  twitter: { label: 'Twitter / X', icon: ExternalLink },
  tiktok: { label: 'TikTok', icon: ExternalLink },
  youtube: { label: 'YouTube', icon: ExternalLink },
}

const opportunityStatusLabels: Record<string, string> = {
  OPEN: 'Aberto',
  WON: 'Ganho',
  LOST: 'Perdido',
}

const opportunityStatusColors: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  WON: 'bg-green-100 text-green-700',
  LOST: 'bg-red-100 text-red-700',
}

const activityTypeLabels: Record<string, string> = {
  NOTE: 'Nota',
  CALL: 'Ligação',
  EMAIL: 'Email',
  MEETING: 'Reunião',
  WHATSAPP_MESSAGE: 'WhatsApp',
  OPPORTUNITY_CREATED: 'Oportunidade criada',
  OPPORTUNITY_WON: 'Oportunidade ganha',
  OPPORTUNITY_LOST: 'Oportunidade perdida',
  TASK_COMPLETED: 'Tarefa concluída',
  STAGE_CHANGED: 'Etapa alterada',
}

const priorityLabels: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

const priorityColors: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
}

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [activeTab, setActiveTab] = useState('opportunities')
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<EditContactForm>({
    name: '', email: '', phone: '', cpfCnpj: '', dateOfBirth: '', address: '', notes: '',
  })

  const queryClient = useQueryClient()

  // Contact data
  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => api.get<ContactDetail>(`/contacts/${id}`),
    enabled: !!id,
  })

  // Opportunities (lazy)
  const { data: opportunities, isLoading: oppsLoading } = useQuery({
    queryKey: ['contact-opportunities', id],
    queryFn: () => api.get<OpportunitySummary[]>(`/contacts/${id}/opportunities`),
    enabled: activeTab === 'opportunities' && !!id,
  })

  // Tasks (lazy)
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['contact-tasks', id],
    queryFn: () => api.get<Task[]>(`/tasks?contactId=${id}`),
    enabled: activeTab === 'tasks' && !!id,
  })

  // Activities (lazy)
  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['contact-activities', id],
    queryFn: () => api.get<Activity[]>(`/activities?contactId=${id}`),
    enabled: activeTab === 'activities' && !!id,
  })

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patch<ContactDetail>(`/contacts/${id}`, data),
    onSuccess: () => {
      toast.success('Contato atualizado!')
      setEditOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['contact', id] })
      void queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
    onError: () => toast.error('Erro ao atualizar contato'),
  })

  // Blacklist mutation
  const blacklistMutation = useMutation({
    mutationFn: () => api.put<ContactDetail>(`/contacts/${id}/blacklist`, { blacklisted: !contact?.isBlacklisted }),
    onSuccess: () => {
      toast.success(contact?.isBlacklisted ? 'Contato removido da blacklist' : 'Contato adicionado à blacklist')
      void queryClient.invalidateQueries({ queryKey: ['contact', id] })
    },
    onError: () => toast.error('Erro ao atualizar blacklist'),
  })

  function openEdit() {
    if (!contact) return
    setEditForm({
      name: contact.name,
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      cpfCnpj: contact.cpfCnpj ?? '',
      dateOfBirth: contact.dateOfBirth ? contact.dateOfBirth.slice(0, 10) : '',
      address: contact.address ?? '',
      notes: contact.notes ?? '',
    })
    setEditOpen(true)
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editForm.name.trim()) { toast.error('Nome é obrigatório'); return }
    editMutation.mutate({
      name: editForm.name,
      ...(editForm.email && { email: editForm.email }),
      ...(editForm.phone && { phone: editForm.phone }),
      ...(editForm.cpfCnpj && { cpfCnpj: editForm.cpfCnpj }),
      ...(editForm.dateOfBirth && { dateOfBirth: new Date(editForm.dateOfBirth).toISOString() }),
      ...(editForm.address && { address: editForm.address }),
      ...(editForm.notes && { notes: editForm.notes }),
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>Contato não encontrado</p>
        <Link href="/contatos">
          <Button size="sm" className="mt-4" variant="outline">Voltar para contatos</Button>
        </Link>
      </div>
    )
  }

  const socialEntries = Object.entries(contact.socialProfiles ?? {}).filter(([, url]) => !!url)

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar className="h-16 w-16 text-xl">
          <AvatarFallback className="bg-primary/10 text-primary text-lg">
            {getInitials(contact.name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{contact.name}</h1>
            {contact.isBlacklisted && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <ShieldOff className="h-3 w-3" />
                Blacklisted
              </Badge>
            )}
          </div>

          {contact.company && (
            <p className="text-muted-foreground flex items-center gap-1 mt-0.5">
              <Building2 className="h-4 w-4" />
              {contact.company.name}
            </p>
          )}

          {contact.tags && contact.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {contact.tags.map(({ tag }) => (
                <Badge
                  key={tag.name}
                  variant="outline"
                  className="text-xs"
                  style={{ borderColor: tag.color, color: tag.color }}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap shrink-0">
          <Button size="sm" variant="outline" onClick={openEdit}>
            <Pencil className="h-4 w-4 mr-1" />
            Editar
          </Button>
          <Link href="/funis">
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Nova Oportunidade
            </Button>
          </Link>
          <Button
            size="sm"
            variant={contact.isBlacklisted ? 'outline' : 'destructive'}
            onClick={() => blacklistMutation.mutate()}
            disabled={blacklistMutation.isPending}
          >
            {blacklistMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : contact.isBlacklisted ? (
              <><ShieldCheck className="h-4 w-4 mr-1" />Remover Blacklist</>
            ) : (
              <><ShieldOff className="h-4 w-4 mr-1" />Blacklist</>
            )}
          </Button>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 rounded-xl border bg-card p-4">
        {contact.email && (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <a href={`mailto:${contact.email}`} className="text-sm hover:underline">{contact.email}</a>
            </div>
          </div>
        )}
        {contact.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Telefone</p>
              <a href={`tel:${contact.phone}`} className="text-sm hover:underline">{contact.phone}</a>
            </div>
          </div>
        )}
        {contact.cpfCnpj && (
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">CPF/CNPJ</p>
              <p className="text-sm">{contact.cpfCnpj}</p>
            </div>
          </div>
        )}
        {contact.dateOfBirth && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Aniversário</p>
              <p className="text-sm">{formatDate(contact.dateOfBirth)}</p>
            </div>
          </div>
        )}
        {contact.address && (
          <div className="flex items-center gap-2 col-span-2">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Endereço</p>
              <p className="text-sm">{contact.address}</p>
            </div>
          </div>
        )}
        {socialEntries.length > 0 && (
          <div className="col-span-full">
            <p className="text-xs text-muted-foreground mb-2">Redes Sociais</p>
            <div className="flex gap-3 flex-wrap">
              {socialEntries.map(([key, url]) => {
                const social = socialIcons[key.toLowerCase()]
                const Icon = social?.icon ?? ExternalLink
                return (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {social?.label ?? key}
                  </a>
                )
              })}
            </div>
          </div>
        )}
        {contact.notes && (
          <div className="col-span-full">
            <p className="text-xs text-muted-foreground mb-1">Notas</p>
            <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="opportunities">Oportunidades</TabsTrigger>
          <TabsTrigger value="tasks">Tarefas</TabsTrigger>
          <TabsTrigger value="activities">Atividades</TabsTrigger>
        </TabsList>

        {/* Opportunities Tab */}
        <TabsContent value="opportunities" className="mt-4">
          {oppsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !opportunities || opportunities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Nenhuma oportunidade vinculada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {opportunities.map((opp) => (
                <div key={opp.id} className="flex items-center gap-4 rounded-lg border bg-card p-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{opp.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {opp.pipeline.name} · {opp.stage.name}
                    </p>
                  </div>
                  {opp.value !== null && (
                    <p className="text-sm font-semibold shrink-0">{formatCurrency(opp.value)}</p>
                  )}
                  <span className={cn('text-xs px-2 py-0.5 rounded shrink-0', opportunityStatusColors[opp.status] ?? 'bg-gray-100 text-gray-600')}>
                    {opportunityStatusLabels[opp.status] ?? opp.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="mt-4">
          {tasksLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !tasks || tasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Nenhuma tarefa vinculada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => {
                const isCompleted = task.status === 'COMPLETED'
                return (
                  <div key={task.id} className={cn('flex items-center gap-3 rounded-lg border bg-card p-4', isCompleted && 'opacity-60')}>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium', isCompleted && 'line-through text-muted-foreground')}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">{task.type}</span>
                        {task.dueDate && (
                          <>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{formatDateTime(task.dueDate)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className={cn('text-xs px-1.5 py-0.5 rounded', priorityColors[task.priority] ?? 'bg-gray-100 text-gray-600')}>
                      {priorityLabels[task.priority] ?? task.priority}
                    </span>
                    <Badge variant={isCompleted ? 'outline' : 'secondary'} className="text-xs">
                      {isCompleted ? 'Concluída' : task.status}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Activities Tab */}
        <TabsContent value="activities" className="mt-4">
          {activitiesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !activities || activities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ActivityIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Nenhuma atividade registrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="h-7 w-7 shrink-0 flex items-center justify-center rounded-full bg-muted mt-0.5">
                    <ActivityIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{item.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs">
                        {activityTypeLabels[item.type] ?? item.type}
                      </Badge>
                      {item.user && <span className="text-xs text-muted-foreground">{item.user.name}</span>}
                      <span className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open) }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Contato</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome <span className="text-red-500">*</span></Label>
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
                <Label>CPF/CNPJ</Label>
                <Input
                  value={editForm.cpfCnpj}
                  onChange={(e) => setEditForm((f) => ({ ...f, cpfCnpj: e.target.value }))}
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data de Nascimento</Label>
                <Input
                  type="date"
                  value={editForm.dateOfBirth}
                  onChange={(e) => setEditForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Endereço</Label>
              <Input
                value={editForm.address}
                onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Rua, número, cidade..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <textarea
                rows={3}
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Observações..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={editMutation.isPending}>
                {editMutation.isPending
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                  : 'Salvar'
                }
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
