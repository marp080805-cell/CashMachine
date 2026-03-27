import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'

const taskTypeEnum = z.enum([
  'FIRST_CONTACT', 'FOLLOW_UP', 'QUALIFY', 'SCHEDULE_MEETING',
  'CONFIRM_PRESENCE', 'PREPARE_BRIEFING', 'SEND_PROPOSAL', 'FOLLOW_UP_PROPOSAL',
  'CALL', 'MEETING', 'EMAIL', 'REMINDER', 'RESCUE_CONTACT', 'CUSTOM',
])

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: taskTypeEnum.default('FOLLOW_UP'),
  dueDate: z.string().datetime().optional(),
  opportunityId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  assignedToId: z.string().uuid(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
})

const taskIncludes = {
  contact: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
  opportunity: { select: { id: true, title: true } },
  assignedTo: { select: { id: true, name: true, avatarUrl: true } },
  stage: { select: { id: true, name: true } },
}

function computeSlaBreach(task: { createdAt: Date; slaMinutes: number | null }): boolean {
  if (!task.slaMinutes) return false
  const deadline = new Date(task.createdAt.getTime() + task.slaMinutes * 60 * 1000)
  return new Date() > deadline
}

export default async function tasksRoutes(app: FastifyInstance) {
  app.get('/tasks', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId, id: userId, role } = request.user as { tenantId: string; id: string; role: string }
    const { filter, assignedToId, opportunityId, contactId, page = 1, limit = 50 } = request.query as any

    const isManager = ['ADMIN', 'MANAGER'].includes(role)
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekEnd = new Date(todayStart.getTime() + 7 * 86400000)

    const where: any = {
      tenantId,
      ...(!isManager && { assignedToId: userId }),
      ...(isManager && assignedToId && { assignedToId }),
      ...(opportunityId && { opportunityId }),
      ...(contactId && { contactId }),
    }

    if (filter === 'today') {
      where.dueDate = { gte: todayStart, lt: new Date(todayStart.getTime() + 86400000) }
      where.status = { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] }
    } else if (filter === 'week') {
      where.dueDate = { gte: todayStart, lt: weekEnd }
      where.status = { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] }
    } else if (filter === 'overdue') {
      where.dueDate = { lt: todayStart }
      where.status = { in: ['PENDING', 'IN_PROGRESS'] }
    }

    const tasks = await prisma.task.findMany({
      where,
      include: taskIncludes,
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    })

    const tasksWithSla = tasks.map((t) => ({
      ...t,
      slaBreach: computeSlaBreach(t),
    }))

    return reply.send(tasksWithSla)
  })

  app.post('/tasks', { preHandler: [app.authenticate] }, async (request, reply) => {
    const input = createTaskSchema.parse(request.body)
    const { tenantId, id: createdById } = request.user as { tenantId: string; id: string }

    const task = await prisma.task.create({
      data: { ...input, tenantId, createdById, status: 'PENDING' },
      include: taskIncludes,
    })

    return reply.status(201).send(task)
  })

  app.patch('/tasks/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }
    const input = createTaskSchema.partial().parse(request.body)

    await prisma.task.findFirstOrThrow({ where: { id, tenantId } })
    const task = await prisma.task.update({ where: { id }, data: input, include: taskIncludes })
    return reply.send(task)
  })

  // Tarefas atrasadas
  app.get('/tasks/overdue', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId, id: userId, role } = request.user as { tenantId: string; id: string; role: string }
    const isManager = ['ADMIN', 'MANAGER'].includes(role)
    const now = new Date()

    const tasks = await prisma.task.findMany({
      where: {
        tenantId,
        ...(!isManager && { assignedToId: userId }),
        dueDate: { lt: now },
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      include: taskIncludes,
      orderBy: { dueDate: 'asc' },
    })

    return reply.send(tasks.map((t) => ({ ...t, slaBreach: computeSlaBreach(t) })))
  })

  // Completar tarefa com notas
  app.post('/tasks/:id/complete', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId, id: userId } = request.user as { tenantId: string; id: string }
    const { notes } = z.object({ notes: z.string().optional() }).parse(request.body)

    await prisma.task.findFirstOrThrow({ where: { id, tenantId } })

    const task = await prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          completedById: userId,
          ...(notes && { completionNotes: notes }),
        },
        include: taskIncludes,
      })

      if (updated.opportunityId) {
        await tx.activity.create({
          data: {
            tenantId,
            type: 'TASK_COMPLETED',
            description: `Tarefa "${updated.title}" concluída${notes ? `: ${notes}` : ''}`,
            opportunityId: updated.opportunityId,
            contactId: updated.contactId ?? undefined,
            userId,
          },
        })
      }

      return updated
    })

    return reply.send(task)
  })

  // Fila "Minha agenda" — tarefas do usuário priorizadas
  app.get('/tasks/my-queue', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId, id: userId } = request.user as { tenantId: string; id: string }
    const now = new Date()
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

    const tasks = await prisma.task.findMany({
      where: {
        tenantId,
        assignedToId: userId,
        status: { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] },
        OR: [{ dueDate: { lte: todayEnd } }, { dueDate: null }],
      },
      include: taskIncludes,
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 50,
    })

    return reply.send(tasks)
  })

  // Pular/cancelar tarefa
  app.put('/tasks/:id/skip', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }
    await prisma.task.findFirstOrThrow({ where: { id, tenantId } })
    const task = await prisma.task.update({
      where: { id },
      data: { status: 'SKIPPED' },
      include: taskIncludes,
    })
    return reply.send(task)
  })

  // Editar task completa
  app.put('/tasks/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }
    const input = createTaskSchema.partial().parse(request.body)

    await prisma.task.findFirstOrThrow({ where: { id, tenantId } })
    const task = await prisma.task.update({ where: { id }, data: input, include: taskIncludes })
    return reply.send(task)
  })

  app.delete('/tasks/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    await prisma.task.findFirstOrThrow({ where: { id, tenantId } })
    await prisma.task.delete({ where: { id } })
    return reply.send({ success: true })
  })
}
