import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import type { Prisma, UserRole } from '@prisma/client'

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['CALL', 'EMAIL', 'MEETING', 'VISIT', 'PROPOSAL', 'FOLLOW_UP', 'OTHER']).default('CALL'),
  dueDate: z.string().datetime(),
  leadId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  assignedToId: z.string().uuid(),
})

export default async function tasksRoutes(app: FastifyInstance) {
  app.get(
    '/tasks',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { filter, assignedToId } = request.query as {
        filter?: 'today' | 'week' | 'overdue' | 'all'
        assignedToId?: string
      }

      const user = request.user as { id: string; role: UserRole }
      const isAdmin = ['ADMIN', 'GESTOR'].includes(user.role)

      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const todayEnd = new Date(todayStart.getTime() + 86400000)
      const weekEnd = new Date(todayStart.getTime() + 7 * 86400000)

      const where: Prisma.TaskWhereInput = {}

      if (!isAdmin) {
        where['assignedToId'] = user.id
      } else if (assignedToId) {
        where['assignedToId'] = assignedToId
      }

      if (filter === 'today') {
        where['dueDate'] = { gte: todayStart, lt: todayEnd }
        where['isCompleted'] = false
      } else if (filter === 'week') {
        where['dueDate'] = { gte: todayStart, lt: weekEnd }
        where['isCompleted'] = false
      } else if (filter === 'overdue') {
        where['dueDate'] = { lt: todayStart }
        where['isCompleted'] = false
      }

      const tasks = await prisma.task.findMany({
        where,
        include: {
          lead: { select: { id: true, name: true } },
          deal: { select: { id: true, title: true } },
          assignedTo: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { dueDate: 'asc' },
      })

      return reply.send(tasks)
    }
  )

  app.post(
    '/tasks',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const input = createTaskSchema.parse(request.body)
      const task = await prisma.task.create({
        data: input,
        include: {
          lead: { select: { id: true, name: true } },
          deal: { select: { id: true, title: true } },
          assignedTo: { select: { id: true, name: true, avatarUrl: true } },
        },
      })
      return reply.status(201).send(task)
    }
  )

  app.patch(
    '/tasks/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const input = createTaskSchema.partial().parse(request.body)
      const task = await prisma.task.update({
        where: { id },
        data: input,
        include: {
          lead: { select: { id: true, name: true } },
          deal: { select: { id: true, title: true } },
          assignedTo: { select: { id: true, name: true, avatarUrl: true } },
        },
      })
      return reply.send(task)
    }
  )

  app.post(
    '/tasks/:id/complete',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const user = request.user as { id: string }

      const task = await prisma.$transaction(async (tx) => {
        const updated = await tx.task.update({
          where: { id },
          data: { isCompleted: true, completedAt: new Date() },
          include: {
            lead: { select: { id: true, name: true } },
            deal: { select: { id: true, title: true } },
            assignedTo: { select: { id: true, name: true, avatarUrl: true } },
          },
        })

        await tx.activity.create({
          data: {
            type: 'TASK_COMPLETED',
            description: `Tarefa "${updated.title}" concluída`,
            leadId: updated.leadId ?? undefined,
            dealId: updated.dealId ?? undefined,
            userId: user.id,
          },
        })

        return updated
      })

      return reply.send(task)
    }
  )

  app.delete(
    '/tasks/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await prisma.task.delete({ where: { id } })
      return reply.status(204).send()
    }
  )
}
