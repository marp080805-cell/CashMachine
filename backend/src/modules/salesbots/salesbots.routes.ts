import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'

const salesBotTypeEnum = z.enum(['CONVERSATION_BOT', 'INTERNAL_WORKFLOW', 'HYBRID'])

const createBotSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  type: salesBotTypeEnum.default('CONVERSATION_BOT'),
  steps: z.unknown(),
  entryPoint: z.string(),
  variables: z.record(z.unknown()).optional(),
})

const updateBotSchema = createBotSchema.partial()

const botIncludes = {
  createdBy: { select: { id: true, name: true, avatarUrl: true } },
  _count: { select: { executions: true } },
}

export default async function salebotsRoutes(app: FastifyInstance) {
  // GET /salesbots — lista com filtros
  app.get('/salesbots', async (request, reply) => {
    const tenantId = (request as any).user?.tenantId
    const query = request.query as { type?: string; isActive?: string }

    const bots = await prisma.salesBot.findMany({
      where: {
        tenantId,
        ...(query.type && { type: query.type as any }),
        ...(query.isActive !== undefined && { isActive: query.isActive === 'true' }),
      },
      include: botIncludes,
      orderBy: { createdAt: 'desc' },
    })

    return reply.send(bots)
  })

  // POST /salesbots — criar bot
  app.post('/salesbots', async (request, reply) => {
    const tenantId = (request as any).user?.tenantId
    const userId = (request as any).user?.id
    const data = createBotSchema.parse(request.body)

    const bot = await prisma.salesBot.create({
      data: {
        tenantId,
        createdById: userId,
        name: data.name,
        description: data.description,
        isActive: data.isActive,
        type: data.type,
        steps: data.steps as object,
        entryPoint: data.entryPoint,
        variables: data.variables,
      },
      include: botIncludes,
    })

    return reply.status(201).send(bot)
  })

  // GET /salesbots/:id — buscar
  app.get('/salesbots/:id', async (request, reply) => {
    const tenantId = (request as any).user?.tenantId
    const { id } = request.params as { id: string }

    const bot = await prisma.salesBot.findFirst({
      where: { id, tenantId },
      include: botIncludes,
    })

    if (!bot) return reply.status(404).send({ error: 'SalesBot not found' })

    return reply.send(bot)
  })

  // PUT /salesbots/:id — atualizar
  app.put('/salesbots/:id', async (request, reply) => {
    const tenantId = (request as any).user?.tenantId
    const { id } = request.params as { id: string }
    const data = updateBotSchema.parse(request.body)

    const existing = await prisma.salesBot.findFirst({ where: { id, tenantId } })
    if (!existing) return reply.status(404).send({ error: 'SalesBot not found' })

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.type !== undefined) updateData.type = data.type
    if (data.steps !== undefined) updateData.steps = data.steps as object
    if (data.entryPoint !== undefined) updateData.entryPoint = data.entryPoint
    if (data.variables !== undefined) updateData.variables = data.variables

    const bot = await prisma.salesBot.update({
      where: { id },
      data: updateData,
      include: botIncludes,
    })

    return reply.send(bot)
  })

  // DELETE /salesbots/:id — deletar
  app.delete('/salesbots/:id', async (request, reply) => {
    const tenantId = (request as any).user?.tenantId
    const { id } = request.params as { id: string }

    const existing = await prisma.salesBot.findFirst({ where: { id, tenantId } })
    if (!existing) return reply.status(404).send({ error: 'SalesBot not found' })

    await prisma.salesBot.delete({ where: { id } })

    return reply.status(204).send()
  })

  // POST /salesbots/:id/duplicate — duplicar bot
  app.post('/salesbots/:id/duplicate', async (request, reply) => {
    const tenantId = (request as any).user?.tenantId
    const userId = (request as any).user?.id
    const { id } = request.params as { id: string }

    const source = await prisma.salesBot.findFirst({ where: { id, tenantId } })
    if (!source) return reply.status(404).send({ error: 'SalesBot not found' })

    const duplicated = await prisma.salesBot.create({
      data: {
        tenantId,
        createdById: userId,
        name: `Cópia de ${source.name}`,
        description: source.description ?? undefined,
        isActive: false,
        type: source.type,
        steps: source.steps as object,
        entryPoint: source.entryPoint,
        variables: source.variables as object | undefined,
      },
      include: botIncludes,
    })

    return reply.status(201).send(duplicated)
  })

  // GET /salesbots/:id/export — retornar JSON do bot para download
  app.get('/salesbots/:id/export', async (request, reply) => {
    const tenantId = (request as any).user?.tenantId
    const { id } = request.params as { id: string }

    const bot = await prisma.salesBot.findFirst({ where: { id, tenantId } })
    if (!bot) return reply.status(404).send({ error: 'SalesBot not found' })

    const exportData = {
      name: bot.name,
      description: bot.description,
      type: bot.type,
      steps: bot.steps,
      entryPoint: bot.entryPoint,
      variables: bot.variables,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    }

    return reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="salesbot-${bot.name.replace(/\s+/g, '-')}.json"`)
      .send(exportData)
  })

  // POST /salesbots/import — receber JSON e criar bot
  app.post('/salesbots/import', async (request, reply) => {
    const tenantId = (request as any).user?.tenantId
    const userId = (request as any).user?.id
    const importSchema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      type: salesBotTypeEnum.default('CONVERSATION_BOT'),
      steps: z.unknown(),
      entryPoint: z.string(),
      variables: z.record(z.unknown()).optional(),
    })
    const data = importSchema.parse(request.body)

    const bot = await prisma.salesBot.create({
      data: {
        tenantId,
        createdById: userId,
        name: data.name,
        description: data.description,
        isActive: false,
        type: data.type,
        steps: data.steps as object,
        entryPoint: data.entryPoint,
        variables: data.variables,
      },
      include: botIncludes,
    })

    return reply.status(201).send(bot)
  })

  // GET /salesbots/:id/executions — listar execuções do bot
  app.get('/salesbots/:id/executions', async (request, reply) => {
    const tenantId = (request as any).user?.tenantId
    const { id } = request.params as { id: string }
    const query = request.query as { status?: string; limit?: string; offset?: string }

    const bot = await prisma.salesBot.findFirst({ where: { id, tenantId } })
    if (!bot) return reply.status(404).send({ error: 'SalesBot not found' })

    const take = Number(query.limit ?? 50)
    const skip = Number(query.offset ?? 0)

    const [executions, total] = await Promise.all([
      prisma.salesBotExecution.findMany({
        where: {
          botId: id,
          ...(query.status && { status: query.status as any }),
        },
        orderBy: { startedAt: 'desc' },
        take,
        skip,
        include: {
          opportunity: { select: { id: true, title: true } },
          contact: { select: { id: true, name: true } },
        },
      }),
      prisma.salesBotExecution.count({
        where: {
          botId: id,
          ...(query.status && { status: query.status as any }),
        },
      }),
    ])

    return reply.send({ executions, total, take, skip })
  })

  // PUT /salesbots/executions/:id/pause — pausar execução
  app.put('/salesbots/executions/:id/pause', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { reason?: string }

    const execution = await prisma.salesBotExecution.findUnique({ where: { id } })
    if (!execution) return reply.status(404).send({ error: 'Execution not found' })

    if (execution.status !== 'RUNNING') {
      return reply.status(400).send({ error: 'Only RUNNING executions can be paused' })
    }

    const updated = await prisma.salesBotExecution.update({
      where: { id },
      data: {
        status: 'PAUSED',
        pausedReason: body?.reason ?? 'Pausado manualmente',
      },
    })

    return reply.send(updated)
  })

  // PUT /salesbots/executions/:id/resume — retomar execução
  app.put('/salesbots/executions/:id/resume', async (request, reply) => {
    const { id } = request.params as { id: string }

    const execution = await prisma.salesBotExecution.findUnique({ where: { id } })
    if (!execution) return reply.status(404).send({ error: 'Execution not found' })

    if (execution.status !== 'PAUSED') {
      return reply.status(400).send({ error: 'Only PAUSED executions can be resumed' })
    }

    const updated = await prisma.salesBotExecution.update({
      where: { id },
      data: {
        status: 'RUNNING',
        pausedReason: null,
      },
    })

    const { botExecutionQueue } = await import('../../queues/bot-execution.queue')
    await botExecutionQueue.add('execute-step', { executionId: id })

    return reply.send(updated)
  })
}
