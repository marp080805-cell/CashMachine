'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Bot, Plus, Loader2, Pencil, Trash2, FlaskConical,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

// ── Types ──

interface AIAgent {
  id: string
  name: string
  type: string
  model: string
  systemPrompt: string
  temperature: number
  maxTokens: number
  isActive: boolean
  totalSuggestions?: number
  approvedCount?: number
}

// ── Constants ──

const agentTypes = [
  { value: 'CONVERSATION_ASSISTANT', label: 'Assistente de Conversa' },
  { value: 'RECORDING_ANALYZER', label: 'Analisador de Gravações' },
  { value: 'LEAD_QUALIFIER', label: 'Qualificador de Leads' },
  { value: 'CUSTOM', label: 'Personalizado' },
]

const agentProviders = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
]

const agentModelsByProvider: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-5', label: 'GPT-5' },
    { value: 'gpt-5-mini', label: 'GPT-5 Mini' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4.5-preview', label: 'GPT-4.5 Preview' },
    { value: 'o4-mini', label: 'o4-mini' },
    { value: 'o3', label: 'o3' },
    { value: 'o3-mini', label: 'o3-mini' },
    { value: 'o1', label: 'o1' },
    { value: 'o1-mini', label: 'o1-mini' },
  ],
  anthropic: [
    { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
  ],
}

const allAgentModels = [...agentModelsByProvider.openai, ...agentModelsByProvider.anthropic]

function inferProvider(model: string): string {
  if (model.startsWith('claude')) return 'anthropic'
  return 'openai'
}

const typeBadgeColors: Record<string, string> = {
  CONVERSATION_ASSISTANT: 'bg-blue-100 text-blue-700',
  RECORDING_ANALYZER: 'bg-purple-100 text-purple-700',
  LEAD_QUALIFIER: 'bg-green-100 text-green-700',
  CUSTOM: 'bg-gray-100 text-gray-700',
}

// ── AgentCard ──

interface AgentCardProps {
  agent: AIAgent
  onEdit: (agent: AIAgent) => void
  onDelete: (id: string) => void
  onTest: (agent: AIAgent) => void
  onToggle: (agent: AIAgent) => void
  isToggling: boolean
}

