import { PrismaClient, UserRole, ChannelType, ChannelStatus, FunnelType, LeadStatus, DealStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const passwordHash = await bcrypt.hash('Admin@123', 10)
  const gestorHash = await bcrypt.hash('Gestor@123', 10)
  const sdrHash = await bcrypt.hash('Sdr@123', 10)
  const closerHash = await bcrypt.hash('Closer@123', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@cashmachine.com' },
    update: {},
    create: {
      email: 'admin@cashmachine.com',
      name: 'Admin CashMachine',
      passwordHash,
      role: UserRole.ADMIN,
    },
  })

  const gestor = await prisma.user.upsert({
    where: { email: 'gestor@cashmachine.com' },
    update: {},
    create: {
      email: 'gestor@cashmachine.com',
      name: 'Carlos Gestor',
      passwordHash: gestorHash,
      role: UserRole.GESTOR,
    },
  })

  const sdr1 = await prisma.user.upsert({
    where: { email: 'sdr1@cashmachine.com' },
    update: {},
    create: {
      email: 'sdr1@cashmachine.com',
      name: 'Ana SDR',
      passwordHash: sdrHash,
      role: UserRole.SDR,
    },
  })

  const sdr2 = await prisma.user.upsert({
    where: { email: 'sdr2@cashmachine.com' },
    update: {},
    create: {
      email: 'sdr2@cashmachine.com',
      name: 'Bruno SDR',
      passwordHash: sdrHash,
      role: UserRole.SDR,
    },
  })

  const closer = await prisma.user.upsert({
    where: { email: 'closer@cashmachine.com' },
    update: {},
    create: {
      email: 'closer@cashmachine.com',
      name: 'Diego Closer',
      passwordHash: closerHash,
      role: UserRole.CLOSER,
    },
  })

  console.log('Users created.')

  const channelsData = [
    { name: 'Google Ads – Tráfego Pago (Pesquisa)', type: ChannelType.ONLINE_PAID, priority: 2, cplTarget: 100, cacTarget: 2000 },
    { name: 'Meta Ads – Tráfego Pago (Insta/Face)', type: ChannelType.ONLINE_PAID, priority: 2, cplTarget: 100, cacTarget: 2000 },
    { name: 'Networking', type: ChannelType.PRESENTIAL_EVENT, priority: 4, cplTarget: 100, cacTarget: 2000 },
    { name: 'Escola do Franchising', type: ChannelType.PRESENTIAL_COMMUNITY, priority: 5, cplTarget: 100, cacTarget: 2000 },
    { name: 'Social Selling – Instagram', type: ChannelType.ONLINE_ORGANIC, priority: 2, cplTarget: 100, cacTarget: 2000 },
    { name: 'Social Selling – LinkedIn', type: ChannelType.ONLINE_ORGANIC, priority: 2, cplTarget: 100, cacTarget: 2000 },
    { name: 'Lista Fria – Outbound', type: ChannelType.OUTBOUND, priority: 3, cplTarget: 100, cacTarget: 2000 },
    { name: 'Indicação – Rede de Parceiros', type: ChannelType.OFFLINE_REFERRAL_PARTNER, priority: 5, cplTarget: 100, cacTarget: 2000 },
    { name: 'Indicação – Clientes Ativos', type: ChannelType.OFFLINE_REFERRAL_CLIENT, priority: 5, cplTarget: 100, cacTarget: 2000 },
    { name: 'Workshop Mensal', type: ChannelType.PRESENTIAL_EVENT, priority: 4, cplTarget: 100, cacTarget: 2000 },
  ]

  const channels: Record<string, string> = {}
  for (const ch of channelsData) {
    const existing = await prisma.channel.findFirst({ where: { name: ch.name } })
    if (existing) {
      channels[ch.name] = existing.id
    } else {
      const created = await prisma.channel.create({
        data: {
          ...ch,
          status: ChannelStatus.ACTIVE,
          leadToCallRate: 0.2,
          callToContractRate: 0.25,
        },
      })
      channels[ch.name] = created.id
    }
  }
  console.log('Channels created.')

  const metricsData = [
    { month: 1, year: 2026, leadsGoal: 20, leadsGenerated: 18, totalCost: 1800, callsReal: 4, contractsReal: 1 },
    { month: 2, year: 2026, leadsGoal: 20, leadsGenerated: 22, totalCost: 2200, callsReal: 5, contractsReal: 1 },
    { month: 3, year: 2026, leadsGoal: 25, leadsGenerated: 10, totalCost: 1000, callsReal: 2, contractsReal: 0 },
  ]

  for (const chName of Object.keys(channels)) {
    const channelId = channels[chName]
    for (const m of metricsData) {
      await prisma.channelMetric.upsert({
        where: { channelId_month_year: { channelId, month: m.month, year: m.year } },
        update: {},
        create: {
          channelId,
          month: m.month,
          year: m.year,
          leadsGoal: m.leadsGoal,
          leadsGenerated: m.leadsGenerated,
          totalCost: m.totalCost,
          callsReal: m.callsReal,
          contractsReal: m.contractsReal,
          callsEstimated: m.leadsGenerated * 0.2,
          contractsEstimated: m.leadsGenerated * 0.2 * 0.25,
        },
      })
    }
  }
  console.log('Channel metrics created.')

  const prospFunnel = await prisma.funnel.upsert({
    where: { id: 'funnel-prospection' },
    update: {},
    create: {
      id: 'funnel-prospection',
      name: 'Prospecção',
      type: FunnelType.PROSPECTING,
      position: 0,
      stages: {
        create: [
          { name: 'Novo Lead', position: 0, color: '#6366f1' },
          { name: 'Primeiro Contato', position: 1, color: '#8b5cf6' },
          { name: 'Qualificação', position: 2, color: '#f59e0b' },
          { name: 'Agendado', position: 3, color: '#22c55e' },
        ],
      },
    },
    include: { stages: true },
  })

  const salesFunnel = await prisma.funnel.upsert({
    where: { id: 'funnel-sales' },
    update: {},
    create: {
      id: 'funnel-sales',
      name: 'Vendas',
      type: FunnelType.SALES,
      position: 1,
      stages: {
        create: [
          { name: 'Reunião Realizada', position: 0, color: '#6366f1' },
          { name: 'Proposta Enviada', position: 1, color: '#f59e0b' },
          { name: 'Negociação', position: 2, color: '#ef4444' },
          { name: 'Contrato Assinado', position: 3, color: '#22c55e' },
        ],
      },
    },
    include: { stages: true },
  })

  const postFunnel = await prisma.funnel.upsert({
    where: { id: 'funnel-post-sales' },
    update: {},
    create: {
      id: 'funnel-post-sales',
      name: 'Pós-venda',
      type: FunnelType.POST_SALES,
      position: 2,
      stages: {
        create: [
          { name: 'Onboarding', position: 0, color: '#6366f1' },
          { name: 'Implementação', position: 1, color: '#f59e0b' },
          { name: 'Ativo', position: 2, color: '#22c55e' },
        ],
      },
    },
    include: { stages: true },
  })

  console.log('Funnels created.')

  const leadsData = [
    { name: 'João Silva', email: 'joao@empresa1.com', phone: '11999990001', channelName: 'Google Ads – Tráfego Pago (Pesquisa)' },
    { name: 'Maria Santos', email: 'maria@empresa2.com', phone: '11999990002', channelName: 'Meta Ads – Tráfego Pago (Insta/Face)' },
    { name: 'Pedro Oliveira', email: 'pedro@empresa3.com', phone: '11999990003', channelName: 'Networking' },
    { name: 'Carla Mendes', email: 'carla@empresa4.com', phone: '11999990004', channelName: 'Social Selling – LinkedIn' },
    { name: 'Lucas Ferreira', email: 'lucas@empresa5.com', phone: '11999990005', channelName: 'Indicação – Clientes Ativos' },
    { name: 'Fernanda Costa', email: 'fernanda@empresa6.com', phone: '11999990006', channelName: 'Google Ads – Tráfego Pago (Pesquisa)' },
    { name: 'Ricardo Lima', email: 'ricardo@empresa7.com', phone: '11999990007', channelName: 'Escola do Franchising' },
    { name: 'Amanda Rocha', email: 'amanda@empresa8.com', phone: '11999990008', channelName: 'Workshop Mensal' },
    { name: 'Thiago Alves', email: 'thiago@empresa9.com', phone: '11999990009', channelName: 'Lista Fria – Outbound' },
    { name: 'Juliana Nunes', email: 'juliana@empresa10.com', phone: '11999990010', channelName: 'Indicação – Rede de Parceiros' },
  ]

  const createdLeads: string[] = []
  for (const ld of leadsData) {
    const existing = await prisma.lead.findFirst({ where: { email: ld.email } })
    if (existing) {
      createdLeads.push(existing.id)
      continue
    }
    const lead = await prisma.lead.create({
      data: {
        name: ld.name,
        email: ld.email,
        phone: ld.phone,
        whatsapp: ld.phone,
        status: LeadStatus.NEW,
        channelId: channels[ld.channelName] ?? null,
        createdById: sdr1.id,
      },
    })
    createdLeads.push(lead.id)
  }
  console.log('Leads created.')

  const prospStages = prospFunnel.stages.sort((a, b) => a.position - b.position)
  const salesStages = salesFunnel.stages.sort((a, b) => a.position - b.position)

  const dealsData = [
    { title: 'Projeto ERP – Empresa Alpha', value: 15000, leadIdx: 0, funnelId: salesFunnel.id, stageId: salesStages[0].id, assignedTo: closer.id },
    { title: 'Consultoria Digital – Beta Corp', value: 8500, leadIdx: 1, funnelId: salesFunnel.id, stageId: salesStages[1].id, assignedTo: closer.id },
    { title: 'Software Gestão – Gamma Ltda', value: 22000, leadIdx: 2, funnelId: salesFunnel.id, stageId: salesStages[2].id, assignedTo: closer.id },
    { title: 'Licença SaaS – Delta SA', value: 5400, leadIdx: 3, funnelId: prospFunnel.id, stageId: prospStages[2].id, assignedTo: sdr1.id },
    { title: 'Implementação – Epsilon ME', value: 12000, leadIdx: 4, funnelId: salesFunnel.id, stageId: salesStages[3].id, assignedTo: closer.id, status: DealStatus.WON },
  ]

  for (const dd of dealsData) {
    const existing = await prisma.deal.findFirst({ where: { title: dd.title } })
    if (!existing) {
      await prisma.deal.create({
        data: {
          title: dd.title,
          value: dd.value,
          funnelId: dd.funnelId,
          stageId: dd.stageId,
          leadId: createdLeads[dd.leadIdx] ?? null,
          assignedToId: dd.assignedTo,
          status: dd.status ?? DealStatus.OPEN,
          probability: 50,
        },
      })
    }
  }
  console.log('Deals created.')

  console.log('\nSeed completed successfully!')
  console.log('\nCredentials:')
  console.log('  Admin:  admin@cashmachine.com   / Admin@123')
  console.log('  Gestor: gestor@cashmachine.com  / Gestor@123')
  console.log('  SDR 1:  sdr1@cashmachine.com    / Sdr@123')
  console.log('  SDR 2:  sdr2@cashmachine.com    / Sdr@123')
  console.log('  Closer: closer@cashmachine.com  / Closer@123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
