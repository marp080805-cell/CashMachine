'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { Channel, ChannelMetric } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatCurrency, formatPercent, getAttainmentColor } from '@/lib/utils'

interface ChannelWithMetric extends Channel {
  metric: ChannelMetric | null
}

// EditableCell is defined outside the render to prevent re-mount on each render
interface EditableCellProps {
  cellId: string
  value: number
  editing: boolean
  editValue: string
  onStartEdit: (cellId: string, value: number) => void
  onChangeEdit: (val: string) => void
  onCommit: () => void
  onCancel: () => void
  onTabNext?: () => void
  onTabPrev?: () => void
  format?: (v: number) => string
}

function EditableCell({
  cellId, value, editing, editValue,
  onStartEdit, onChangeEdit, onCommit, onCancel, onTabNext, onTabPrev, format,
}: EditableCellProps) {
  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={editValue}
        onChange={(e) => onChangeEdit(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); onCommit(); onTabNext?.() }
          if (e.key === 'Tab') { e.preventDefault(); onCommit(); e.shiftKey ? onTabPrev?.() : onTabNext?.() }
          if (e.key === 'Escape') onCancel()
        }}
        className="w-24 border rounded px-1 py-0.5 text-right text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
      />
    )
  }
  return (
    <span
      onClick={() => onStartEdit(cellId, value)}
      className="cursor-pointer hover:bg-primary/10 rounded px-1 py-0.5 select-none transition-colors"
      title="Clique para editar"
    >
      {format ? format(value) : value}
    </span>
  )
}

