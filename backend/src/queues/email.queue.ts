import { Worker } from 'bullmq'
import { env } from '../config/env'
import { sendEmail } from '../lib/email'

const connection = { url: env.REDIS_URL }

export function startEmailWorker() {
  return new Worker(
    'emails',
    async (job) => {
      const { to, subject, html } = job.data as {
        to: string | string[]
        subject: string
        html: string
      }

      await sendEmail({ to, subject, html })
    },
    { connection }
  )
}
