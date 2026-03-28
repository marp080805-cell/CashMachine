'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import {
  Loader2, Plus, Trash2, RefreshCw, Wifi, WifiOff,
  Eye, EyeOff, MessageSquare, Webhook, Copy, Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { WhatsappNumber } from '@/types'

const STATUS_CONFIG = {
  CONNECTED: { label: 'Conectado', color: 'bg-green-100 text-green-700', icon: Wifi },
  DISCONNECTED: { label: 'Desconectado', color: 'bg-muted text-muted-foreground', icon: WifiOff },
  CONNECTING: { label: 'Conectando...', color: 'bg-blue-100 text-blue-700', icon: Loader2 },
  ERROR: { label: 'Erro', color: 'bg-red-100 text-red-700', icon: WifiOff },
}

interface ConnectForm {
  baseUrl: string
  instanceName: string
  apiKey: string
  phone: string
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      title="Copiar URL"
      className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

export default function WhatsappConfigPage() {
  const [connectModalOpen, setConnectModalOpen] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [form, setForm] = useState<ConnectForm>({
    baseUrl: '',
    instanceName: '',
    apiKey: '',
    phone: '',
  })
  const queryClient = useQueryClient()

  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? (typeof window !== 'undefined' ? window.location.origin : '')

  const { data, isLoading } = useQuery({
    queryKey: ['whatsapp-numbers'],
    queryFn: () => api.get<{ numbers: WhatsappNumber[] }>('/whatsapp/numbers'),
    refetchInterval: 15000,
  })

  const connectMutation = useMutation({
    mutationFn: (body: ConnectForm) =>
      api.post<WhatsappNumber>('/whatsapp/numbers/connect', body),
    onSuccess: () => {
      toast.success('Número conectado com sucesso!')
      setConnectModalOpen(false)
      setForm({ baseUrl: '', instanceName: '', apiKey: '', phone: '' })
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { message?: string })?.message ?? 'Erro ao conectar'
      toast.error(msg)
    },
  })

  const verifyMutation = useMutation({
    mutationFn: (id: string) => api.post(`/whatsapp/numbers/${id}/verify`, {}),
    onSuccess: () => {
      toast.success('Status atualizado')
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { message?: string })?.message ?? 'Erro ao verificar'
      toast.error(msg)
    },
  })

  const setupWebhookMutation = useMutation({
    mutationFn: (id: string) => api.post<{ ok: boolean; webhookUrl: string }>(`/whatsapp/numbers/${id}/setup-webhook`),
    onSuccess: (data) => toast.success(`Webhook configurado! URL: ${data.webhookUrl}`),
    onError: (err: unknown) => {
      const msg = (err as { message?: string })?.message ?? 'Erro ao configurar webhook'
      toast.error(msg, { duration: 8000 })
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/whatsapp/numbers/${id}`),
    onSuccess: () => {
      toast.success('Número removido')
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers'] })
    },
    onError: () => toast.error('Erro ao remover'),
  })

  const numbers = data?.numbers ?? []

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.baseUrl || !form.instanceName || !form.apiKey || !form.phone) {
      toast.error('Preencha todos os campos')
      return
    }
    connectMutation.mutate(form)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{numbers.length} número(s) cadastrado(s)</p>
        <Button onClick={() => setConnectModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Conectar Número
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : numbers.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">Nenhum número conectado</p>
          <p className="text-sm text-muted-foreground mt-1">
            Conecte sua instância Evolution API para começar
          </p>
          <Button className="mt-4" onClick={() => setConnectModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Conectar Número
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {numbers.map((number) => {
            const cfg = STATUS_CONFIG[number.status] ?? STATUS_CONFIG.DISCONNECTED
            const Icon = cfg.icon
            const num = number as WhatsappNumber & { apiUrl?: string; instanceName: string }
            const webhookUrl = `${appUrl}/api/whatsapp/webhook/${num.instanceName}`

            return (
              <div key={number.id} className="rounded-lg border bg-card p-4 space-y-3">
                {/* Top row */}
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 flex-shrink-0">
                    <Icon className={cn('h-5 w-5 text-green-600', number.status === 'CONNECTING' && 'animate-spin')} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{number.phone}</p>
                    <p className="text-xs text-muted-foreground font-mono">{num.instanceName}</p>
                    {num.apiUrl && (
                      <p className="text-xs text-muted-foreground truncate">{num.apiUrl}</p>
                    )}
                  </div>

                  <Badge className={cn(cfg.color, 'flex-shrink-0')}>
                    <Icon className={cn('h-3 w-3 mr-1', number.status === 'CONNECTING' && 'animate-spin')} />
                    {cfg.label}
                  </Badge>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Verificar status"
                      onClick={() => verifyMutation.mutate(number.id)}
                      disabled={verifyMutation.isPending}
                    >
                      <RefreshCw className={cn('h-4 w-4', verifyMutation.isPending && 'animate-spin')} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Configurar webhook automaticamente"
                      onClick={() => setupWebhookMutation.mutate(number.id)}
                      disabled={setupWebhookMutation.isPending}
                    >
                      <Webhook className={cn('h-4 w-4', setupWebhookMutation.isPending && 'animate-spin')} />
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

                {/* Webhook URL row */}
                <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                  <Webhook className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground flex-shrink-0">Webhook:</span>
                  <span className="text-xs font-mono text-foreground/80 truncate flex-1">{webhookUrl}</span>
                  <CopyButton text={webhookUrl} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={connectModalOpen} onOpenChange={setConnectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp API</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>URL base da API</Label>
              <Input
                placeholder="https://evolution.exemplo.com"
                value={form.baseUrl}
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nome da instância</Label>
              <Input
                placeholder="minha-instancia"
                value={form.instanceName}
                onChange={(e) => setForm((f) => ({ ...f, instanceName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Token de autenticação</Label>
              <div className="relative">
                <Input
                  type={showToken ? 'text' : 'password'}
                  placeholder="••••••••••••••••••••••••"
                  value={form.apiKey}
                  onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Número padrão (com DDI)</Label>
              <Input
                placeholder="5511999999999"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>

            {/* Webhook URL preview */}
            {form.instanceName && (
              <div className="rounded-md bg-muted p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">URL do webhook que será configurada:</p>
                <div className="flex items-center gap-1">
                  <p className="text-xs font-mono break-all flex-1">
                    {appUrl}/api/whatsapp/webhook/{form.instanceName}
                  </p>
                  <CopyButton text={`${appUrl}/api/whatsapp/webhook/${form.instanceName}`} />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={connectMutation.isPending}>
              {connectMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verificando...</>
              ) : (
                'Verificar e conectar'
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
