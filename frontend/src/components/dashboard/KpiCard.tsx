import { type LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, getAttainmentColor, getAttainmentBg } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: string
  icon: LucideIcon
  attainment?: number
  trend?: number
  subtitle?: string
  isLoading?: boolean
}

export function KpiCard({ title, value, icon: Icon, attainment, trend, subtitle, isLoading }: KpiCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-3 w-16" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>

            {attainment !== undefined && (
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                    getAttainmentBg(attainment),
                    getAttainmentColor(attainment)
                  )}
                >
                  {attainment >= 100 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : attainment >= 70 ? (
                    <Minus className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {attainment.toFixed(1)}% da meta
                </span>
              </div>
            )}

            {trend !== undefined && (
              <div className={cn('flex items-center gap-1 mt-2 text-xs', trend >= 0 ? 'text-green-600' : 'text-red-600')}>
                {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>{trend >= 0 ? '+' : ''}{trend.toFixed(1)}% vs mês anterior</span>
              </div>
            )}

            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
