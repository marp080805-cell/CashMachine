'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Save, Play, X } from 'lucide-react'
import { api } from '@/lib/api'

interface SalesBot {
  id: string
  name: string
  type: string
  isActive: boolean
  description?: string
  entryPoint: string
  steps?: BotStep[]
}

interface BotStep {
  id: string
  type: string
  config: Record<string, unknown>
  label?: string
}

const STEP_TYPES = [
  { type: 'send_message', label: 'Enviar Mensagem', icon: '💬' },
  { type: 'wait', label: 'Aguardar', icon: '⏳' },
  { type: 'condition', label: 'Condição', icon: '🔀' },
  { type: 'set_field', label: 'Definir Campo', icon: '✏️' },
  { type: 'add_tag', label: 'Adicionar Tag', icon: '🏷️' },
  { type: 'change_stage', label: 'Mudar Etapa', icon: '📋' },
  { type: 'create_task', label: 'Criar Tarefa', icon: '✅' },
  { type: 'webhook', label: 'Webhook', icon: '🔗' },
  { type: 'stop', label: 'Parar', icon: '🛑' },
]

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

function StepConfig({ step, onChange }: { step: BotStep; onChange: (config: Record<string, unknown>) => void }) {
  const cfg = step.config

  switch (step.type) {
    case 'send_message':
      return (
        <div className="space-y-2">
          <Label className="text-xs">Mensagem</Label>
          <Textarea
            value={(cfg.message as string) ?? ''}
            onChange={(e) => onChange({ ...cfg, message: e.target.value })}
            placeholder="Olá! Como posso ajudar?"
            rows={4}
          />
        </div>
      )
    case 'wait':
      return (
        <div className="space-y-2">
          <Label className="text-xs">Minutos de espera</Label>
          <Input
            type="number"
            min={1}
            value={(cfg.minutes as number) ?? 1}
            onChange={(e) => onChange({ ...cfg, minutes: Number(e.target.value) })}
          />
        </div>
      )
    case 'condition':
      return (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Campo</Label>
            <Input
              value={(cfg.field as string) ?? ''}
              onChange={(e) => onChange({ ...cfg, field: e.target.value })}
              placeholder="Ex: status, tag, stage"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valor</Label>
            <Input
              value={(cfg.value as string) ?? ''}
              onChange={(e) => onChange({ ...cfg, value: e.target.value })}
              placeholder="Ex: ativo, hot_lead"
            />
          </div>
        </div>
      )
    case 'set_field':
      return (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Campo</Label>
            <Input
              value={(cfg.field as string) ?? ''}
              onChange={(e) => onChange({ ...cfg, field: e.target.value })}
              placeholder="Nome do campo"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valor</Label>
            <Input
              value={(cfg.value as string) ?? ''}
              onChange={(e) => onChange({ ...cfg, value: e.target.value })}
              placeholder="Novo valor"
            />
          </div>
        </div>
      )
    case 'add_tag':
      return (
        <div className="space-y-2">
          <Label className="text-xs">Tag</Label>
          <Input
            value={(cfg.tag as string) ?? ''}
            onChange={(e) => onChange({ ...cfg, tag: e.target.value })}
            placeholder="Nome da tag"
          />
        </div>
      )
    case 'change_stage':
      return (
        <div className="space-y-2">
          <Label className="text-xs">Etapa de destino</Label>
          <Input
            value={(cfg.stage as string) ?? ''}
            onChange={(e) => onChange({ ...cfg, stage: e.target.value })}
            placeholder="Nome ou ID da etapa"
          />
        </div>
      )
    case 'create_task':
      return (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Título</Label>
            <Input
              value={(cfg.title as string) ?? ''}
              onChange={(e) => onChange({ ...cfg, title: e.target.value })}
              placeholder="Título da tarefa"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select
              value={(cfg.taskType as string) ?? 'CALL'}
              onValueChange={(v) => onChange({ ...cfg, taskType: v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CALL">Ligação</SelectItem>
                <SelectItem value="EMAIL">E-mail</SelectItem>
                <SelectItem value="MEETING">Reunião</SelectItem>
                <SelectItem value="TASK">Tarefa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Prioridade</Label>
            <Select
              value={(cfg.priority as string) ?? 'MEDIUM'}
              onValueChange={(v) => onChange({ ...cfg, priority: v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Baixa</SelectItem>
                <SelectItem value="MEDIUM">Média</SelectItem>
                <SelectItem value="HIGH">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )
    case 'webhook':
      return (
        <div className="space-y-2">
          <Label className="text-xs">URL do Webhook</Label>
          <Input
            value={(cfg.url as string) ?? ''}
            onChange={(e) => onChange({ ...cfg, url: e.target.value })}
            placeholder="https://..."
          />
        </div>
      )
    case 'stop':
      return <p className="text-xs text-muted-foreground">Este step encerra a execução do bot.</p>
    default:
      return <p className="text-xs text-muted-foreground">Sem configuração disponível.</p>
  }
}

export default function AutomacaoBuildePage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [bot, setBot] = useState<SalesBot | null>(null)
  const [steps, setSteps] = useState<BotStep[]>([])
  const [selectedStep, setSelectedStep] = useState<string | null>(null)
  const [botName, setBotName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const data = await api.get<SalesBot>(`/salesbots/${id}`)
      setBot(data)
      setBotName(data.name)
      setSteps(data.steps ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [id])

  function addStep(type: string) {
    const newStep: BotStep = {
      id: generateId(),
      type,
      config: {},
      label: STEP_TYPES.find((s) => s.type === type)?.label ?? type,
    }
    setSteps((prev) => [...prev, newStep])
    setSelectedStep(newStep.id)
  }

  function removeStep(stepId: string) {
    setSteps((prev) => prev.filter((s) => s.id !== stepId))
    if (selectedStep === stepId) setSelectedStep(null)
  }

  function moveStep(stepId: string, direction: 'up' | 'down') {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === stepId)
      if (idx < 0) return prev
      const newArr = [...prev]
      if (direction === 'up' && idx > 0) {
        ;[newArr[idx - 1], newArr[idx]] = [newArr[idx], newArr[idx - 1]]
      } else if (direction === 'down' && idx < newArr.length - 1) {
        ;[newArr[idx], newArr[idx + 1]] = [newArr[idx + 1], newArr[idx]]
      }
      return newArr
    })
  }

  function updateStepConfig(stepId: string, config: Record<string, unknown>) {
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, config } : s)))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await api.patch<SalesBot>(`/salesbots/${id}`, { name: botName, steps })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-muted-foreground text-sm p-6">Carregando...</div>
  if (!bot) return <div className="text-muted-foreground text-sm p-6">Automação não encontrada.</div>

  const selectedStepData = steps.find((s) => s.id === selectedStep) ?? null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push('/configuracoes/automacoes')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <input
          className="font-semibold text-sm bg-transparent border-none outline-none flex-1 min-w-0"
          value={botName}
          onChange={(e) => setBotName(e.target.value)}
          placeholder="Nome do bot"
        />
        <Button variant="outline" size="sm" onClick={() => alert('Execução de teste não implementada ainda.')} className="gap-1">
          <Play className="h-3.5 w-3.5" /> Testar
        </Button>
        <Button size="sm" onClick={() => void handleSave()} disabled={saving} className="gap-1">
          <Save className="h-3.5 w-3.5" /> {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — step types */}
        <div className="w-44 border-r bg-muted/30 p-3 overflow-y-auto flex-shrink-0">
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Tipos de Step</p>
          <div className="space-y-1">
            {STEP_TYPES.map((st) => (
              <button
                key={st.type}
                onClick={() => addStep(st.type)}
                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent flex items-center gap-2 transition-colors"
              >
                <span>{st.icon}</span>
                <span>{st.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Center — steps list */}
        <div className="flex-1 p-4 overflow-y-auto">
          <p className="text-xs text-muted-foreground mb-3">
            Gatilho: <Badge variant="outline" className="text-xs">{bot.entryPoint}</Badge>
          </p>

          {steps.length === 0 && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground">
              Clique em um tipo de step na barra lateral para adicionar steps à automação.
            </div>
          )}

          <div className="space-y-2">
            {steps.map((step, idx) => {
              const meta = STEP_TYPES.find((s) => s.type === step.type)
              return (
                <div
                  key={step.id}
                  onClick={() => setSelectedStep(step.id === selectedStep ? null : step.id)}
                  className={`border rounded-lg px-3 py-2.5 cursor-pointer flex items-center gap-2 transition-colors ${
                    selectedStep === step.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
                  }`}
                >
                  <span className="text-base">{meta?.icon ?? '⚙️'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{step.label ?? meta?.label ?? step.type}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {Object.entries(step.config)
                        .map(([k, v]) => `${k}: ${String(v)}`)
                        .join(' · ') || 'Sem configuração'}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground w-5 text-right">{idx + 1}</span>
                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => { e.stopPropagation(); moveStep(step.id, 'up') }}
                      disabled={idx === 0}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => { e.stopPropagation(); moveStep(step.id, 'down') }}
                      disabled={idx === steps.length - 1}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); removeStep(step.id) }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          {steps.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-1 w-full"
              onClick={() => {
                const t = STEP_TYPES[0]
                if (t) addStep(t.type)
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar Step
            </Button>
          )}
        </div>

        {/* Right panel — config */}
        {selectedStepData && (
          <div className="w-64 border-l p-4 overflow-y-auto flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Configurar Step</p>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedStep(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-2 mb-3">
              <Label className="text-xs">Rótulo do step</Label>
              <Input
                value={selectedStepData.label ?? ''}
                onChange={(e) =>
                  setSteps((prev) =>
                    prev.map((s) =>
                      s.id === selectedStepData.id ? { ...s, label: e.target.value } : s
                    )
                  )
                }
                className="h-7 text-xs"
              />
            </div>
            <StepConfig
              step={selectedStepData}
              onChange={(config) => updateStepConfig(selectedStepData.id, config)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
