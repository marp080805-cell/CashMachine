import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { z } from 'zod'

const DEFAULT_WIDGETS = [
  { id: 'kpi_leads', type: 'kpi', label: 'Leads este mês', enabled: true, position: 0 },
  { id: 'kpi_cpl', type: 'kpi', label: 'CPL Médio', enabled: true, position: 1 },
  { id: 'kpi_calls', type: 'kpi', label: 'Calls realizadas', enabled: true, position: 2 },
  { id: 'kpi_contracts', type: 'kpi', label: 'Contratos fechados', enabled: true, position: 3 },
  { id: 'kpi_cost', type: 'kpi', label: 'Custo investido', enabled: true, position: 4 },
  { id: 'kpi_cac', type: 'kpi', label: 'CAC Médio', enabled: true, position: 5 },
  { id: 'chart_channel', type: 'chart', label: 'Gráfico: Performance por Canal', enabled: true, position: 6 },
  { id: 'chart_leads', type: 'chart', label: 'Gráfico: Evolução de Leads', enabled: true, position: 7 },
  { id: 'table_channels', type: 'table', label: 'Tabela: Performance por Canal', enabled: true, position: 8 },
  { id: 'activities', type: 'list', label: 'Atividades Recentes', enabled: true, position: 9 },
  { id: 'tasks', type: 'list', label: 'Próximas Tarefas', enabled: true, position: 10 },
  { id: 'team', type: 'list', label: 'Performance do Time', enabled: true, position: 11 },
]

export default async function dashboardConfigRoutes(app: FastifyInstance) {
  // Get dashboard config for current user
  app.get('/settings/dashboard', async (req, reply) => {
    await req.jwtVerify()
    const user = req.user as { id: string }

    const config = await prisma.dashboardConfig.findUnique({
      where: { userId: user.id },
    })

    if (!config) {
      return reply.send({ widgets: DEFAULT_WIDGETS })
    }

    // Merge with defaults: add any new widgets that don't exist in saved config
    const saved = config.widgets as typeof DEFAULT_WIDGETS
    const savedIds = new Set(saved.map((w) => w.id))
    const merged = [
      ...saved,
      ...DEFAULT_WIDGETS.filter((w) => !savedIds.has(w.id)).map((w, i) => ({
        ...w,
        position: saved.length + i,
      })),
    ]

    return reply.send({ widgets: merged })
  })

  // Save dashboard config for current user
  app.put('/settings/dashboard', async (req, reply) => {
    await req.jwtVerify()
    const user = req.user as { id: string }

    const { widgets } = z.object({
      widgets: z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          label: z.string(),
          enabled: z.boolean(),
          position: z.number(),
        })
      ),
    }).parse(req.body)

    const config = await prisma.dashboardConfig.upsert({
      where: { userId: user.id },
      create: { userId: user.id, widgets },
      update: { widgets },
    })

    return reply.send({ widgets: config.widgets })
  })

  // Reset to defaults
  app.delete('/settings/dashboard', async (req, reply) => {
    await req.jwtVerify()
    const user = req.user as { id: string }
    await prisma.dashboardConfig.deleteMany({ where: { userId: user.id } })
    return reply.send({ widgets: DEFAULT_WIDGETS })
  })
}
