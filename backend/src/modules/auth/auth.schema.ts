import { z } from 'zod'

export const loginSchema = z.object({
  tenantSlug: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

export const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'MANAGER', 'SDR', 'CLOSER', 'VIEWER']),
})

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
})

export type LoginInput = z.infer<typeof loginSchema>
export type InviteInput = z.infer<typeof inviteSchema>
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>
