import { PrismaClient, UserRole, StageType, CustomFieldType, TaskType, TaskPriority, Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // ─── TENANT + ADMIN ──────────────────────────────────────────────
  const adminPasswordHash = await bcrypt.hash('Admin@123', 10)
  const managerPasswordHash = await bcrypt.hash('Manager@123', 10)
  const sdrPasswordHash = await bcrypt.hash('Sdr@123', 10)
  const closerPasswordHash = await bcrypt.hash('Closer@123', 10)

  // Sempre priorizar o tenant com slug 'seuresultado' (hardcoded no frontend)
  let tenant = await prisma.tenant.findUnique({ where: { slug: 'seuresultado' } })

  if (!tenant) {
    // Fallback: existe um tenant 'cashmind' mas ainda não tem o 'seuresultado'?
    const cashmindTenant = await prisma.tenant.findUnique({ where: { slug: 'cashmind' } })
    if (cashmindTenant) {
      tenant = await prisma.tenant.update({
        where: { id: cashmindTenant.id },
        data: { slug: 'seuresultado' },
      })
      console.log('Tenant slug migrado: cashmind → seuresultado')
    } else {
      tenant = await prisma.tenant.create({
        data: { name: 'CashMind', slug: 'seuresultado', plan: 'FREE', isActive: true },
      })
      console.log('Tenant criado:', tenant.slug)
    }
  } else {
    console.log('Tenant já existe:', tenant.slug)
  }

  const tenantId = tenant.id

  // ─── USUÁRIOS ─────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId, email: 'admin@cashmind.com' } },
    update: {},
    create: {
      tenantId,
      email: 'admin@cashmind.com',
      name: 'Admin CashMind',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  })

  const manager = await prisma.user.upsert({
    where: { tenantId_email: { tenantId, email: 'gestor@cashmind.com' } },
    update: {},
    create: {
      tenantId,
      email: 'gestor@cashmind.com',
      name: 'Carlos Gestor',
      passwordHash: managerPasswordHash,
      role: UserRole.MANAGER,
      isActive: true,
    },
  })

  const sdr1 = await prisma.user.upsert({
    where: { tenantId_email: { tenantId, email: 'sdr1@cashmind.com' } },
    update: {},
    create: {
      tenantId,
      email: 'sdr1@cashmind.com',
      name: 'Ana SDR',
      passwordHash: sdrPasswordHash,
      role: UserRole.SDR,
      isActive: true,
    },
  })

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId, email: 'sdr2@cashmind.com' } },
    update: {},
    create: {
      tenantId,
      email: 'sdr2@cashmind.com',
      name: 'Bruno SDR',
      passwordHash: sdrPasswordHash,
      role: UserRole.SDR,
      isActive: true,
    },
  })

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId, email: 'closer@cashmind.com' } },
    update: {},
    create: {
      tenantId,
      email: 'closer@cashmind.com',
      name: 'Diego Closer',
      passwordHash: closerPasswordHash,
      role: UserRole.CLOSER,
      isActive: true,
    },
  })

  console.log('Users created.')

  // ─── DEFAULT TAGS ─────────────────────────────────────────────────
  const tagsData = [
    { name: 'Hot Lead', color: '#EF4444', category: 'QUALIFICATION' as const },
    { name: 'Cold Lead', color: '#6B7280', category: 'QUALIFICATION' as const },
    { name: 'Warm Lead', color: '#F59E0B', category: 'QUALIFICATION' as const },
    { name: 'VIP', color: '#8B5CF6', category: 'STATUS' as const },
    { name: 'Indicação', color: '#10B981', category: 'CUSTOM' as const },
    { name: 'Inbound', color: '#3B82F6', category: 'CUSTOM' as const },
    { name: 'Reengajamento', color: '#EC4899', category: 'STATUS' as const },
    { name: 'Sem interesse', color: '#9CA3AF', category: 'STATUS' as const },
    { name: 'Em análise', color: '#F59E0B', category: 'STATUS' as const },
    { name: 'Proposta enviada', color: '#06B6D4', category: 'STATUS' as const },
    { name: 'Follow-up', color: '#84CC16', category: 'CUSTOM' as const },
    { name: 'Urgente', color: '#EF4444', category: 'CUSTOM' as const },
  ]

  for (const tag of tagsData) {
    await prisma.tag.upsert({
      where: { tenantId_name_entityType: { tenantId, name: tag.name, entityType: 'opportunity' } },
      update: {},
      create: {
        tenantId,
        name: tag.name,
        color: tag.color,
        category: tag.category,
        entityType: 'opportunity',
        createdById: admin.id,
        isLocked: false,
      },
    })
  }
  console.log('Tags created.')

  // ─── DEFAULT ORIGINS ──────────────────────────────────────────────
  const originsData = [
    {
      name: 'Mídia Paga',
      subOrigins: ['Google Ads', 'Facebook Ads', 'Instagram Ads', 'YouTube Ads'],
    },
    {
      name: 'Orgânico',
      subOrigins: ['SEO', 'Blog', 'YouTube Orgânico', 'Instagram Orgânico'],
    },
    {
      name: 'Indicação',
      subOrigins: ['Cliente', 'Parceiro', 'Funcionário'],
    },
  ]

  for (const originData of originsData) {
    let origin = await prisma.origin.findFirst({
      where: { tenantId, name: originData.name },
    })

    if (!origin) {
      origin = await prisma.origin.create({
        data: {
          tenantId,
          name: originData.name,
          isActive: true,
        },
      })
    }

    for (const subName of originData.subOrigins) {
      const existingSub = await prisma.subOrigin.findFirst({
        where: { originId: origin.id, name: subName },
      })
      if (!existingSub) {
        await prisma.subOrigin.create({
          data: {
            originId: origin.id,
            name: subName,
            isActive: true,
          },
        })
      }
    }
  }
  console.log('Origins created.')

  // ─── DEFAULT LOST REASONS ─────────────────────────────────────────
  const lostReasonsData = [
    'Preço muito alto',
    'Escolheu concorrente',
    'Não era o momento certo',
    'Sem necessidade atual',
    'Sem contato/Sem resposta',
  ]

  for (const name of lostReasonsData) {
    const existing = await prisma.lostReason.findFirst({ where: { tenantId, name } })
    if (!existing) {
      await prisma.lostReason.create({
        data: { tenantId, name, isActive: true },
      })
    }
  }
  console.log('Lost reasons created.')

  // ─── DEFAULT PIPELINE ─────────────────────────────────────────────
  let pipeline = await prisma.pipeline.findFirst({
    where: { tenantId, name: 'Funil de Vendas Principal' },
    include: { stages: true },
  })

  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        tenantId,
        name: 'Funil de Vendas Principal',
        type: 'SALES',
        isActive: true,
        sortOrder: 0,
        stages: {
          create: [
            { name: 'Novo Lead', sortOrder: 0, probability: 5, type: StageType.NORMAL, color: '#6366f1' },
            { name: 'Contato Realizado', sortOrder: 1, probability: 15, type: StageType.NORMAL, color: '#8b5cf6' },
            { name: 'Qualificado', sortOrder: 2, probability: 30, type: StageType.NORMAL, color: '#f59e0b' },
            { name: 'Reunião Agendada', sortOrder: 3, probability: 50, type: StageType.NORMAL, color: '#3b82f6' },
            { name: 'Proposta Enviada', sortOrder: 4, probability: 70, type: StageType.NORMAL, color: '#06b6d4' },
            { name: 'Negociação', sortOrder: 5, probability: 85, type: StageType.NORMAL, color: '#ec4899' },
            { name: 'Fechado/Ganho', sortOrder: 6, probability: 100, type: StageType.WON, color: '#22c55e' },
            { name: 'Fechado/Perdido', sortOrder: 7, probability: 0, type: StageType.LOST, color: '#ef4444' },
          ],
        },
      },
      include: { stages: true },
    })
    console.log('Pipeline created with', pipeline.stages.length, 'stages.')
  } else {
    console.log('Pipeline já existe:', pipeline.name)
  }

  // ─── DEFAULT CUSTOM FIELD GROUP + FIELDS ─────────────────────────
  let group = await prisma.customFieldGroup.findFirst({
    where: { tenantId, entityType: 'opportunity', name: 'Informações da Oportunidade' },
  })

  if (!group) {
    group = await prisma.customFieldGroup.create({
      data: {
        tenantId,
        entityType: 'opportunity',
        name: 'Informações da Oportunidade',
        sortOrder: 0,
        isCollapsedByDefault: false,
      },
    })
  }

  const customFieldsData = [
    {
      name: 'Canal de Contato',
      slug: 'canal_contato',
      fieldType: CustomFieldType.SELECT,
      options: ['WhatsApp', 'Telefone', 'Email', 'Presencial', 'Videoconferência'],
      sortOrder: 0,
    },
    {
      name: 'Como nos encontrou',
      slug: 'como_encontrou',
      fieldType: CustomFieldType.SELECT,
      options: ['Google', 'Instagram', 'Facebook', 'LinkedIn', 'Indicação', 'Evento'],
      sortOrder: 1,
    },
    {
      name: 'Data prevista de fechamento',
      slug: 'data_fechamento_prevista',
      fieldType: CustomFieldType.DATE,
      options: null,
      sortOrder: 2,
    },
    {
      name: 'Motivo do interesse',
      slug: 'motivo_interesse',
      fieldType: CustomFieldType.TEXT,
      options: null,
      sortOrder: 3,
    },
    {
      name: 'Observações internas',
      slug: 'observacoes_internas',
      fieldType: CustomFieldType.TEXTAREA,
      options: null,
      sortOrder: 4,
    },
  ]

  for (const cf of customFieldsData) {
    const existing = await prisma.customField.findFirst({
      where: { groupId: group.id, slug: cf.slug },
    })
    if (!existing) {
      await prisma.customField.create({
        data: {
          groupId: group.id,
          entityType: 'opportunity',
          name: cf.name,
          slug: cf.slug,
          fieldType: cf.fieldType,
          options: cf.options ? (cf.options as Prisma.InputJsonValue) : undefined,
          sortOrder: cf.sortOrder,
          isRequiredGlobal: false,
          showInCard: false,
          isActive: true,
        },
      })
    }
  }
  console.log('Custom field group + fields created.')

  // ─── DEFAULT TASK TEMPLATES ───────────────────────────────────────
  const taskTemplatesData = [
    {
      name: 'Primeiro contato',
      type: TaskType.FIRST_CONTACT,
      titleTemplate: 'Realizar primeiro contato com {{contact_name}}',
      descriptionTemplate: 'Realizar primeiro contato com o lead em até 1 hora',
      defaultPriority: TaskPriority.HIGH,
    },
    {
      name: 'Enviar proposta',
      type: TaskType.SEND_PROPOSAL,
      titleTemplate: 'Enviar proposta para {{contact_name}}',
      descriptionTemplate: 'Enviar proposta comercial detalhada',
      defaultPriority: TaskPriority.MEDIUM,
    },
    {
      name: 'Follow-up pós-reunião',
      type: TaskType.FOLLOW_UP,
      titleTemplate: 'Follow-up após reunião com {{contact_name}}',
      descriptionTemplate: 'Ligar 24h após a reunião para verificar interesse',
      defaultPriority: TaskPriority.MEDIUM,
    },
  ]

  for (const tt of taskTemplatesData) {
    const existing = await prisma.taskTemplate.findFirst({
      where: { tenantId, name: tt.name },
    })
    if (!existing) {
      await prisma.taskTemplate.create({
        data: {
          tenantId,
          name: tt.name,
          type: tt.type,
          titleTemplate: tt.titleTemplate,
          descriptionTemplate: tt.descriptionTemplate,
          defaultPriority: tt.defaultPriority,
        },
      })
    }
  }
  console.log('Task templates created.')

  console.log('\nSeed completed successfully!')
  console.log('\nCredentials:')
  console.log('  Admin:   admin@cashmind.com   / Admin@123')
  console.log('  Gestor:  gestor@cashmind.com  / Manager@123')
  console.log('  SDR 1:   sdr1@cashmind.com    / Sdr@123')
  console.log('  SDR 2:   sdr2@cashmind.com    / Sdr@123')
  console.log('  Closer:  closer@cashmind.com  / Closer@123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
