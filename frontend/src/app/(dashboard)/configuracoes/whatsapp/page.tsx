'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { Loader2, Plus, Trash2, RefreshCw, Wifi, WifiOff, QrCode } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { WhatsappNumber } from '@/types'

const STATUS_CONFIG = {
  CONNECTED: { label: 'Conectado', color: 'bg-green-100 text-green-700', icon: Wifi },
  DISCONNECTED: { label: 'Desconectado', color: 'bg-muted text-muted-foreground', icon: WifiOff },
  CONNECTING: { label: 'Conectando...', color: 'bg-blue-100 text-blue-700', icon: Loader2 },
  ERROR: { label: 'Erro', color: 'bg-red-100 text-red-700', icon: WifiOff },
}

export default function WhatsappConfigPage() {
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['whatsapp-numbers'],
    queryFn: () => api.get<{ numbers: WhatsappNumber[] }>('/whatsapp/numbers'),
    refetchInterval: 10000,
  })

  const connectMutation = useMutation({
    mutationFn: () => api.post<{ qrcode: string; instanceName: string }>('/whatsapp/numbers', {}),
    onSuccess: (result) => {
      setQrCode(result.qrcode)
      setConnecting(true)
    },
    onError: () => toast.error('Erro ao iniciar conexão'),
  })

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/whatsapp/numbers/${id}`),
    onSuccess: () => {
      toast.success('Número desconectado')
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers'] })
    },
    onError: () => toast.error('Erro ao desconectar'),
  })

  useEffect(() => {
    if (!connecting) return
    const interval = setInterval(async () => {
      await queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers'] })
      const numbers = data?.numbers ?? []
      const justConnected = numbers.find((n) => n.status === 'CONNECTED')
      if (justConnected) {
        setConnecting(false)
        setQrModalOpen(false)
        setQrCode(null)
        toast.success('WhatsApp conectado com sucesso!')
        clearInterval(interval)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [connecting, data, queryClient])

  const numbers = data?.numbers ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{numbers.length} número(s) cadastrado(s)</p>
        <Button onClick={() => { setQrCode(null); setQrModalOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Conectar Número
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : numbers.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center">
          <QrCode className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">Nenhum número conectado</p>
          <p className="text-sm text-muted-foreground mt-1">Conecte um número WhatsApp para começar</p>
          <Button className="mt-4" onClick={() => setQrModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Conectar Número
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {numbers.map((number) => {
            const cfg = STATUS_CONFIG[number.status] ?? STATUS_CONFIG.DISCONNECTED
            const Icon = cfg.icon
            return (
              <div key={number.id} className="rounded-lg border bg-card p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <Icon className={cn('h-5 w-5 text-green-600', number.status === 'CONNECTING' && 'animate-spin')} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{number.phone}</p>
                  <p className="text-xs text-muted-foreground font-mono">{number.instanceName}</p>
                </div>
                <Badge className={cfg.color}>
                  <Icon className={cn('h-3 w-3 mr-1', number.status === 'CONNECTING' && 'animate-spin')} />
                  {cfg.label}
                </Badge>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers'] })}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => disconnectMutation.mutate(number.id)}
                    disabled={disconnectMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={qrModalOpen} onOpenChange={(open) => { setQrModalOpen(open); if (!open) { setQrCode(null); setConnecting(false) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {!qrCode ? (
              <>
                <QrCode className="h-16 w-16 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground text-center">
                  Clique em "Gerar QR Code" para iniciar a conexão com seu WhatsApp
                </p>
                <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
                  {connectMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando...</>
                  ) : (
                    <><QrCode className="h-4 w-4 mr-2" />Gerar QR Code</>
                  )}
                </Button>
              </>
            ) : (
              <>
                <div className="rounded-lg border p-3 bg-card">
                  <img src={qrCode} alt="QR Code WhatsApp" className="w-56 h-56" />
                </div>
                <p className="text-sm text-center text-muted-foreground">
                  Abra o WhatsApp no celular → Dispositivos conectados → Conectar dispositivo → Escaneie o QR
                </p>
                {connecting && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Aguardando escaneamento...
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Novo QR Code
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
