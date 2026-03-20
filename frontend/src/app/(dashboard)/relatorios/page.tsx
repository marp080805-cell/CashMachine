'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Download } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, FunnelChart, Funnel, LabelList
} from 'recharts'
import { formatCurrency, formatPercent, getAttainmentColor } from '@/lib/utils'
import { cn } from '@/lib/utils'

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4']

export default function RelatoriosPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const { data: channelReport, isLoading: channelLoading } = useQuery({
    queryKey: ['report-channels', month, year],
    queryFn: () =>
      api.get<{ period: unknown; report: Array<{ channelId: string; channelName: string; leadsGoal: number; leadsGenerated: number; attainment: number; totalCost: number; cpl: number; contractsReal: number; delta: number }> }>(
        `/reports/channels?month=${month}&year=${year}`
      ),
  })

  const { data: funnelReport, isLoading: funnelLoading } = useQuery({
    queryKey: ['report-funnel', month, year],
    queryFn: () =>
      api.get<{ funnel: { leads: number; calls: number; contracts: number; leadToCallRate: number; callToContractRate: number; leadToContractRate: number } }>(
        `/reports/funnel?month=${month}&year=${year}`
      ),
  })

  const { data: teamReport, isLoading: teamLoading } = useQuery({
    queryKey: ['report-team', month, year],
    queryFn: () =>
      api.get<{ report: Array<{ userId: string; userName: string; leadsCreated: number; dealsCreated: number; dealsWon: number; revenueWon: number; tasksCompleted: number }> }>(
        `/reports/team?month=${month}&year=${year}`
      ),
  })

  const { data: forecast, isLoading: forecastLoading } = useQuery({
    queryKey: ['report-forecast'],
    queryFn: () =>
      api.get<{ forecast: { projectedLeads: number; projectedContracts: number; projectedCost: number; leadsAttainmentProbability: number; message: string } }>(
        '/reports/forecast'
      ),
  })

  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))} className="border rounded-md px-3 py-2 text-sm">
          {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} className="border rounded-md px-3 py-2 text-sm">
          {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <Tabs defaultValue="channels">
        <TabsList>
          <TabsTrigger value="channels">Canais</TabsTrigger>
          <TabsTrigger value="funnel">Funil</TabsTrigger>
          <TabsTrigger value="team">Time</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
        </TabsList>

        <TabsContent value="channels" className="space-y-4 mt-4">
          {channelLoading ? <Skeleton className="h-64" /> : (
            <>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="text-base">Leads por Canal</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={channelReport?.report ?? []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="channelName" tick={{ fontSize: 10 }} width={120} />
                        <Tooltip />
                        <Bar dataKey="leadsGoal" name="Meta" fill="#e2e8f0" />
                        <Bar dataKey="leadsGenerated" name="Realizado" fill="#6366f1" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Distribuição de Custo</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={channelReport?.report ?? []} dataKey="totalCost" nameKey="channelName" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }: { name: string; percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                          {(channelReport?.report ?? []).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-slate-50 text-xs text-muted-foreground"><th className="px-4 py-3 text-left">Canal</th><th className="px-4 py-3 text-right">Meta</th><th className="px-4 py-3 text-right">Leads</th><th className="px-4 py-3 text-right">% Meta</th><th className="px-4 py-3 text-right">Custo</th><th className="px-4 py-3 text-right">CPL</th><th className="px-4 py-3 text-right">Contratos</th></tr></thead>
                    <tbody>
                      {(channelReport?.report ?? []).map((ch) => (
                        <tr key={ch.channelId} className="border-b">
                          <td className="px-4 py-2">{ch.channelName}</td>
                          <td className="px-4 py-2 text-right">{ch.leadsGoal}</td>
                          <td className="px-4 py-2 text-right">{ch.leadsGenerated}</td>
                          <td className={cn('px-4 py-2 text-right font-semibold', getAttainmentColor(ch.attainment))}>{formatPercent(ch.attainment, 0)}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(ch.totalCost)}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(ch.cpl)}</td>
                          <td className="px-4 py-2 text-right">{ch.contractsReal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="funnel" className="mt-4">
          {funnelLoading ? <Skeleton className="h-64" /> : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {[
                { label: 'Leads', value: funnelReport?.funnel.leads ?? 0 },
                { label: 'Calls', value: funnelReport?.funnel.calls ?? 0 },
                { label: 'Contratos', value: funnelReport?.funnel.contracts ?? 0 },
              ].map((item) => (
                <Card key={item.label}><CardContent className="pt-6 text-center"><p className="text-muted-foreground text-sm">{item.label}</p><p className="text-4xl font-bold mt-1">{item.value}</p></CardContent></Card>
              ))}
              <Card className="xl:col-span-3"><CardContent className="pt-6 grid grid-cols-3 divide-x text-center">
                <div><p className="text-xs text-muted-foreground">Lead → Call</p><p className="text-2xl font-bold mt-1">{formatPercent(funnelReport?.funnel.leadToCallRate ?? 0)}</p></div>
                <div><p className="text-xs text-muted-foreground">Call → Contrato</p><p className="text-2xl font-bold mt-1">{formatPercent(funnelReport?.funnel.callToContractRate ?? 0)}</p></div>
                <div><p className="text-xs text-muted-foreground">Lead → Contrato</p><p className="text-2xl font-bold mt-1">{formatPercent(funnelReport?.funnel.leadToContractRate ?? 0)}</p></div>
              </CardContent></Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          {teamLoading ? <Skeleton className="h-64" /> : (
            <div className="rounded-lg border bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-slate-50 text-xs text-muted-foreground"><th className="px-4 py-3 text-left">Usuário</th><th className="px-4 py-3 text-right">Leads</th><th className="px-4 py-3 text-right">Deals</th><th className="px-4 py-3 text-right">Ganhos</th><th className="px-4 py-3 text-right">Receita</th><th className="px-4 py-3 text-right">Tarefas</th></tr></thead>
                <tbody>
                  {(teamReport?.report ?? []).map((u) => (
                    <tr key={u.userId} className="border-b">
                      <td className="px-4 py-2 font-medium">{u.userName}</td>
                      <td className="px-4 py-2 text-right">{u.leadsCreated}</td>
                      <td className="px-4 py-2 text-right">{u.dealsCreated}</td>
                      <td className="px-4 py-2 text-right text-green-600 font-semibold">{u.dealsWon}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(u.revenueWon)}</td>
                      <td className="px-4 py-2 text-right">{u.tasksCompleted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="forecast" className="mt-4">
          {forecastLoading ? <Skeleton className="h-64" /> : (
            <div className="space-y-4">
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="pt-6">
                  <p className="text-lg font-semibold text-primary">{forecast?.forecast.message}</p>
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  { label: 'Leads Projetados', value: String(forecast?.forecast.projectedLeads ?? 0) },
                  { label: 'Contratos Projetados', value: String(forecast?.forecast.projectedContracts ?? 0) },
                  { label: 'Custo Projetado', value: formatCurrency(forecast?.forecast.projectedCost) },
                  { label: 'Prob. de Bater Meta', value: formatPercent(forecast?.forecast.leadsAttainmentProbability) },
                ].map((item) => (
                  <Card key={item.label}><CardContent className="pt-6"><p className="text-xs text-muted-foreground">{item.label}</p><p className="text-2xl font-bold mt-1">{item.value}</p></CardContent></Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
