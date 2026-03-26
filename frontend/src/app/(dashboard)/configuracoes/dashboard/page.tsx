'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { DashboardWidget } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Eye, EyeOff, ChevronUp, ChevronDown, RotateCcw, Save } from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

const TYPE_ICONS: Record<string, string> = {
  kpi: '📊',
  chart: '📈',
  table: '📋',
  list: '📝',
}

const TYPE_LABELS: Record<string, string> = {
  kpi: 'KPI',
  chart: 'Gráfico',
  table: 'Tabela',
  list: 'Lista',
}

export default function DashboardConfigPage() {
  const qc = useQueryClient()
  const [widgets, setWidgets] = useState<DashboardWidget[]>([])
  const [dirty, setDirty] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-config'],
    queryFn: () => api.get<{ widgets: DashboardWidget[] }>('/settings/dashboard'),
  })

  useEffect(() => {
    if (data?.widgets) {
      setWidgets([...data.widgets].sort((a, b) => a.position - b.position))
      setDirty(false)
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: (w: DashboardWidget[]) => api.put('/settings/dashboard', { widgets: w }),
    onSuccess: () => {
      toast.success('Dashboard salvo!')
      setDirty(false)
      void qc.invalidateQueries({ queryKey: ['dashboard-config'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: () => toast.error('Erro ao salvar'),
  })

  const resetMutation = useMutation({
    mutationFn: () => api.delete('/settings/dashboard'),
    onSuccess: (res) => {
      const result = res as { widgets: DashboardWidget[] }
      setWidgets([...result.widgets].sort((a, b) => a.position - b.position))
      toast.success('Dashboard resetado!')
      setDirty(false)
      void qc.invalidateQueries({ queryKey: ['dashboard-config'] })
    },
    onError: () => toast.error('Erro ao resetar'),
  })

  function toggle(id: string) {
    setWidgets((prev) => prev.map((w) => w.id === id ? { ...w, enabled: !w.enabled } : w))
    setDirty(true)
  }

  function move(idx: number, dir: -1 | 1) {
    const next = [...widgets]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target]!, next[idx]!]
    const reindexed = next.map((w, i) => ({ ...w, position: i }))
    setWidgets(reindexed)
    setDirty(true)
  }

  function handleSave() {
    saveMutation.mutate(widgets)
  }

  const enabledCount = widgets.filter((w) => w.enabled).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Configurar Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Escolha quais blocos aparecem e em qual ordem no seu dashboard
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Resetar padrão
          </Button>
          <Button onClick={handleSave} disabled={!dirty || saveMutation.isPending} size="sm">
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>{enabledCount} de {widgets.length} blocos visíveis</span>
        {dirty && <Badge variant="outline" className="text-xs">Alterações não salvas</Badge>}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
      ) : (
        <div className="space-y-2">
          {widgets.map((widget, idx) => (
            <div
              key={widget.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3 transition-all',
                widget.enabled
                  ? 'bg-card border-border'
                  : 'bg-muted/30 border-dashed opacity-60'
              )}
            >
              <span className="text-lg">{TYPE_ICONS[widget.type]}</span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-medium', !widget.enabled && 'text-muted-foreground')}>
                    {widget.label}
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0"
                  >
                    {TYPE_LABELS[widget.type]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Posição {idx + 1} · {widget.enabled ? 'Visível' : 'Oculto'}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => move(idx, 1)}
                  disabled={idx === widgets.length - 1}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  variant={widget.enabled ? 'ghost' : 'ghost'}
                  size="icon"
                  className={cn('h-7 w-7', widget.enabled ? 'text-foreground' : 'text-muted-foreground')}
                  onClick={() => toggle(widget.id)}
                  title={widget.enabled ? 'Ocultar' : 'Mostrar'}
                >
                  {widget.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Card className="border-dashed">
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">
            <strong>Dica:</strong> Use as setas para reordenar os blocos. Clique no ícone de olho para mostrar ou ocultar.
            As alterações ficam salvas por usuário — cada membro da equipe pode ter seu próprio layout.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
