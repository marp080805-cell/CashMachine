import { Queue } from 'bullmq'
import { env } from '../config/env'

const connection = {
  url: env.REDIS_URL,
}

export const notificationQueue = new Queue('notifications', { connection })
export const aiSuggestionQueue = new Queue('ai-suggestions', { connection })
export const emailQueue = new Queue('emails', { connection })
export const transcriptionQueue = new Queue('transcriptions', { connection })
export const stageTriggerQueue = new Queue('stage-triggers', { connection })
export const botExecutionQueue = new Queue('bot-execution', { connection })
