import { Queue, Worker } from 'bullmq'
import { env } from '../config/env'
import { prisma } from '../lib/prisma'

const connection = { url: env.REDIS_URL }

export const dailyMetricsQueue = new Queue('daily-metrics', { connection })

export async function computeDailyMetrics(targetDate?: Date) {
  const date = targetDate ?? new Date()
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayEnd = new Date(dayStart.getTime() + 86400000)

  // Get all active tenants
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true },
    select: { id: true },
  })

  let total = 0

  for (const tenant of tenants) {
    // Get pipelines for this tenant
    const pipelines = await prisma.pipeline.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: { id: true },
    })

    // Also compute global (pipelineId = null) metrics
    const pipelineIds: (string | null)[] = [null, ...pipelines.map((p) => p.id)]

    for (const pipelineId of pipelineIds) {
      const oppWhere: any = {
        tenantId: tenant.id,
        ...(pipelineId ? { pipelineId } : {}),
      }

      const [
        newOpportunities,
        wonAgg,
        lostAgg,
      ] = await Promise.all([
        prisma.opportunity.count({
          where: {
            ...oppWhere,
            createdAt: { gte: dayStart, lt: dayEnd },
          },
        }),

        prisma.opportunity.aggregate({
          where: {
            ...oppWhere,
            status: 'WON',
            wonDate: { gte: dayStart, lt: dayEnd },
          },
          _count: { id: true },
          _sum: { value: true, monthlyValue: true },
        }),

        prisma.opportunity.aggregate({
          where: {
            ...oppWhere,
            status: 'LOST',
            lostDate: { gte: dayStart, lt: dayEnd },
          },
          _count: { id: true },
          _sum: { value: true },
        }),
      ])

      const wonDeals = wonAgg._count.id
      const lostDeals = lostAgg._count.id
      const revenue = Number(wonAgg._sum.value ?? 0)
      const mrr = Number(wonAgg._sum.monthlyValue ?? 0)
      const lostValue = Number(lostAgg._sum.value ?? 0)

      // Total open value
      const openAgg = await prisma.opportunity.aggregate({
        where: { ...oppWhere, status: 'OPEN' },
        _sum: { value: true },
      })
      const totalValueOpen = Number(openAgg._sum.value ?? 0)

      const metricsData = {
        newOpportunities,
        wonOpportunities: wonDeals,
        lostOpportunities: lostDeals,
        totalValueWon: revenue,
        totalValueLost: lostValue,
        totalValueOpen,
        totalMrrWon: mrr,
        computedAt: new Date(),
      }

      // Find existing record first (handles nullable pipelineId in unique constraint)
      const existing = await prisma.dailyMetrics.findFirst({
        where: {
          tenantId: tenant.id,
          date: dayStart,
          pipelineId: pipelineId ?? null,
        },
      })

      if (existing) {
        await prisma.dailyMetrics.update({
          where: { id: existing.id },
          data: metricsData,
        })
      } else {
        await prisma.dailyMetrics.create({
          data: {
            tenantId: tenant.id,
            date: dayStart,
            pipelineId: pipelineId ?? null,
            ...metricsData,
          },
        })
      }

      total++
    }
  }

  return { total, date: dayStart.toISOString().split('T')[0] }
}

export function startDailyMetricsWorker() {
  // Schedule repeat job: every day at 1am
  dailyMetricsQueue.add(
    'compute-daily-metrics',
    {},
    {
      repeat: { pattern: '0 1 * * *' },
      jobId: 'daily-metrics-cron',
    }
  )

  return new Worker(
    'daily-metrics',
    async (job) => {
      const targetDate = job.data?.date ? new Date(job.data.date) : undefined
      const result = await computeDailyMetrics(targetDate)
      console.log(`[daily-metrics] Computed ${result.total} records for ${result.date}`)
      return result
    },
    {
      connection,
      concurrency: 1,
    }
  )
}
