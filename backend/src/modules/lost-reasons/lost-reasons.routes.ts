import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'

export default async function lostReasonsRoutes(app: FastifyInstance) {
  app.get('/lost-reasons', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const reasons = await prisma.lostReason.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    })
    return reply.send(reasons)
  })

  app.post('/lost-reasons', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const input = z.object({ name: z.string().min(1) }).parse(request.body)
    const reason = await prisma.lostReason.create({ data: { ...input, tenantId } })
    return reply.status(201).send(reason)
  })

  app.patch('/lost-reasons/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }
    const input = z.object({
      name: z.string().optional(),
      isActive: z.boolean().optional(),
    }).parse(request.body)
    await prisma.lostReason.findFirstOrThrow({ where: { id, tenantId } })
    const reason = await prisma.lostReason.update({ where: { id }, data: input })
    return reply.send(reason)
  })

  app.delete('/lost-reasons/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }
    await prisma.lostReason.findFirstOrThrow({ where: { id, tenantId } })
    await prisma.lostReason.delete({ where: { id } })
    return reply.send({ success: true })
  })
}
