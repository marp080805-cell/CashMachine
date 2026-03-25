import { Worker } from 'bullmq'
import { env } from '../config/env'
import { prisma } from '../lib/prisma'
import { sendEmail } from '../lib/email'
import type { NotificationType } from '@prisma/client'

const connection = { url: env.REDIS_URL }

export function startNotificationWorker() {
  return new Worker(
    'notifications',
    async (job) => {
      const { userId, type, title, body, link, sendEmail: shouldSendEmail } = job.data as {
        userId: string
        type: NotificationType
        title: string
        body: string
        link?: string
        sendEmail?: boolean
      }

      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, tenantId: true } })

      await prisma.notification.create({
        data: { userId, type, title, body, link, tenantId: user?.tenantId ?? '' },
      })

      if (shouldSendEmail) {
        if (user) {
          await sendEmail({
            to: user.email,
            subject: title,
            html: `<p>Olá, ${user.name}!</p><p>${body}</p>${link ? `<p><a href="${env.NEXT_PUBLIC_APP_URL}${link}">Ver mais</a></p>` : ''}`,
          })
        }
      }
    },
    { connection }
  )
}
