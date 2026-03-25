import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { requirePermission } from '../../middleware/rbac'

export default async function originsRoutes(app: FastifyInstance) {
  // Listar origens com sub-origens
  app.get('/origins', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }

    const origins = await prisma.origin.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
      include: {
        subOrigins: { where: { isActive: true }, orderBy: { name: 'asc' } },
      },
    })

    return reply.send(origins)
  })

  app.post(
    '/origins',
    { preHandler: [app.authenticate, requirePermission('origins:manage')] },
    async (request, reply) => {
      const { tenantId } = request.user as { tenantId: string }
      const input = z.object({ name: z.string().min(1) }).parse(request.body)

      const origin = await prisma.origin.create({ data: { ...input, tenantId } })
      return reply.status(201).send(origin)
    }
  )

  app.patch(
    '/origins/:id',
    { preHandler: [app.authenticate, requirePermission('origins:manage')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { tenantId } = request.user as { tenantId: string }
      const input = z.object({ name: z.string().min(1).optional(), isActive: z.boolean().optional() }).parse(request.body)

      await prisma.origin.findFirstOrThrow({ where: { id, tenantId } })
      const origin = await prisma.origin.update({ where: { id }, data: input })
      return reply.send(origin)
    }
  )

  app.delete(
    '/origins/:id',
    { preHandler: [app.authenticate, requirePermission('origins:manage')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { tenantId } = request.user as { tenantId: string }

      await prisma.origin.findFirstOrThrow({ where: { id, tenantId } })
      await prisma.origin.update({ where: { id }, data: { isActive: false } })
      return reply.send({ success: true })
    }
  )

  // Sub-origens
  app.post(
    '/origins/:id/sub-origins',
    { preHandler: [app.authenticate, requirePermission('origins:manage')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { tenantId } = request.user as { tenantId: string }
      const input = z.object({ name: z.string().min(1) }).parse(request.body)

      await prisma.origin.findFirstOrThrow({ where: { id, tenantId } })
      const subOrigin = await prisma.subOrigin.create({ data: { ...input, originId: id } })
      return reply.status(201).send(subOrigin)
    }
  )

  app.patch(
    '/origins/:id/sub-origins/:subId',
    { preHandler: [app.authenticate, requirePermission('origins:manage')] },
    async (request, reply) => {
      const { id, subId } = request.params as { id: string; subId: string }
      const { tenantId } = request.user as { tenantId: string }
      const input = z.object({ name: z.string().min(1).optional(), isActive: z.boolean().optional() }).parse(request.body)

      await prisma.origin.findFirstOrThrow({ where: { id, tenantId } })
      await prisma.subOrigin.findFirstOrThrow({ where: { id: subId, originId: id } })
      const subOrigin = await prisma.subOrigin.update({ where: { id: subId }, data: input })
      return reply.send(subOrigin)
    }
  )

  // Motivos de perda
  app.get('/lost-reasons', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const reasons = await prisma.lostReason.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    })
    return reply.send(reasons)
  })

  app.post(
    '/lost-reasons',
    { preHandler: [app.authenticate, requirePermission('origins:manage')] },
    async (request, reply) => {
      const { tenantId } = request.user as { tenantId: string }
      const { name } = z.object({ name: z.string().min(1) }).parse(request.body)
      const reason = await prisma.lostReason.create({ data: { name, tenantId } })
      return reply.status(201).send(reason)
    }
  )

  app.patch(
    '/lost-reasons/:id',
    { preHandler: [app.authenticate, requirePermission('origins:manage')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { tenantId } = request.user as { tenantId: string }
      const input = z.object({ name: z.string().optional(), isActive: z.boolean().optional() }).parse(request.body)

      await prisma.lostReason.findFirstOrThrow({ where: { id, tenantId } })
      const reason = await prisma.lostReason.update({ where: { id }, data: input })
      return reply.send(reason)
    }
  )
}
