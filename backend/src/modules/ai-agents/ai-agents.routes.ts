import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { AIAgentService } from './ai-agent.service'

const agentTypeEnum = z.enum([
  'CONVERSATION_ASSISTANT',
  'RECORDING_ANALYZER',
  'LEAD_QUALIFIER',
  'CUSTOM',
])

const createAgentSchema = z.object({
  name: z.string().min(1),
  type: agentTypeEnum.default('CUSTOM'),
  model: z.string().default('gpt-4o'),
  systemPrompt: z.string().min(1),
  contextConfig: z.any().optional(),
  temperature: z.number().min(0).max(2).default(0.3),
  maxTokens: z.number().int().default(500),
  isActive: z.boolean().default(true),
})

export default async function aiAgentsRoutes(app: FastifyInstance) {
  // ─── AI Agents ────────────────────────────────────────────────────

  app.get('/ai-agents', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const { type } = request.query as { type?: string }

    // Garante que existe sempre o agente padrão "Assistente de Conversa"
    if (!type || type === 'CONVERSATION_ASSISTANT') {
      const hasConvAgent = await prisma.aIAgent.findFirst({
        where: { tenantId, name: 'Assistente de Conversa' },
        select: { id: true },
      })
      if (!hasConvAgent) {
        await prisma.aIAgent.create({
          data: {
            tenantId,
            name: 'Assistente de Conversa',
            type: 'CONVERSATION_ASSISTANT',
            model: 'gpt-4o-mini',
            systemPrompt: `Você é um assistente de vendas profissional e consultivo. Com base no contexto fornecido — informações do contato, oportunidade ativa, atividades recentes e histórico da conversa — sugira UMA resposta natural, direta e empática para a última mensagem recebida.\n\nRegras:\n- Máximo de 3 linhas\n- Tom humano, não robótico\n- Alinhado ao momento da venda e ao perfil do contato\n- Responda APENAS com o texto da mensagem, sem prefixos ou explicações`,
            temperature: 0.7,
            maxTokens: 300,
            isActive: true,
          },
        })
      }
    }

    const agents = await prisma.aIAgent.findMany({
      where: {
        tenantId,
        ...(type && { type: type as any }),
      },
      orderBy: { createdAt: 'asc' },
    })

    return reply.send(agents)
  })

  app.post('/ai-agents', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const input = createAgentSchema.parse(request.body)

    const agent = await prisma.aIAgent.create({
      data: { ...input, tenantId },
    })

    return reply.status(201).send(agent)
  })

  app.get('/ai-agents/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    const agent = await prisma.aIAgent.findFirstOrThrow({
      where: { id, tenantId },
      include: {
        suggestions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    return reply.send(agent)
  })

  app.put('/ai-agents/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }
    const input = createAgentSchema.partial().parse(request.body)

    await prisma.aIAgent.findFirstOrThrow({ where: { id, tenantId } })

    const agent = await prisma.aIAgent.update({
      where: { id },
      data: input,
    })

    return reply.send(agent)
  })

  app.delete('/ai-agents/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    await prisma.aIAgent.findFirstOrThrow({ where: { id, tenantId } })
    await prisma.aIAgent.delete({ where: { id } })

    return reply.send({ success: true })
  })

  app.post('/ai-agents/:id/test', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }
    const { input } = z.object({ input: z.string().min(1) }).parse(request.body)

    const agent = await prisma.aIAgent.findFirstOrThrow({ where: { id, tenantId } })

    const result = await AIAgentService.callAgent(
      { id: agent.id, systemPrompt: agent.systemPrompt, model: agent.model, tenantId },
      { input }
    )

    return reply.send(result)
  })

  // ─── AI Suggestions ───────────────────────────────────────────────

  app.get('/ai-suggestions', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const {
      conversationId,
      opportunityId,
      agentId,
      action,
      page = '1',
      limit = '50',
    } = request.query as any

    // Verificar que o agentId pertence ao tenant (segurança)
    const agentWhere = agentId
      ? { agent: { tenantId } }
      : { agent: { tenantId } }

    const where: any = {
      ...agentWhere,
      ...(conversationId && { conversationId }),
      ...(opportunityId && { opportunityId }),
      ...(agentId && { agentId }),
      ...(action && { action }),
    }

    const [suggestions, total] = await Promise.all([
      prisma.aISuggestion.findMany({
        where,
        include: {
          agent: { select: { id: true, name: true, type: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.aISuggestion.count({ where }),
    ])

    return reply.send({ suggestions, total, page: Number(page), limit: Number(limit) })
  })
}
