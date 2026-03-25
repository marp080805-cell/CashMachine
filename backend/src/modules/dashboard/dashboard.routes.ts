import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'

export default async function dashboardRoutes(app: FastifyInstance) {
  app.get('/dashboard/summary', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId, id: userId, role } = request.user as {
      tenantId: string; id: string; role: string
    }
    const isManager = ['ADMIN', 'MANAGER'].includes(role)

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const oppWhere: any = {
      tenantId,
      ...(!isManager && { assignedToId: userId }),
    }

    const [
      openOpportunities,
      wonThisMonth,
      lostThisMonth,
      newContactsThisMonth,
      recentActivities,
      upcomingTasks,
      pipelineSummary,
    ] = await Promise.all([
      prisma.opportunity.count({ where: { ...oppWhere, status: 'OPEN' } }),

      prisma.opportunity.aggregate({
        where: { ...oppWhere, status: 'WON', closedAt: { gte: monthStart, lt: monthEnd } },
        _count: { id: true },
        _sum: { value: true },
      }),

      prisma.opportunity.count({
        where: { ...oppWhere, status: 'LOST', closedAt: { gte: monthStart, lt: monthEnd } },
      }),

      prisma.contact.count({
        where: { tenantId, createdAt: { gte: monthStart, lt: monthEnd } },
      }),

      prisma.activity.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          contact: { select: { id: true, name: true } },
          opportunity: { select: { id: true, title: true } },
        },
      }),

      prisma.task.findMany({
        where: {
          tenantId,
          assignedToId: userId,
          status: { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] },
          dueDate: { gte: now },
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
        include: {
          contact: { select: { id: true, name: true } },
          opportunity: { select: { id: true, title: true } },
        },
      }),

      prisma.pipeline.findMany({
        where: { tenantId, isActive: true },
        include: {
          _count: { select: { opportunities: { where: { ...oppWhere, status: 'OPEN' } } } },
          stages: {
            orderBy: { sortOrder: 'asc' },
            include: {
              _count: { select: { opportunities: { where: { ...oppWhere, status: 'OPEN' } } } },
            },
          },
        },
      }),
    ])

    return reply.send({
      kpis: {
        openOpportunities,
        wonThisMonth: wonThisMonth._count.id,
        revenueWon: Number(wonThisMonth._sum.value ?? 0),
        lostThisMonth,
        newContacts: newContactsThisMonth,
        winRate: (wonThisMonth._count.id + lostThisMonth) > 0
          ? (wonThisMonth._count.id / (wonThisMonth._count.id + lostThisMonth)) * 100
          : 0,
      },
      recentActivities,
      upcomingTasks,
      pipelineSummary: pipelineSummary.map((p) => ({
        pipelineId: p.id,
        pipelineName: p.name,
        openCount: p._count.opportunities,
        stages: p.stages.map((s) => ({
          stageId: s.id,
          stageName: s.name,
          color: s.color,
          count: s._count.opportunities,
        })),
      })),
    })
  })
}
