import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { normalizePhone } from '../../lib/phone'

const createContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  cpfCnpj: z.string().optional(),
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
}
