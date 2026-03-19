import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export const refreshSchema = z.object({
  refreshToken: z.string(),
})

export const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: z.enum(['ADMIN', 'GESTOR', 'SDR', 'CLOSER']),
})

export const acceptInviteSchema = z.object({
  token: z.string(),
  password: z.string().min(6),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RefreshInput = z.infer<typeof refreshSchema>
export type InviteInput = z.infer<typeof inviteSchema>
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>