function AgentCard({ agent, onEdit, onDelete, onTest, onToggle, isToggling }: AgentCardProps) {
  const typeLabel = agentTypes.find((t) => t.value === agent.type)?.label ?? agent.type
  const modelLabel = allAgentModels.find((m) => m.value === agent.model)?.label ?? agent.model
  const provider = inferProvider(agent.model)

  return (
    <div className={cn(
      'rounded-lg border bg-card p-4 space-y-3 transition-opacity',
      !agent.isActive && 'opacity-60',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{agent.name}</p>
            <p className="text-xs text-muted-foreground">
            {modelLabel}
            <span className={cn('ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium', provider === 'anthropic' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700')}>
              {provider === 'anthropic' ? 'Anthropic' : 'OpenAI'}
            </span>
          </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Switch
            checked={agent.isActive}
            onCheckedChange={() => onToggle(agent)}
            disabled={isToggling}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', typeBadgeColors[agent.type] ?? 'bg-gray-100 text-gray-700')}>
          {typeLabel}
        </span>
        <span className="text-xs text-muted-foreground">
          temp: {agent.temperature} · max: {agent.maxTokens} tokens
        </span>
      </div>

      {(agent.totalSuggestions !== undefined) && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{agent.totalSuggestions} sugestões</span>
          {agent.approvedCount !== undefined && (
            <span>{agent.approvedCount} aprovadas</span>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => onTest(agent)}>
          <FlaskConical className="h-3.5 w-3.5 mr-1" />
          Testar
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onEdit(agent)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => onDelete(agent.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ── AgentFormModal ──

interface AgentForm {
  name: string
  type: string
  provider: string
  model: string
  systemPrompt: string
  temperature: string
  maxTokens: string
}

const defaultForm: AgentForm = {
  name: '',
  type: 'CONVERSATION_ASSISTANT',
  provider: 'openai',
  model: 'gpt-4o-mini',
  systemPrompt: '',
  temperature: '0.7',
  maxTokens: '1000',
}

interface AgentFormModalProps {
  open: boolean
  editing: AIAgent | null
  onClose: () => void
  onSave: (data: Record<string, unknown>) => void
  isPending: boolean
}

function AgentFormModal({ open, editing, onClose, onSave, isPending }: AgentFormModalProps) {
  const [form, setForm] = useState<AgentForm>(() =>
    editing
      ? {
          name: editing.name,
          type: editing.type,
          provider: inferProvider(editing.model),
          model: editing.model,
          systemPrompt: editing.systemPrompt,
          temperature: String(editing.temperature),
          maxTokens: String(editing.maxTokens),
        }
      : defaultForm
  )

  const availableModels = agentModelsByProvider[form.provider] ?? agentModelsByProvider.openai

  // Sync form when editing changes
  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        type: editing.type,
        provider: inferProvider(editing.model),
        model: editing.model,
        systemPrompt: editing.systemPrompt,
        temperature: String(editing.temperature),
        maxTokens: String(editing.maxTokens),
      })
    } else {
      setForm(defaultForm)
    }
  }, [editing])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return }
    if (!form.systemPrompt.trim()) { toast.error('System Prompt é obrigatório'); return }
    onSave({
      name: form.name,
      type: form.type,
      model: form.model,
      systemPrompt: form.systemPrompt,
      temperature: parseFloat(form.temperature) || 0.7,
      maxTokens: parseInt(form.maxTokens) || 1000,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar Agente' : 'Novo Agente IA'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome <span className="text-red-500">*</span></Label>
            <Input
              placeholder="Ex: Assistente de Vendas"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {agentTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Provedor</Label>
              <Select
                value={form.provider}
                onValueChange={(v) => {
                  const firstModel = agentModelsByProvider[v]?.[0]?.value ?? ''
                  setForm((f) => ({ ...f, provider: v, model: firstModel }))
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {agentProviders.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Modelo</Label>
              <Select value={form.model} onValueChange={(v) => setForm((f) => ({ ...f, model: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableModels.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>System Prompt <span className="text-red-500">*</span></Label>
            <Textarea
              rows={5}
              placeholder="Você é um assistente especializado em vendas..."
              value={form.systemPrompt}
              onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
              className="resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Temperature (0-2)</Label>
              <Input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={form.temperature}
                onChange={(e) => setForm((f) => ({ ...f, temperature: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max Tokens</Label>
              <Input
                type="number"
                min="100"
                max="4000"
                step="100"
                value={form.maxTokens}
                onChange={(e) => setForm((f) => ({ ...f, maxTokens: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={isPending}>
              {isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                : editing ? 'Salvar' : 'Criar Agente'
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── TestModal ──

function TestModal({
  agent,
  open,
  onClose,
}: {
  agent: AIAgent | null
  open: boolean
  onClose: () => void
}) {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleTest() {
    if (!agent || !input.trim()) { toast.error('Digite uma mensagem para testar'); return }
    setIsLoading(true)
    setResult(null)
    try {
      const data = await api.post<{ suggestion_text: string }>(`/ai-agents/${agent.id}/test`, { input })
      setResult(data.suggestion_text)
    } catch {
      toast.error('Erro ao testar agente')
    } finally {
      setIsLoading(false)
    }
  }

  function handleClose() {
    setInput('')
    setResult(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Testar: {agent?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Mensagem de entrada</Label>
            <Textarea
              rows={3}
              placeholder="Digite o texto para o agente processar..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="resize-none"
            />
          </div>
          <Button className="w-full" onClick={() => void handleTest()} disabled={isLoading || !input.trim()}>
            {isLoading
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando...</>
              : <><FlaskConical className="h-4 w-4 mr-2" />Testar</>
            }
          </Button>
          {result !== null && (
            <div className="space-y-1.5">
              <Label>Resposta do Agente</Label>
              <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                {result}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ──

export default function IAAgentesPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<AIAgent | null>(null)
  const [testAgent, setTestAgent] = useState<AIAgent | null>(null)
  const [testOpen, setTestOpen] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const queryClient = useQueryClient()

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['ai-agents'],
    queryFn: () => api.get<AIAgent[]>('/ai-agents'),
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<AIAgent>('/ai-agents', body),
    onSuccess: () => {
      toast.success('Agente criado!')
      setFormOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['ai-agents'] })
    },
    onError: () => toast.error('Erro ao criar agente'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api.patch<AIAgent>(`/ai-agents/${id}`, body),
    onSuccess: () => {
      toast.success('Agente atualizado!')
      setFormOpen(false)
      setEditingAgent(null)
      void queryClient.invalidateQueries({ queryKey: ['ai-agents'] })
    },
    onError: () => toast.error('Erro ao atualizar agente'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/ai-agents/${id}`),
    onSuccess: () => {
      toast.success('Agente excluído!')
      void queryClient.invalidateQueries({ queryKey: ['ai-agents'] })
    },
    onError: () => toast.error('Erro ao excluir agente'),
  })

  async function handleToggle(agent: AIAgent) {
    setTogglingId(agent.id)
    try {
      await api.patch<AIAgent>(`/ai-agents/${agent.id}`, { isActive: !agent.isActive })
      toast.success(agent.isActive ? 'Agente desativado' : 'Agente ativado')
      void queryClient.invalidateQueries({ queryKey: ['ai-agents'] })
    } catch {
      toast.error('Erro ao alterar status')
    } finally {
      setTogglingId(null)
    }
  }

  function handleEdit(agent: AIAgent) {
    setEditingAgent(agent)
    setFormOpen(true)
  }

  function handleDelete(id: string) {
    if (!confirm('Excluir este agente?')) return
    deleteMutation.mutate(id)
  }

  function handleTest(agent: AIAgent) {
    setTestAgent(agent)
    setTestOpen(true)
  }

  function handleSave(data: Record<string, unknown>) {
    if (editingAgent) {
      updateMutation.mutate({ id: editingAgent.id, ...data })
    } else {
      createMutation.mutate(data)
    }
  }

  const isSavePending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">IA / Agentes</h1>
        </div>
        <Button size="sm" onClick={() => { setEditingAgent(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Agente
        </Button>
      </div>

      {/* Stats */}
      {agents.length > 0 && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{agents.length} agentes</span>
          <span>{agents.filter((a) => a.isActive).length} ativos</span>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum agente IA configurado</p>
          <Button size="sm" className="mt-4" onClick={() => { setEditingAgent(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Agente
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onTest={handleTest}
              onToggle={(a) => void handleToggle(a)}
              isToggling={togglingId === agent.id}
            />
          ))}
        </div>
      )}

      {/* Form Modal */}
      <AgentFormModal
        open={formOpen}
        editing={editingAgent}
        onClose={() => { setFormOpen(false); setEditingAgent(null) }}
        onSave={handleSave}
        isPending={isSavePending}
      />

      {/* Test Modal */}
      <TestModal
        agent={testAgent}
        open={testOpen}
        onClose={() => { setTestOpen(false); setTestAgent(null) }}
      />
    </div>
  )
}
