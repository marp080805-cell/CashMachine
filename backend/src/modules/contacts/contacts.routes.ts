import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { normalizePhone } from '../../lib/phone'

const createContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  mobile: z.string().optional(),
  fax: z.string().optional(),
  extension: z.string().optional(),
  cpfCnpj: z.string().optional(),
  cpf: z.string().optional(),
  role: z.string().optional(),
  nationality: z.string().optional(),
  category: z.string().optional(),
  website: z.string().optional(),
  dateOfBirth: z.string().datetime().optional(),
  avatarUrl: z.string().url().optional(),
  address: z.record(z.any()).optional(),
  socialProfiles: z.record(z.string()).optional(),
  isBlacklisted: z.boolean().optional(),
  originId: z.string().uuid().optional(),
  subOriginId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  firstContactDate: z.string().datetime().optional(),
  notes: z.string().optional(),
})

const updateContactSchema = createContactSchema.partial()

const listQuerySchema = z.object({
  search: z.string().optional(),
  originId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
})

export default async function contactsRoutes(app: FastifyInstance) {
  app.get('/contacts', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { search, originId, companyId, page, limit } = listQuerySchema.parse(request.query)
    const { tenantId } = request.user as { tenantId: string }
    const skip = (page - 1) * limit

    const where = {
      tenantId,
      ...(originId && { originId }),
      ...(companyId && { companyId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
        ],
      }),
    }

    const [data, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          origin: { select: { id: true, name: true } },
          subOrigin: { select: { id: true, name: true } },
          company: { select: { id: true, name: true } },
        },
      }),
      prisma.contact.count({ where }),
    ])

    return reply.send({ data, total, page, limit })
  })

  app.get('/contacts/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    const contact = await prisma.contact.findFirstOrThrow({
      where: { id, tenantId },
      include: {
        origin: { select: { id: true, name: true } },
        subOrigin: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
        opportunities: {
          select: {
            id: true, title: true, status: true, value: true,
            stage: { select: { id: true, name: true } },
            pipeline: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
        tasks: {
          where: { status: { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] } },
          orderBy: { dueDate: 'asc' },
          include: { assignedTo: { select: { id: true, name: true } } },
        },
      },
    })

    return reply.send(contact)
  })

  app.post('/contacts', { preHandler: [app.authenticate] }, async (request, reply) => {
    const input = createContactSchema.parse(request.body)
    const { tenantId, id: userId } = request.user as { tenantId: string; id: string }

    const phone = normalizePhone(input.phone) ?? input.phone ?? undefined

    const contact = await prisma.contact.create({
      data: { ...input, phone, tenantId },
      include: {
        origin: { select: { id: true, name: true } },
        subOrigin: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
      },
    })

    await prisma.activity.create({
      data: {
        tenantId,
        type: 'NOTE',
        description: `Contato criado`,
        contactId: contact.id,
        userId,
      },
    })

    return reply.status(201).send(contact)
  })

  app.patch('/contacts/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId, id: userId } = request.user as { tenantId: string; id: string }
    const input = updateContactSchema.parse(request.body)

    await prisma.contact.findFirstOrThrow({ where: { id, tenantId } })

    const normalizedInput = {
      ...input,
      ...(input.phone !== undefined && { phone: normalizePhone(input.phone) ?? input.phone }),
    }

    const contact = await prisma.contact.update({
      where: { id },
      data: normalizedInput,
      include: {
        origin: { select: { id: true, name: true } },
        subOrigin: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
      },
    })

    await prisma.activity.create({
      data: {
        tenantId,
        type: 'NOTE',
        description: 'Contato atualizado',
        contactId: id,
        userId,
      },
    })

    return reply.send(contact)
  })

  app.delete('/contacts/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    await prisma.contact.findFirstOrThrow({ where: { id, tenantId } })
    await prisma.contact.delete({ where: { id } })

    return reply.send({ success: true })
  })

  // Blacklist/unblacklist contato
  app.put('/contacts/:id/blacklist', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId, id: userId } = request.user as { tenantId: string; id: string }
    const { reason } = z.object({ reason: z.string().optional() }).parse(request.body)

    const contact = await prisma.contact.findFirstOrThrow({ where: { id, tenantId } })
    const newValue = !contact.isBlacklisted

    const updated = await prisma.contact.update({
      where: { id },
      data: { isBlacklisted: newValue },
    })

    await prisma.activity.create({
      data: {
        tenantId,
        type: 'NOTE',
        description: newValue
          ? `Contato adicionado à blacklist${reason ? `: ${reason}` : ''}`
          : 'Contato removido da blacklist',
        contactId: id,
        userId,
      },
    })

    return reply.send(updated)
  })

  // Oportunidades do contato
  app.get('/contacts/:id/opportunities', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    await prisma.contact.findFirstOrThrow({ where: { id, tenantId } })

    const opportunities = await prisma.opportunity.findMany({
      where: { contactId: id, tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        stage: { select: { id: true, name: true, color: true } },
        pipeline: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    return reply.send(opportunities)
  })

  // Tarefas do contato
  app.get('/contacts/:id/tasks', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    await prisma.contact.findFirstOrThrow({ where: { id, tenantId } })

    const tasks = await prisma.task.findMany({
      where: { contactId: id, tenantId },
      orderBy: { dueDate: 'asc' },
      include: {
        assignedTo: { select: { id: true, name: true, avatarUrl: true } },
        opportunity: { select: { id: true, title: true } },
      },
    })

    return reply.send(tasks)
  })

  // Atividades do contato
  app.get('/contacts/:id/activities', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    await prisma.contact.findFirstOrThrow({ where: { id, tenantId } })

    const activities = await prisma.activity.findMany({
      where: { contactId: id, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    })

    return reply.send(activities)
  })

  // Conversas do contato
  app.get('/contacts/:id/conversations', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    await prisma.contact.findFirstOrThrow({ where: { id, tenantId } })

    const conversations = await prisma.conversation.findMany({
      where: { contactId: id, tenantId },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        assignedTo: { select: { id: true, name: true, avatarUrl: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, content: true, direction: true, createdAt: true },
        },
      },
    })

    return reply.send(conversations)
  })
}
