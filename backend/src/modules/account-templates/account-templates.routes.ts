import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  isPublic: z.boolean().default(false),
  templateData: z.record(z.unknown()),
})

const snapshotSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  isPublic: z.boolean().default(false),
})

export default async function accountTemplatesRoutes(app: FastifyInstance) {
  // GET /account-templates
  app.get('/account-templates', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as { id: string }

    const templates = await prisma.accountTemplate.findMany({
      where: {
        OR: [{ createdById: userId }, { isPublic: true }],
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send(templates)
  })

  // POST /account-templates
  app.post('/account-templates', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: createdById } = request.user as { id: string }
    const input = createTemplateSchema.parse(request.body)

    const template = await prisma.accountTemplate.create({
      data: {
        ...input,
        templateData: input.templateData as any,
        createdById,
      },
    })

    return reply.status(201).send(template)
  })

  // GET /account-templates/:id
  app.get('/account-templates/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId } = request.user as { id: string }

    const template = await prisma.accountTemplate.findFirstOrThrow({
      where: {
        id,
        OR: [{ createdById: userId }, { isPublic: true }],
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    })

    return reply.send(template)
  })

  // DELETE /account-templates/:id
  app.delete('/account-templates/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId } = request.user as { id: string }

    await prisma.accountTemplate.findFirstOrThrow({ where: { id, createdById: userId } })
    await prisma.accountTemplate.delete({ where: { id } })

    return reply.send({ success: true })
  })

  // POST /account-templates/:id/apply — apply template to tenant
  app.post('/account-templates/:id/apply', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId, id: userId } = request.user as { tenantId: string; id: string }

    const template = await prisma.accountTemplate.findFirstOrThrow({
      where: {
        id,
        OR: [{ createdById: userId }, { isPublic: true }],
      },
    })

    const data = template.templateData as Record<string, unknown>

    const results: Record<string, number> = {}

    await prisma.$transaction(async (tx) => {
      // Pipelines + Stages
      if (Array.isArray(data.pipelines)) {
        let pipelineCount = 0
        for (const pipeline of data.pipelines as any[]) {
          const { stages, ...pipelineData } = pipeline
          const created = await tx.pipeline.create({
            data: {
              tenantId,
              name: pipelineData.name,
              description: pipelineData.description ?? null,
              type: pipelineData.type ?? 'SALES',
              isActive: true,
              sortOrder: pipelineData.sortOrder ?? 0,
            },
          })
          pipelineCount++

          if (Array.isArray(stages)) {
            for (const stage of stages as any[]) {
              await tx.stage.create({
                data: {
                  pipelineId: created.id,
                  name: stage.name,
                  color: stage.color ?? '#6366f1',
                  sortOrder: stage.sortOrder ?? 0,
                  type: stage.type ?? 'NORMAL',
                  probability: stage.probability ?? 0,
                  description: stage.description ?? null,
                },
              })
            }
          }
        }
        results.pipelines = pipelineCount
      }

      // Origins
      if (Array.isArray(data.origins)) {
        let originCount = 0
        for (const origin of data.origins as any[]) {
          await tx.origin.create({
            data: {
              tenantId,
              name: origin.name,
              isActive: true,
            },
          })
          originCount++
        }
        results.origins = originCount
      }

      // Lost Reasons
      if (Array.isArray(data.lostReasons)) {
        let count = 0
        for (const lr of data.lostReasons as any[]) {
          await tx.lostReason.create({
            data: {
              tenantId,
              name: lr.name,
              isActive: true,
            },
          })
          count++
        }
        results.lostReasons = count
      }

      // Tags
      if (Array.isArray(data.tags)) {
        let count = 0
        for (const tag of data.tags as any[]) {
          try {
            await tx.tag.create({
              data: {
                tenantId,
                name: tag.name,
                color: tag.color ?? '#6366f1',
                category: tag.category ?? 'CUSTOM',
                createdById: userId,
                isLocked: false,
              },
            })
            count++
          } catch {
            // skip duplicates
          }
        }
        results.tags = count
      }

      // Custom Field Groups + Custom Fields
      if (Array.isArray(data.customFieldGroups)) {
        let count = 0
        for (const group of data.customFieldGroups as any[]) {
          const { customFields, ...groupData } = group
          const createdGroup = await tx.customFieldGroup.create({
            data: {
              tenantId,
              entityType: groupData.entityType ?? 'opportunity',
              name: groupData.name,
              sortOrder: groupData.sortOrder ?? 0,
            },
          })
          count++

          if (Array.isArray(customFields)) {
            for (const field of customFields as any[]) {
              try {
                await tx.customField.create({
                  data: {
                    groupId: createdGroup.id,
                    entityType: field.entityType ?? 'opportunity',
                    name: field.name,
                    slug: field.slug,
                    fieldType: field.fieldType ?? 'TEXT',
                    options: field.options ?? null,
                    sortOrder: field.sortOrder ?? 0,
                    isActive: true,
                    showInCard: field.showInCard ?? false,
                    placeholder: field.placeholder ?? null,
                    tooltip: field.tooltip ?? null,
                  },
                })
              } catch {
                // skip duplicates
              }
            }
          }
        }
        results.customFieldGroups = count
      }

      // Message Templates
      if (Array.isArray(data.messageTemplates)) {
        let count = 0
        for (const mt of data.messageTemplates as any[]) {
          await tx.messageTemplate.create({
            data: {
              tenantId,
              name: mt.name,
              channel: mt.channel ?? 'WHATSAPP',
              body: mt.body,
              hasButtons: mt.hasButtons ?? false,
              buttons: mt.buttons ?? null,
              mediaUrl: mt.mediaUrl ?? null,
            },
          })
          count++
        }
        results.messageTemplates = count
      }

      // Task Templates
      if (Array.isArray(data.taskTemplates)) {
        let count = 0
        for (const tt of data.taskTemplates as any[]) {
          await tx.taskTemplate.create({
            data: {
              tenantId,
              name: tt.name,
              type: tt.type ?? 'FOLLOW_UP',
              titleTemplate: tt.titleTemplate,
              descriptionTemplate: tt.descriptionTemplate ?? null,
              defaultPriority: tt.defaultPriority ?? 'MEDIUM',
              slaMinutes: tt.slaMinutes ?? null,
              dueOffsetMinutes: tt.dueOffsetMinutes ?? null,
              dueDateRelativeTo: tt.dueDateRelativeTo ?? null,
              assignedRole: tt.assignedRole ?? null,
            },
          })
          count++
        }
        results.taskTemplates = count
      }
    })

    return reply.send({ success: true, applied: results })
  })

  // POST /account-templates/snapshot — capture current tenant state
  app.post('/account-templates/snapshot', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId, id: createdById } = request.user as { tenantId: string; id: string }
    const input = snapshotSchema.parse(request.body)

    // Capture current tenant state
    const [
      pipelines,
      origins,
      lostReasons,
      tags,
      customFieldGroups,
      messageTemplates,
      taskTemplates,
    ] = await Promise.all([
      prisma.pipeline.findMany({
        where: { tenantId },
        include: { stages: { orderBy: { sortOrder: 'asc' } } },
      }),
      prisma.origin.findMany({ where: { tenantId } }),
      prisma.lostReason.findMany({ where: { tenantId } }),
      prisma.tag.findMany({
        where: { tenantId },
        select: { name: true, color: true, category: true },
      }),
      prisma.customFieldGroup.findMany({
        where: { tenantId },
        include: { customFields: { orderBy: { sortOrder: 'asc' } } },
      }),
      prisma.messageTemplate.findMany({ where: { tenantId } }),
      prisma.taskTemplate.findMany({ where: { tenantId } }),
    ])

    const templateData = {
      pipelines: pipelines.map((p) => ({
        name: p.name,
        description: p.description,
        type: p.type,
        sortOrder: p.sortOrder,
        stages: p.stages.map((s) => ({
          name: s.name,
          color: s.color,
          sortOrder: s.sortOrder,
          type: s.type,
          probability: s.probability,
          description: s.description,
        })),
      })),
      origins: origins.map((o) => ({ name: o.name })),
      lostReasons: lostReasons.map((lr) => ({ name: lr.name })),
      tags,
      customFieldGroups: customFieldGroups.map((g) => ({
        entityType: g.entityType,
        name: g.name,
        sortOrder: g.sortOrder,
        customFields: g.customFields.map((f) => ({
          entityType: f.entityType,
          name: f.name,
          slug: f.slug,
          fieldType: f.fieldType,
          options: f.options,
          sortOrder: f.sortOrder,
          showInCard: f.showInCard,
          placeholder: f.placeholder,
          tooltip: f.tooltip,
        })),
      })),
      messageTemplates: messageTemplates.map((mt) => ({
        name: mt.name,
        channel: mt.channel,
        body: mt.body,
        hasButtons: mt.hasButtons,
        buttons: mt.buttons,
        mediaUrl: mt.mediaUrl,
      })),
      taskTemplates: taskTemplates.map((tt) => ({
        name: tt.name,
        type: tt.type,
        titleTemplate: tt.titleTemplate,
        descriptionTemplate: tt.descriptionTemplate,
        defaultPriority: tt.defaultPriority,
        slaMinutes: tt.slaMinutes,
        dueOffsetMinutes: tt.dueOffsetMinutes,
        dueDateRelativeTo: tt.dueDateRelativeTo,
        assignedRole: tt.assignedRole,
      })),
    }

    const template = await prisma.accountTemplate.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        category: input.category ?? null,
        isPublic: input.isPublic,
        templateData: templateData as any,
        createdById,
      },
    })

    return reply.status(201).send(template)
  })
}
