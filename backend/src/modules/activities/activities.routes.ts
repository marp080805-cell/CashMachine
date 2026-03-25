import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'

const createActivitySchema = z.object({
  type: z.enum(['NOTE', 'EMAIL', 'CALL', 'MEETING', 'WHATSAPP_MESSAGE', 'DEAL_MOVED', 'DEAL_CREATED', 'DEAL_WON', 'DEAL_LOST', 'TASK_COMPLETED', 'FILE_UPLOADED', 'AI_SUGGESTION']),
  description: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
  leadId: z.string().min(1).optional(),
  dealId: z.string().min(1).optional(),
})

export default async function activitiesRoutes(app: FastifyInstance) {
  app.get(
    '/activities',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { leadId, dealId, limit } = request.query as {
        leadId?: string
        dealId?: string
        limit?: string
      }

      const activities = await prisma.activity.findMany({
        where: {
          ...(leadId ? { leadId } : {}),
          ...(dealId ? { dealId } : {}),
        },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          lead: { select: { id: true, name: true } },
          deal: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit ? parseInt(limit, 10) : 50,
      })

      return reply.send(activities)
    }
  )

  app.post(
    '/activities',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const input = createActivitySchema.parse(request.body)
      const user = request.user as { id: string }

      const { metadata, ...rest } = input
      const activity = await prisma.activity.create({
        data: { ...rest, userId: user.id, ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}) },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      })

      return reply.status(201).send(activity)
    }
  )
}
