import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'

const taskTypeEnum = z.enum([
  'FIRST_CONTACT', 'FOLLOW_UP', 'QUALIFY', 'SCHEDULE_MEETING',
  'CONFIRM_PRESENCE', 'PREPARE_BRIEFING', 'SEND_PROPOSAL', 'FOLLOW_UP_PROPOSAL',
  'CALL', 'MEETING', 'EMAIL', 'REMINDER', 'RESCUE_CONTACT', 'CUSTOM',
])

const createTemplateSchema = z.object({
  name: z.string().min(1),
  titleTemplate: z.string().min(1),
  descriptionTemplate: z.string().optional(),
  type: taskTypeEnum.default('FOLLOW_UP'),
  defaultPriority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  slaMinutes: z.number().int().optional(),
  dueOffsetMinutes: z.number().int().optional(),
  dueDateRelativeTo: z.string().optional(),
  assignedRole: z.string().optional(),
})

export default async function taskTemplatesRoutes(app: FastifyInstance) {
  // GET /task-templates — listar todos do tenant
  app.get('/task-templates', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const templates = await prisma.taskTemplate.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    })
    return reply.send(templates)
  })

  // POST /task-templates — criar (admin/manager recomendado)
  app.post('/task-templates', { preHandler: [app.authenticate] }, async (request, reply) => {
    const input = createTemplateSchema.parse(request.body)
    const { tenantId } = request.user as { tenantId: string }
    const template = await prisma.taskTemplate.create({ data: { ...input, tenantId } })
    return reply.status(201).send(template)
  })

  // PUT /task-templates/:id — atualizar
  app.put('/task-templates/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }
    const input = createTemplateSchema.partial().parse(request.body)
    await prisma.taskTemplate.findFirstOrThrow({ where: { id, tenantId } })
    const template = await prisma.taskTemplate.update({ where: { id }, data: input })
    return reply.send(template)
  })

  // DELETE /task-templates/:id — deletar
  app.delete('/task-templates/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }
    await prisma.taskTemplate.findFirstOrThrow({ where: { id, tenantId } })
    await prisma.taskTemplate.delete({ where: { id } })
    return reply.send({ success: true })
  })
}
