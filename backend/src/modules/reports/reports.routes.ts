import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'

export default async function reportsRoutes(app: FastifyInstance) {
  // Funil de conversão por pipeline
  app.get('/reports/funnel', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const { pipelineId, period = '30d' } = request.query as any

    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
    const since = new Date(Date.now() - days * 86400000)

    const where: any = { tenantId, ...(pipelineId && { pipelineId }) }

    const [total, won, lost, byStage] = await Promise.all([
      prisma.opportunity.count({ where: { ...where, createdAt: { gte: since } } }),
      prisma.opportunity.count({ where: { ...where, status: 'WON', closedAt: { gte: since } } }),
      prisma.opportunity.count({ where: { ...where, status: 'LOST', closedAt: { gte: since } } }),
      prisma.stageHistory.groupBy({
        by: ['stageId'],
        where: { enteredAt: { gte: since }, opportunity: where },
        _count: { id: true },
        _avg: { durationSeconds: true },
      }),
    ])

    return reply.send({
      period: { days, since },
      total,
      won,
      lost,
      open: total - won - lost,
      winRate: total > 0 ? (won / total) * 100 : 0,
      byStage,
    })
  })

  // Breakdown por origem
  app.get('/reports/by-origin', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const { period = '30d' } = request.query as any

    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
    const since = new Date(Date.now() - days * 86400000)

    const byOrigin = await prisma.opportunity.groupBy({
      by: ['originId'],
      where: { tenantId, createdAt: { gte: since } },
      _count: { id: true },
      _sum: { value: true },
    })

    const origins = await prisma.origin.findMany({ where: { tenantId } })
    const originMap = new Map(origins.map((o) => [o.id, o.name]))

    const result = byOrigin.map((row) => ({
      originId: row.originId,
      originName: row.originId ? (originMap.get(row.originId) ?? 'Desconhecido') : 'Sem origem',
      count: row._count.id,
      totalValue: Number(row._sum.value ?? 0),
    }))

    return reply.send({ period: { days, since }, byOrigin: result })
  })

  // Performance por usuário
  app.get('/reports/team', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId, role } = request.user as { tenantId: string; role: string }

    if (!['ADMIN', 'MANAGER'].includes(role)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const { period = '30d' } = request.query as any
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
    const since = new Date(Date.now() - days * 86400000)

    const users = await prisma.user.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, role: true, avatarUrl: true },
    })

    const [wonDeals, tasksCompleted] = await Promise.all([
      prisma.opportunity.groupBy({
        by: ['assignedToId'],
        where: { tenantId, status: 'WON', closedAt: { gte: since } },
        _count: { id: true },
        _sum: { value: true },
      }),
      prisma.task.groupBy({
        by: ['assignedToId'],
        where: { tenantId, status: 'COMPLETED', completedAt: { gte: since } },
        _count: { id: true },
      }),
    ])

    const wonMap = new Map(wonDeals.map((d) => [d.assignedToId, d]))
    const tasksMap = new Map(tasksCompleted.map((t) => [t.assignedToId, t]))

    const report = users.map((u) => ({
      userId: u.id,
      userName: u.name,
      role: u.role,
      avatarUrl: u.avatarUrl,
      opportunitiesWon: wonMap.get(u.id)?._count.id ?? 0,
      revenueWon: Number(wonMap.get(u.id)?._sum.value ?? 0),
      tasksCompleted: tasksMap.get(u.id)?._count.id ?? 0,
    }))

    return reply.send({ period: { days, since }, report })
  })
}
