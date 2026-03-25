'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Pipeline } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GitBranch, Plus, Loader2 } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'

const pipelineTypeLabels: Record<string, string> = {
  SALES: 'Vendas',
  TREATMENT: 'Tratamento',
  RESCUE: 'Resgate',
  RELATIONSHIP: 'Relacionamento',
  CUSTOM: 'Personalizado',
}

const DEFAULT_STAGES = [
  { name: 'Novo', color: '#6366f1' },
  { name: 'Em contato', color: '#f59e0b' },
  { name: 'Proposta', color: '#10b981' },
  { name: 'Fechamento', color: '#8b5cf6' },
]

export default function FunisPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'SALES',
    stages: DEFAULT_STAGES.map((s, i) => ({ ...s, sortOrder: i })),
  })
  const queryClient = useQueryClient()

  const { data: pipelines, isLoading } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => api.get<Pipeline[]>('/pipelines'),
  })

  const createMutation = useMutation({
    mutationFn: async (body: { name: string; description: string; type: string }) => {
      const pipeline = await api.post<Pipeline>('/pipelines', body)
      for (let i = 0; i < form.stages.length; i++) {
        const stage = form.stages[i]
        await api.post(`/pipelines/${pipeline.id}/stages`, { name: stage.name, color: stage.color, sortOrder: i })
      }
      return pipeline
    },
    onSuccess: () => {
      toast.success('Pipeline criado!')
      setModalOpen(false)
      setForm({ name: '', description: '', type: 'SALES', stages: DEFAULT_STAGES.map((s, i) => ({ ...s, sortOrder: i })) })
      void queryClient.invalidateQueries({ queryKey: ['pipelines'] })
    },
    onError: () => toast.error('Erro ao criar pipeline'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return }
    createMutation.mutate({ name: form.name, description: form.description, type: form.type })
  }

  function addStage() {
    setForm((f) => ({
      ...f,
      stages: [...f.stages, { name: '', color: '#6366f1', sortOrder: f.stages.length }],
    }))
  }

  function removeStage(idx: number) {
    setForm((f) => ({ ...f, stages: f.stages.filter((_, i) => i !== idx) }))
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Pipeline
        </Button>
      </div>

      {!pipelines?.length ? (
        <EmptyState
          icon={GitBranch}
          title="Nenhum pipeline cadastrado"
          description="Crie seu primeiro pipeline de vendas para começar"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pipelines.map((pipeline) => (
            <Link key={pipeline.id} href={`/funis/${pipeline.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{pipeline.name}</CardTitle>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {pipelineTypeLabels[pipeline.type] ?? pipeline.type}
                    </Badge>
                  </div>
                  {pipeline.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{pipeline.description}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <GitBranch className="h-4 w-4" />
                    <span>{pipeline.stages.length} etapas</span>
                    <span>·</span>
                    <span>{pipeline._count?.opportunities ?? 0} oportunidades</span>
                  </div>
                  <div className="flex gap-1 mt-3">
                    {pipeline.stages.slice(0, 6).map((stage) => (
                      <div
                        key={stage.id}
                        className="h-2 flex-1 rounded-full"
                        style={{ backgroundColor: stage.color }}
                        title={stage.name}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Pipeline</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input
                placeholder="Ex: Pipeline de Vendas"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input
                placeholder="Descrição opcional"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(pipelineTypeLabels).map(([val, lbl]) => (
                    <SelectItem key={val} value={val}>{lbl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Etapas</Label>
                <Button type="button" size="sm" variant="outline" onClick={addStage}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Etapa
                </Button>
              </div>
              {form.stages.map((stage, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={stage.color}
                    onChange={(e) => setForm((f) => ({
                      ...f,
                      stages: f.stages.map((s, i) => i === idx ? { ...s, color: e.target.value } : s),
                    }))}
                    className="h-9 w-9 rounded border cursor-pointer bg-transparent"
                  />
                  <Input
                    placeholder="Nome da etapa"
                    value={stage.name}
                    onChange={(e) => setForm((f) => ({
                      ...f,
                      stages: f.stages.map((s, i) => i === idx ? { ...s, name: e.target.value } : s),
                    }))}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeStage(idx)}
                    className="text-red-500 hover:text-red-600 shrink-0"
                    disabled={form.stages.length <= 1}
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</>
                ) : 'Criar Pipeline'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
