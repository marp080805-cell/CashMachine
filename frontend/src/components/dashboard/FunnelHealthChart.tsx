'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingDown } from 'lucide-react'
import {
  FunnelChart,
  Funnel,
  Tooltip,
  LabelList,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface FunnelStep {
  name: string
  value: number
  fill: string
}

interface FunnelHealthChartProps {
  leads: number
  calls: number
  contracts: number
}

const COLORS = ['#6366f1', '#8b5cf6', '#22c55e']

export function FunnelHealthChart({ leads, calls, contracts }: FunnelHealthChartProps) {
  const data: FunnelStep[] = [
    { name: 'Leads', value: leads, fill: COLORS[0] },
    { name: 'Calls', value: calls, fill: COLORS[1] },
    { name: 'Contratos', value: contracts, fill: COLORS[2] },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingDown className="h-4 w-4" />
          Funil de Conversão
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <FunnelChart>
            <Tooltip
              formatter={(value: number, name: string) => [`${value}`, name]}
            />
            <Funnel dataKey="value" data={data} isAnimationActive>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
              <LabelList
                position="right"
                content={({ value, name }) => (
                  <text className="text-xs fill-gray-600">
                    {name}: {value}
                  </text>
                )}
              />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-center text-xs text-muted-foreground">
          {data.map((step, i) => {
            const prev = i > 0 ? data[i - 1].value : null
            const rate = prev && prev > 0 ? ((step.value / prev) * 100).toFixed(1) : null
            return (
              <div key={step.name}>
                <div className="font-semibold text-sm text-foreground">{step.value}</div>
                <div>{step.name}</div>
                {rate && <div className="text-primary">{rate}% conv.</div>}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
