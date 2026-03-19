import bcrypt from 'bcryptjs'
import { prisma } from '../../lib/prisma'
import { redis } from '../../lib/redis'
import { sendEmail } from '../../lib/email'
import { env } from '../../config/env'
import type { LoginInput, InviteInput, AcceptInviteInput } from './auth.schema'
import type { FastifyInstance } from 'fastify'
import { PERMISSIONS } from '../../middleware/rbac'
import type { UserRole } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'

const REFRESH_TOKEN_PREFIX = 'refresh:'
const INVITE_TOKEN_PREFIX = 'invite:'

function getRefreshExpirySecs(expiresIn: string): number {
  const match = expiresIn.match(/(\d+)([dhms])/)
  if (!match) return 604800
  const value = parseInt(match[1] ?? '7', 10)
  const unit = match[2]
  const multipliers: Record<string, number> = { d: 86400, h: 3600, m: 60, s: 1 }
  return value * (multipliers[unit ?? 'd'] ?? 86400)
}

export async function loginUser(
  app: FastifyInstance,
  input: LoginInput
): Promise<{ accessToken: string; refreshToken: string; user: object }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } })

  if (!user || !user.isActive) {
    throw new Error('Invalid credentials')
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash)
  if (!valid) {
    throw new Error('Invalid credentials')
  }

  const payload = { id: user.id, email: user.email, role: user.role }
  const accessToken = app.jwt.sign(payload)

  const refreshToken = uuidv4()
  const expirySecs = getRefreshExpirySecs(env.JWT_REFRESH_EXPIRES_IN)
  await redis.setex(`${REFRESH_TOKEN_PREFIX}${refreshToken}`, expirySecs, user.id)

  const permissions = PERMISSIONS[user.role as UserRole] ?? []

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      permissions,
    },
  }
}

export async function refreshAccessToken(
  app: FastifyInstance,
  refreshToken: string
): Promise<{ accessToken: string }> {
  const userId = await redis.get(`${REFRESH_TOKEN_PREFIX}${refreshToken}`)
  if (!userId) {
    throw new Error('Invalid or expired refresh token')
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || !user.isActive) {
    throw new Error('User not found or inactive')
  }

  const payload = { id: user.id, email: user.email, role: user.role }
  const accessToken = app.jwt.sign(payload)

  return { accessToken }
}

export async function logoutUser(refreshToken: string): Promise<void> {
  await redis.del(`${REFRESH_TOKEN_PREFIX}${refreshToken}`)
}

export async function inviteUser(input: InviteInput, invitedById: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } })
  if (existing) {
    throw new Error('Email already registered')
  }

  const inviteToken = uuidv4()
  await redis.setex(`${INVITE_TOKEN_PREFIX}${inviteToken}`, 86400 * 7, JSON.stringify({
    email: input.email,
    name: input.name,
    role: input.role,
    invitedById,
  }))

  const inviteUrl = `${env.NEXT_PUBLIC_APP_URL}/aceitar-convite?token=${inviteToken}`

  await sendEmail({
    to: input.email,
    subject: 'Você foi convidado para o CashMachine',
    html: `
      <h2>Olá, ${input.name}!</h2>
      <p>Você foi convidado para acessar o CashMachine como <strong>${input.role}</strong>.</p>
      <p><a href="${inviteUrl}">Clique aqui para aceitar o convite</a></p>
      <p>Este link expira em 7 dias.</p>
    `,
  })
}

export async function acceptInvite(input: AcceptInviteInput): Promise<void> {
  const data = await redis.get(`${INVITE_TOKEN_PREFIX}${input.token}`)
  if (!data) {
    throw new Error('Invalid or expired invite token')
  }

  const { email, name, role } = JSON.parse(data) as { email: string; name: string; role: UserRole; invitedById: string }

  const passwordHash = await bcrypt.hash(input.password, 12)

  await prisma.user.create({
    data: {
      email,
      name,
      role,
      passwordHash,
      isActive: true,
    },
  })

  await redis.del(`${INVITE_TOKEN_PREFIX}${input.token}`)
}

export async function getMe(userId: string): Promise<object> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      avatarUrl: true,
      isActive: true,
      teamId: true,
    },
  })

  const permissions = PERMISSIONS[user.role as UserRole] ?? []

  return { ...user, permissions }
}
