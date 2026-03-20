import { prisma } from '../../lib/prisma'
import { Prisma } from '@prisma/client'
import type { CreateLeadInput, UpdateLeadInput, ListLeadsQuery } from './leads.schema'

export async function listLeads(query: ListLeadsQuery, userId: string, isAdmin: boolean) {
  const skip = (query.page - 1) * query.limit

  const where: Prisma.LeadWhereInput = {}

  if (query.search) {
    where['OR'] = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search, mode: 'insensitive' } },
    ]
  }

  if (query.channelId) where['channelId'] = query.channelId
  if (query.status) where['status'] = query.status
  if (query.createdById) where['createdById'] = query.createdById

  if (!isAdmin) {
    where['createdById'] = userId
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: { id: true, name: true } },
        channel: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    prisma.lead.count({ where }),
  ])

  return {
    leads,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    },
  }
}

export async function getLead(id: string) {
  return prisma.lead.findUniqueOrThrow({
    where: { id },
    include: {
      company: true,
      channel: true,
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
      deals: {
        include: {
          stage: true,
          funnel: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      activities: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      tasks: {
        where: { isCompleted: false },
        orderBy: { dueDate: 'asc' },
      },
    },
  })
}

export async function createLead(input: CreateLeadInput, createdById: string) {
  const { customFields, ...rest } = input
  const lead = await prisma.lead.create({
    data: {
      ...rest,
      tags: rest.tags ?? [],
      createdById,
      ...(customFields !== undefined ? { customFields: customFields as unknown as Prisma.InputJsonValue } : {}),
    },
    include: {
      company: { select: { id: true, name: true } },
      channel: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
    },
  })

  return lead
}

export async function updateLead(id: string, input: UpdateLeadInput) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return prisma.lead.update({
    where: { id },
    data: input as any,
    include: {
      company: { select: { id: true, name: true } },
      channel: { select: { id: true, name: true } },
    },
  })
}

export async function deleteLead(id: string) {
  await prisma.lead.delete({ where: { id } })
}

export async function importLeads(
  rows: CreateLeadInput[],
  createdById: string,
  onDuplicate: 'ignore' | 'update'
): Promise<{ created: number; skipped: number; updated: number }> {
  let created = 0
  let skipped = 0
  let updated = 0

  for (const row of rows) {
    if (!row.phone && !row.email) {
      skipped++
      continue
    }

    const existing = await prisma.lead.findFirst({
      where: {
        OR: [
          row.phone ? { phone: row.phone } : undefined,
          row.email ? { email: row.email } : undefined,
        ].filter(Boolean) as Prisma.LeadWhereInput[],
      },
    })

    if (existing) {
      if (onDuplicate === 'update') {
        await prisma.lead.update({ where: { id: existing.id }, data: row as any })
        updated++
      } else {
        skipped++
      }
    } else {
      const { customFields: cf, ...rowRest } = row
      await prisma.lead.create({
        data: {
          ...rowRest,
          tags: rowRest.tags ?? [],
          createdById,
          ...(cf !== undefined ? { customFields: cf as unknown as Prisma.InputJsonValue } : {}),
        },
      })
      created++
    }
  }

  return { created, skipped, updated }
}
