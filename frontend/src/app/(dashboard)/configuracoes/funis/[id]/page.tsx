'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Pencil, Trash2, Plus, ArrowLeft, Zap, Mail, MessageSquare, Bell } from 'lucide-react'
import { api } from '@/lib/api'
import Link from 'next/link'

interface StageTrigger {
  id: string
  name: string
  triggerEvent: string
  actionType: string
  isActive: boolean
}

interface Stage {
  id: string
  name: string
  type: string
  probability: number
  color: string
  sortOrder: number
  triggers?: StageTrigger[]
}

interface Pipeline {
  id: string
  name: string
  type: string
  stages?: Stage[]
}

const STAGE_TYPES = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'WON', label: 'Ganho' },
  { value: 'LOST', label: 'Perdido' },
]

const TRIGGER_EVENTS = [
  { value: 'STAGE_ENTERED', label: 'Entrou na etapa' },
  { value: 'STAGE_LEFT', label: 'Saiu da etapa' },
  { value: 'DEAL_WON', label: 'Negócio ganho' },
  { value: 'DEAL_LOST', label: 'Negócio perdido' },
]

const ACTION_TYPES = [
  { value: 'SEND_EMAIL', label: 'Enviar e-mail' },
  { value: 'SEND_WHATSAPP', label: 'Enviar WhatsApp' },
  { value: 'CREATE_TASK', label: 'Criar tarefa' },
  { value: 'SEND_NOTIFICATION', label: 'Enviar notificação' },
  { value: 'WEBHOOK', label: 'Webhook' },
]

const actionTypeIcons: Record<string, React.ElementType> = {
  SEND_EMAIL: Mail,
  SEND_WHATSAPP: MessageSquare,
  CREATE_TASK: Bell,
  SEND_NOTIFICATION: Bell,
  WEBHOOK: Zap,
}

const stageTypeBadge: Record<string, string> = {
  NORMAL: 'bg-gray-100 text-gray-700',
  WON: 'bg-green-100 text-green-700',
  LOST: 'bg-red-100 text-red-700',
}

const emptyStageForm = { name: '', type: 'NORMAL', probability: 50, color: '#6366f1' }
const emptyTriggerForm = { name: '', triggerEvent: 'STAGE_ENTERED', actionType: 'SEND_WHATSAPP' }

