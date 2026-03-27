import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { TriggerExecutorService } from './trigger-executor.service'

const triggerEventEnum = z.enum([
  'ON_ENTER',
  'ON_EXIT',
  'ON_CREATE_IN_STAGE',
  'ON_ENTER_OR_CREATE',
  'ON_RESPONSIBLE_CHANGED',
  'AFTER_TIME_IN_STAGE',
  'ON_FIELD_CHANGED',
  'ON_MESSAGE_RECEIVED',
  'ON_MESSAGE_READ',
  'SCHEDULED',
])

const triggerActionTypeEnum = z.enum([
  'SALESBOT',
  'CREATE_TASK',
  'SEND_EMAIL',
  'SEND_MESSAGE',
  'CHANGE_RESPONSIBLE',
  'CHANGE_STAGE',
  'MOVE_TO_PIPELINE',
  'SET_FIELD',
  'ADD_TAG',
  'REMOVE_TAG',
  'CREATE_OPPORTUNITY',
  'WEBHOOK',
  'NOTIFY_USER',
  'AI_SUGGEST_RESPONSE',
  'SCHEDULE_MEETING',
  'DUPLICATE_TO_PIPELINE',
])

const createTriggerSchema = z.object({
  pipelineId: z.string().uuid(),
  stageId: z.string().uuid(),
  name: z.string().min(1),
  triggerEvent: triggerEventEnum,
  triggerConfig: z.record(z.unknown()).optional(),
  conditions: z.record(z.unknown()).optional(),
  actionType: triggerActionTypeEnum,
  actionConfig: z.record(z.unknown()).optional(),
  activeHours: z.object({ start: z.number().int().optional(), end: z.number().int().optional() }).optional(),
  delay: z.number().int().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  applyToExisting: z.boolean().default(false),
})

const updateTriggerSchema = createTriggerSchema.partial()

const triggerIncludes = {
  stage: { select: { id: true, name: true } },
  pipeline: { select: { id: true, name: true } },
  _count: { select: { logs: true } },
}

