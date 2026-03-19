import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'

export default async function reportsRoutes(app: FastifyInstance) {
  app.get(
    '/reports/channels',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { month, year } = request.query as { month?: string; year?: string }
      const now = new Date()
      const targetMonth = month ? parseInt(month, 10) : now.getMonth() + 1
      const targetYear = year ? parseInt(year, 10) : now.getFullYear()

      const metrics = await prisma.channelMetric.findMany({
        where: { month: targetMonth, year: targetYear },
        include: { channel: { select: { id: true, name: true, type: true, cplTarget: true, cacTarget: true } } },
        orderBy: { leadsGenerated: 'desc' },
      })

      const report = metrics.map((m) => ({
        channelId: m.channelId,
        channelName: m.channel.name,
        channelType: m.channel.type,
        leadsGoal: m.leadsGoal,
        leadsGenerated: m.leadsGenerated,
        attainment: m.leadsGoal > 0 ? (m.leadsGenerated / m.leadsGoal) * 100 : 0,
        totalCost: m.totalCost,
        cpl: m.leadsGenerated > 0 ? m.totalCost / m.leadsGenerated : 0,
        cplTarget: m.channel.cplTarget,
        contractsReal: m.contractsReal,
        callsReal: m.callsReal,
        cac: m.contractsReal > 0 ? m.totalCost / m.contractsReal : 0,
        cacTarget: m.channel.cacTarget,
        delta: m.leadsGenerated - m.leadsGoal,
      }))

      return reply.send({ period: { month: targetMonth, year: targetYear }, report })
    }
  )

  app.get(
    '/reports/funnel',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { month, year } = request.query as { month?: string; year?: string }
      const now = new Date()
      const targetMonth = month ? parseInt(month, 10) : now.getMonth() + 1
      const targetYear = year ? parseInt(year, 10) : now.getFullYear()

      const periodStart = new Date(targetYear, targetMonth - 1, 1)
      const periodEnd = new Date(targetYear, targetMonth, 1)

      const [totalLeads, totalCalls, totalContracts] = await Promise.all([
        prisma.channelMetric.aggregate({
          where: { month: targetMonth, year: targetYear },
          _sum: { leadsGenerated: true },
        }),
        prisma.channelMetric.aggregate({
          where: { month: targetMonth, year: targetYear },
          _sum: { callsReal: true },
        }),
        prisma.channelMetric.aggregate({
          where: { month: targetMonth, year: targetYear },
          _sum: { contractsReal: true },
        }),
      ])

      const leads = totalLeads._sum.leadsGenerated ?? 0
      const calls = totalCalls._sum.callsReal ?? 0
      const contracts = totalContracts._sum.contractsReal ?? 0

      const channelBreakdown = await prisma.channelMetric.findMany({
        where: { month: targetMonth, year: targetYear },
        include: { channel: { select: { id: true, name: true } } },
        orderBy: { contractsReal: 'desc' },
      })

      return reply.send({
        period: { month: targetMonth, year: targetYear },
        funnel: {
          leads,
          calls,
          contracts,
          leadToCallRate: leads > 0 ? (calls / leads) * 100 : 0,
          callToContractRate: calls > 0 ? (contracts / calls) * 100 : 0,
          leadToContractRate: leads > 0 ? (contracts / leads) * 100 : 0,
        },
        channelBreakdown: channelBreakdown.map((m) => ({
          channelId: m.channelId,
          channelName: m.channel.name,
          leads: m.leadsGenerated,
          calls: m.callsReal,
          contracts: m.contractsReal,
          conversionRate: m.leadsGenerated > 0 ? (m.contractsReal / m.leadsGenerated) * 100 : 0,
        })),
      })
    }
  )

  app.get(
    '/reports/team',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { month, year } = request.query as { month?: string; year?: string }
      const now = new Date()
      const targetMonth = month ? parseInt(month, 10) : now.getMonth() + 1
      const targetYear = year ? parseInt(year, 10) : now.getFullYear()

      const periodStart = new Date(targetYear, targetMonth - 1, 1)
      const periodEnd = new Date(targetYear, targetMonth, 1)

      const users = await prisma.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          role: true,
          avatarUrl: true,
          _count: {
            select: {
              createdLeads: { where: { createdAt: { gte: periodStart, lt: periodEnd } } },
              assignedDeals: { where: { createdAt: { gte: periodStart, lt: periodEnd } } },
              tasks: { where: { isCompleted: true, completedAt: { gte: periodStart, lt: periodEnd } } },
            },
          },
        },
        orderBy: { name: 'asc' },
      })

      const wonDeals = await prisma.deal.groupBy({
        by: ['assignedToId'],
        where: { status: 'WON', updatedAt: { gte: periodStart, lt: periodEnd } },
        _count: { id: true },
        _sum: { value: true },
      })

      const wonMap = new Map(wonDeals.map((d) => [d.assignedToId, { count: d._count.id, value: d._sum.value ?? 0 }]))

      const report = users.map((u) => ({
        userId: u.id,
        userName: u.name,
        role: u.role,
        avatarUrl: u.avatarUrl,
        leadsCreated: u._count.createdLeads,
        dealsCreated: u._count.assignedDeals,
        dealsWon: wonMap.get(u.id)?.count ?? 0,
        revenueWon: wonMap.get(u.id)?.value ?? 0,
        tasksCompleted: u._count.tasks,
      }))

      return reply.send({ period: { month: targetMonth, year: targetYear }, report })
    }
  )

  app.get(
    '/reports/forecast',
    { preHandler: [app.authenticate] },
    async (_request, reply) => {
      const now = new Date()
      const currentMonth = now.getMonth() + 1
      const currentYear = now.getFullYear()
      const dayOfMonth = now.getDate()
      const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
      const daysElapsed = dayOfMonth
      const daysRemaining = daysInMonth - dayOfMonth
      const progressFraction = daysElapsed / daysInMonth

      const metrics = await prisma.channelMetric.findMany({
        where: { month: currentMonth, year: currentYear },
      })

      const leadsGenerated = metrics.reduce((sum, m) => sum + m.leadsGenerated, 0)
      const leadsGoal = metrics.reduce((sum, m) => sum + m.leadsGoal, 0)
      const contractsReal = metrics.reduce((sum, m) => sum + m.contractsReal, 0)
      const totalCost = metrics.reduce((sum, m) => sum + m.totalCost, 0)

      const dailyLeadsRate = progressFraction > 0 ? leadsGenerated / daysElapsed : 0
      const projectedLeads = Math.round(dailyLeadsRate * daysInMonth)

      const leadToContractRate = leadsGenerated > 0 ? contractsReal / leadsGenerated : 0
      const projectedContracts = Math.round(projectedLeads * leadToContractRate)

      const projectedCost = progressFraction > 0 ? totalCost / progressFraction : totalCost

      const leadsAttainmentProb = leadsGoal > 0 ? Math.min(100, (projectedLeads / leadsGoal) * 100) : 0

      return reply.send({
        period: { month: currentMonth, year: currentYear },
        currentPace: { leadsGenerated, contractsReal, totalCost, daysElapsed, daysRemaining },
        forecast: {
          projectedLeads,
          projectedContracts,
          projectedCost,
          leadsAttainmentProbability: leadsAttainmentProb,
          message: `No ritmo atual, você vai fechar ${projectedLeads} leads e ${projectedContracts} contratos este mês`,
        },
      })
    }
  )
}
