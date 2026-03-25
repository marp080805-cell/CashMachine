import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'

const createActivitySchema = z.object({
  type: z.enum([
    'NOTE', 'EMAIL', 'CALL', 'MEETING', 'WHATSAPP_MESSAGE',
    'OPPORTUNITY_MOVED', 'OPPORTUNITY_CREATED', 'OPPORTUNITY_WON', 'OPPORTUNITY_LOST',
    'TASK_COMPLETED', 'FILE_UPLOADED', 'AI_SUGGESTION', 'STAGE_CHANGED', 'HANDOFF',
  ]),
  description: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
  contactId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
})

export default async function activitiesRoutes(app: FastifyInstance) {
  app.get('/activities', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const { contactId, opportunityId, limit = 50 } = request.query as any

    const activities = await prisma.activity.findMany({
      where: {
        tenantId,
        ...(contactId && { contactId }),
        ...(opportunityId && { opportunityId }),
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        contact: { select: { id: true, name: true } },
        opportunity: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    })

    return reply.send(activities)
  })

  app.post('/activities', { preHandler: [app.authenticate] }, async (request, reply) => {
    const input = createActivitySchema.parse(request.body)
    const { tenantId, id: userId } = request.user as { tenantId: string; id: string }

    const activity = await prisma.activity.create({
      data: {
        ...input,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        tenantId,
        userId,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    return reply.status(201).send(activity)
  })
}
