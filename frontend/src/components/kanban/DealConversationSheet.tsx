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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Snowflake, Trophy, X, Loader2, MessageSquare, Phone, ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import type { Deal, WhatsappNumber } from '@/types'
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

export function DealConversationSheet({ deal, onClose, funnelId }: DealConversationSheetProps) {
  const [lostDialogOpen, setLostDialogOpen] = useState(false)
  const [wonDialogOpen, setWonDialogOpen] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>()
  const [startMessage, setStartMessage] = useState('')
  const [selectedNumberId, setSelectedNumberId] = useState('')
  const queryClient = useQueryClient()

  const conversationId = activeConversationId ?? deal?.lead?.conversations?.[0]?.id

  const { data: dealDetail } = useQuery({
    queryKey: ['deal', deal?.id],
    queryFn: () => api.get<Deal & { activities: unknown[]; tasks: unknown[] }>(`/deals/${deal!.id}`),
    enabled: !!deal?.id,
  })

  const { data: numbersData } = useQuery({
    queryKey: ['whatsapp-numbers'],
    queryFn: () => api.get<{ numbers: WhatsappNumber[] }>('/whatsapp/numbers'),
    enabled: !!deal?.lead && !conversationId,
  })

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

  function handleStartConversation() {
    if (!deal?.lead?.id || !effectiveNumberId || !startMessage.trim()) return
    startConversationMutation.mutate({
      leadId: deal.lead.id,
      numberId: effectiveNumberId,
      text: startMessage.trim(),
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
              <div className="min-w-0">
                <SheetTitle className="truncate text-base">{deal.title}</SheetTitle>
                {deal.lead && (
                  <p className="text-sm text-muted-foreground truncate">{deal.lead.name}</p>
                )}
              </div>
            </div>
          </SheetHeader>

          {/* Two-column body */}
          <div className="flex flex-1 overflow-hidden">
            {/* LEFT PANEL — Deal details */}
            <div className="w-[400px] shrink-0 border-r overflow-y-auto p-5 space-y-5">
              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
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
              </div>

              {/* Info grid */}
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

              {/* Tabs */}
              <Tabs defaultValue="activities">
                <TabsList className="w-full">
                  <TabsTrigger value="activities" className="flex-1">Atividades</TabsTrigger>
                  <TabsTrigger value="tasks" className="flex-1">Tarefas</TabsTrigger>
                </TabsList>
                <TabsContent value="activities" className="mt-4">
                  {dealDetail?.activities ? (
                    <RecentActivities
                      activities={dealDetail.activities as Parameters<typeof RecentActivities>[0]['activities']}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
                  )}
                </TabsContent>
                <TabsContent value="tasks" className="mt-4">
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {dealDetail?.tasks?.length === 0
                      ? 'Nenhuma tarefa vinculada'
                      : `${dealDetail?.tasks?.length ?? 0} tarefas`}
                  </p>
                </TabsContent>
              </Tabs>
            </div>

            {/* RIGHT PANEL — WhatsApp chat */}
            <div className="flex-1 flex flex-col overflow-hidden bg-muted/20">
              {!deal.lead ? (
                /* No lead */
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/30" />
                  <p className="font-medium text-muted-foreground">Sem lead vinculado</p>
                  <p className="text-sm text-muted-foreground">
                    Vincule um lead a este deal para ver e enviar mensagens WhatsApp.
                  </p>
                </div>
              ) : conversationId ? (
                /* Existing conversation */
                <>
                  {/* Contact header */}
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
                /* Lead without phone */
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                  <Phone className="h-12 w-12 text-muted-foreground/30" />
                  <p className="font-medium text-muted-foreground">Lead sem número de WhatsApp</p>
                  <p className="text-sm text-muted-foreground">
                    Adicione um número de telefone ao lead para iniciar uma conversa.
                  </p>
                </div>
              ) : (
                /* Start conversation */
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
    </>
  )
}
