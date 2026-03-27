import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'

const goalSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['REVENUE', 'MRR', 'DEAL_COUNT', 'NEW_LEADS', 'MEETINGS_BOOKED', 'CONVERSION_SDR', 'CONVERSION_CLOSER', 'CPL']),
  periodType: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  targetValue: z.number(),
  scope: z.enum(['GLOBAL', 'BY_USER', 'BY_TEAM', 'BY_CHANNEL']).default('GLOBAL'),
  userId: z.string().uuid().optional(),
  originId: z.string().uuid().optional(),
})

const breakdownSchema = z.object({
  originId: z.string().uuid(),
  subOriginId: z.string().uuid().optional(),
  targetLeads: z.number().int().optional(),
  targetCpl: z.number().optional(),
  targetConversionToMeeting: z.number().optional(),
  targetConversionToSale: z.number().optional(),
})

async function computeGoalProgress(goal: {
  id: string
  type: string
  startDate: Date
  endDate: Date
  tenantId: string
}): Promise<number> {
  const { type, startDate, endDate, tenantId } = goal
  const dateRange = { gte: startDate, lte: endDate }

  switch (type) {
    case 'REVENUE': {
      const agg = await prisma.opportunity.aggregate({
        where: { tenantId, status: 'WON', wonDate: dateRange },
        _sum: { value: true },
      })
      return Number(agg._sum.value ?? 0)
    }
    case 'MRR': {
      const agg = await prisma.opportunity.aggregate({
        where: { tenantId, status: 'WON', wonDate: dateRange },
        _sum: { monthlyValue: true },
      })
      return Number(agg._sum.monthlyValue ?? 0)
    }
    case 'DEAL_COUNT': {
      return prisma.opportunity.count({
        where: { tenantId, status: 'WON', wonDate: dateRange },
      })
    }
    case 'NEW_LEADS': {
      return prisma.lead.count({
        where: { tenantId, createdAt: dateRange },
      })
    }
    case 'MEETINGS_BOOKED': {
      return prisma.meeting.count({
        where: { tenantId, createdAt: dateRange },
      })
    }
    default:
      return 0
  }
}

export default async function goalsRoutes(app: FastifyInstance) {
  // Listar metas
  app.get('/goals', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const goals = await prisma.goal.findMany({
      where: { tenantId },
      orderBy: { startDate: 'desc' },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { breakdowns: true } },
      },
    })
    return reply.send(goals)
  })

  // Criar meta
  app.post('/goals', { preHandler: [app.authenticate] }, async (request, reply) => {
    const input = goalSchema.parse(request.body)
    const { tenantId } = request.user as { tenantId: string }

    const goal = await prisma.goal.create({
      data: { ...input, targetValue: input.targetValue, tenantId },
    })

    return reply.status(201).send(goal)
  })

  // Progresso de todas as metas ativas
  app.get('/goals/progress', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const now = new Date()

    const goals = await prisma.goal.findMany({
      where: { tenantId, startDate: { lte: now }, endDate: { gte: now } },
    })

    const results = await Promise.all(
      goals.map(async (goal) => {
        const currentValue = await computeGoalProgress(goal)
        const target = Number(goal.targetValue)
        const progress = target > 0 ? (currentValue / target) * 100 : 0
        return { ...goal, currentValue, progress: Math.min(progress, 100) }
      })
    )

    return reply.send(results)
  })

  // Buscar meta por ID
  app.get('/goals/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    const goal = await prisma.goal.findFirstOrThrow({
      where: { id, tenantId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        breakdowns: true,
      },
    })

    const currentValue = await computeGoalProgress(goal)
    const target = Number(goal.targetValue)
    const progress = target > 0 ? (currentValue / target) * 100 : 0

    return reply.send({ ...goal, currentValue, progress: Math.min(progress, 100) })
  })

  // Atualizar meta
  app.put('/goals/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }
    const input = goalSchema.partial().parse(request.body)

    await prisma.goal.findFirstOrThrow({ where: { id, tenantId } })
    const goal = await prisma.goal.update({ where: { id }, data: input })
    return reply.send(goal)
  })

  // Deletar meta
  app.delete('/goals/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }
    await prisma.goal.findFirstOrThrow({ where: { id, tenantId } })
    await prisma.goal.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // ─── Breakdowns ────────────────────────────────────────────────────

  app.get('/goals/:id/breakdowns', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }
    await prisma.goal.findFirstOrThrow({ where: { id, tenantId } })
    const breakdowns = await prisma.goalBreakdown.findMany({ where: { goalId: id } })
    return reply.send(breakdowns)
  })

  app.post('/goals/:id/breakdowns', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }
    const input = breakdownSchema.parse(request.body)

    await prisma.goal.findFirstOrThrow({ where: { id, tenantId } })
    const breakdown = await prisma.goalBreakdown.create({ data: { ...input, goalId: id } })
    return reply.status(201).send(breakdown)
  })

  app.put('/goals/:id/breakdowns/:breakdownId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id, breakdownId } = request.params as { id: string; breakdownId: string }
    const { tenantId } = request.user as { tenantId: string }
    const input = breakdownSchema.partial().parse(request.body)

    await prisma.goal.findFirstOrThrow({ where: { id, tenantId } })
    const breakdown = await prisma.goalBreakdown.update({ where: { id: breakdownId }, data: input })
    return reply.send(breakdown)
  })

  app.delete('/goals/:id/breakdowns/:breakdownId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id, breakdownId } = request.params as { id: string; breakdownId: string }
    const { tenantId } = request.user as { tenantId: string }
    await prisma.goal.findFirstOrThrow({ where: { id, tenantId } })
    await prisma.goalBreakdown.delete({ where: { id: breakdownId } })
    return reply.send({ success: true })
  })
}
