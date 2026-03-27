'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Copy, Settings, Bot } from 'lucide-react'
import { api } from '@/lib/api'

interface SalesBot {
  id: string
  name: string
  type: 'CONVERSATION_BOT' | 'INTERNAL_WORKFLOW' | 'HYBRID'
  isActive: boolean
  description?: string
  entryPoint: string
  executionCount?: number
}

const TYPE_LABELS: Record<string, string> = {
  CONVERSATION_BOT: 'Bot Conversa',
  INTERNAL_WORKFLOW: 'Workflow Interno',
  HYBRID: 'Híbrido',
}

const TYPE_COLORS: Record<string, string> = {
  CONVERSATION_BOT: 'bg-blue-100 text-blue-800',
  INTERNAL_WORKFLOW: 'bg-purple-100 text-purple-800',
  HYBRID: 'bg-green-100 text-green-800',
}

const emptyForm = {
  name: '',
  type: 'CONVERSATION_BOT' as SalesBot['type'],
  entryPoint: '',
  description: '',
}

export default function AutomacoesPage() {
  const router = useRouter()
  const [bots, setBots] = useState<SalesBot[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const data = await api.get<SalesBot[]>('/salesbots')
      setBots(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function handleCreate() {
    setSaving(true)
    try {
      const created = await api.post<SalesBot>('/salesbots', form)
      setBots((prev) => [...prev, created])
      setOpen(false)
      setForm(emptyForm)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(bot: SalesBot) {
    const updated = await api.patch<SalesBot>(`/salesbots/${bot.id}`, { isActive: !bot.isActive })
    setBots((prev) => prev.map((b) => (b.id === bot.id ? updated : b)))
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta automação?')) return
    await api.delete(`/salesbots/${id}`)
    setBots((prev) => prev.filter((b) => b.id !== id))
  }

  async function handleDuplicate(id: string) {
    const duplicated = await api.post<SalesBot>(`/salesbots/${id}/duplicate`, {})
    setBots((prev) => [...prev, duplicated])
  }

  if (loading) return <div className="text-muted-foreground text-sm">Carregando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Automações (SalesBots)</h2>
          <p className="text-sm text-muted-foreground">Crie bots e workflows para automatizar processos do CRM</p>
        </div>
        <Button onClick={() => setOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nova Automação
        </Button>
      </div>

      <div className="border rounded-lg divide-y">
        {bots.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma automação cadastrada</div>
        )}
        {bots.map((bot) => (
          <div key={bot.id} className="flex items-center gap-3 px-4 py-3">
            <Bot className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{bot.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[bot.type] ?? 'bg-gray-100 text-gray-700'}`}>
                  {TYPE_LABELS[bot.type] ?? bot.type}
                </span>
                {typeof bot.executionCount === 'number' && (
                  <Badge variant="outline" className="text-xs">{bot.executionCount} execuções</Badge>
                )}
              </div>
              {bot.description && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{bot.description}</p>
              )}
            </div>
            <Switch
              checked={bot.isActive}
              onCheckedChange={() => void handleToggle(bot)}
            />
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => router.push(`/configuracoes/automacoes/${bot.id}`)}
                title="Configurar"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => void handleDuplicate(bot.id)}
                title="Duplicar"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => void handleDelete(bot.id)}
                title="Excluir"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Automação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Bot de boas-vindas"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as SalesBot['type'] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Gatilho de entrada (entryPoint)</Label>
              <Input
                value={form.entryPoint}
                onChange={(e) => setForm((f) => ({ ...f, entryPoint: e.target.value }))}
                placeholder="Ex: nova_oportunidade, mensagem_recebida"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Descreva o objetivo desta automação"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleCreate()} disabled={!form.name || !form.entryPoint || saving}>
              {saving ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
