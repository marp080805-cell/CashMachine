import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { requirePermission } from '../../middleware/rbac'

export default async function tagsRoutes(app: FastifyInstance) {
  app.get('/tags', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const { entityType } = request.query as { entityType?: string }

    const tags = await prisma.tag.findMany({
      where: { tenantId, ...(entityType ? { entityType } : {}) },
      orderBy: { name: 'asc' },
    })

    return reply.send(tags)
  })

  app.post(
    '/tags',
    { preHandler: [app.authenticate, requirePermission('tags:manage')] },
    async (request, reply) => {
      const { tenantId, id: userId } = request.user as { tenantId: string; id: string }
      const input = z.object({
        name: z.string().min(1),
        color: z.string().default('#6366f1'),
        category: z.enum(['QUALIFICATION', 'TEMPERATURE', 'STATUS', 'AI_CONTROL', 'CUSTOM']).default('CUSTOM'),
        entityType: z.string().default('opportunity'),
        isLocked: z.boolean().default(false),
      }).parse(request.body)

      const tag = await prisma.tag.create({
        data: { ...input, tenantId, createdById: userId },
      })
      return reply.status(201).send(tag)
    }
  )

  app.patch(
    '/tags/:id',
    { preHandler: [app.authenticate, requirePermission('tags:manage')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { tenantId } = request.user as { tenantId: string }
      const input = z.object({
        name: z.string().optional(),
        color: z.string().optional(),
        category: z.enum(['QUALIFICATION', 'TEMPERATURE', 'STATUS', 'AI_CONTROL', 'CUSTOM']).optional(),
        entityType: z.string().optional(),
        isLocked: z.boolean().optional(),
      }).parse(request.body)

      await prisma.tag.findFirstOrThrow({ where: { id, tenantId } })
      const tag = await prisma.tag.update({ where: { id }, data: input })
      return reply.send(tag)
    }
  )

  app.delete(
    '/tags/:id',
    { preHandler: [app.authenticate, requirePermission('tags:manage')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { tenantId } = request.user as { tenantId: string }

      const tag = await prisma.tag.findFirstOrThrow({ where: { id, tenantId } })
      if (tag.isLocked) {
        return reply.status(403).send({ error: 'Tag bloqueada — só super admin pode excluir' })
      }

      await prisma.tag.delete({ where: { id } })
      return reply.send({ success: true })
    }
  )

  // Atribuir tag a entidade
  app.post('/tags/assign', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId, id: userId } = request.user as { tenantId: string; id: string }
    const input = z.object({
      tagId: z.string().uuid(),
      entityType: z.literal('opportunity'),
      entityId: z.string().uuid(),
    }).parse(request.body)

    await prisma.tag.findFirstOrThrow({ where: { id: input.tagId, tenantId } })

    const existing = await prisma.tagAssignment.findFirst({
      where: { tagId: input.tagId, entityType: input.entityType, entityId: input.entityId, removedAt: null },
    })

    if (existing) return reply.send(existing)

    const assignment = await prisma.tagAssignment.create({
      data: {
        tagId: input.tagId,
        entityType: input.entityType,
        entityId: input.entityId,
        assignedById: userId,
      },
      include: { tag: true },
    })

    return reply.status(201).send(assignment)
  })

  // Remover tag de entidade
  app.post('/tags/unassign', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const input = z.object({
      tagId: z.string().uuid(),
      entityType: z.literal('opportunity'),
      entityId: z.string().uuid(),
    }).parse(request.body)

    await prisma.tagAssignment.updateMany({
      where: {
        tagId: input.tagId,
        entityType: input.entityType,
        entityId: input.entityId,
        removedAt: null,
      },
      data: { removedAt: new Date() },
    })

    return reply.send({ success: true })
  })

  // Listar tags de uma entidade
  app.get('/tags/entity/:entityType/:entityId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { entityType, entityId } = request.params as { entityType: string; entityId: string }

    const assignments = await prisma.tagAssignment.findMany({
      where: { entityType, entityId, removedAt: null },
      include: { tag: true },
    })

    return reply.send(assignments.map((a) => a.tag))
  })
}