export default function PlanejamentoPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const queryClient = useQueryClient()

  const { data: channelsData, isLoading: channelsLoading } = useQuery({
    queryKey: ['channels'],
    queryFn: () => api.get<{ channels: Channel[] }>('/channels'),
  })

  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['channel-metrics', month, year],
    queryFn: () =>
      api.get<{ period: unknown; report: Array<{ channelId: string } & ChannelMetric> }>(
        `/reports/channels?month=${month}&year=${year}`
      ),
  })

  const updateMetricMutation = useMutation({
    mutationFn: ({ channelId, field, value }: { channelId: string; field: string; value: number }) =>
      api.put(`/channels/${channelId}/metrics`, { month, year, [field]: value }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['channel-metrics'] })
      toast.success('Atualizado')
    },
    onError: () => toast.error('Erro ao atualizar'),
  })

  const isLoading = channelsLoading || metricsLoading

  const metricsMap = new Map(
    (metricsData?.report ?? []).map((m) => [m.channelId, m])
  )

  const rows = (channelsData?.channels ?? []).map((ch) => ({
    channel: ch,
    metric: metricsMap.get(ch.id) ?? null,
  }))

  const totals = rows.reduce(
    (acc, { metric }) => ({
      leadsGoal: acc.leadsGoal + (metric?.leadsGoal ?? 0),
      leadsGenerated: acc.leadsGenerated + (metric?.leadsGenerated ?? 0),
      totalCost: acc.totalCost + (metric?.totalCost ?? 0),
      callsReal: acc.callsReal + (metric?.callsReal ?? 0),
      contractsReal: acc.contractsReal + (metric?.contractsReal ?? 0),
    }),
    { leadsGoal: 0, leadsGenerated: 0, totalCost: 0, callsReal: 0, contractsReal: 0 }
  )

  // Ordered list of editable cell IDs for Tab navigation
  const EDITABLE_FIELDS = ['leadsGoal', 'leadsGenerated', 'totalCost', 'callsReal', 'contractsReal']
  const allCellIds = rows.flatMap(({ channel }) =>
    EDITABLE_FIELDS.map((f) => `${channel.id}-${f}`)
  )

  const startEdit = useCallback((cellId: string, value: number) => {
    setEditingCell(cellId)
    setEditValue(String(value))
  }, [])

  const changeEdit = useCallback((val: string) => setEditValue(val), [])

  const cancelEdit = useCallback(() => setEditingCell(null), [])

  const commitEdit = useCallback((channelId: string, field: string) => {
    const num = parseFloat(editValue)
    if (!isNaN(num)) {
      updateMetricMutation.mutate({ channelId, field, value: num })
    }
    setEditingCell(null)
  }, [editValue, updateMetricMutation])

  const tabToNext = useCallback((currentCellId: string, direction: 1 | -1 = 1) => {
    const idx = allCellIds.indexOf(currentCellId)
    if (idx === -1) return
    const nextIdx = idx + direction
    if (nextIdx < 0 || nextIdx >= allCellIds.length) return
    const nextId = allCellIds[nextIdx]!
    // Parse value for next cell from rows
    const [channelId, field] = nextId.split('-') as [string, string]
    const row = rows.find((r) => r.channel.id === channelId)
    if (!row) return
    const m = row.metric
    const valMap: Record<string, number> = {
      leadsGoal: m?.leadsGoal ?? 0,
      leadsGenerated: m?.leadsGenerated ?? 0,
      totalCost: m?.totalCost ?? 0,
      callsReal: m?.callsReal ?? 0,
      contractsReal: m?.contractsReal ?? 0,
    }
    startEdit(nextId, valMap[field] ?? 0)
  }, [allCellIds, rows, startEdit])

  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <select
          value={month}
          onChange={(e) => setMonth(parseInt(e.target.value, 10))}
          className="border rounded-md px-3 py-2 text-sm bg-background"
        >
          {monthNames.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value, 10))}
          className="border rounded-md px-3 py-2 text-sm bg-background"
        >
          {[2024, 2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">Clique em qualquer número para editar</p>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Meta Total', value: String(totals.leadsGoal) },
          { label: 'Leads Gerados', value: String(totals.leadsGenerated) },
          { label: 'Atingimento', value: formatPercent(totals.leadsGoal > 0 ? (totals.leadsGenerated / totals.leadsGoal) * 100 : 0) },
          { label: 'Custo Total', value: formatCurrency(totals.totalCost) },
          { label: 'CPL Médio', value: formatCurrency(totals.leadsGenerated > 0 ? totals.totalCost / totals.leadsGenerated : 0) },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-2xl font-bold mt-1">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Canais — {monthNames[month - 1]} {year}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Canal</th>
                  <th className="px-4 py-3 text-right font-medium">Meta</th>
                  <th className="px-4 py-3 text-right font-medium">Leads Reais</th>
                  <th className="px-4 py-3 text-right font-medium">Custo Real</th>
                  <th className="px-4 py-3 text-right font-medium">CPL Real</th>
                  <th className="px-4 py-3 text-right font-medium">Calls</th>
                  <th className="px-4 py-3 text-right font-medium">Contratos</th>
                  <th className="px-4 py-3 text-right font-medium">% Meta</th>
                  <th className="px-4 py-3 text-right font-medium">Δ Meta</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                      ))}
                    </tr>
                  ))
                ) : (
                  rows.map(({ channel, metric }) => {
                    const leads = metric?.leadsGenerated ?? 0
                    const goal = metric?.leadsGoal ?? 0
                    const cost = metric?.totalCost ?? 0
                    const attainment = goal > 0 ? (leads / goal) * 100 : 0
                    const cpl = leads > 0 ? cost / leads : 0
                    const delta = leads - goal

                    return (
                      <tr key={channel.id} className="border-b hover:bg-muted/50">
                        <td className="px-4 py-3 font-medium">{channel.name}</td>
                        <td className="px-4 py-3 text-right">
                          <EditableCell
                            cellId={`${channel.id}-leadsGoal`}
                            value={goal}
                            editing={editingCell === `${channel.id}-leadsGoal`}
                            editValue={editValue}
                            onStartEdit={startEdit}
                            onChangeEdit={changeEdit}
                            onCommit={() => commitEdit(channel.id, 'leadsGoal')}
                            onCancel={cancelEdit}
                            onTabNext={() => tabToNext(`${channel.id}-leadsGoal`, 1)}
                            onTabPrev={() => tabToNext(`${channel.id}-leadsGoal`, -1)}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <EditableCell
                            cellId={`${channel.id}-leadsGenerated`}
                            value={leads}
                            editing={editingCell === `${channel.id}-leadsGenerated`}
                            editValue={editValue}
                            onStartEdit={startEdit}
                            onChangeEdit={changeEdit}
                            onCommit={() => commitEdit(channel.id, 'leadsGenerated')}
                            onCancel={cancelEdit}
                            onTabNext={() => tabToNext(`${channel.id}-leadsGenerated`, 1)}
                            onTabPrev={() => tabToNext(`${channel.id}-leadsGenerated`, -1)}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <EditableCell
                            cellId={`${channel.id}-totalCost`}
                            value={cost}
                            editing={editingCell === `${channel.id}-totalCost`}
                            editValue={editValue}
                            onStartEdit={startEdit}
                            onChangeEdit={changeEdit}
                            onCommit={() => commitEdit(channel.id, 'totalCost')}
                            onCancel={cancelEdit}
                            format={formatCurrency}
                            onTabNext={() => tabToNext(`${channel.id}-totalCost`, 1)}
                            onTabPrev={() => tabToNext(`${channel.id}-totalCost`, -1)}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">{formatCurrency(cpl)}</td>
                        <td className="px-4 py-3 text-right">
                          <EditableCell
                            cellId={`${channel.id}-callsReal`}
                            value={metric?.callsReal ?? 0}
                            editing={editingCell === `${channel.id}-callsReal`}
                            editValue={editValue}
                            onStartEdit={startEdit}
                            onChangeEdit={changeEdit}
                            onCommit={() => commitEdit(channel.id, 'callsReal')}
                            onCancel={cancelEdit}
                            onTabNext={() => tabToNext(`${channel.id}-callsReal`, 1)}
                            onTabPrev={() => tabToNext(`${channel.id}-callsReal`, -1)}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <EditableCell
                            cellId={`${channel.id}-contractsReal`}
                            value={metric?.contractsReal ?? 0}
                            editing={editingCell === `${channel.id}-contractsReal`}
                            editValue={editValue}
                            onStartEdit={startEdit}
                            onChangeEdit={changeEdit}
                            onCommit={() => commitEdit(channel.id, 'contractsReal')}
                            onCancel={cancelEdit}
                            onTabNext={() => tabToNext(`${channel.id}-contractsReal`, 1)}
                            onTabPrev={() => tabToNext(`${channel.id}-contractsReal`, -1)}
                          />
                        </td>
                        <td className={cn('px-4 py-3 text-right font-semibold', getAttainmentColor(attainment))}>
                          {formatPercent(attainment, 0)}
                        </td>
                        <td className={cn('px-4 py-3 text-right font-semibold', delta >= 0 ? 'text-green-600' : 'text-red-600')}>
                          {delta >= 0 ? '+' : ''}{delta}
                        </td>
                      </tr>
                    )
                  })
                )}
                <tr className="bg-muted font-semibold text-xs border-t-2">
                  <td className="px-4 py-3">TOTAL</td>
                  <td className="px-4 py-3 text-right">{totals.leadsGoal}</td>
                  <td className="px-4 py-3 text-right">{totals.leadsGenerated}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(totals.totalCost)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(totals.leadsGenerated > 0 ? totals.totalCost / totals.leadsGenerated : 0)}</td>
                  <td className="px-4 py-3 text-right">{totals.callsReal}</td>
                  <td className="px-4 py-3 text-right">{totals.contractsReal}</td>
                  <td className={cn('px-4 py-3 text-right', getAttainmentColor(totals.leadsGoal > 0 ? (totals.leadsGenerated / totals.leadsGoal) * 100 : 0))}>
                    {formatPercent(totals.leadsGoal > 0 ? (totals.leadsGenerated / totals.leadsGoal) * 100 : 0, 0)}
                  </td>
                  <td className={cn('px-4 py-3 text-right', totals.leadsGenerated - totals.leadsGoal >= 0 ? 'text-green-600' : 'text-red-600')}>
                    {totals.leadsGenerated - totals.leadsGoal >= 0 ? '+' : ''}{totals.leadsGenerated - totals.leadsGoal}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
