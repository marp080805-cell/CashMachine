import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'

const createOpportunitySchema = z.object({
  contactId: z.string().uuid(),
  companyId: z.string().uuid().optional(),
  pipelineId: z.string().uuid(),
  stageId: z.string().uuid(),
  assignedToId: z.string().uuid().optional(),
  title: z.string().min(1),
  value: z.number().optional(),
  originId: z.string().uuid().optional(),
  subOriginId: z.string().uuid().optional(),
  expectedCloseDate: z.string().datetime().optional(),
  temperature: z.enum(['COLD', 'WARM', 'HOT']).optional(),
  notes: z.string().optional(),
})

const moveSchema = z.object({
  stageId: z.string().uuid(),
  position: z.number().optional(),
})

const opportunityIncludes = {
  contact: { select: { id: true, name: true, phone: true, email: true } },
  company: { select: { id: true, name: true } },
  pipeline: { select: { id: true, name: true, prefix: true } },
  stage: { select: { id: true, name: true, color: true } },
  assignedTo: { select: { id: true, name: true, avatarUrl: true } },
  sdr: { select: { id: true, name: true } },
  closer: { select: { id: true, name: true } },
  origin: { select: { id: true, name: true } },
  subOrigin: { select: { id: true, name: true } },
  lostReason: { select: { id: true, name: true } },
}

