import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'

const patchBodySchema = z.object({
  entityType: z.string().min(1),
  fieldSlug: z.string().min(1),
  required: z.boolean().optional(),
  label: z.string().optional(),
  placeholder: z.string().optional(),
  hidden: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  optionDefs: z.array(z.object({ key: z.string(), label: z.string() })).optional(),
}).refine(
  (d) => d.required !== undefined || d.label !== undefined || d.placeholder !== undefined || d.hidden !== undefined || d.options !== undefined || d.optionDefs !== undefined,
  { message: 'At least one field must be provided' }
)

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
    const fieldPlaceholders = (settings.fieldPlaceholders ?? {}) as Record<string, Record<string, string>>
    const fieldHidden = (settings.fieldHidden ?? {}) as Record<string, Record<string, boolean>>
    const fieldOptions = (settings.fieldOptions ?? {}) as Record<string, Record<string, string[]>>
    const fieldOptionDefs = (settings.fieldOptionDefs ?? {}) as Record<string, Record<string, { key: string; label: string }[]>>

    return reply.send({ fieldRequired, fieldLabels, fieldPlaceholders, fieldHidden, fieldOptions, fieldOptionDefs })
  })

  app.patch('/settings/field-config', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const { entityType, fieldSlug, required, label, placeholder, hidden, options, optionDefs } = patchBodySchema.parse(request.body)

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    })

    if (!tenant) return reply.status(404).send({ error: 'Tenant not found' })

    const settings = (tenant.settings ?? {}) as Record<string, unknown>
    const fieldRequired = (settings.fieldRequired ?? {}) as Record<string, Record<string, boolean>>
    const fieldLabels = (settings.fieldLabels ?? {}) as Record<string, Record<string, string>>
    const fieldPlaceholders = (settings.fieldPlaceholders ?? {}) as Record<string, Record<string, string>>
    const fieldHidden = (settings.fieldHidden ?? {}) as Record<string, Record<string, boolean>>
    const fieldOptions = (settings.fieldOptions ?? {}) as Record<string, Record<string, string[]>>
    const fieldOptionDefs = (settings.fieldOptionDefs ?? {}) as Record<string, Record<string, { key: string; label: string }[]>>

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

    if (placeholder !== undefined) {
      if (!fieldPlaceholders[entityType]) fieldPlaceholders[entityType] = {}
      fieldPlaceholders[entityType][fieldSlug] = placeholder
    }

    if (hidden !== undefined) {
      if (!fieldHidden[entityType]) fieldHidden[entityType] = {}
      fieldHidden[entityType][fieldSlug] = hidden
    }

    if (options !== undefined) {
      if (!fieldOptions[entityType]) fieldOptions[entityType] = {}
      fieldOptions[entityType][fieldSlug] = options
    }

    if (optionDefs !== undefined) {
      if (!fieldOptionDefs[entityType]) fieldOptionDefs[entityType] = {}
      fieldOptionDefs[entityType][fieldSlug] = optionDefs
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...settings,
          fieldRequired,
          fieldLabels,
          fieldPlaceholders,
          fieldHidden,
          fieldOptions,
          fieldOptionDefs,
        },
      },
    })

    return reply.send({ fieldRequired, fieldLabels, fieldPlaceholders, fieldHidden, fieldOptions, fieldOptionDefs })
  })
}
