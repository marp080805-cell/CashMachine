import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'

const createCompanySchema = z.object({
  name: z.string().min(1),
  cnpj: z.string().optional(),
  website: z.string().url().optional(),
  segment: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
})

export default async function companiesRoutes(app: FastifyInstance) {
  app.get(
    '/companies',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { search } = request.query as { search?: string }

      const companies = await prisma.company.findMany({
        where: search
          ? { name: { contains: search, mode: 'insensitive' } }
          : undefined,
        orderBy: { name: 'asc' },
        take: 50,
      })

      return reply.send(companies)
    }
  )

  app.get(
    '/companies/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const company = await prisma.company.findUniqueOrThrow({ where: { id } })
      return reply.send(company)
    }
  )

  app.post(
    '/companies',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const input = createCompanySchema.parse(request.body)
      const company = await prisma.company.create({ data: input })
      return reply.status(201).send(company)
    }
  )

  app.patch(
    '/companies/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const input = createCompanySchema.partial().parse(request.body)
      const company = await prisma.company.update({ where: { id }, data: input })
      return reply.send(company)
    }
  )

  app.delete(
    '/companies/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await prisma.company.delete({ where: { id } })
      return reply.status(204).send()
    }
  )
}
