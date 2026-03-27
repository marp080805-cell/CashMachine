import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'

const createLeadSchema = z.object({
  // Contato existente ou criar novo
  contactId: z.string().uuid().optional(),
  // Campos para criar contato novo
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  originId: z.string().uuid().optional(),
  subOriginId: z.string().uuid().optional(),
  // Campos do lead
  source: z.string().optional(),
  score: z.number().optional(),
}).refine(
  (data) => data.contactId || data.name,
  { message: 'Informe contactId ou name do contato' }
)

export default async function leadsRoutes(app: FastifyInstance) {
  app.get('/leads', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const { status, search, page = 1, limit = 20 } = request.query as any

    const where: any = {
      tenantId,
      ...(status && { status }),
    }

    if (search) {
      where.contact = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
      }
    }

    const [data, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          contact: {
            include: {
              origin: { select: { id: true, name: true } },
              subOrigin: { select: { id: true, name: true } },
              company: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.lead.count({ where }),
    ])

    return reply.send({ data, total, page: Number(page), limit: Number(limit) })
  })

  app.get('/leads/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    const lead = await prisma.lead.findFirstOrThrow({
      where: { id, tenantId },
      include: {
        contact: {
          include: {
            origin: { select: { id: true, name: true } },
            subOrigin: { select: { id: true, name: true } },
            company: { select: { id: true, name: true } },
            activities: {
              orderBy: { createdAt: 'desc' },
              take: 20,
              include: { user: { select: { id: true, name: true } } },
            },
          },
        },
      },
    })

    return reply.send(lead)
  })

  app.post('/leads', { preHandler: [app.authenticate] }, async (request, reply) => {
    const input = createLeadSchema.parse(request.body)
    const { tenantId, id: userId } = request.user as { tenantId: string; id: string }

    let contactId = input.contactId

    if (!contactId) {
      const contact = await prisma.contact.create({
        data: {
          tenantId,
          name: input.name!,
          email: input.email,
          phone: input.phone,
          originId: input.originId,
          subOriginId: input.subOriginId,
        },
      })
      contactId = contact.id
    }

    const lead = await prisma.lead.create({
      data: { tenantId, contactId, source: input.source, score: input.score ?? 0, status: 'NEW' },
      include: {
        contact: {
          include: {
            origin: { select: { id: true, name: true } },
            subOrigin: { select: { id: true, name: true } },
          },
        },
      },
    })

    return reply.status(201).send(lead)
  })

  app.patch('/leads/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }
    const input = z.object({
      status: z.enum(['NEW', 'NURTURING', 'QUALIFIED', 'DISQUALIFIED']).optional(),
      source: z.string().optional(),
      score: z.number().optional(),
    }).parse(request.body)

    await prisma.lead.findFirstOrThrow({ where: { id, tenantId } })
    const lead = await prisma.lead.update({ where: { id }, data: input, include: { contact: true } })
    return reply.send(lead)
  })

  app.delete('/leads/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    await prisma.lead.findFirstOrThrow({ where: { id, tenantId } })
    await prisma.lead.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // Promover lead para oportunidade
  app.post('/leads/:id/promote', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId, id: userId } = request.user as { tenantId: string; id: string }
    const input = z.object({
      pipelineId: z.string().uuid(),
      stageId: z.string().uuid(),
      title: z.string().optional(),
      value: z.number().optional(),
    }).parse(request.body)

    const lead = await prisma.lead.findFirstOrThrow({ where: { id, tenantId } })
    const contact = await prisma.contact.findUniqueOrThrow({ where: { id: lead.contactId } })

    const opportunity = await prisma.opportunity.create({
      data: {
        tenantId,
        contactId: lead.contactId,
        pipelineId: input.pipelineId,
        stageId: input.stageId,
        assignedToId: userId,
        sdrId: userId,
        title: input.title ?? `Oportunidade — ${contact.name}`,
        value: input.value,
        status: 'OPEN',
      },
      include: {
        contact: { select: { id: true, name: true } },
        stage: { select: { id: true, name: true } },
        pipeline: { select: { id: true, name: true } },
      },
    })

    await prisma.stageHistory.create({
      data: { opportunityId: opportunity.id, stageId: input.stageId, movedById: userId },
    })

    await prisma.activity.create({
      data: {
        tenantId,
        type: 'OPPORTUNITY_CREATED',
        description: 'Oportunidade criada a partir de lead',
        opportunityId: opportunity.id,
        contactId: lead.contactId,
        userId,
      },
    })

    await prisma.lead.update({ where: { id }, data: { status: 'QUALIFIED' } })

    return reply.status(201).send(opportunity)
  })
}
