'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { api } from '@/lib/api'

interface MessageTemplate {
  id: string
  name: string
  channel: string
  subject?: string
  body: string
}

const CHANNELS = ['WHATSAPP', 'EMAIL', 'SMS'] as const
const channelLabels: Record<string, string> = { WHATSAPP: 'WhatsApp', EMAIL: 'E-mail', SMS: 'SMS' }
const VARIABLES = ['{{contact.name}}', '{{contact.phone}}', '{{opportunity.title}}', '{{user.name}}', '{{company.name}}']

const emptyForm = { name: '', channel: 'WHATSAPP', subject: '', body: '' }

export default function TemplatesMensagemPage() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<MessageTemplate | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const data = await api.get('/message-templates')
      setTemplates(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  function openCreate(channel = 'WHATSAPP') {
    setEditing(null)
    setForm({ ...emptyForm, channel })
    setOpen(true)
  }

  function openEdit(t: MessageTemplate) {
    setEditing(t)
    setForm({ name: t.name, channel: t.channel, subject: t.subject ?? '', body: t.body })
    setOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = { ...form, subject: form.channel === 'EMAIL' ? form.subject : undefined }
      if (editing) {
        const updated = await api.patch(`/message-templates/${editing.id}`, payload)
        setTemplates((prev) => prev.map((t) => (t.id === editing.id ? updated : t)))
      } else {
        const created = await api.post('/message-templates', payload)
        setTemplates((prev) => [...prev, created])
      }
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este template?')) return
    await api.delete(`/message-templates/${id}`)
    setTemplates((prev) => prev.filter((t) => t.id !== id))
  }

  function insertVariable(variable: string) {
    setForm((f) => ({ ...f, body: f.body + variable }))
  }

  const byChannel = (ch: string) => templates.filter((t) => t.channel === ch)

  if (loading) return <div className="text-muted-foreground text-sm">Carregando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Templates de Mensagem</h2>
          <p className="text-sm text-muted-foreground">Templates reutilizáveis para WhatsApp, e-mail e SMS</p>
        </div>
        <Button onClick={() => openCreate()} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Novo Template
        </Button>
      </div>

      <Tabs defaultValue="WHATSAPP">
        <TabsList>
          {CHANNELS.map((ch) => (
            <TabsTrigger key={ch} value={ch}>
              {channelLabels[ch]} ({byChannel(ch).length})
            </TabsTrigger>
          ))}
        </TabsList>
        {CHANNELS.map((ch) => (
          <TabsContent key={ch} value={ch}>
            <div className="border rounded-lg divide-y mt-3">
              {byChannel(ch).length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground mb-3">Nenhum template de {channelLabels[ch]}</p>
                  <Button size="sm" variant="outline" onClick={() => openCreate(ch)}>
                    <Plus className="h-4 w-4 mr-1" /> Criar template
                  </Button>
                </div>
              )}
              {byChannel(ch).map((tmpl) => (
                <div key={tmpl.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{tmpl.name}</p>
                    {tmpl.subject && (
                      <p className="text-xs text-muted-foreground mt-0.5">Assunto: {tmpl.subject}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tmpl.body}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tmpl)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => void handleDelete(tmpl.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Template' : 'Novo Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Boas-vindas..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Canal</Label>
                <Select value={form.channel} onValueChange={(v) => setForm((f) => ({ ...f, channel: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => (
                      <SelectItem key={c} value={c}>{channelLabels[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.channel === 'EMAIL' && (
              <div className="space-y-1.5">
                <Label>Assunto</Label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="Assunto do e-mail..."
                />
              </div>
            )}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Mensagem</Label>
                <div className="flex gap-1 flex-wrap">
                  {VARIABLES.map((v) => (
                    <button
                      key={v}
                      onClick={() => insertVariable(v)}
                      className="text-xs bg-muted hover:bg-muted/80 rounded px-1.5 py-0.5 font-mono"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Olá {{contact.name}}, ..."
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSave()} disabled={!form.name || !form.body || saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
