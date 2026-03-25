import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'

export default async function notificationsRoutes(app: FastifyInstance) {
  app.get('/notifications', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId, tenantId } = request.user as { id: string; tenantId: string }
    const { limit = 20 } = request.query as { limit?: string }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId, tenantId },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
      }),
      prisma.notification.count({ where: { userId, tenantId, isRead: false } }),
    ])

    return reply.send({ notifications, unreadCount })
  })

  app.patch('/notifications/:id/read', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    await prisma.notification.updateMany({ where: { id, tenantId }, data: { isRead: true } })
    return reply.send({ success: true })
  })

  app.patch('/notifications/read-all', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId, tenantId } = request.user as { id: string; tenantId: string }

    await prisma.notification.updateMany({
      where: { userId, tenantId, isRead: false },
      data: { isRead: true },
    })
    return reply.send({ success: true })
  })
}
