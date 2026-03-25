import { z } from 'zod'

export const createLeadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  position: z.string().optional(),
  companyId: z.string().min(1).optional(),
  channelId: z.string().min(1).optional(),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CUSTOMER', 'LOST']).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  customFields: z.record(z.unknown()).optional(),
})

export const updateLeadSchema = createLeadSchema.partial()

export const listLeadsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  channelId: z.string().min(1).optional(),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CUSTOMER', 'LOST']).optional(),
  createdById: z.string().min(1).optional(),
})

export type CreateLeadInput = z.infer<typeof createLeadSchema>
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>
export type ListLeadsQuery = z.infer<typeof listLeadsSchema>
