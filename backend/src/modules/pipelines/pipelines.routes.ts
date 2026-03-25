import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { requirePermission } from '../../middleware/rbac'

const createPipelineSchema = z.object({
  name: z.string().min(1),
  prefix: z.string().max(5).optional(),
  description: z.string().optional(),
  type: z.enum(['SALES', 'TREATMENT', 'RESCUE', 'RELATIONSHIP', 'CUSTOM']).default('SALES'),
  defaultCloseDays: z.number().optional(),
})

const createStageSchema = z.object({
  name: z.string().min(1),
  color: z.string().default('#6366f1'),
  sortOrder: z.number().optional(),
  isWon: z.boolean().default(false),
  isLost: z.boolean().default(false),
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

      await prisma.pipeline.findFirstOrThrow({ where: { id, tenantId } })

      const stage = await prisma.stage.findFirstOrThrow({
        where: { id: stageId, pipelineId: id },
        include: { _count: { select: { opportunities: true } } },
      })

      if (stage._count.opportunities > 0) {
        return reply.status(409).send({ error: 'Etapa possui oportunidades vinculadas' })
      }

      await prisma.stage.delete({ where: { id: stageId } })
      return reply.send({ success: true })
    }
  )

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
