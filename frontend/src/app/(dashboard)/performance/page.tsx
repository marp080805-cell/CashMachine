'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Trophy, TrendingUp } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { formatCurrency, getInitials } from '@/lib/utils'

interface TeamMember {
  userId: string
  userName: string
  leadsCreated: number
  dealsCreated: number
  dealsWon: number
  revenueWon: number
  tasksCompleted: number
}

const MEDAL_COLORS = ['#f59e0b', '#94a3b8', '#cd7c2f']
const MEDAL_LABELS = ['1º', '2º', '3º']

export default function PerformancePage() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const { data: teamReport, isLoading } = useQuery({
    queryKey: ['report-team', month, year],
    queryFn: () =>
      api.get<{ report: TeamMember[] }>(`/reports/team?month=${month}&year=${year}`),
  })

  const sorted = [...(teamReport?.report ?? [])].sort((a, b) => b.revenueWon - a.revenueWon)
  const top3 = sorted.slice(0, 3)
  const rest = sorted.slice(3)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-amber-500" />
        <h1 className="text-xl font-semibold">Performance do Time</h1>
        <Badge variant="secondary" className="ml-auto">
          {new Date(year, month - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
        </Badge>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {top3.map((member, idx) => (
              <Card key={member.userId} className={idx === 0 ? 'border-amber-400 shadow-md' : ''}>
                <CardContent className="pt-6 text-center">
                  <div className="relative inline-block mb-3">
                    <Avatar className="h-16 w-16 mx-auto">
                      <AvatarFallback className="text-lg" style={{ backgroundColor: MEDAL_COLORS[idx] + '33', color: MEDAL_COLORS[idx] }}>
                        {getInitials(member.userName)}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: MEDAL_COLORS[idx] }}
                    >
                      {MEDAL_LABELS[idx]}
                    </span>
                  </div>
                  <p className="font-semibold text-foreground">{member.userName}</p>
                  <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(member.revenueWon)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Receita gerada</p>
                  <div className="grid grid-cols-3 gap-2 mt-4 border-t pt-4 text-center">
                    <div>
                      <p className="text-lg font-bold">{member.dealsWon}</p>
                      <p className="text-[10px] text-muted-foreground">Ganhos</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{member.leadsCreated}</p>
                      <p className="text-[10px] text-muted-foreground">Leads</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{member.tasksCompleted}</p>
                      <p className="text-[10px] text-muted-foreground">Tarefas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Comparison Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Comparativo do Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={sorted} margin={{ left: 0, right: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="userName" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === 'Receita') return formatCurrency(value)
                      return value
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="dealsWon" name="Deals Ganhos" fill="#6366f1" />
                  <Bar yAxisId="left" dataKey="leadsCreated" name="Leads" fill="#22c55e" />
                  <Bar yAxisId="right" dataKey="revenueWon" name="Receita" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Rest of team table */}
          {rest.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Demais Membros</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted text-xs text-muted-foreground">
                      <th className="px-4 py-3 text-left">#</th>
                      <th className="px-4 py-3 text-left">Usuário</th>
                      <th className="px-4 py-3 text-right">Leads</th>
                      <th className="px-4 py-3 text-right">Deals</th>
                      <th className="px-4 py-3 text-right">Ganhos</th>
                      <th className="px-4 py-3 text-right">Receita</th>
                      <th className="px-4 py-3 text-right">Tarefas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((member, idx) => (
                      <tr key={member.userId} className="border-b">
                        <td className="px-4 py-2 text-muted-foreground font-mono">{idx + 4}º</td>
                        <td className="px-4 py-2 font-medium flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[9px]">{getInitials(member.userName)}</AvatarFallback>
                          </Avatar>
                          {member.userName}
                        </td>
                        <td className="px-4 py-2 text-right">{member.leadsCreated}</td>
                        <td className="px-4 py-2 text-right">{member.dealsCreated}</td>
                        <td className="px-4 py-2 text-right text-green-600 font-semibold">{member.dealsWon}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(member.revenueWon)}</td>
                        <td className="px-4 py-2 text-right">{member.tasksCompleted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
