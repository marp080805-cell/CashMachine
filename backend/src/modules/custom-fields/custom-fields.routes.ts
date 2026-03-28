import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { requirePermission } from '../../middleware/rbac'

const fieldTypeEnum = z.enum([
  'TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'DATETIME',
  'SELECT', 'MULTISELECT', 'CHECKBOX', 'URL', 'PHONE', 'EMAIL', 'CURRENCY',
])

export default async function customFieldsRoutes(app: FastifyInstance) {
  // ── Grupos ──────────────────────────────────────────────────────

  app.get('/custom-fields/groups', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const { entityType } = request.query as { entityType?: string }

    const groups = await prisma.customFieldGroup.findMany({
      where: { tenantId, ...(entityType && { entityType }) },
      orderBy: { sortOrder: 'asc' },
      include: {
        customFields: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    return reply.send(groups)
  })

  app.post(
    '/custom-fields/groups',
    { preHandler: [app.authenticate, requirePermission('custom-fields:manage')] },
    async (request, reply) => {
      const { tenantId } = request.user as { tenantId: string }
      const input = z.object({
        entityType: z.enum(['opportunity', 'contact', 'company', 'lead', 'task']),
        name: z.string().min(1),
        sortOrder: z.number().default(0),
        isCollapsedByDefault: z.boolean().default(false),
      }).parse(request.body)

      const group = await prisma.customFieldGroup.create({ data: { ...input, tenantId } })
      return reply.status(201).send(group)
    }
  )

  app.patch(
    '/custom-fields/groups/:id',
    { preHandler: [app.authenticate, requirePermission('custom-fields:manage')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { tenantId } = request.user as { tenantId: string }
      const input = z.object({
        name: z.string().optional(),
        sortOrder: z.number().optional(),
        isCollapsedByDefault: z.boolean().optional(),
      }).parse(request.body)

      await prisma.customFieldGroup.findFirstOrThrow({ where: { id, tenantId } })
      const group = await prisma.customFieldGroup.update({ where: { id }, data: input })
      return reply.send(group)
    }
  )

  app.delete(
    '/custom-fields/groups/:id',
    { preHandler: [app.authenticate, requirePermission('custom-fields:manage')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { tenantId } = request.user as { tenantId: string }

      await prisma.customFieldGroup.findFirstOrThrow({ where: { id, tenantId } })
      await prisma.customFieldGroup.delete({ where: { id } })
      return reply.send({ success: true })
    }
  )

  // ── Campos ──────────────────────────────────────────────────────

  app.post(
    '/custom-fields',
    { preHandler: [app.authenticate, requirePermission('custom-fields:manage')] },
    async (request, reply) => {
      const input = z.object({
        groupId: z.string().uuid(),
        entityType: z.enum(['opportunity', 'contact', 'company', 'lead', 'task']),
        name: z.string().min(1),
        slug: z.string().regex(/^[a-z0-9_]+$/),
        fieldType: fieldTypeEnum,
        options: z.array(z.string()).optional(),
        isRequiredGlobal: z.boolean().default(false),
        requiredInStages: z.array(z.string()).optional(),
        visibleInStages: z.array(z.string()).optional(),
        showInCard: z.boolean().default(false),
        tooltip: z.string().optional(),
        defaultValue: z.string().optional(),
        sortOrder: z.number().default(0),
      }).parse(request.body)

      const field = await prisma.customField.create({ data: input })
      return reply.status(201).send(field)
    }
  )

  app.patch(
    '/custom-fields/:id',
    { preHandler: [app.authenticate, requirePermission('custom-fields:manage')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const input = z.object({
        name: z.string().optional(),
        fieldType: z.string().optional(),
        options: z.array(z.string()).optional(),
        isRequiredGlobal: z.boolean().optional(),
        requiredInStages: z.array(z.string()).optional(),
        visibleInStages: z.array(z.string()).optional(),
        showInCard: z.boolean().optional(),
        tooltip: z.string().optional(),
        defaultValue: z.string().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      }).parse(request.body)

      const field = await prisma.customField.update({ where: { id }, data: input })
      return reply.send(field)
    }
  )

  app.delete(
    '/custom-fields/:id',
    { preHandler: [app.authenticate, requirePermission('custom-fields:manage')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await prisma.customField.update({ where: { id }, data: { isActive: false } })
      return reply.send({ success: true })
    }
  )

  // ── Valores ──────────────────────────────────────────────────────

  // Obter valores de campos de uma entidade
  app.get('/custom-fields/values/:entityType/:entityId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { entityType, entityId } = request.params as { entityType: string; entityId: string }

    const values = await prisma.customFieldValue.findMany({
      where: { entityType, entityId },
      include: { customField: { select: { id: true, name: true, fieldType: true, slug: true } } },
    })

    return reply.send(values)
  })

  // Salvar valor de campo (upsert)
  app.put('/custom-fields/values', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const input = z.object({
      customFieldId: z.string().uuid(),
      entityType: z.enum(['opportunity', 'contact', 'company', 'lead', 'task']),
      entityId: z.string().uuid(),
      valueText: z.string().nullable().optional(),
      valueNumber: z.number().nullable().optional(),
      valueDate: z.string().datetime().nullable().optional(),
      valueJson: z.unknown().nullable().optional(),
    }).parse(request.body)

    const { valueJson, ...inputRest } = input
    const value = await prisma.customFieldValue.upsert({
      where: {
        customFieldId_entityType_entityId: {
          customFieldId: input.customFieldId,
          entityType: input.entityType,
          entityId: input.entityId,
        },
      },
      create: { ...inputRest, valueJson: valueJson === null ? Prisma.DbNull : valueJson as Prisma.InputJsonValue | undefined, updatedById: userId },
      update: { ...inputRest, valueJson: valueJson === null ? Prisma.DbNull : valueJson as Prisma.InputJsonValue | undefined, updatedById: userId },
    })

    return reply.send(value)
  })

  // Salvar múltiplos valores de uma vez
  app.put('/custom-fields/values/bulk', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { entityType, entityId, values } = z.object({
      entityType: z.enum(['opportunity', 'contact', 'company', 'lead', 'task']),
      entityId: z.string().uuid(),
      values: z.array(z.object({
        customFieldId: z.string().uuid(),
        valueText: z.string().nullable().optional(),
        valueNumber: z.number().nullable().optional(),
        valueDate: z.string().datetime().nullable().optional(),
        valueJson: z.unknown().nullable().optional(),
      })),
    }).parse(request.body)

    const results = await Promise.all(
      values.map(({ valueJson, ...v }) =>
        prisma.customFieldValue.upsert({
          where: {
            customFieldId_entityType_entityId: {
              customFieldId: v.customFieldId,
              entityType,
              entityId,
            },
          },
          create: { ...v, valueJson: valueJson === null ? Prisma.DbNull : valueJson as Prisma.InputJsonValue | undefined, entityType, entityId, updatedById: userId },
          update: { ...v, valueJson: valueJson === null ? Prisma.DbNull : valueJson as Prisma.InputJsonValue | undefined, entityType, entityId, updatedById: userId },
        })
      )
    )

    return reply.send(results)
  })
}
