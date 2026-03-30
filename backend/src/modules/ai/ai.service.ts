import OpenAI from 'openai'
import { env } from '../../config/env'

const WHATSAPP_SUGGESTION_PROMPT = `Você é um SDR profissional e consultivo. Analise o histórico da conversa e a última mensagem recebida e sugira UMA resposta natural, direta e sem parecer robótico. A resposta deve ter no máximo 3 linhas. Contexto do lead: {lead_context}. Histórico: {history}. Última mensagem: {message}. Responda apenas com o texto da mensagem, sem explicações.`

function getOpenAI(apiKey?: string | null) {
  return new OpenAI({ apiKey: apiKey || env.OPENAI_API_KEY || 'no-key' })
}

const CALL_ANALYSIS_PROMPT = `Analise a transcrição desta reunião de vendas e retorne um JSON com: pontos_positivos (array de strings), objecoes (array de strings), oportunidades_perdidas (array de strings), proximo_passo (string), score (number 0-10), justificativa_score (string). Seja específico com exemplos da conversa.`

export interface CallAnalysis {
  pontos_positivos: string[]
  objecoes: string[]
  oportunidades_perdidas: string[]
  proximo_passo: string
  score: number
  justificativa_score: string
}

export interface MessageContext {
  content: string
  fromMe: boolean
  timestamp: string
}

export async function generateWhatsappSuggestion(
  conversationHistory: MessageContext[],
  leadContext: string | null,
  incomingMessage: string,
  apiKey?: string | null,
): Promise<string> {
  const historyText = conversationHistory
    .slice(-10)
    .map((m) => `${m.fromMe ? 'Você' : 'Lead'}: ${m.content}`)
    .join('\n')

  const prompt = WHATSAPP_SUGGESTION_PROMPT
    .replace('{lead_context}', leadContext ?? 'Sem informações do lead')
    .replace('{history}', historyText || 'Sem histórico anterior')
    .replace('{message}', incomingMessage)

  const openai = getOpenAI(apiKey)
  const response = await openai.chat.completions.create({
    model: env.OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 200,
    temperature: 0.7,
  })

  return response.choices[0]?.message?.content?.trim() ?? ''
}

export async function analyzeCallTranscription(
  transcript: string,
  dealContext: string | null,
  apiKey?: string | null,
): Promise<CallAnalysis> {
  const prompt = `${CALL_ANALYSIS_PROMPT}\n\n${dealContext ? `Contexto do deal: ${dealContext}\n\n` : ''}Transcrição:\n${transcript}`

  const openai = getOpenAI(apiKey)
  const response = await openai.chat.completions.create({
    model: env.OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1000,
    temperature: 0.3,
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0]?.message?.content ?? '{}'
  return JSON.parse(content) as CallAnalysis
}
