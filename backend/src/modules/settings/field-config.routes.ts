import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'

const patchBodySchema = z.object({
  entityType: z.string().min(1),
  fieldSlug: z.string().min(1),
  required: z.boolean().optional(),
  label: z.string().optional(),
}).refine((d) => d.required !== undefined || d.label !== undefined, {
  message: 'At least one of required or label must be provided',
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
    const fieldLabels = (settings.fieldLabels ?? {}) as Record<string, Record<string, string>>

    return reply.send({ fieldRequired, fieldLabels })
  })

  app.patch('/settings/field-config', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const { entityType, fieldSlug, required, label } = patchBodySchema.parse(request.body)

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    })

    if (!tenant) return reply.status(404).send({ error: 'Tenant not found' })

    const settings = (tenant.settings ?? {}) as Record<string, unknown>
    const fieldRequired = (settings.fieldRequired ?? {}) as Record<string, Record<string, boolean>>
    const fieldLabels = (settings.fieldLabels ?? {}) as Record<string, Record<string, string>>

    if (required !== undefined) {
      if (!fieldRequired[entityType]) {
        fieldRequired[entityType] = {}
      }
      fieldRequired[entityType][fieldSlug] = required
    }

    if (label !== undefined) {
      if (!fieldLabels[entityType]) {
        fieldLabels[entityType] = {}
      }
      fieldLabels[entityType][fieldSlug] = label
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...settings,
          fieldRequired,
          fieldLabels,
        },
      },
    })

    return reply.send({ fieldRequired, fieldLabels })
  })
}
