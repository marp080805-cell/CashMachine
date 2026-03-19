import { Resend } from 'resend'
import { env } from '../config/env'

export const resend = new Resend(env.RESEND_API_KEY)

export async function sendEmail(options: {
  to: string | string[]
  subject: string
  html: string
}): Promise<void> {
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
  })
}
