import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { z } from 'zod'

const fieldSchema = z.object({
  label: z.string().min(1),
  type: z.enum(['TEXT', 'NUMBER', 'SELECT', 'MULTI_SELECT', 'DATE', 'BOOLEAN', 'URL']),
  entity: z.enum(['lead', 'deal']).default('lead'),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  required: z.boolean().default(false),
  position: z.number().int().default(0),
})

function toName(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export default async function customFieldsRoutes(app: FastifyInstance) {
  // List all definitions
  app.get('/settings/custom-fields', async (req, reply) => {
    await req.jwtVerify()
    const entity = (req.query as { entity?: string }).entity ?? 'lead'
    const fields = await prisma.customFieldDefinition.findMany({
      where: { entity, isActive: true },
      orderBy: { position: 'asc' },
    })
    return reply.send({ fields })
  })

  // Create definition
  app.post('/settings/custom-fields', async (req, reply) => {
    await req.jwtVerify()
    const user = req.user as { role: string }
    if (!['ADMIN', 'GESTOR'].includes(user.role)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const body = fieldSchema.parse(req.body)
    const name = toName(body.label)

    const field = await prisma.customFieldDefinition.create({
      data: {
        name,
        label: body.label,
        type: body.type as 'TEXT' | 'NUMBER' | 'SELECT' | 'MULTI_SELECT' | 'DATE' | 'BOOLEAN' | 'URL',
        entity: body.entity,
        options: body.options ?? undefined,
        required: body.required,
        position: body.position,
      },
    })
    return reply.status(201).send(field)
  })

  // Update definition
  app.patch('/settings/custom-fields/:id', async (req, reply) => {
    await req.jwtVerify()
    const user = req.user as { role: string }
    if (!['ADMIN', 'GESTOR'].includes(user.role)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const { id } = req.params as { id: string }
    const body = fieldSchema.partial().parse(req.body)

    const data: Record<string, unknown> = {}
    if (body.label !== undefined) {
      data.label = body.label
    }
    if (body.type !== undefined) data.type = body.type
    if (body.options !== undefined) data.options = body.options
    if (body.required !== undefined) data.required = body.required
    if (body.position !== undefined) data.position = body.position

    const field = await prisma.customFieldDefinition.update({ where: { id }, data })
    return reply.send(field)
  })

  // Reorder fields (bulk update positions)
  app.put('/settings/custom-fields/reorder', async (req, reply) => {
    await req.jwtVerify()
    const user = req.user as { role: string }
    if (!['ADMIN', 'GESTOR'].includes(user.role)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const { items } = z.object({
      items: z.array(z.object({ id: z.string(), position: z.number() })),
    }).parse(req.body)

    await Promise.all(
      items.map((item) =>
        prisma.customFieldDefinition.update({
          where: { id: item.id },
          data: { position: item.position },
        })
      )
    )
    return reply.send({ ok: true })
  })

  // Delete (soft delete)
  app.delete('/settings/custom-fields/:id', async (req, reply) => {
    await req.jwtVerify()
    const user = req.user as { role: string }
    if (!['ADMIN', 'GESTOR'].includes(user.role)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const { id } = req.params as { id: string }
    await prisma.customFieldDefinition.update({ where: { id }, data: { isActive: false } })
    return reply.send({ ok: true })
  })
}
