import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import type { UserRole } from '@prisma/client'

export default async function dashboardRoutes(app: FastifyInstance) {
  app.get(
    '/dashboard/summary',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { month, year } = request.query as { month?: string; year?: string }
      const user = request.user as { id: string; role: UserRole }
      const isAdmin = ['ADMIN', 'GESTOR'].includes(user.role)

      const now = new Date()
      const targetMonth = month ? parseInt(month, 10) : now.getMonth() + 1
      const targetYear = year ? parseInt(year, 10) : now.getFullYear()

      const periodStart = new Date(targetYear, targetMonth - 1, 1)
      const periodEnd = new Date(targetYear, targetMonth, 1)

      const [
        metrics,
        channels,
        monthlyTrend,
        teamPerformance,
        recentActivities,
        upcomingTasks,
      ] = await Promise.all([
        prisma.channelMetric.findMany({
          where: { month: targetMonth, year: targetYear },
          include: { channel: { select: { id: true, name: true } } },
        }),

        prisma.channel.findMany({
          where: { status: 'ACTIVE' },
          include: {
            metrics: { where: { month: targetMonth, year: targetYear }, take: 1 },
          },
        }),

        prisma.$queryRaw<Array<{ month_num: number; year_num: number; leads: bigint; contracts: bigint; cost: number }>>`
          SELECT
            EXTRACT(MONTH FROM cm.created_at)::int as month_num,
            EXTRACT(YEAR FROM cm.created_at)::int as year_num,
            SUM(cm.leads_generated)::bigint as leads,
            SUM(cm.contracts_real)::bigint as contracts,
            SUM(cm.total_cost)::float as cost
          FROM channel_metrics cm
          WHERE cm.created_at >= NOW() - INTERVAL '6 months'
          GROUP BY month_num, year_num
          ORDER BY year_num ASC, month_num ASC
        `,

        isAdmin
          ? prisma.user.findMany({
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                _count: {
                  select: {
                    createdLeads: { where: { createdAt: { gte: periodStart, lt: periodEnd } } },
                    assignedDeals: { where: { createdAt: { gte: periodStart, lt: periodEnd } } },
                    tasks: { where: { isCompleted: true, completedAt: { gte: periodStart, lt: periodEnd } } },
                  },
                },
              },
            })
          : Promise.resolve([]),

        prisma.activity.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
            lead: { select: { id: true, name: true } },
            deal: { select: { id: true, title: true } },
          },
        }),

        prisma.task.findMany({
          where: {
            assignedToId: user.id,
            isCompleted: false,
            dueDate: { gte: new Date() },
          },
          orderBy: { dueDate: 'asc' },
          take: 5,
          include: {
            lead: { select: { id: true, name: true } },
            deal: { select: { id: true, title: true } },
          },
        }),
      ])

      const totalLeadsGenerated = metrics.reduce((sum, m) => sum + m.leadsGenerated, 0)
      const totalLeadsGoal = metrics.reduce((sum, m) => sum + m.leadsGoal, 0)
      const totalCost = metrics.reduce((sum, m) => sum + m.totalCost, 0)
      const totalCalls = metrics.reduce((sum, m) => sum + m.callsReal, 0)
      const totalContracts = metrics.reduce((sum, m) => sum + m.contractsReal, 0)

      const cplAverage = totalLeadsGenerated > 0 ? totalCost / totalLeadsGenerated : 0
      const cacAverage = totalContracts > 0 ? totalCost / totalContracts : 0
      const conversionRate = totalLeadsGenerated > 0 ? (totalContracts / totalLeadsGenerated) * 100 : 0
      const leadsAttainment = totalLeadsGoal > 0 ? (totalLeadsGenerated / totalLeadsGoal) * 100 : 0

      const channelPerformance = channels.map((ch) => {
        const metric = ch.metrics[0]
        const leads = metric?.leadsGenerated ?? 0
        const goal = metric?.leadsGoal ?? 0
        const cost = metric?.totalCost ?? 0
        const cpl = leads > 0 ? cost / leads : 0
        const attainment = goal > 0 ? (leads / goal) * 100 : 0

        return {
          channelId: ch.id,
          channelName: ch.name,
          leadsGenerated: leads,
          leadsGoal: goal,
          attainment,
          cost,
          cpl,
          delta: leads - goal,
        }
      })

      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

      const trendData = monthlyTrend.map((row) => ({
        month: monthNames[(row.month_num - 1) % 12] ?? '',
        leads: Number(row.leads),
        contracts: Number(row.contracts),
        cost: row.cost,
      }))

      return reply.send({
        period: { month: targetMonth, year: targetYear },
        kpis: {
          leadsThisMonth: totalLeadsGenerated,
          leadsGoal: totalLeadsGoal,
          leadsAttainment,
          callsThisMonth: totalCalls,
          contractsThisMonth: totalContracts,
          contractsGoal: metrics.reduce((sum, m) => sum + (m.contractsReal > 0 ? m.contractsReal : 0), 0),
          totalCost,
          cplAverage,
          cacAverage,
          conversionRate,
        },
        channelPerformance,
        monthlyTrend: trendData,
        teamPerformance: isAdmin
          ? teamPerformance.map((u) => ({
              userId: u.id,
              userName: u.name,
              leadsCreated: u._count.createdLeads,
              dealsCreated: u._count.assignedDeals,
              tasksCompleted: u._count.tasks,
              callsMade: 0,
            }))
          : [],
        recentActivities,
        upcomingTasks,
      })
    }
  )
}
