import OpenAI from 'openai'
import { prisma } from '../../lib/prisma'
import { decryptIfNeeded } from '../../lib/encryption'

export class AIAgentService {
  static async callAgent(
    agent: {
      id: string
      systemPrompt: string
      model: string
      tenantId: string
    },
    context: {
      input: string
      opportunityId?: string
      conversationId?: string
    }
  ): Promise<{ suggestionText: string; suggestionId: string }> {
    const startTime = Date.now()

    // Buscar tenant para pegar openaiApiKey
    const tenant = await prisma.tenant.findUnique({
      where: { id: agent.tenantId },
      select: { openaiApiKey: true, openaiModel: true },
    })

    // Descriptografar chave se necessário, ou usar env fallback
    const rawKey = tenant?.openaiApiKey
      ? decryptIfNeeded(tenant.openaiApiKey)
      : process.env['OPENAI_API_KEY'] ?? null

    if (!rawKey) {
      throw new Error('No OpenAI API key configured for this tenant')
    }

    const model = agent.model || tenant?.openaiModel || 'gpt-4o'

    const openai = new OpenAI({ apiKey: rawKey })

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: agent.systemPrompt },
        { role: 'user', content: context.input },
      ],
      max_tokens: 500,
      temperature: 0.3,
    })

    const suggestionText = response.choices[0]?.message?.content?.trim() ?? ''
    const tokensUsed = response.usage?.total_tokens ?? null
    const responseTimeMs = Date.now() - startTime

    // Salvar AISuggestion no banco
    const suggestion = await prisma.aISuggestion.create({
      data: {
        agentId: agent.id,
        conversationId: context.conversationId ?? null,
        opportunityId: context.opportunityId ?? null,
        inputContext: { input: context.input },
        suggestionText,
        action: 'PENDING',
        responseTimeMs,
        tokensUsed,
      },
    })

    return { suggestionText, suggestionId: suggestion.id }
  }
}
