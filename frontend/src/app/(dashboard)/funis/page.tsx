'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { Pipeline } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { GitBranch, Plus, Loader2 } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
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
  const router = useRouter()
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

  // Redireciona para o primeiro pipeline automaticamente
  useEffect(() => {
    if (pipelines && pipelines.length > 0) {
      router.replace(`/funis/${pipelines[0].id}`)
    }
  }, [pipelines, router])

  const createMutation = useMutation({
    mutationFn: async (body: { name: string; description: string; type: string }) => {
      const pipeline = await api.post<Pipeline>('/pipelines', body)
      for (let i = 0; i < form.stages.length; i++) {
        const stage = form.stages[i]
        await api.post(`/pipelines/${pipeline.id}/stages`, { name: stage.name, color: stage.color, sortOrder: i })
      }
      return pipeline
    },
    onSuccess: (pipeline) => {
      toast.success('Pipeline criado!')
      setModalOpen(false)
      setForm({ name: '', description: '', type: 'SALES', stages: DEFAULT_STAGES.map((s, i) => ({ ...s, sortOrder: i })) })
      void queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      router.push(`/funis/${pipeline.id}`)
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
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-72 shrink-0 space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        ))}
      </div>
    )
  }

  // Se tem pipelines, está redirecionando — mostra skeleton
  if (pipelines && pipelines.length > 0) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-72 shrink-0 space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        ))}
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

      <EmptyState
        icon={GitBranch}
        title="Nenhum pipeline cadastrado"
        description="Crie seu primeiro pipeline de vendas para começar"
        action={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Pipeline
          </Button>
        }
      />

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
