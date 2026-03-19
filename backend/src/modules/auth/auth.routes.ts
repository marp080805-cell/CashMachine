import type { FastifyInstance } from 'fastify'
import {
  loginSchema,
  refreshSchema,
  inviteSchema,
  acceptInviteSchema,
} from './auth.schema'
import {
  loginUser,
  refreshAccessToken,
  logoutUser,
  inviteUser,
  acceptInvite,
  getMe,
} from './auth.service'
import { requirePermission } from '../../middleware/rbac'
import type { UserRole } from '@prisma/client'

export default async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (request, reply) => {
    const input = loginSchema.parse(request.body)
    const result = await loginUser(app, input)
    return reply.send(result)
  })

  app.post('/auth/refresh', async (request, reply) => {
    const input = refreshSchema.parse(request.body)
    const result = await refreshAccessToken(app, input.refreshToken)
    return reply.send(result)
  })

  app.post('/auth/logout', async (request, reply) => {
    const input = refreshSchema.parse(request.body)
    await logoutUser(input.refreshToken)
    return reply.send({ success: true })
  })

  app.post(
    '/auth/invite',
    { preHandler: [app.authenticate, requirePermission('*')] },
    async (request, reply) => {
      const input = inviteSchema.parse(request.body)
      const user = request.user as { id: string; role: UserRole }
      await inviteUser(input, user.id)
      return reply.status(201).send({ success: true })
    }
  )

  app.post('/auth/accept-invite', async (request, reply) => {
    const input = acceptInviteSchema.parse(request.body)
    await acceptInvite(input)
    return reply.status(201).send({ success: true })
  })

  app.get(
    '/auth/me',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = request.user as { id: string }
      const data = await getMe(user.id)
      return reply.send(data)
    }
  )
}
