import { Worker } from 'bullmq'
import { env } from '../config/env'
import { prisma } from '../lib/prisma'
import { decryptIfNeeded } from '../lib/encryption'
import { generateWhatsappSuggestion } from '../modules/ai/ai.service'
import { AIAgentService } from '../modules/ai-agents/ai-agent.service'

const connection = { url: env.REDIS_URL }

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
              id: true, name: true, email: true, phone: true, whatsapp: true, notes: true,
              company: { select: { id: true, name: true } },
            },
          },
        },
      })

      if (!conversation) return

      // Verificar se IA está habilitada para esta conversa
      if (conversation.aiEnabled === false) {
        console.log(`[ai-suggestion] IA desabilitada para conversa ${conversationId}`)
        return
      }

      const tenantId = conversation.number?.tenantId
      if (!tenantId) return

      // Buscar API key do tenant
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { openaiApiKey: true },
      })
      const tenantApiKey = decryptIfNeeded(tenant?.openaiApiKey)

      if (!tenantApiKey && !env.OPENAI_API_KEY) {
        console.warn(`[ai-suggestion] Nenhuma OpenAI API key configurada para o tenant ${tenantId}`)
        return
      }

      // Determinar qual agente usar: conversa > pipeline > nenhum (método legado)
      let agentId: string | null = conversation.aiAgentId ?? null

      // Se não há agente na conversa, buscar oportunidade para pegar agente do pipeline
      if (!agentId && contactId) {
        const opportunity = await prisma.opportunity.findFirst({
          where: { contactId, tenantId, status: 'OPEN' },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, title: true, value: true, temperature: true, status: true, notes: true,
            pipeline: { select: { id: true, name: true, aiEnabled: true, aiAgentId: true } },
            stage: { select: { name: true } },
            assignedTo: { select: { name: true } },
          },
        })

        if (opportunity?.pipeline?.aiEnabled === false) {
          console.log(`[ai-suggestion] IA desabilitada no funil ${opportunity.pipeline.id}`)
          return
        }

        agentId = opportunity?.pipeline?.aiAgentId ?? null
      }

      const history = [...conversation.messages].reverse().map((m) => ({
        content: m.content ?? '',
        fromMe: m.fromMe,
        timestamp: m.timestamp.toISOString(),
      }))

      let suggestion: string

      if (agentId) {
        // Usar agente configurado com contexto rico
        const agent = await prisma.aIAgent.findUnique({
          where: { id: agentId, tenantId, isActive: true },
        })

        if (!agent) {
          console.warn(`[ai-suggestion] Agente ${agentId} não encontrado ou inativo`)
          agentId = null
        } else {
          // Montar contexto rico: contato + oportunidade + histórico
          const contact = conversation.contact
          const opportunity = contactId ? await prisma.opportunity.findFirst({
            where: { contactId, tenantId, status: 'OPEN' },
            orderBy: { createdAt: 'desc' },
            select: {
              title: true, value: true, temperature: true, notes: true,
              pipeline: { select: { name: true } },
              stage: { select: { name: true } },
              assignedTo: { select: { name: true } },
              activities: {
                orderBy: { createdAt: 'desc' }, take: 3,
                select: { type: true, description: true, createdAt: true },
              },
            },
          }) : null

          const contextParts: string[] = []

          if (contact) {
            contextParts.push(`=== CONTATO ===\nNome: ${contact.name}${contact.email ? `\nEmail: ${contact.email}` : ''}${contact.phone ? `\nTelefone: ${contact.phone}` : ''}${contact.company ? `\nEmpresa: ${contact.company.name}` : ''}${contact.notes ? `\nObservações: ${contact.notes}` : ''}`)
          }

          if (opportunity) {
            const temp = opportunity.temperature === 'HOT' ? '🔥 Quente' : opportunity.temperature === 'WARM' ? '🌤 Morno' : '❄️ Frio'
            contextParts.push(`=== OPORTUNIDADE ===\nTítulo: ${opportunity.title}\nFunil: ${opportunity.pipeline?.name ?? 'N/A'}\nEtapa: ${opportunity.stage?.name ?? 'N/A'}\nTemperatura: ${temp}${opportunity.value ? `\nValor: R$ ${Number(opportunity.value).toLocaleString('pt-BR')}` : ''}${opportunity.notes ? `\nNotas: ${opportunity.notes}` : ''}`)

            if (opportunity.activities.length > 0) {
              const acts = opportunity.activities.map((a) => `- [${a.type}] ${a.description ?? ''}`.trim()).join('\n')
              contextParts.push(`=== ATIVIDADES RECENTES ===\n${acts}`)
            }
          }

          const historyText = history.slice(-15).map((m) => `${m.fromMe ? 'Você' : 'Lead'}: ${m.content}`).join('\n')
          contextParts.push(`=== HISTÓRICO DA CONVERSA ===\n${historyText || 'Sem histórico anterior'}`)
          contextParts.push(`=== NOVA MENSAGEM RECEBIDA ===\n"${incomingMessage}"`)

          const richInput = contextParts.join('\n\n')

          const result = await AIAgentService.callAgent(
            { id: agent.id, systemPrompt: agent.systemPrompt, model: agent.model, tenantId },
            { input: richInput, conversationId },
          )
          suggestion = result.suggestionText
        }
      }

      // Fallback para método legado se não houver agente configurado
      if (!agentId) {
        let leadContext: string | null = null
        if (contactId) {
          const lead = await prisma.lead.findFirst({
            where: { contactId },
            select: { status: true, score: true, contact: { select: { name: true } } },
          })
          if (lead) {
            leadContext = `Nome: ${lead.contact?.name ?? 'N/A'}, Status: ${lead.status}, Score: ${lead.score}`
          }
        }
        suggestion = await generateWhatsappSuggestion(history, leadContext, incomingMessage, tenantApiKey)
      }

      // Salvar sugestão na última mensagem e emitir via socket
      const lastMessage = conversation.messages[0] // já em ordem desc
      if (lastMessage) {
        await prisma.whatsappMessage.update({
          where: { id: lastMessage.id },
          data: { aiSuggestion: suggestion! },
        })
      }

      io.to(`conversation:${conversationId}`).emit('ai:suggestion', {
        conversationId,
        suggestion: suggestion!,
      })
    },
    { connection }
  )

  return worker
}
