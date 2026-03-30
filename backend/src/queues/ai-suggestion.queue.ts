import { Worker } from 'bullmq'
import { env } from '../config/env'
import { prisma } from '../lib/prisma'
import { decryptIfNeeded } from '../lib/encryption'
import { AIAgentService } from '../modules/ai-agents/ai-agent.service'

const connection = { url: env.REDIS_URL }

const DEFAULT_AGENT_PROMPT = `Você é um assistente de vendas profissional e consultivo. Com base no contexto fornecido — informações do contato, oportunidade ativa, atividades recentes e histórico da conversa — sugira UMA resposta natural, direta e empática para a última mensagem recebida.

Regras:
- Máximo de 3 linhas
- Tom humano, não robótico
- Alinhado ao momento da venda e ao perfil do contato
- Responda APENAS com o texto da mensagem, sem prefixos ou explicações`

async function getOrCreateDefaultAgent(tenantId: string) {
  // Prioridade: agente CONVERSATION_ASSISTANT ativo mais antigo
  let agent = await prisma.aIAgent.findFirst({
    where: { tenantId, type: 'CONVERSATION_ASSISTANT', isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!agent) {
    agent = await prisma.aIAgent.create({
      data: {
        tenantId,
        name: 'Assistente de Conversa',
        type: 'CONVERSATION_ASSISTANT',
        model: 'gpt-4o-mini',
        systemPrompt: DEFAULT_AGENT_PROMPT,
        temperature: 0.7,
        maxTokens: 300,
        isActive: true,
      },
    })
    console.log(`[ai-suggestion] Agente padrão criado para tenant ${tenantId}: ${agent.id}`)
  }

  return agent
}

async function buildRichContext(params: {
  contact: { id: string; name: string; email: string | null; phone: string | null; notes: string | null; company: { name: string } | null } | null
  contactId: string | undefined
  tenantId: string
  history: { content: string; fromMe: boolean }[]
  incomingMessage: string
}): Promise<string> {
  const { contact, contactId, tenantId, history, incomingMessage } = params
  const parts: string[] = []

  if (contact) {
    let contactSection = `=== CONTATO ===\nNome: ${contact.name}`
    if (contact.email) contactSection += `\nEmail: ${contact.email}`
    if (contact.phone) contactSection += `\nTelefone: ${contact.phone}`
    if (contact.company) contactSection += `\nEmpresa: ${contact.company.name}`
    if (contact.notes) contactSection += `\nObservações: ${contact.notes}`
    parts.push(contactSection)
  }

  if (contactId) {
    const opp = await prisma.opportunity.findFirst({
      where: { contactId, tenantId, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      select: {
        title: true, value: true, temperature: true, notes: true,
        pipeline: { select: { name: true } },
        stage: { select: { name: true } },
        assignedTo: { select: { name: true } },
        tags: { select: { tag: { select: { name: true } } } },
        activities: {
          orderBy: { createdAt: 'desc' }, take: 5,
          select: { type: true, description: true, createdAt: true },
        },
      },
    })

    if (opp) {
      const tempLabel = opp.temperature === 'HOT' ? 'Quente' : opp.temperature === 'WARM' ? 'Morno' : opp.temperature ? 'Frio' : 'N/A'
      let oppSection = `=== OPORTUNIDADE ATIVA ===\nTítulo: ${opp.title}\nFunil: ${opp.pipeline?.name ?? 'N/A'}\nEtapa: ${opp.stage?.name ?? 'N/A'}\nTemperatura: ${tempLabel}`
      if (opp.value) oppSection += `\nValor: R$ ${Number(opp.value).toLocaleString('pt-BR')}`
      if (opp.assignedTo) oppSection += `\nResponsável: ${opp.assignedTo.name}`
      if (opp.tags?.length) oppSection += `\nTags: ${opp.tags.map((t) => t.tag.name).join(', ')}`
      if (opp.notes) oppSection += `\nNotas: ${opp.notes}`
      parts.push(oppSection)

      if (opp.activities.length > 0) {
        const acts = opp.activities
          .map((a) => `- [${a.type}] ${a.description ?? ''}`.trimEnd())
          .join('\n')
        parts.push(`=== ATIVIDADES RECENTES ===\n${acts}`)
      }
    }
  }

  const historyText = history
    .slice(-15)
    .map((m) => `${m.fromMe ? 'Você' : 'Lead'}: ${m.content}`)
    .join('\n')
  parts.push(`=== HISTÓRICO DA CONVERSA ===\n${historyText || 'Sem histórico anterior'}`)
  parts.push(`=== NOVA MENSAGEM RECEBIDA ===\n"${incomingMessage}"`)

  return parts.join('\n\n')
}

export function startAiSuggestionWorker(io: { to: (room: string) => { emit: (event: string, data: unknown) => void } }) {
  const worker = new Worker(
    'ai-suggestions',
    async (job) => {
      const { conversationId, incomingMessage, contactId } = job.data as {
        conversationId: string
        incomingMessage: string
        contactId?: string
      }

      const conversation = await prisma.whatsappConversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: { orderBy: { timestamp: 'desc' }, take: 20 },
          number: { select: { tenantId: true } },
          contact: {
            select: {
              id: true, name: true, email: true, phone: true, notes: true,
              company: { select: { name: true } },
            },
          },
        },
      })

      if (!conversation) return

      // IA desabilitada nesta conversa?
      if (conversation.aiEnabled === false) return

      const tenantId = conversation.number?.tenantId
      if (!tenantId) return

      // Verificar que há API key configurada
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { openaiApiKey: true },
      })
      const tenantApiKey = decryptIfNeeded(tenant?.openaiApiKey)
      if (!tenantApiKey && !env.OPENAI_API_KEY) {
        console.warn(`[ai-suggestion] Nenhuma OpenAI API key configurada para o tenant ${tenantId}`)
        return
      }

      // Hierarquia de agente: conversa > pipeline > qualquer CONVERSATION_ASSISTANT > auto-criar
      let agentId: string | null = conversation.aiAgentId ?? null

      if (!agentId && contactId) {
        const opp = await prisma.opportunity.findFirst({
          where: { contactId, tenantId, status: 'OPEN' },
          orderBy: { createdAt: 'desc' },
          select: { pipeline: { select: { aiEnabled: true, aiAgentId: true } } },
        })

        if (opp?.pipeline?.aiEnabled === false) {
          console.log(`[ai-suggestion] IA desabilitada no funil`)
          return
        }

        agentId = opp?.pipeline?.aiAgentId ?? null
      }

      // Se ainda sem agente: usar o padrão CONVERSATION_ASSISTANT (ou criar)
      let agent
      if (agentId) {
        agent = await prisma.aIAgent.findUnique({
          where: { id: agentId, tenantId, isActive: true },
        })
        if (!agent) agentId = null
      }

      if (!agent) {
        agent = await getOrCreateDefaultAgent(tenantId)
      }

      // Construir histórico e contexto rico
      const history = [...conversation.messages].reverse().map((m) => ({
        content: m.content ?? '',
        fromMe: m.fromMe,
      }))

      const richInput = await buildRichContext({
        contact: conversation.contact,
        contactId,
        tenantId,
        history,
        incomingMessage,
      })

      // Chamar agente
      const result = await AIAgentService.callAgent(
        {
          id: agent.id,
          systemPrompt: agent.systemPrompt,
          model: agent.model,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
          tenantId,
        },
        { input: richInput, conversationId },
      )

      // Salvar na mensagem e emitir via socket
      const lastMessage = conversation.messages[0]
      if (lastMessage) {
        await prisma.whatsappMessage.update({
          where: { id: lastMessage.id },
          data: { aiSuggestion: result.suggestionText },
        })
      }

      io.to(`conversation:${conversationId}`).emit('ai:suggestion', {
        conversationId,
        suggestion: result.suggestionText,
      })
    },
    { connection }
  )

  return worker
}
