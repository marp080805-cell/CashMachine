'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ChannelPerformance } from '@/types'

interface CanalPerformanceChartProps {
  data: ChannelPerformance[]
}

export function CanalPerformanceChart({ data }: CanalPerformanceChartProps) {
  const chartData = data.slice(0, 8).map((d) => ({
    name: d.channelName.split(' ')[0],
    Meta: d.leadsGoal,
    Realizado: d.leadsGenerated,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Meta vs Realizado por Canal</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Meta" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Realizado" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