export default function FunilDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [loading, setLoading] = useState(true)

  // Stage modal
  const [stageOpen, setStageOpen] = useState(false)
  const [editingStage, setEditingStage] = useState<Stage | null>(null)
  const [stageForm, setStageForm] = useState(emptyStageForm)
  const [savingStage, setSavingStage] = useState(false)

  // Trigger modal
  const [triggerOpen, setTriggerOpen] = useState(false)
  const [triggerStageId, setTriggerStageId] = useState<string | null>(null)
  const [triggerForm, setTriggerForm] = useState(emptyTriggerForm)
  const [savingTrigger, setSavingTrigger] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await api.get<Pipeline>(`/pipelines/${id}/config`)
      setPipeline(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [id])

  function openCreateStage() {
    setEditingStage(null)
    setStageForm(emptyStageForm)
    setStageOpen(true)
  }

  function openEditStage(stage: Stage) {
    setEditingStage(stage)
    setStageForm({
      name: stage.name,
      type: stage.type,
      probability: stage.probability,
      color: stage.color,
    })
    setStageOpen(true)
  }

  async function handleSaveStage() {
    if (!pipeline) return
    setSavingStage(true)
    try {
      if (editingStage) {
        const updated = await api.patch<Stage>(`/stages/${editingStage.id}`, stageForm)
        setPipeline((prev) => prev ? {
          ...prev,
          stages: prev.stages?.map((s) => s.id === editingStage.id ? { ...s, ...updated } : s),
        } : prev)
      } else {
        const created = await api.post<Stage>(`/pipelines/${id}/stages`, stageForm)
        setPipeline((prev) => prev ? {
          ...prev,
          stages: [...(prev.stages ?? []), { ...created, triggers: [] }],
        } : prev)
      }
      setStageOpen(false)
    } finally {
      setSavingStage(false)
    }
  }

  async function handleDeleteStage(stageId: string) {
    if (!confirm('Excluir esta etapa?')) return
    await api.delete(`/stages/${stageId}`)
    setPipeline((prev) => prev ? {
      ...prev,
      stages: prev.stages?.filter((s) => s.id !== stageId),
    } : prev)
  }

  function openCreateTrigger(stageId: string) {
    setTriggerStageId(stageId)
    setTriggerForm(emptyTriggerForm)
    setTriggerOpen(true)
  }

  async function handleSaveTrigger() {
    if (!triggerStageId) return
    setSavingTrigger(true)
    try {
      const created = await api.post<StageTrigger>(`/stages/${triggerStageId}/triggers`, triggerForm)
      setPipeline((prev) => prev ? {
        ...prev,
        stages: prev.stages?.map((s) =>
          s.id === triggerStageId
            ? { ...s, triggers: [...(s.triggers ?? []), created] }
            : s
        ),
      } : prev)
      setTriggerOpen(false)
    } finally {
      setSavingTrigger(false)
    }
  }

  async function toggleTrigger(stageId: string, trigger: StageTrigger) {
    const updated = await api.patch<StageTrigger>(`/stage-triggers/${trigger.id}`, { isActive: !trigger.isActive })
    setPipeline((prev) => prev ? {
      ...prev,
      stages: prev.stages?.map((s) =>
        s.id === stageId
          ? { ...s, triggers: s.triggers?.map((t) => t.id === trigger.id ? updated : t) }
          : s
      ),
    } : prev)
  }

  async function handleDeleteTrigger(stageId: string, triggerId: string) {
    if (!confirm('Excluir este trigger?')) return
    await api.delete(`/stage-triggers/${triggerId}`)
    setPipeline((prev) => prev ? {
      ...prev,
      stages: prev.stages?.map((s) =>
        s.id === stageId
          ? { ...s, triggers: s.triggers?.filter((t) => t.id !== triggerId) }
          : s
      ),
    } : prev)
  }

  if (loading) return <div className="text-muted-foreground text-sm">Carregando...</div>
  if (!pipeline) return <div className="text-muted-foreground text-sm">Funil não encontrado</div>

  const stages = pipeline.stages ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link href="/configuracoes/funis">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-lg font-semibold">{pipeline.name}</h2>
          <p className="text-sm text-muted-foreground">Configure as etapas do funil</p>
        </div>
        <Button onClick={openCreateStage} size="sm" className="ml-auto">
          <Plus className="h-4 w-4 mr-1" /> Nova Etapa
        </Button>
      </div>

      {stages.length === 0 ? (
        <div className="border rounded-lg py-12 text-center text-sm text-muted-foreground">
          Nenhuma etapa cadastrada
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4" style={{ minWidth: `${stages.length * 280}px` }}>
            {stages
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((stage) => (
                <div
                  key={stage.id}
                  className="w-64 flex-shrink-0 border rounded-lg overflow-hidden"
                >
                  {/* Stage header */}
                  <div
                    className="px-3 py-2.5 flex items-center gap-2"
                    style={{ borderTop: `3px solid ${stage.color}` }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{stage.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${stageTypeBadge[stage.type] ?? 'bg-gray-100 text-gray-700'}`}>
                          {STAGE_TYPES.find((t) => t.value === stage.type)?.label ?? stage.type}
                        </span>
                        <span className="text-xs text-muted-foreground">{stage.probability}%</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0"
                      onClick={() => openEditStage(stage)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 text-destructive hover:text-destructive"
                      onClick={() => void handleDeleteStage(stage.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Triggers */}
                  <div className="px-3 py-2 space-y-1.5 bg-muted/30 min-h-[80px]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Automações</span>
                      <Button
                        variant="ghost" size="sm" className="h-5 px-1 text-xs"
                        onClick={() => openCreateTrigger(stage.id)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {(stage.triggers ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Nenhuma automação</p>
                    ) : (
                      stage.triggers?.map((trigger) => {
                        const Icon = actionTypeIcons[trigger.actionType] ?? Zap
                        return (
                          <div
                            key={trigger.id}
                            className="flex items-center gap-1.5 text-xs bg-background rounded p-1.5"
                          >
                            <Icon className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                            <span className="flex-1 truncate">{trigger.name}</span>
                            <Switch
                              checked={trigger.isActive}
                              onCheckedChange={() => void toggleTrigger(stage.id, trigger)}
                              className="scale-75"
                            />
                            <Button
                              variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive"
                              onClick={() => void handleDeleteTrigger(stage.id, trigger.id)}
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Stage Modal */}
      <Dialog open={stageOpen} onOpenChange={setStageOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingStage ? 'Editar Etapa' : 'Nova Etapa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={stageForm.name}
                onChange={(e) => setStageForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Proposta enviada"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={stageForm.type}
                onValueChange={(v) => setStageForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Probabilidade (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={stageForm.probability}
                  onChange={(e) => setStageForm((f) => ({ ...f, probability: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cor</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={stageForm.color}
                    onChange={(e) => setStageForm((f) => ({ ...f, color: e.target.value }))}
                    className="h-9 w-12 rounded border cursor-pointer"
                  />
                  <Input
                    value={stageForm.color}
                    onChange={(e) => setStageForm((f) => ({ ...f, color: e.target.value }))}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSaveStage()} disabled={!stageForm.name || savingStage}>
              {savingStage ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trigger Modal */}
      <Dialog open={triggerOpen} onOpenChange={setTriggerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Automação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={triggerForm.name}
                onChange={(e) => setTriggerForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Enviar proposta por email"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Evento</Label>
              <Select
                value={triggerForm.triggerEvent}
                onValueChange={(v) => setTriggerForm((f) => ({ ...f, triggerEvent: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_EVENTS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ação</Label>
              <Select
                value={triggerForm.actionType}
                onValueChange={(v) => setTriggerForm((f) => ({ ...f, actionType: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTriggerOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSaveTrigger()} disabled={!triggerForm.name || savingTrigger}>
              {savingTrigger ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
