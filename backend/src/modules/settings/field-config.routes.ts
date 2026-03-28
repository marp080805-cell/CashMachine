import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'

const patchBodySchema = z.object({
  entityType: z.string().min(1),
  fieldSlug: z.string().min(1),
  required: z.boolean(),
})

export default async function fieldConfigRoutes(app: FastifyInstance) {
  app.get('/settings/field-config', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    })

    if (!tenant) return reply.status(404).send({ error: 'Tenant not found' })

    const settings = (tenant.settings ?? {}) as Record<string, unknown>
    const fieldRequired = (settings.fieldRequired ?? {}) as Record<string, Record<string, boolean>>

    return reply.send(fieldRequired)
  })

  app.patch('/settings/field-config', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const { entityType, fieldSlug, required } = patchBodySchema.parse(request.body)

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    })

    if (!tenant) return reply.status(404).send({ error: 'Tenant not found' })

    const settings = (tenant.settings ?? {}) as Record<string, unknown>
    const fieldRequired = (settings.fieldRequired ?? {}) as Record<string, Record<string, boolean>>

    if (!fieldRequired[entityType]) {
      fieldRequired[entityType] = {}
    }
    fieldRequired[entityType][fieldSlug] = required

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...settings,
          fieldRequired,
        },
      },
    })

    return reply.send(fieldRequired)
  })
}
