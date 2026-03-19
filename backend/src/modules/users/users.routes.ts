import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { requirePermission } from '../../middleware/rbac'
import bcrypt from 'bcryptjs'
import type { UserRole } from '@prisma/client'

export default async function usersRoutes(app: FastifyInstance) {
  app.get(
    '/users',
    { preHandler: [app.authenticate, requirePermission('*')] },
    async (request, reply) => {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatarUrl: true,
          isActive: true,
          teamId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { name: 'asc' },
      })
      return reply.send(users)
    }
  )

  app.get(
    '/users/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const user = await prisma.user.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatarUrl: true,
          isActive: true,
          teamId: true,
          createdAt: true,
        },
      })
      return reply.send(user)
    }
  )

  app.patch(
    '/users/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const currentUser = request.user as { id: string; role: UserRole }

      const bodySchema = z.object({
        name: z.string().min(2).optional(),
        avatarUrl: z.string().url().optional(),
        role: z.enum(['ADMIN', 'GESTOR', 'SDR', 'CLOSER']).optional(),
        isActive: z.boolean().optional(),
        teamId: z.string().uuid().nullable().optional(),
        password: z.string().min(6).optional(),
      })

      const body = bodySchema.parse(request.body)

      if (body.role !== undefined && currentUser.role !== 'ADMIN') {
        return reply.status(403).send({ error: 'Only admins can change roles' })
      }

      if (currentUser.id !== id && currentUser.role !== 'ADMIN') {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const updateData: Record<string, unknown> = {}
      if (body.name !== undefined) updateData['name'] = body.name
      if (body.avatarUrl !== undefined) updateData['avatarUrl'] = body.avatarUrl
      if (body.role !== undefined) updateData['role'] = body.role
      if (body.isActive !== undefined) updateData['isActive'] = body.isActive
      if (body.teamId !== undefined) updateData['teamId'] = body.teamId
      if (body.password !== undefined) {
        updateData['passwordHash'] = await bcrypt.hash(body.password, 12)
      }

      const updated = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatarUrl: true,
          isActive: true,
        },
      })

      return reply.send(updated)
    }
  )
}
