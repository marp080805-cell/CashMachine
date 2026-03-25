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
  // Buscar tenant pelo slug
  const tenant = await prisma.tenant.findUnique({ where: { slug: input.tenantSlug } })
  if (!tenant || !tenant.isActive) {
    throw new Error('Invalid credentials')
  }

  // Buscar usuário dentro do tenant
  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: input.email, isActive: true },
  })

  if (!user) {
    throw new Error('Invalid credentials')
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash)
  if (!valid) {
    throw new Error('Invalid credentials')
  }

  // Atualizar lastLoginAt
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  const payload = { id: user.id, email: user.email, role: user.role, tenantId: tenant.id }
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
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
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

  const payload = { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId }
  const accessToken = app.jwt.sign(payload)

  return { accessToken }
}

export async function logoutUser(refreshToken: string): Promise<void> {
  await redis.del(`${REFRESH_TOKEN_PREFIX}${refreshToken}`)
}

export async function inviteUser(input: InviteInput, invitedById: string, tenantId: string): Promise<void> {
  const existing = await prisma.user.findFirst({ where: { email: input.email, tenantId } })
  if (existing) {
    throw new Error('Email already registered')
  }

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })

  const inviteToken = uuidv4()
  await redis.setex(`${INVITE_TOKEN_PREFIX}${inviteToken}`, 86400 * 7, JSON.stringify({
    email: input.email,
    name: input.name,
    role: input.role,
    tenantId,
    tenantSlug: tenant.slug,
    invitedById,
  }))

  const inviteUrl = `${env.NEXT_PUBLIC_APP_URL}/aceitar-convite?token=${inviteToken}`

  await sendEmail({
    to: input.email,
    subject: `Convite para ${tenant.name}`,
    html: `
      <h2>Olá, ${input.name}!</h2>
      <p>Você foi convidado para acessar o <strong>${tenant.name}</strong> como <strong>${input.role}</strong>.</p>
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

  const { email, name, role, tenantId } = JSON.parse(data) as {
    email: string; name: string; role: UserRole; tenantId: string; invitedById: string
  }

  const passwordHash = await bcrypt.hash(input.password, 12)

  await prisma.user.create({
    data: { email, name, role, passwordHash, isActive: true, tenantId },
  })

  await redis.del(`${INVITE_TOKEN_PREFIX}${input.token}`)
}

export async function getMe(userId: string): Promise<object> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true, email: true, name: true, role: true,
      avatarUrl: true, isActive: true, tenantId: true,
      tenant: { select: { id: true, name: true, slug: true, plan: true } },
    },
  })

  const permissions = PERMISSIONS[user.role as UserRole] ?? []

  return { ...user, permissions }
}