export default async function stageTriggerRoutes(app: FastifyInstance) {
  // GET /stage-triggers — lista com filtros
  app.get('/stage-triggers', { preHandler: [app.authenticate] }, async (request, reply) => {
    const tenantId = (request as any).user?.tenantId
    const query = request.query as {
      pipelineId?: string
      stageId?: string
      triggerEvent?: string
      actionType?: string
    }

    const triggers = await prisma.stageTrigger.findMany({
      where: {
        tenantId,
        ...(query.pipelineId && { pipelineId: query.pipelineId }),
        ...(query.stageId && { stageId: query.stageId }),
        ...(query.triggerEvent && { triggerEvent: query.triggerEvent as any }),
        ...(query.actionType && { actionType: query.actionType as any }),
      },
      include: triggerIncludes,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    return reply.send(triggers)
  })

  // POST /stage-triggers — criar trigger
  app.post('/stage-triggers', { preHandler: [app.authenticate] }, async (request, reply) => {
    const tenantId = (request as any).user?.tenantId
    const data = createTriggerSchema.parse(request.body)

    const trigger = await prisma.stageTrigger.create({
      data: {
        tenantId,
        pipelineId: data.pipelineId,
        stageId: data.stageId,
        name: data.name,
        triggerEvent: data.triggerEvent,
        triggerConfig: data.triggerConfig as Prisma.InputJsonValue | undefined,
        conditions: data.conditions as Prisma.InputJsonValue | undefined,
        actionType: data.actionType,
        actionConfig: data.actionConfig as Prisma.InputJsonValue | undefined,
        activeHours: data.activeHours as Prisma.InputJsonValue | undefined,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
        applyToExisting: data.applyToExisting,
      },
      include: triggerIncludes,
    })

    return reply.status(201).send(trigger)
  })

  // GET /stage-triggers/:id — buscar por ID
  app.get('/stage-triggers/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const tenantId = (request as any).user?.tenantId
    const { id } = request.params as { id: string }

    const trigger = await prisma.stageTrigger.findFirst({
      where: { id, tenantId },
      include: triggerIncludes,
    })

    if (!trigger) return reply.status(404).send({ error: 'Trigger not found' })

    return reply.send(trigger)
  })

  // PUT /stage-triggers/:id — atualizar
  app.put('/stage-triggers/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const tenantId = (request as any).user?.tenantId
    const { id } = request.params as { id: string }
    const data = updateTriggerSchema.parse(request.body)

    const existing = await prisma.stageTrigger.findFirst({ where: { id, tenantId } })
    if (!existing) return reply.status(404).send({ error: 'Trigger not found' })

    const trigger = await prisma.stageTrigger.update({
      where: { id },
      data: data as any,
      include: triggerIncludes,
    })

    return reply.send(trigger)
  })

  // DELETE /stage-triggers/:id — deletar
  app.delete('/stage-triggers/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const tenantId = (request as any).user?.tenantId
    const { id } = request.params as { id: string }

    const existing = await prisma.stageTrigger.findFirst({ where: { id, tenantId } })
    if (!existing) return reply.status(404).send({ error: 'Trigger not found' })

    await prisma.stageTrigger.delete({ where: { id } })

    return reply.status(204).send()
  })

  // PUT /stage-triggers/:id/toggle — ativar/desativar
  app.put('/stage-triggers/:id/toggle', { preHandler: [app.authenticate] }, async (request, reply) => {
    const tenantId = (request as any).user?.tenantId
    const { id } = request.params as { id: string }

    const existing = await prisma.stageTrigger.findFirst({ where: { id, tenantId } })
    if (!existing) return reply.status(404).send({ error: 'Trigger not found' })

    const trigger = await prisma.stageTrigger.update({
      where: { id },
      data: { isActive: !existing.isActive },
      include: triggerIncludes,
    })

    return reply.send(trigger)
  })

  // GET /stage-triggers/:id/logs — buscar logs do trigger
  app.get('/stage-triggers/:id/logs', { preHandler: [app.authenticate] }, async (request, reply) => {
    const tenantId = (request as any).user?.tenantId
    const { id } = request.params as { id: string }
    const query = request.query as { limit?: string; offset?: string }

    const existing = await prisma.stageTrigger.findFirst({ where: { id, tenantId } })
    if (!existing) return reply.status(404).send({ error: 'Trigger not found' })

    const take = Number(query.limit ?? 50)
    const skip = Number(query.offset ?? 0)

    const [logs, total] = await Promise.all([
      prisma.stageTriggerLog.findMany({
        where: { triggerId: id },
        orderBy: { executedAt: 'desc' },
        take,
        skip,
        include: {
          opportunity: { select: { id: true, title: true } },
        },
      }),
      prisma.stageTriggerLog.count({ where: { triggerId: id } }),
    ])

    return reply.send({ logs, total, take, skip })
  })

  // POST /stage-triggers/:id/test — executar trigger manualmente
  app.post('/stage-triggers/:id/test', { preHandler: [app.authenticate] }, async (request, reply) => {
    const tenantId = (request as any).user?.tenantId
    const { id } = request.params as { id: string }
    const body = request.body as { opportunityId: string }

    const trigger = await prisma.stageTrigger.findFirst({ where: { id, tenantId } })
    if (!trigger) return reply.status(404).send({ error: 'Trigger not found' })

    const opportunity = await prisma.opportunity.findFirst({
      where: { id: body.opportunityId, tenantId },
    })
    if (!opportunity) return reply.status(404).send({ error: 'Opportunity not found' })

    const result = await TriggerExecutorService.execute(trigger, opportunity)

    return reply.send({ success: result.success, result: result.result, error: result.error })
  })

  // GET /pipelines/:pipelineId/triggers — triggers de um pipeline
  app.get('/pipelines/:pipelineId/triggers', { preHandler: [app.authenticate] }, async (request, reply) => {
    const tenantId = (request as any).user?.tenantId
    const { pipelineId } = request.params as { pipelineId: string }

    const triggers = await prisma.stageTrigger.findMany({
      where: { pipelineId, tenantId },
      include: triggerIncludes,
      orderBy: [{ stageId: 'asc' }, { sortOrder: 'asc' }],
    })

    return reply.send(triggers)
  })

  // GET /stages/:stageId/triggers — triggers de uma stage
  app.get('/stages/:stageId/triggers', { preHandler: [app.authenticate] }, async (request, reply) => {
    const tenantId = (request as any).user?.tenantId
    const { stageId } = request.params as { stageId: string }

    const triggers = await prisma.stageTrigger.findMany({
      where: { stageId, tenantId },
      include: triggerIncludes,
      orderBy: { sortOrder: 'asc' },
    })

    return reply.send(triggers)
  })
}
