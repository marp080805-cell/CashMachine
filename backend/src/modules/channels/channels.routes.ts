import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { requirePermission } from '../../middleware/rbac'

const createChannelSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['ONLINE_PAID', 'ONLINE_ORGANIC', 'PRESENTIAL_EVENT', 'PRESENTIAL_COMMUNITY', 'OFFLINE_REFERRAL_PARTNER', 'OFFLINE_REFERRAL_CLIENT', 'OUTBOUND', 'CUSTOM']),
  status: z.enum(['ACTIVE', 'PAUSED', 'TESTING', 'INACTIVE']).default('ACTIVE'),
  priority: z.number().min(1).max(5).default(3),
  cplTarget: z.number().optional(),
  cacTarget: z.number().optional(),
  leadToCallRate: z.number().default(0.2),
  callToContractRate: z.number().default(0.25),
})

const upsertMetricSchema = z.object({
  month: z.number().min(1).max(12),
  year: z.number().min(2020),
  leadsGoal: z.number().default(0),
  leadsGenerated: z.number().default(0),
  totalCost: z.number().default(0),
  callsReal: z.number().default(0),
  contractsReal: z.number().default(0),
})

export default async function channelsRoutes(app: FastifyInstance) {
  app.get(
    '/channels',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const channels = await prisma.channel.findMany({
        orderBy: [{ priority: 'desc' }, { name: 'asc' }],
        include: {
          _count: { select: { leads: true } },
        },
      })
      return reply.send({ channels })
    }
  )

  app.get(
    '/channels/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const channel = await prisma.channel.findUniqueOrThrow({
        where: { id },
        include: { metrics: { orderBy: [{ year: 'desc' }, { month: 'desc' }] } },
      })
      return reply.send(channel)
    }
  )

  app.post(
    '/channels',
    { preHandler: [app.authenticate, requirePermission('*')] },
    async (request, reply) => {
      const input = createChannelSchema.parse(request.body)
      const channel = await prisma.channel.create({ data: input })
      return reply.status(201).send(channel)
    }
  )

  app.patch(
    '/channels/:id',
    { preHandler: [app.authenticate, requirePermission('*')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const input = createChannelSchema.partial().parse(request.body)
      const channel = await prisma.channel.update({ where: { id }, data: input })
      return reply.send(channel)
    }
  )

  app.delete(
    '/channels/:id',
    { preHandler: [app.authenticate, requirePermission('*')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await prisma.channel.update({ where: { id }, data: { status: 'INACTIVE' } })
      return reply.status(204).send()
    }
  )

  app.get(
    '/channels/:id/metrics',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { year } = request.query as { year?: string }

      const metrics = await prisma.channelMetric.findMany({
        where: {
          channelId: id,
          ...(year ? { year: parseInt(year, 10) } : {}),
        },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      })

      return reply.send(metrics)
    }
  )

  app.put(
    '/channels/:id/metrics',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id: channelId } = request.params as { id: string }
      const input = upsertMetricSchema.parse(request.body)

      const callsEstimated = input.leadsGenerated * (
        await prisma.channel.findUniqueOrThrow({ where: { id: channelId } })
      ).leadToCallRate

      const contractsEstimated = callsEstimated * (
        await prisma.channel.findUniqueOrThrow({ where: { id: channelId } })
      ).callToContractRate

      const metric = await prisma.channelMetric.upsert({
        where: {
          channelId_month_year: {
            channelId,
            month: input.month,
            year: input.year,
          },
        },
        update: { ...input, callsEstimated, contractsEstimated },
        create: { ...input, channelId, callsEstimated, contractsEstimated },
      })

      return reply.send(metric)
    }
  )
}
