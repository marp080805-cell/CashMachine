'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Brain, Calendar, Mail, CheckCircle, XCircle, Loader2,
  Plus, Trash2, RefreshCw, Wifi, WifiOff, Eye, EyeOff,
  MessageSquare, Webhook, Copy, Check,
} from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { WhatsappNumber } from '@/types'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TenantConfig {
  openaiApiKey?: string
  openaiModel?: string
  resendApiKey?: string
}

interface ConnectForm {
  baseUrl: string
  instanceName: string
  apiKey: string
  phone: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const WA_STATUS = {
  CONNECTED:    { label: 'Conectado',    color: 'bg-green-100 text-green-700', icon: Wifi },
  DISCONNECTED: { label: 'Desconectado', color: 'bg-muted text-muted-foreground', icon: WifiOff },
  CONNECTING:   { label: 'Conectando...', color: 'bg-blue-100 text-blue-700', icon: Loader2 },
  ERROR:        { label: 'Erro',          color: 'bg-red-100 text-red-700', icon: WifiOff },
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      title="Copiar"
      className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function IntegracoesPage() {
  // ── Tenant config (OpenAI / Resend) ─────────────────────────────────────────
  const [tenantConfig, setTenantConfig] = useState<TenantConfig>({})
  const [loadingConfig, setLoadingConfig] = useState(true)

  const [openaiKey, setOpenaiKey]     = useState('')
  const [openaiModel, setOpenaiModel] = useState('gpt-4o')
  const [savingOpenai, setSavingOpenai] = useState(false)
  const [savedOpenai, setSavedOpenai]   = useState(false)

  const [resendKey, setResendKey]     = useState('')
  const [savingResend, setSavingResend] = useState(false)
  const [savedResend, setSavedResend]   = useState(false)

  useEffect(() => {
    void loadConfig()
  }, [])

  async function loadConfig() {
    setLoadingConfig(true)
    try {
      const config = await api.get<TenantConfig>('/tenants/me')
      setTenantConfig(config)
      setOpenaiKey(config.openaiApiKey ? '••••••••••••••••' : '')
      setOpenaiModel(config.openaiModel ?? 'gpt-4o')
      setResendKey(config.resendApiKey ? '••••••••••••••••' : '')
    } finally {
      setLoadingConfig(false)
    }
  }

  async function saveOpenai() {
    setSavingOpenai(true); setSavedOpenai(false)
    try {
      const payload: Partial<TenantConfig> = { openaiModel }
      if (openaiKey && !openaiKey.startsWith('•')) payload.openaiApiKey = openaiKey
      await api.patch<TenantConfig>('/tenants/me', payload)
      setSavedOpenai(true); setTimeout(() => setSavedOpenai(false), 2000)
    } finally { setSavingOpenai(false) }
  }

  async function saveResend() {
    setSavingResend(true); setSavedResend(false)
    try {
      if (resendKey && !resendKey.startsWith('•')) {
        await api.patch<TenantConfig>('/tenants/me', { resendApiKey: resendKey })
      }
      setSavedResend(true); setTimeout(() => setSavedResend(false), 2000)
    } finally { setSavingResend(false) }
  }

  // ── WhatsApp ─────────────────────────────────────────────────────────────────
  const [connectOpen, setConnectOpen] = useState(false)
  const [showToken, setShowToken]     = useState(false)
  const [form, setForm] = useState<ConnectForm>({ baseUrl: '', instanceName: '', apiKey: '', phone: '' })
  const queryClient = useQueryClient()

  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? (typeof window !== 'undefined' ? window.location.origin : '')

  const { data: waData, isLoading: waLoading } = useQuery({
    queryKey: ['whatsapp-numbers'],
    queryFn: () => api.get<{ numbers: WhatsappNumber[] }>('/whatsapp/numbers'),
    refetchInterval: 15000,
  })
  const numbers = waData?.numbers ?? []
  const anyConnected = numbers.some((n) => n.status === 'CONNECTED')

  const connectMutation = useMutation({
    mutationFn: (body: ConnectForm) => api.post<WhatsappNumber>('/whatsapp/numbers/connect', body),
    onSuccess: () => {
      toast.success('Número conectado!')
      setConnectOpen(false)
      setForm({ baseUrl: '', instanceName: '', apiKey: '', phone: '' })
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers'] })
    },
    onError: (err: unknown) => toast.error((err as { message?: string })?.message ?? 'Erro ao conectar'),
  })

  const verifyMutation = useMutation({
    mutationFn: (id: string) => api.post(`/whatsapp/numbers/${id}/verify`, {}),
    onSuccess: () => { toast.success('Status atualizado'); void queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers'] }) },
    onError: (err: unknown) => toast.error((err as { message?: string })?.message ?? 'Erro ao verificar'),
  })

  const webhookMutation = useMutation({
    mutationFn: (id: string) => api.post<{ ok: boolean; webhookUrl: string }>(`/whatsapp/numbers/${id}/setup-webhook`),
    onSuccess: (d) => toast.success(`Webhook configurado! ${d.webhookUrl}`),
    onError: (err: unknown) => toast.error((err as { message?: string })?.message ?? 'Erro ao configurar webhook', { duration: 8000 }),
  })

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/whatsapp/numbers/${id}`),
    onSuccess: () => { toast.success('Número removido'); void queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers'] }) },
    onError: () => toast.error('Erro ao remover'),
  })

  function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    if (!form.baseUrl || !form.instanceName || !form.apiKey || !form.phone) {
      toast.error('Preencha todos os campos'); return
    }
    connectMutation.mutate(form)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Integrações</h2>
        <p className="text-sm text-muted-foreground">Conecte o CashMind com outras ferramentas</p>
      </div>

      {/* ── WhatsApp (full width) ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 shrink-0">
              <MessageSquare className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-sm">WhatsApp</CardTitle>
              <p className="text-xs text-muted-foreground">Evolution API</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {anyConnected ? (
                <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
                  <CheckCircle className="h-3 w-3" /> Conectado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground gap-1">
                  <XCircle className="h-3 w-3" /> Desconectado
                </Badge>
              )}
              <Button size="sm" onClick={() => setConnectOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Conectar Número
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {waLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : numbers.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Nenhum número conectado</p>
              <p className="text-xs text-muted-foreground mt-1">Conecte sua instância Evolution API para começar</p>
              <Button size="sm" className="mt-4" onClick={() => setConnectOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Conectar Número
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {numbers.map((number) => {
                const cfg = WA_STATUS[number.status] ?? WA_STATUS.DISCONNECTED
                const Icon = cfg.icon
                const num = number as WhatsappNumber & { apiUrl?: string; instanceName: string }
                const webhookUrl = `${appUrl}/api/whatsapp/webhook/${num.instanceName}`
                return (
                  <div key={number.id} className="rounded-lg border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 shrink-0">
                        <Icon className={cn('h-4 w-4 text-green-600', number.status === 'CONNECTING' && 'animate-spin')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{number.phone}</p>
                        <p className="text-xs text-muted-foreground font-mono">{num.instanceName}</p>
                        {num.apiUrl && <p className="text-xs text-muted-foreground truncate">{num.apiUrl}</p>}
                      </div>
                      <Badge className={cn(cfg.color, 'shrink-0 text-xs')}>
                        <Icon className={cn('h-3 w-3 mr-1', number.status === 'CONNECTING' && 'animate-spin')} />
                        {cfg.label}
                      </Badge>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="ghost" title="Verificar status"
                          onClick={() => verifyMutation.mutate(number.id)} disabled={verifyMutation.isPending}>
                          <RefreshCw className={cn('h-3.5 w-3.5', verifyMutation.isPending && 'animate-spin')} />
                        </Button>
                        <Button size="sm" variant="ghost" title="Configurar webhook"
                          onClick={() => webhookMutation.mutate(number.id)} disabled={webhookMutation.isPending}>
                          <Webhook className={cn('h-3.5 w-3.5', webhookMutation.isPending && 'animate-spin')} />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => disconnectMutation.mutate(number.id)} disabled={disconnectMutation.isPending}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                      <Webhook className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground shrink-0">Webhook:</span>
                      <span className="text-xs font-mono text-foreground/80 truncate flex-1">{webhookUrl}</span>
                      <CopyButton text={webhookUrl} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Other integrations (2-col grid) ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* OpenAI */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100">
                <Brain className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-sm">OpenAI</CardTitle>
                <p className="text-xs text-muted-foreground">IA e sugestões</p>
              </div>
              {tenantConfig.openaiApiKey && (
                <Badge className="ml-auto bg-green-100 text-green-700 border-green-200 gap-1 text-xs">
                  <CheckCircle className="h-3 w-3" /> Configurado
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingConfig ? <Skeleton className="h-20" /> : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">API Key</Label>
                  <Input type="password" value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    onFocus={() => { if (openaiKey.startsWith('•')) setOpenaiKey('') }}
                    placeholder="sk-..." className="font-mono text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Modelo padrão</Label>
                  <Select value={openaiModel} onValueChange={setOpenaiModel}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="gpt-4o-mini">GPT-4o mini</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" className="w-full" onClick={() => void saveOpenai()} disabled={savingOpenai}>
                  {savingOpenai ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Salvando...</>
                    : savedOpenai ? <><CheckCircle className="h-3.5 w-3.5 mr-1" />Salvo!</>
                    : 'Salvar'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Resend */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100">
                <Mail className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-sm">Resend</CardTitle>
                <p className="text-xs text-muted-foreground">Envio de e-mails</p>
              </div>
              {tenantConfig.resendApiKey && (
                <Badge className="ml-auto bg-green-100 text-green-700 border-green-200 gap-1 text-xs">
                  <CheckCircle className="h-3 w-3" /> Configurado
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingConfig ? <Skeleton className="h-16" /> : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">API Key</Label>
                  <Input type="password" value={resendKey}
                    onChange={(e) => setResendKey(e.target.value)}
                    onFocus={() => { if (resendKey.startsWith('•')) setResendKey('') }}
                    placeholder="re_..." className="font-mono text-sm" />
                </div>
                <Button size="sm" className="w-full" onClick={() => void saveResend()} disabled={savingResend}>
                  {savingResend ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Salvando...</>
                    : savedResend ? <><CheckCircle className="h-3.5 w-3.5 mr-1" />Salvo!</>
                    : 'Salvar'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Google Calendar */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-sm">Google Calendar</CardTitle>
                <p className="text-xs text-muted-foreground">Sincronização de eventos</p>
              </div>
              <Badge variant="outline" className="ml-auto text-xs">Em breve</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" className="w-full" disabled>
              Conectar Google Calendar
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Connect modal ────────────────────────────────────────────────────── */}
      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp API</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleConnect} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>URL base da API</Label>
              <Input placeholder="https://evolution.exemplo.com" value={form.baseUrl}
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Nome da instância</Label>
              <Input placeholder="minha-instancia" value={form.instanceName}
                onChange={(e) => setForm((f) => ({ ...f, instanceName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Token de autenticação</Label>
              <div className="relative">
                <Input type={showToken ? 'text' : 'password'} placeholder="••••••••••••••••••••••••"
                  value={form.apiKey} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                  className="pr-10" />
                <button type="button" onClick={() => setShowToken((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Número padrão (com DDI)</Label>
              <Input placeholder="5511999999999" value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            {form.instanceName && (
              <div className="rounded-md bg-muted p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">URL do webhook:</p>
                <div className="flex items-center gap-1">
                  <p className="text-xs font-mono break-all flex-1">
                    {appUrl}/api/whatsapp/webhook/{form.instanceName}
                  </p>
                  <CopyButton text={`${appUrl}/api/whatsapp/webhook/${form.instanceName}`} />
                </div>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={connectMutation.isPending}>
              {connectMutation.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verificando...</>
                : 'Verificar e conectar'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
