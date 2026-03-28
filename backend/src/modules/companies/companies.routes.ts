import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'

const createCompanySchema = z.object({
  name: z.string().min(1),
  legalName: z.string().optional(),
  cnpj: z.string().optional(),
  category: z.string().optional(),
  segment: z.string().optional(),
  website: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  mobile: z.string().optional(),
  fax: z.string().optional(),
  extension: z.string().optional(),
  address: z.string().optional(),
  addressJson: z.record(z.any()).optional(),
  socialProfiles: z.record(z.string()).optional(),
  employeeCount: z.number().int().optional(),
  annualRevenue: z.number().optional(),
  originId: z.string().uuid().optional(),
  notes: z.string().optional(),
  assignedToId: z.string().uuid().optional(),
})

export default async function companiesRoutes(app: FastifyInstance) {
  app.get('/companies', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const { search, page = 1, limit = 20 } = request.query as any

    const where = {
      tenantId,
      ...(search && { name: { contains: search, mode: 'insensitive' as const } }),
    }

    const [data, total] = await Promise.all([
      prisma.company.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { contacts: true, opportunities: true } },
          assignedTo: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      prisma.company.count({ where }),
    ])

    return reply.send({ data, total, page: Number(page), limit: Number(limit) })
  })

  app.get('/companies/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    const company = await prisma.company.findFirstOrThrow({
      where: { id, tenantId },
      include: {
        assignedTo: { select: { id: true, name: true, avatarUrl: true } },
        contacts: {
          select: { id: true, name: true, email: true, phone: true },
          take: 20,
        },
        opportunities: {
          select: {
            id: true, title: true, status: true, value: true,
            stage: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })

    return reply.send(company)
  })

  app.post('/companies', { preHandler: [app.authenticate] }, async (request, reply) => {
    const input = createCompanySchema.parse(request.body)
    const { tenantId } = request.user as { tenantId: string }

    const company = await prisma.company.create({ data: { ...input, tenantId } })
    return reply.status(201).send(company)
  })

  app.patch('/companies/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }
    const input = createCompanySchema.partial().parse(request.body)

    await prisma.company.findFirstOrThrow({ where: { id, tenantId } })
    const company = await prisma.company.update({ where: { id }, data: input })
    return reply.send(company)
  })

  app.delete('/companies/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    await prisma.company.findFirstOrThrow({ where: { id, tenantId } })
    await prisma.company.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // Contatos da empresa
  app.get('/companies/:id/contacts', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    await prisma.company.findFirstOrThrow({ where: { id, tenantId } })

    const contacts = await prisma.contact.findMany({
      where: { companyId: id, tenantId },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, email: true, phone: true,
        origin: { select: { id: true, name: true } },
      },
    })

    return reply.send(contacts)
  })

  // Oportunidades da empresa (via contatos)
  app.get('/companies/:id/opportunities', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    await prisma.company.findFirstOrThrow({ where: { id, tenantId } })

    const contacts = await prisma.contact.findMany({
      where: { companyId: id, tenantId },
      select: { id: true },
    })
    const contactIds = contacts.map((c) => c.id)

    const opportunities = await prisma.opportunity.findMany({
      where: { contactId: { in: contactIds }, tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        contact: { select: { id: true, name: true } },
        stage: { select: { id: true, name: true, color: true } },
        pipeline: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    return reply.send(opportunities)
  })
}
