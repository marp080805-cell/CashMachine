'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { MessageSquare, Brain, Calendar, Mail, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import Link from 'next/link'

interface TenantConfig {
  openaiApiKey?: string
  openaiModel?: string
  resendApiKey?: string
}

interface WhatsAppStatus {
  connected: boolean
  instance?: string
}

export default function IntegracoesPage() {
  const [tenantConfig, setTenantConfig] = useState<TenantConfig>({})
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus | null>(null)
  const [loading, setLoading] = useState(true)

  // OpenAI
  const [openaiKey, setOpenaiKey] = useState('')
  const [openaiModel, setOpenaiModel] = useState('gpt-4o')
  const [savingOpenai, setSavingOpenai] = useState(false)
  const [savedOpenai, setSavedOpenai] = useState(false)

  // Resend
  const [resendKey, setResendKey] = useState('')
  const [savingResend, setSavingResend] = useState(false)
  const [savedResend, setSavedResend] = useState(false)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const [config, ws] = await Promise.all([
        api.get<TenantConfig>('/tenants/me'),
        api.get<WhatsAppStatus>('/whatsapp/status').catch(() => ({ connected: false })),
      ])
      setTenantConfig(config)
      setOpenaiKey(config.openaiApiKey ? '••••••••••••••••' : '')
      setOpenaiModel(config.openaiModel ?? 'gpt-4o')
      setResendKey(config.resendApiKey ? '••••••••••••••••' : '')
      setWhatsappStatus(ws as WhatsAppStatus)
    } finally {
      setLoading(false)
    }
  }

  async function saveOpenai() {
    setSavingOpenai(true)
    setSavedOpenai(false)
    try {
      const payload: Partial<TenantConfig> = { openaiModel }
      if (openaiKey && !openaiKey.startsWith('•')) {
        payload.openaiApiKey = openaiKey
      }
      await api.patch<TenantConfig>('/tenants/me', payload)
      setSavedOpenai(true)
      setTimeout(() => setSavedOpenai(false), 2000)
    } finally {
      setSavingOpenai(false)
    }
  }

  async function saveResend() {
    setSavingResend(true)
    setSavedResend(false)
    try {
      if (resendKey && !resendKey.startsWith('•')) {
        await api.patch<TenantConfig>('/tenants/me', { resendApiKey: resendKey })
      }
      setSavedResend(true)
      setTimeout(() => setSavedResend(false), 2000)
    } finally {
      setSavingResend(false)
    }
  }

  if (loading) return <div className="text-muted-foreground text-sm">Carregando...</div>

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Integrações</h2>
        <p className="text-sm text-muted-foreground">Conecte o CashMind com outras ferramentas</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* WhatsApp */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100">
                <MessageSquare className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-sm">WhatsApp</CardTitle>
                <p className="text-xs text-muted-foreground">Evolution API</p>
              </div>
              <div className="ml-auto">
                {whatsappStatus?.connected ? (
                  <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
                    <CheckCircle className="h-3 w-3" /> Conectado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground gap-1">
                    <XCircle className="h-3 w-3" /> Desconectado
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {whatsappStatus?.connected && whatsappStatus.instance && (
              <p className="text-xs text-muted-foreground mb-3">
                Instância: <span className="font-mono font-medium">{whatsappStatus.instance}</span>
              </p>
            )}
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href="/configuracoes/whatsapp">Configurar WhatsApp</Link>
            </Button>
          </CardContent>
        </Card>

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
                <Badge className="ml-auto bg-green-100 text-green-700 border-green-200 gap-1">
                  <CheckCircle className="h-3 w-3" /> Configurado
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">API Key</Label>
              <Input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                onFocus={() => { if (openaiKey.startsWith('•')) setOpenaiKey('') }}
                placeholder="sk-..."
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Modelo padrão</Label>
              <Select value={openaiModel} onValueChange={setOpenaiModel}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="gpt-4o-mini">GPT-4o mini</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm" className="w-full"
              onClick={() => void saveOpenai()}
              disabled={savingOpenai}
            >
              {savingOpenai ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Salvando...</>
              ) : savedOpenai ? (
                <><CheckCircle className="h-3.5 w-3.5 mr-1" /> Salvo!</>
              ) : (
                'Salvar'
              )}
            </Button>
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
                <Badge className="ml-auto bg-green-100 text-green-700 border-green-200 gap-1">
                  <CheckCircle className="h-3 w-3" /> Configurado
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">API Key</Label>
              <Input
                type="password"
                value={resendKey}
                onChange={(e) => setResendKey(e.target.value)}
                onFocus={() => { if (resendKey.startsWith('•')) setResendKey('') }}
                placeholder="re_..."
                className="font-mono text-sm"
              />
            </div>
            <Button
              size="sm" className="w-full"
              onClick={() => void saveResend()}
              disabled={savingResend}
            >
              {savingResend ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Salvando...</>
              ) : savedResend ? (
                <><CheckCircle className="h-3.5 w-3.5 mr-1" /> Salvo!</>
              ) : (
                'Salvar'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
