import { env } from '../../config/env'

interface EvolutionInstance {
  instanceName: string
  status: string
}

interface QRCodeResponse {
  qrcode: { base64: string; code: string }
}

interface SendMessageResponse {
  key: { id: string }
}

export type EvolutionWebhookPayload = {
  event: string
  instance: string
  data: {
    key: {
      remoteJid: string
      fromMe: boolean
      id: string
    }
    pushName?: string
    message?: {
      conversation?: string
      imageMessage?: { caption?: string; url?: string }
      audioMessage?: { url?: string; seconds?: number }
      videoMessage?: { caption?: string; url?: string }
      documentMessage?: { title?: string; url?: string }
      stickerMessage?: object
      locationMessage?: { degreesLatitude?: number; degreesLongitude?: number }
    }
    messageType: string
    messageTimestamp: number
    status?: string
  }
}

export interface EvolutionCredentials {
  baseUrl?: string
  apiKey?: string
}

async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  creds?: EvolutionCredentials
): Promise<T> {
  const baseUrl = creds?.baseUrl ?? env.EVOLUTION_API_URL
  const apiKey = creds?.apiKey ?? env.EVOLUTION_API_KEY

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await response.text()

  if (!response.ok) {
    throw new Error(`Evolution API error ${response.status}: ${text}`)
  }

  if (!text) return null as T
  try {
    return JSON.parse(text) as T
  } catch {
    return null as T
  }
}

export async function createInstance(instanceName: string, creds?: EvolutionCredentials): Promise<EvolutionInstance> {
  return apiRequest<EvolutionInstance>('POST', '/instance/create', {
    instanceName,
    qrcode: true,
    integration: 'WHATSAPP-BAILEYS',
  }, creds)
}

export async function getQRCode(instanceName: string, creds?: EvolutionCredentials): Promise<{ qrcode: string }> {
  const data = await apiRequest<QRCodeResponse>('GET', `/instance/connect/${instanceName}`, undefined, creds)
  return { qrcode: data.qrcode.base64 }
}

export async function getInstanceStatus(instanceName: string, creds?: EvolutionCredentials): Promise<string> {
  // Evolution API v2 returns an array; v1 returns an object
  const data = await apiRequest<{ instance: { state: string } } | Array<{ instance: { state: string } }>>('GET', `/instance/fetchInstances/${instanceName}`, undefined, creds)
  if (Array.isArray(data)) return data[0]?.instance?.state ?? 'unknown'
  return data?.instance?.state ?? 'unknown'
}

export async function getConnectionState(instanceName: string, creds?: EvolutionCredentials): Promise<string> {
  try {
    const data = await apiRequest<{ instance: { state: string } }>('GET', `/instance/connectionState/${instanceName}`, undefined, creds)
    return data.instance?.state ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

export async function setWebhook(instanceName: string, webhookUrl: string, creds?: EvolutionCredentials): Promise<void> {
  const body = {
    enabled: true,
    url: webhookUrl,
    webhookByEvents: false,
    webhookBase64: false,
    events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'],
  }
  try {
    // Try Evolution API v2 format first (flat body, no outer wrapper)
    await apiRequest('POST', `/webhook/set/${instanceName}`, body, creds)
  } catch (errV2) {
    // Fall back to v1 format (wrapped in "webhook" key)
    try {
      await apiRequest('POST', `/webhook/set/${instanceName}`, { webhook: body }, creds)
    } catch (errV1) {
      // Re-throw the original v2 error so the caller sees it
      throw errV2
    }
  }
}

export async function deleteInstance(instanceName: string, creds?: EvolutionCredentials): Promise<void> {
  await apiRequest('DELETE', `/instance/delete/${instanceName}`, undefined, creds)
}

export async function sendTextMessage(
  instanceName: string,
  to: string,
  text: string,
  creds?: EvolutionCredentials
): Promise<string> {
  const data = await apiRequest<SendMessageResponse>('POST', `/message/sendText/${instanceName}`, {
    number: to,
    text,
  }, creds)
  return data.key.id
}

export async function sendMedia(
  instanceName: string,
  to: string,
  mediaUrl: string,
  caption?: string,
  creds?: EvolutionCredentials
): Promise<string> {
  const data = await apiRequest<SendMessageResponse>('POST', `/message/sendMedia/${instanceName}`, {
    number: to,
    mediatype: 'image',
    media: mediaUrl,
    caption,
  }, creds)
  return data.key.id
}

export function parseWebhookMessage(payload: EvolutionWebhookPayload): {
  remoteJid: string
  fromMe: boolean
  messageId: string
  content: string | null
  type: string
  mediaUrl: string | null
  timestamp: Date
  remoteName: string | null
} {
  const { key, message, messageTimestamp, pushName } = payload.data

  let content: string | null = null
  let mediaUrl: string | null = null
  let type = 'TEXT'

  if (message?.conversation) {
    content = message.conversation
    type = 'TEXT'
  } else if (message?.imageMessage) {
    content = message.imageMessage.caption ?? null
    mediaUrl = message.imageMessage.url ?? null
    type = 'IMAGE'
  } else if (message?.audioMessage) {
    mediaUrl = message.audioMessage.url ?? null
    type = 'AUDIO'
  } else if (message?.videoMessage) {
    content = message.videoMessage.caption ?? null
    mediaUrl = message.videoMessage.url ?? null
    type = 'VIDEO'
  } else if (message?.documentMessage) {
    content = message.documentMessage.title ?? null
    mediaUrl = message.documentMessage.url ?? null
    type = 'DOCUMENT'
  } else if (message?.stickerMessage) {
    type = 'STICKER'
  } else if (message?.locationMessage) {
    type = 'LOCATION'
  }

  return {
    remoteJid: key.remoteJid,
    fromMe: key.fromMe,
    messageId: key.id,
    content,
    type,
    mediaUrl,
    timestamp: new Date(messageTimestamp * 1000),
    remoteName: pushName ?? null,
  }
}
