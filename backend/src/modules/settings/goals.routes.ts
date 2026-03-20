import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { z } from 'zod'

const goalSchema = z.object({
  name: z.string().min(1),
  metric: z.string().min(1),
  target: z.number().positive(),
  period: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL']).default('MONTHLY'),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int(),
  channelId: z.string().optional(),
})

export default async function goalsRoutes(app: FastifyInstance) {
  // List goals
  app.get('/settings/goals', async (req, reply) => {
    await req.jwtVerify()
    const { year, month } = req.query as { year?: string; month?: string }

    const where: Record<string, unknown> = {}
    if (year) where.year = Number(year)
    if (month) where.month = Number(month)

    const goals = await prisma.goal.findMany({
      where,
      include: { channel: { select: { id: true, name: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'asc' }],
    })
    return reply.send({ goals })
  })

  // Create goal
  app.post('/settings/goals', async (req, reply) => {
    await req.jwtVerify()
    const user = req.user as { id: string; role: string }
    if (!['ADMIN', 'GESTOR'].includes(user.role)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const body = goalSchema.parse(req.body)

    const goal = await prisma.goal.create({
      data: {
        name: body.name,
        metric: body.metric,
        target: body.target,
        period: body.period as 'MONTHLY' | 'QUARTERLY' | 'ANNUAL',
        month: body.month,
        year: body.year,
        channelId: body.channelId,
        createdById: user.id,
      },
      include: { channel: { select: { id: true, name: true } } },
    })
    return reply.status(201).send(goal)
  })

  // Update goal
  app.patch('/settings/goals/:id', async (req, reply) => {
    await req.jwtVerify()
    const user = req.user as { role: string }
    if (!['ADMIN', 'GESTOR'].includes(user.role)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const { id } = req.params as { id: string }
    const body = goalSchema.partial().parse(req.body)

    const goal = await prisma.goal.update({
      where: { id },
      data: body as Record<string, unknown>,
      include: { channel: { select: { id: true, name: true } } },
    })
    return reply.send(goal)
  })

  // Delete goal
  app.delete('/settings/goals/:id', async (req, reply) => {
    await req.jwtVerify()
    const user = req.user as { role: string }
    if (!['ADMIN', 'GESTOR'].includes(user.role)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const { id } = req.params as { id: string }
    await prisma.goal.delete({ where: { id } })
    return reply.send({ ok: true })
  })
}
