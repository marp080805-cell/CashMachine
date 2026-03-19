import type { FastifyInstance } from 'fastify'
import {
  createLeadSchema,
  updateLeadSchema,
  listLeadsSchema,
} from './leads.schema'
import {
  listLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  importLeads,
} from './leads.service'
import type { UserRole } from '@prisma/client'
import { z } from 'zod'

export default async function leadsRoutes(app: FastifyInstance) {
  app.get(
    '/leads',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const query = listLeadsSchema.parse(request.query)
      const user = request.user as { id: string; role: UserRole }
      const isAdmin = ['ADMIN', 'GESTOR'].includes(user.role)
      const result = await listLeads(query, user.id, isAdmin)
      return reply.send(result)
    }
  )

  app.get(
    '/leads/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const lead = await getLead(id)
      return reply.send(lead)
    }
  )

  app.post(
    '/leads',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const input = createLeadSchema.parse(request.body)
      const user = request.user as { id: string }
      const lead = await createLead(input, user.id)
      return reply.status(201).send(lead)
    }
  )

  app.patch(
    '/leads/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const input = updateLeadSchema.parse(request.body)
      const lead = await updateLead(id, input)
      return reply.send(lead)
    }
  )

  app.delete(
    '/leads/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await deleteLead(id)
      return reply.status(204).send()
    }
  )

  app.post(
    '/leads/import',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const bodySchema = z.object({
        rows: z.array(z.record(z.string())),
        mapping: z.record(z.string()),
        onDuplicate: z.enum(['ignore', 'update']).default('ignore'),
      })

      const { rows, mapping, onDuplicate } = bodySchema.parse(request.body)
      const user = request.user as { id: string }

      const mapped = rows.map((row) => {
        const lead: Record<string, unknown> = {}
        for (const [field, csvCol] of Object.entries(mapping)) {
          if (row[csvCol] !== undefined) {
            lead[field] = row[csvCol]
          }
        }
        return lead
      })

      const validRows = mapped.filter(
        (r) => typeof r['name'] === 'string' && r['name'].length > 0
      ) as Array<{ name: string } & Record<string, unknown>>

      const result = await importLeads(
        validRows as Parameters<typeof importLeads>[0],
        user.id,
        onDuplicate
      )

      return reply.send(result)
    }
  )
}