export default async function opportunitiesRoutes(app: FastifyInstance) {
  app.get('/opportunities', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId, id: userId, role } = request.user as { tenantId: string; id: string; role: string }
    const {
      pipelineId, stageId, status, assignedToId, temperature,
      search, page = 1, limit = 20,
    } = request.query as any

    const isManager = ['ADMIN', 'MANAGER'].includes(role)

    const where: any = {
      tenantId,
      ...(pipelineId && { pipelineId }),
      ...(stageId && { stageId }),
      ...(status && { status }),
      ...(assignedToId && { assignedToId }),
      ...(temperature && { temperature }),
      ...(!isManager && { assignedToId: userId }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { contact: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    }

    const [data, total] = await Promise.all([
      prisma.opportunity.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { updatedAt: 'desc' },
        include: opportunityIncludes,
      }),
      prisma.opportunity.count({ where }),
    ])

    return reply.send({ data, total, page: Number(page), limit: Number(limit) })
  })

  app.get('/opportunities/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    const opportunity = await prisma.opportunity.findFirstOrThrow({
      where: { id, tenantId },
      include: {
        ...opportunityIncludes,
        stageHistories: {
          orderBy: { enteredAt: 'desc' },
          include: {
            stage: { select: { id: true, name: true } },
            movedBy: { select: { id: true, name: true } },
          },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 30,
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
        tasks: {
          where: { status: { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] } },
          orderBy: { dueDate: 'asc' },
          include: { assignedTo: { select: { id: true, name: true } } },
        },
      },
    })

    return reply.send(opportunity)
  })

  app.post('/opportunities', { preHandler: [app.authenticate] }, async (request, reply) => {
    const input = createOpportunitySchema.parse(request.body)
    const { tenantId, id: userId } = request.user as { tenantId: string; id: string }

    const opportunity = await prisma.opportunity.create({
      data: {
        ...input,
        tenantId,
        assignedToId: input.assignedToId ?? userId,
        sdrId: userId,
        status: 'OPEN',
      },
      include: opportunityIncludes,
    })

    await prisma.stageHistory.create({
      data: {
        opportunityId: opportunity.id,
        stageId: input.stageId,
        movedById: userId,
      },
    })

    await prisma.activity.create({
      data: {
        tenantId,
        type: 'OPPORTUNITY_CREATED',
        description: `Oportunidade "${opportunity.title}" criada`,
        opportunityId: opportunity.id,
        contactId: opportunity.contactId,
        userId,
      },
    })

    return reply.status(201).send(opportunity)
  })

  app.patch('/opportunities/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId, id: userId } = request.user as { tenantId: string; id: string }
    const input = createOpportunitySchema.partial().parse(request.body)

    await prisma.opportunity.findFirstOrThrow({ where: { id, tenantId } })
    const opportunity = await prisma.opportunity.update({
      where: { id },
      data: input,
      include: opportunityIncludes,
    })

    return reply.send(opportunity)
  })

  // Mover para outra etapa (com StageHistory)
  app.put('/opportunities/:id/move', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId, id: userId } = request.user as { tenantId: string; id: string }
    const { stageId, position } = moveSchema.parse(request.body)

    const opportunity = await prisma.opportunity.findFirstOrThrow({ where: { id, tenantId } })

    // Fechar entrada anterior no StageHistory
    const lastHistory = await prisma.stageHistory.findFirst({
      where: { opportunityId: id, exitedAt: null },
      orderBy: { enteredAt: 'desc' },
    })

    if (lastHistory) {
      const durationSeconds = Math.floor(
        (Date.now() - lastHistory.enteredAt.getTime()) / 1000
      )
      await prisma.stageHistory.update({
        where: { id: lastHistory.id },
        data: { exitedAt: new Date(), durationSeconds },
      })
    }

    // Criar nova entrada
    await prisma.stageHistory.create({
      data: { opportunityId: id, stageId, movedById: userId },
    })

    const updated = await prisma.opportunity.update({
      where: { id },
      data: {
        stageId,
        ...(position !== undefined && { position }),
      },
      include: opportunityIncludes,
    })

    await prisma.activity.create({
      data: {
        tenantId,
        type: 'STAGE_CHANGED',
        description: `Movido para etapa`,
        metadata: { fromStageId: opportunity.stageId, toStageId: stageId },
        opportunityId: id,
        userId,
      },
    })

    return reply.send(updated)
  })

  // Fechar como WON
  app.post('/opportunities/:id/won', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId, id: userId } = request.user as { tenantId: string; id: string }

    const pipeline = await prisma.opportunity.findFirstOrThrow({ where: { id, tenantId } })

    // Buscar etapa "won" do pipeline
    const wonStage = await prisma.stage.findFirst({
      where: { pipelineId: pipeline.pipelineId, isWon: true },
    })

    const updated = await prisma.opportunity.update({
      where: { id },
      data: {
        status: 'WON',
        closedAt: new Date(),
        ...(wonStage && { stageId: wonStage.id }),
      },
      include: opportunityIncludes,
    })

    await prisma.activity.create({
      data: {
        tenantId,
        type: 'OPPORTUNITY_WON',
        description: `Oportunidade fechada como GANHA`,
        opportunityId: id,
        userId,
      },
    })

    return reply.send(updated)
  })

  // Fechar como LOST
  app.post('/opportunities/:id/lost', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId, id: userId } = request.user as { tenantId: string; id: string }
    const { lostReasonId, notes } = z.object({
      lostReasonId: z.string().uuid().optional(),
      notes: z.string().optional(),
    }).parse(request.body)

    const pipeline = await prisma.opportunity.findFirstOrThrow({ where: { id, tenantId } })

    const lostStage = await prisma.stage.findFirst({
      where: { pipelineId: pipeline.pipelineId, isLost: true },
    })

    const updated = await prisma.opportunity.update({
      where: { id },
      data: {
        status: 'LOST',
        closedAt: new Date(),
        lostReasonId,
        ...(notes && { notes }),
        ...(lostStage && { stageId: lostStage.id }),
      },
      include: opportunityIncludes,
    })

    await prisma.activity.create({
      data: {
        tenantId,
        type: 'OPPORTUNITY_LOST',
        description: `Oportunidade fechada como PERDIDA`,
        opportunityId: id,
        userId,
      },
    })

    return reply.send(updated)
  })

  // Reabrir oportunidade
  app.post('/opportunities/:id/reopen', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId, id: userId } = request.user as { tenantId: string; id: string }

    await prisma.opportunity.findFirstOrThrow({ where: { id, tenantId } })

    const updated = await prisma.opportunity.update({
      where: { id },
      data: { status: 'OPEN', closedAt: null, lostReasonId: null },
      include: opportunityIncludes,
    })

    return reply.send(updated)
  })

  app.delete('/opportunities/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    await prisma.opportunity.findFirstOrThrow({ where: { id, tenantId } })
    await prisma.opportunity.delete({ where: { id } })
    return reply.send({ success: true })
  })
}
