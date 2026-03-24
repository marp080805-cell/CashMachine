import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { requirePermission } from '../../middleware/rbac'

const createFunnelSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['PROSPECTING', 'SALES', 'POST_SALES', 'CUSTOM']).default('SALES'),
  position: z.number().default(0),
})

const createStageSchema = z.object({
  name: z.string().min(1),
  position: z.number(),
  color: z.string().default('#6366f1'),
})

export default async function funnelsRoutes(app: FastifyInstance) {
  app.get(
    '/funnels',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const funnels = await prisma.funnel.findMany({
        where: { isActive: true },
        orderBy: { position: 'asc' },
        include: {
          stages: { orderBy: { position: 'asc' } },
          _count: { select: { deals: true } },
        },
      })
      return reply.send(funnels)
    }
  )

  app.get(
    '/funnels/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const funnel = await prisma.funnel.findUniqueOrThrow({
        where: { id },
        include: {
          stages: {
            orderBy: { position: 'asc' },
            include: {
              deals: {
                where: { status: 'OPEN' },
                include: {
                  lead: {
                    select: {
                      id: true,
                      name: true,
                      phone: true,
                      conversations: {
                        select: { id: true, lastMessage: true, lastMessageAt: true, unreadCount: true },
                        orderBy: { lastMessageAt: 'desc' },
                        take: 1,
                      },
                    },
                  },
                  company: { select: { id: true, name: true } },
                  assignedTo: { select: { id: true, name: true, avatarUrl: true } },
                  activities: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                  },
                },
                orderBy: { updatedAt: 'desc' },
              },
            },
          },
        },
      })
      return reply.send(funnel)
    }
  )

  app.post(
    '/funnels',
    { preHandler: [app.authenticate, requirePermission('*')] },
    async (request, reply) => {
      const input = createFunnelSchema.parse(request.body)
      const funnel = await prisma.funnel.create({ data: input })
      return reply.status(201).send(funnel)
    }
  )

  app.patch(
    '/funnels/:id',
    { preHandler: [app.authenticate, requirePermission('*')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const input = createFunnelSchema.partial().parse(request.body)
      const funnel = await prisma.funnel.update({ where: { id }, data: input })
      return reply.send(funnel)
    }
  )

  app.delete(
    '/funnels/:id',
    { preHandler: [app.authenticate, requirePermission('*')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await prisma.funnel.update({ where: { id }, data: { isActive: false } })
      return reply.status(204).send()
    }
  )

  app.post(
    '/funnels/:id/stages',
    { preHandler: [app.authenticate, requirePermission('*')] },
    async (request, reply) => {
      const { id: funnelId } = request.params as { id: string }
      const input = createStageSchema.parse(request.body)
      const stage = await prisma.funnelStage.create({
        data: { ...input, funnelId },
      })
      return reply.status(201).send(stage)
    }
  )

  app.patch(
    '/funnels/:id/stages/:stageId',
    { preHandler: [app.authenticate, requirePermission('*')] },
    async (request, reply) => {
      const { stageId } = request.params as { id: string; stageId: string }
      const input = createStageSchema.partial().parse(request.body)
      const stage = await prisma.funnelStage.update({
        where: { id: stageId },
        data: input,
      })
      return reply.send(stage)
    }
  )

  app.delete(
    '/funnels/:id/stages/:stageId',
    { preHandler: [app.authenticate, requirePermission('*')] },
    async (request, reply) => {
      const { stageId } = request.params as { id: string; stageId: string }
      await prisma.funnelStage.delete({ where: { id: stageId } })
      return reply.status(204).send()
    }
  )
}
