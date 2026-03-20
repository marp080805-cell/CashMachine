'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Snowflake, Trophy, X, Loader2 } from 'lucide-react'
import type { Deal } from '@/types'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { useQuery } from '@tanstack/react-query'

interface DealModalProps {
  deal: Deal | null
  onClose: () => void
  funnelId: string
}

export function DealModal({ deal, onClose, funnelId }: DealModalProps) {
  const [lostDialogOpen, setLostDialogOpen] = useState(false)
  const [wonDialogOpen, setWonDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: dealDetail } = useQuery({
    queryKey: ['deal', deal?.id],
    queryFn: () => api.get<Deal & { activities: unknown[]; tasks: unknown[] }>(`/deals/${deal!.id}`),
    enabled: !!deal?.id,
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

  if (!deal) return null

  return (
    <>
      <Sheet open={!!deal} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-[480px] sm:max-w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 pr-8">
              {deal.isFrozen && <Snowflake className="h-4 w-4 text-blue-400" />}
              <span className="truncate">{deal.title}</span>
            </SheetTitle>
          </SheetHeader>

          <div className="flex gap-2 mt-4 mb-6">
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

          <Tabs defaultValue="details">
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1">Detalhes</TabsTrigger>
              <TabsTrigger value="activities" className="flex-1">Atividades</TabsTrigger>
              <TabsTrigger value="tasks" className="flex-1">Tarefas</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
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
                  <p className="text-xs text-muted-foreground mb-1">Lead</p>
                  <p className="text-sm">{deal.lead?.name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Empresa</p>
                  <p className="text-sm">{deal.company?.name ?? '—'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Responsável</p>
                  <p className="text-sm">{deal.assignedTo.name}</p>
                </div>
                {deal.notes && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Notas</p>
                    <p className="text-sm whitespace-pre-wrap">{deal.notes}</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="activities" className="mt-4">
              {dealDetail?.activities ? (
                <RecentActivities activities={dealDetail.activities as Parameters<typeof RecentActivities>[0]['activities']} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
              )}
            </TabsContent>

            <TabsContent value="tasks" className="mt-4">
              <p className="text-sm text-muted-foreground text-center py-8">
                {dealDetail?.tasks?.length === 0 ? 'Nenhuma tarefa vinculada' : `${dealDetail?.tasks?.length ?? 0} tarefas`}
              </p>
            </TabsContent>
          </Tabs>
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
