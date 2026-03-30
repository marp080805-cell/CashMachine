import { Worker } from 'bullmq'
import { env } from '../config/env'
import { prisma } from '../lib/prisma'
import { decryptIfNeeded } from '../lib/encryption'
import { generateWhatsappSuggestion } from '../modules/ai/ai.service'

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
          messages: { orderBy: { timestamp: 'desc' }, take: 10 },
          number: { select: { tenantId: true } },
        },
      })

      if (!conversation) return

      // Busca a API key do tenant (salva via Integrações)
      let tenantApiKey: string | null = null
      if (conversation.number?.tenantId) {
        const tenant = await prisma.tenant.findUnique({
          where: { id: conversation.number.tenantId },
          select: { openaiApiKey: true },
        })
        tenantApiKey = decryptIfNeeded(tenant?.openaiApiKey)
      }

      // Sem nenhuma API key disponível, abandona o job silenciosamente
      if (!tenantApiKey && !env.OPENAI_API_KEY) {
        console.warn(`[ai-suggestion] Nenhuma OpenAI API key configurada para o tenant`)
        return
      }

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

      const history = conversation.messages.reverse().map((m) => ({
        content: m.content ?? '',
        fromMe: m.fromMe,
        timestamp: m.timestamp.toISOString(),
      }))

      const suggestion = await generateWhatsappSuggestion(history, leadContext, incomingMessage, tenantApiKey)

      const lastMessage = conversation.messages[conversation.messages.length - 1]
      if (lastMessage) {
        await prisma.whatsappMessage.update({
          where: { id: lastMessage.id },
          data: { aiSuggestion: suggestion },
        })
      }

      io.to(`conversation:${conversationId}`).emit('ai:suggestion', {
        conversationId,
        suggestion,
      })
    },
    { connection }
  )

  return worker
}
