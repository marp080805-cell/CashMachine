import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'

export default async function notificationsRoutes(app: FastifyInstance) {
  app.get(
    '/notifications',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = request.user as { id: string }
      const { limit } = request.query as { limit?: string }

      const notifications = await prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: limit ? parseInt(limit, 10) : 20,
      })

      const unreadCount = await prisma.notification.count({
        where: { userId: user.id, isRead: false },
      })

      return reply.send({ notifications, unreadCount })
    }
  )

  app.patch(
    '/notifications/:id/read',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await prisma.notification.update({ where: { id }, data: { isRead: true } })
      return reply.status(204).send()
    }
  )

  app.patch(
    '/notifications/read-all',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = request.user as { id: string }
      await prisma.notification.updateMany({
        where: { userId: user.id, isRead: false },
        data: { isRead: true },
      })
      return reply.status(204).send()
    }
  )
}
