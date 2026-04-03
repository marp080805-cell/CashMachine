import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { requirePermission } from '../../middleware/rbac'

const createPipelineSchema = z.object({
  name: z.string().min(1),
  prefix: z.string().max(5).optional(),
  description: z.string().optional(),
  type: z.enum(['SALES', 'TREATMENT', 'RESCUE', 'RELATIONSHIP', 'CUSTOM']).default('SALES'),
  typeName: z.string().optional().nullable(),
  defaultCloseDays: z.number().optional(),
  sdrStages: z.array(z.string()).optional(),
  closerStages: z.array(z.string()).optional(),
  handoffStageId: z.string().uuid().optional().nullable(),
  handoffRequiredFields: z.array(z.string()).optional(),
  autoAssignCloser: z.enum(['MANUAL', 'ROUND_ROBIN', 'BY_SPECIALTY', 'FIXED']).optional(),
  fixedCloserId: z.string().uuid().optional().nullable(),
  roundRobinUserIds: z.array(z.string()).optional(),
  cardFields: z.string().optional(), // JSON array como string: '["contact","value"]'
  cardTaskStatuses: z.string().optional(), // JSON array string
  aiEnabled: z.boolean().optional(),
  aiAgentId: z.string().nullable().optional(),
})

const deleteStageBodySchema = z.object({
  transferToStageId: z.string().uuid().optional(),
})

const createStageSchema = z.object({
  name: z.string().min(1),
  color: z.string().default('#6366f1'),
  sortOrder: z.number().optional(),
  type: z.enum(['NORMAL', 'WON', 'LOST']).optional(),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
  probability: z.number().min(0).max(100).optional(),
  autoCreateTasks: z.array(z.record(z.any())).optional(),
  description: z.string().optional(),
  requiredFields: z.array(z.string()).optional(),
  visibleFields: z.array(z.string()).optional(),
})

export default async function pipelinesRoutes(app: FastifyInstance) {
  // Listar todos os pipelines
  app.get('/pipelines', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }

    const pipelines = await prisma.pipeline.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        stages: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { opportunities: { where: { status: 'OPEN' } } } },
      },
    })

    return reply.send(pipelines)
  })

  // Obter pipeline com kanban completo
  app.get('/pipelines/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    const pipeline = await prisma.pipeline.findFirstOrThrow({
      where: { id, tenantId },
      include: {
        stages: {
          orderBy: { sortOrder: 'asc' },
          include: {
            opportunities: {
              where: { status: 'OPEN' },
              orderBy: { position: 'asc' },
              include: {
                contact: { select: { id: true, name: true, phone: true, email: true } },
                assignedTo: { select: { id: true, name: true, avatarUrl: true } },
                sdr: { select: { id: true, name: true } },
                closer: { select: { id: true, name: true } },
                origin: { select: { id: true, name: true } },
                subOrigin: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    })

    return reply.send(pipeline)
  })

  // Criar pipeline
  app.post(
    '/pipelines',
    { preHandler: [app.authenticate, requirePermission('pipelines:manage')] },
    async (request, reply) => {
      const input = createPipelineSchema.parse(request.body)
      const { tenantId } = request.user as { tenantId: string }

      const maxOrder = await prisma.pipeline.aggregate({
        where: { tenantId },
        _max: { sortOrder: true },
      })

      const pipeline = await prisma.pipeline.create({
        data: {
          ...input,
          tenantId,
          sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
        },
      })

      return reply.status(201).send(pipeline)
    }
  )

  // Atualizar pipeline
  app.patch(
    '/pipelines/:id',
    { preHandler: [app.authenticate, requirePermission('pipelines:manage')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { tenantId } = request.user as { tenantId: string }
      const input = createPipelineSchema.partial().parse(request.body)

      await prisma.pipeline.findFirstOrThrow({ where: { id, tenantId } })
      const pipeline = await prisma.pipeline.update({ where: { id }, data: input })
      return reply.send(pipeline)
    }
  )

  // Deletar pipeline (soft delete)
  app.delete(
    '/pipelines/:id',
    { preHandler: [app.authenticate, requirePermission('pipelines:manage')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { tenantId } = request.user as { tenantId: string }

      await prisma.pipeline.findFirstOrThrow({ where: { id, tenantId } })
      await prisma.pipeline.update({ where: { id }, data: { isActive: false } })
      return reply.send({ success: true })
    }
  )

  // Adicionar etapa ao pipeline
  app.post(
    '/pipelines/:id/stages',
    { preHandler: [app.authenticate, requirePermission('pipelines:manage')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { tenantId } = request.user as { tenantId: string }
      const input = createStageSchema.parse(request.body)

      await prisma.pipeline.findFirstOrThrow({ where: { id, tenantId } })

      const maxOrder = await prisma.stage.aggregate({
        where: { pipelineId: id },
        _max: { sortOrder: true },
      })

      const stage = await prisma.stage.create({
        data: {
          ...input,
          pipelineId: id,
          sortOrder: input.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
        },
      })

      return reply.status(201).send(stage)
    }
  )

  // Atualizar etapa
  app.patch(
    '/pipelines/:id/stages/:stageId',
    { preHandler: [app.authenticate, requirePermission('pipelines:manage')] },
    async (request, reply) => {
      const { id, stageId } = request.params as { id: string; stageId: string }
      const { tenantId } = request.user as { tenantId: string }
      const input = createStageSchema.partial().parse(request.body)

      await prisma.pipeline.findFirstOrThrow({ where: { id, tenantId } })
      await prisma.stage.findFirstOrThrow({ where: { id: stageId, pipelineId: id } })

      const stage = await prisma.stage.update({ where: { id: stageId }, data: input })
      return reply.send(stage)
    }
  )

  // Deletar etapa
  app.delete(
    '/pipelines/:id/stages/:stageId',
    { preHandler: [app.authenticate, requirePermission('pipelines:manage')] },
    async (request, reply) => {
      const { id, stageId } = request.params as { id: string; stageId: string }
      const { tenantId } = request.user as { tenantId: string }
      const { transferToStageId } = deleteStageBodySchema.parse(request.body ?? {})

      await prisma.pipeline.findFirstOrThrow({ where: { id, tenantId } })

      const stage = await prisma.stage.findFirstOrThrow({
        where: { id: stageId, pipelineId: id },
        include: { _count: { select: { opportunities: true } } },
      })

      if (stage._count.opportunities > 0) {
        if (!transferToStageId) {
          return reply.status(409).send({ error: 'Etapa possui oportunidades. Forneça transferToStageId.' })
        }
        await prisma.opportunity.updateMany({
          where: { stageId, tenantId },
          data: { stageId: transferToStageId },
        })
      }

      await prisma.stage.delete({ where: { id: stageId } })
      return reply.send({ success: true })
    }
  )

  // Configuração completa do funil (com triggers por stage)
  app.get('/pipelines/:id/config', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    const pipeline = await prisma.pipeline.findFirstOrThrow({
      where: { id, tenantId },
      include: {
        stages: {
          orderBy: { sortOrder: 'asc' },
          include: {
            _count: { select: { stageTriggers: true } },
            stageTriggers: {
              where: { tenantId },
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true, name: true, triggerEvent: true, actionType: true,
                isActive: true, executionCount: true, sortOrder: true,
              },
            },
          },
        },
      },
    })

    return reply.send(pipeline)
  })

  // Stage triggers do pipeline, agrupados por stage
  app.get('/pipelines/:id/stage-triggers', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    await prisma.pipeline.findFirstOrThrow({ where: { id, tenantId } })

    const stages = await prisma.stage.findMany({
      where: { pipelineId: id },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        color: true,
        sortOrder: true,
        stageTriggers: {
          where: { tenantId },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true, name: true, triggerEvent: true, actionType: true,
            isActive: true, executionCount: true, lastExecutedAt: true,
            sortOrder: true, applyToExisting: true,
          },
        },
      },
    })

    const result = stages.map((stage) => ({
      stageId: stage.id,
      stageName: stage.name,
      color: stage.color,
      sortOrder: stage.sortOrder,
      triggers: stage.stageTriggers,
    }))

    return reply.send(result)
  })

  // Board com dados enriquecidos para o kanban
  app.get('/pipelines/:id/board', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }
    const now = new Date()

    // Buscar o pipeline para obter configurações do card
    const pipelineConfig = await prisma.pipeline.findUnique({
      where: { id, tenantId },
      select: { cardTaskStatuses: true }
    })
    const taskStatuses: string[] = JSON.parse(pipelineConfig?.cardTaskStatuses ?? '["PENDING","IN_PROGRESS"]')

    const pipeline = await prisma.pipeline.findFirstOrThrow({
      where: { id, tenantId },
      include: {
        stages: {
          orderBy: { sortOrder: 'asc' },
          include: {
            opportunities: {
              where: { status: 'OPEN' },
              orderBy: { position: 'asc' },
              include: {
                contact: { select: { id: true, name: true, phone: true, email: true } },
                assignedTo: { select: { id: true, name: true, avatarUrl: true } },
                company: { select: { id: true, name: true } },
                sdr: { select: { id: true, name: true } },
                closer: { select: { id: true, name: true } },
                origin: { select: { id: true, name: true } },
                subOrigin: { select: { id: true, name: true } },
                tagAssignments: { where: { removedAt: null }, include: { tag: { select: { id: true, name: true, color: true } } } },
                tasks: {
                  where: {
                    status: { in: taskStatuses as any },
                  },
                  orderBy: { dueDate: 'asc' },
                  take: 5,
                  select: {
                    id: true,
                    title: true,
                    status: true,
                    dueDate: true,
                    priority: true,
                    type: true,
                  }
                },
                conversations: {
                  where: { status: { not: 'CLOSED' } },
                  orderBy: { lastMessageAt: 'desc' },
                  take: 1,
                  select: {
                    id: true,
                    status: true,
                    lastMessageAt: true,
                    messages: {
                      orderBy: { createdAt: 'desc' },
                      take: 1,
                      select: {
                        id: true,
                        direction: true,
                        content: true,
                        createdAt: true,
                      }
                    }
                  }
                },
              },
            },
          },
        },
      },
    })

    // Enriquecer oportunidades com status SLA
    const enriched = {
      ...pipeline,
      stages: pipeline.stages.map((stage) => ({
        ...stage,
        opportunities: stage.opportunities.map((opp) => {
          const nextTask = opp.tasks[0]
          const slaBreach = nextTask?.dueDate ? nextTask.dueDate < now : false
          return { ...opp, slaBreach, nextTask: nextTask ?? null }
        }),
      })),
    }

    return reply.send(enriched)
  })

  // Reordenar etapas
  app.put(
    '/pipelines/:id/stages/reorder',
    { preHandler: [app.authenticate, requirePermission('pipelines:manage')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { tenantId } = request.user as { tenantId: string }
      const { stageIds } = z.object({ stageIds: z.array(z.string()) }).parse(request.body)

      await prisma.pipeline.findFirstOrThrow({ where: { id, tenantId } })

      await Promise.all(
        stageIds.map((stageId, index) =>
          prisma.stage.update({
            where: { id: stageId, pipelineId: id },
            data: { sortOrder: index },
          })
        )
      )

      return reply.send({ success: true })
    }
  )
}
