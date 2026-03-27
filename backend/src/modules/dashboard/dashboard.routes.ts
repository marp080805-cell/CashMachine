import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { computeDailyMetrics, dailyMetricsQueue } from '../../queues/daily-metrics.queue'

// ─── helpers ──────────────────────────────────────────────────────

function getPeriodDates(period: string, startParam?: string, endParam?: string) {
  const now = new Date()
  if (period === 'custom' && startParam && endParam) {
    return { startDate: new Date(startParam), now: new Date(endParam) }
  }
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - days)
  return { startDate, now }
}

// ─── dashboard routes ─────────────────────────────────────────────

export default async function dashboardRoutes(app: FastifyInstance) {

  // ── legacy summary ──────────────────────────────────────────────
  app.get('/dashboard/summary', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId, id: userId, role } = request.user as {
      tenantId: string; id: string; role: string
    }
    const isManager = ['ADMIN', 'MANAGER'].includes(role)

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const oppWhere: any = {
      tenantId,
      ...(!isManager && { assignedToId: userId }),
    }

    const [
      openOpportunities,
      wonThisMonth,
      lostThisMonth,
      newContactsThisMonth,
      recentActivities,
      upcomingTasks,
      pipelineSummary,
    ] = await Promise.all([
      prisma.opportunity.count({ where: { ...oppWhere, status: 'OPEN' } }),

      prisma.opportunity.aggregate({
        where: { ...oppWhere, status: 'WON', closedAt: { gte: monthStart, lt: monthEnd } },
        _count: { id: true },
        _sum: { value: true },
      }),

      prisma.opportunity.count({
        where: { ...oppWhere, status: 'LOST', closedAt: { gte: monthStart, lt: monthEnd } },
      }),

      prisma.contact.count({
        where: { tenantId, createdAt: { gte: monthStart, lt: monthEnd } },
      }),

      prisma.activity.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          contact: { select: { id: true, name: true } },
          opportunity: { select: { id: true, title: true } },
        },
      }),

      prisma.task.findMany({
        where: {
          tenantId,
          assignedToId: userId,
          status: { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] },
          dueDate: { gte: now },
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
        include: {
          contact: { select: { id: true, name: true } },
          opportunity: { select: { id: true, title: true } },
        },
      }),

      prisma.pipeline.findMany({
        where: { tenantId, isActive: true },
        include: {
          _count: { select: { opportunities: { where: { ...oppWhere, status: 'OPEN' } } } },
          stages: {
            orderBy: { sortOrder: 'asc' },
            include: {
              _count: { select: { opportunities: { where: { ...oppWhere, status: 'OPEN' } } } },
            },
          },
        },
      }),
    ])

    return reply.send({
      kpis: {
        openOpportunities,
        wonThisMonth: wonThisMonth._count.id,
        revenueWon: Number(wonThisMonth._sum.value ?? 0),
        lostThisMonth,
        newContacts: newContactsThisMonth,
        winRate: (wonThisMonth._count.id + lostThisMonth) > 0
          ? (wonThisMonth._count.id / (wonThisMonth._count.id + lostThisMonth)) * 100
          : 0,
      },
      recentActivities,
      upcomingTasks,
      pipelineSummary: pipelineSummary.map((p) => ({
        pipelineId: p.id,
        pipelineName: p.name,
        openCount: p._count.opportunities,
        stages: p.stages.map((s) => ({
          stageId: s.id,
          stageName: s.name,
          color: s.color,
          count: s._count.opportunities,
        })),
      })),
    })
  })

  // ── GET /dashboard/widgets ───────────────────────────────────────
  app.get('/dashboard/widgets', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId, id: userId, role } = request.user as {
      tenantId: string; id: string; role: string
    }
    const isManager = ['ADMIN', 'MANAGER'].includes(role)

    const query = request.query as {
      period?: string
      pipeline_id?: string
      origin_id?: string
      user_id?: string
    }

    const period = query.period ?? '30d'
    const { startDate, now } = getPeriodDates(period)
    const dateRange = { gte: startDate, lte: now }

    const pipelineFilter = query.pipeline_id ? { pipelineId: query.pipeline_id } : {}
    const originFilter = query.origin_id ? { originId: query.origin_id } : {}
    const userFilter = query.user_id
      ? { assignedToId: query.user_id }
      : !isManager
        ? { assignedToId: userId }
        : {}

    const baseOppWhere: any = { tenantId, ...pipelineFilter, ...originFilter, ...userFilter }

    // ── 1. goal_progress ─────────────────────────────────────────
    const goals = await prisma.goal.findMany({
      where: {
        tenantId,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
    })

    const goalProgress = await Promise.all(
      goals.map(async (goal) => {
        let currentValue = 0

        if (goal.type === 'REVENUE') {
          const agg = await prisma.opportunity.aggregate({
            where: { ...baseOppWhere, status: 'WON', wonDate: dateRange },
            _sum: { value: true },
          })
          currentValue = Number(agg._sum.value ?? 0)
        } else if (goal.type === 'MRR') {
          const agg = await prisma.opportunity.aggregate({
            where: { ...baseOppWhere, status: 'WON', wonDate: dateRange },
            _sum: { monthlyValue: true },
          })
          currentValue = Number(agg._sum.monthlyValue ?? 0)
        } else if (goal.type === 'DEAL_COUNT') {
          currentValue = await prisma.opportunity.count({
            where: { ...baseOppWhere, status: 'WON', wonDate: dateRange },
          })
        } else if (goal.type === 'NEW_LEADS') {
          currentValue = await prisma.lead.count({
            where: { tenantId, createdAt: dateRange },
          })
        } else if (goal.type === 'MEETINGS_BOOKED') {
          currentValue = await prisma.meeting.count({
            where: { tenantId, createdAt: dateRange },
          })
        }

        const targetValue = Number(goal.targetValue ?? 0)
        return {
          goalId: goal.id,
          name: goal.name,
          type: goal.type,
          targetValue,
          currentValue,
          progress: targetValue > 0 ? (currentValue / targetValue) * 100 : 0,
          startDate: goal.startDate,
          endDate: goal.endDate,
        }
      })
    )

    // ── 2. mrr_current ───────────────────────────────────────────
    const mrrAgg = await prisma.opportunity.aggregate({
      where: { ...baseOppWhere, status: 'WON', wonDate: dateRange },
      _sum: { monthlyValue: true },
    })
    const mrr_current = Number(mrrAgg._sum.monthlyValue ?? 0)

    // ── 3. revenue_current ───────────────────────────────────────
    const revenueAgg = await prisma.opportunity.aggregate({
      where: { ...baseOppWhere, status: 'WON', wonDate: dateRange },
      _sum: { value: true },
    })
    const revenue_current = Number(revenueAgg._sum.value ?? 0)

    // ── 4. deal_count ────────────────────────────────────────────
    const deal_count = await prisma.opportunity.count({
      where: { ...baseOppWhere, status: 'WON', wonDate: dateRange },
    })

    // ── 5. new_leads_count ───────────────────────────────────────
    const [newLeadsTotal, newLeadsByOrigin] = await Promise.all([
      prisma.lead.count({ where: { tenantId, createdAt: dateRange } }),
      prisma.opportunity.groupBy({
        by: ['originId'],
        where: { ...baseOppWhere, createdAt: dateRange },
        _count: { id: true },
      }),
    ])
    const new_leads_count = {
      total: newLeadsTotal,
      byOrigin: newLeadsByOrigin.map((g) => ({
        originId: g.originId,
        count: g._count.id,
      })),
    }

    // ── 6. conversion_funnel ─────────────────────────────────────
    const [totalLeads, scheduledCount, attendedCount, wonCount] = await Promise.all([
      prisma.opportunity.count({ where: { ...baseOppWhere, createdAt: dateRange } }),
      prisma.opportunity.count({
        where: { ...baseOppWhere, createdAt: dateRange, scheduledDate: { not: null } },
      }),
      prisma.opportunity.count({
        where: { ...baseOppWhere, createdAt: dateRange, attendedDate: { not: null } },
      }),
      prisma.opportunity.count({
        where: { ...baseOppWhere, createdAt: dateRange, status: 'WON' },
      }),
    ])

    const conversion_funnel = {
      total_leads: totalLeads,
      scheduled: scheduledCount,
      attended: attendedCount,
      won: wonCount,
      scheduled_pct: totalLeads > 0 ? (scheduledCount / totalLeads) * 100 : 0,
      attended_pct: scheduledCount > 0 ? (attendedCount / scheduledCount) * 100 : 0,
      won_pct: attendedCount > 0 ? (wonCount / attendedCount) * 100 : 0,
      overall_conversion: totalLeads > 0 ? (wonCount / totalLeads) * 100 : 0,
    }

    // ── 7. sdr_metrics ───────────────────────────────────────────
    const [sdrLeads, sdrScheduled, sdrAttended] = await Promise.all([
      prisma.opportunity.count({ where: { ...baseOppWhere, createdAt: dateRange } }),
      prisma.opportunity.count({
        where: { ...baseOppWhere, scheduledDate: { gte: startDate, lte: now } },
      }),
      prisma.opportunity.count({
        where: { ...baseOppWhere, attendedDate: { gte: startDate, lte: now } },
      }),
    ])

    // SLA compliance: tasks FIRST_CONTACT completed within slaMinutes
    const firstContactTasks = await prisma.task.findMany({
      where: {
        tenantId,
        type: 'FIRST_CONTACT',
        status: 'COMPLETED',
        createdAt: dateRange,
        slaMinutes: { not: null },
        completedAt: { not: null },
      },
      select: { createdAt: true, completedAt: true, slaMinutes: true },
    })

    const slaCompliant = firstContactTasks.filter((t) => {
      if (!t.completedAt || !t.slaMinutes) return false
      const diffMs = t.completedAt.getTime() - t.createdAt.getTime()
      const diffMin = diffMs / 60000
      return diffMin <= t.slaMinutes
    }).length

    const sdr_metrics = {
      leads_created: sdrLeads,
      scheduled: sdrScheduled,
      meetings_confirmed: sdrAttended,
      sla_total: firstContactTasks.length,
      sla_compliant: slaCompliant,
      sla_compliance_rate: firstContactTasks.length > 0
        ? (slaCompliant / firstContactTasks.length) * 100
        : 0,
    }

    // ── 8. closer_metrics ────────────────────────────────────────
    const [closerMeetings, closerNoShow, closerProposals, closerWon] = await Promise.all([
      prisma.meeting.count({ where: { tenantId, startDatetime: dateRange } }),
      prisma.meeting.count({
        where: { tenantId, startDatetime: dateRange, status: 'NO_SHOW' },
      }),
      prisma.opportunity.count({
        where: { ...baseOppWhere, proposalSentDate: { gte: startDate, lte: now } },
      }),
      prisma.opportunity.count({
        where: { ...baseOppWhere, status: 'WON', wonDate: dateRange },
      }),
    ])

    const ticket_medio = deal_count > 0 ? revenue_current / deal_count : 0

    const closer_metrics = {
      meetings_done: closerMeetings,
      no_show_count: closerNoShow,
      no_show_rate: closerMeetings > 0 ? (closerNoShow / closerMeetings) * 100 : 0,
      proposals_sent: closerProposals,
      won_count: closerWon,
      closing_rate: closerMeetings > 0 ? (closerWon / closerMeetings) * 100 : 0,
      ticket_medio,
      revenue: revenue_current,
    }

    // ── 9. closer_call_scores ────────────────────────────────────
    const recordings = await prisma.recording.findMany({
      where: {
        tenantId,
        createdAt: dateRange,
      },
      select: { aiAnalysis: true },
    })

    let totalScore = 0
    let scoreCount = 0
    for (const rec of recordings) {
      if (rec.aiAnalysis && typeof rec.aiAnalysis === 'object') {
        const analysis = rec.aiAnalysis as any
        if (typeof analysis.overall_score === 'number') {
          totalScore += analysis.overall_score
          scoreCount++
        }
      }
    }

    const closer_call_scores = {
      average_score: scoreCount > 0 ? totalScore / scoreCount : null,
      total_analyzed: scoreCount,
      total_recordings: recordings.length,
    }

    // ── 10. pipeline_value ───────────────────────────────────────
    const pvAgg = await prisma.opportunity.aggregate({
      where: { ...baseOppWhere, status: 'OPEN' },
      _sum: { value: true },
    })
    const pipeline_value = Number(pvAgg._sum.value ?? 0)

    // ── 11. forecast ─────────────────────────────────────────────
    const openOpps = await prisma.opportunity.findMany({
      where: { ...baseOppWhere, status: 'OPEN' },
      select: { stageId: true, value: true },
    })

    const stageIds = [...new Set(openOpps.map((o) => o.stageId))]
    const stages = await prisma.stage.findMany({
      where: { id: { in: stageIds } },
      select: { id: true, name: true, probability: true },
    })

    const stageMap = new Map(stages.map((s) => [s.id, s]))
    const forecastByStage = new Map<string, { stageName: string; probability: number; value: number; weighted: number }>()

    for (const opp of openOpps) {
      const stage = stageMap.get(opp.stageId)
      if (!stage) continue
      const val = Number(opp.value ?? 0)
      const prob = stage.probability / 100
      const existing = forecastByStage.get(opp.stageId)
      if (existing) {
        existing.value += val
        existing.weighted += val * prob
      } else {
        forecastByStage.set(opp.stageId, {
          stageName: stage.name,
          probability: stage.probability,
          value: val,
          weighted: val * prob,
        })
      }
    }

    const forecast = {
      total_open_value: pipeline_value,
      weighted_forecast: Array.from(forecastByStage.values()).reduce((s, e) => s + e.weighted, 0),
      by_stage: Array.from(forecastByStage.entries()).map(([stageId, data]) => ({
        stageId,
        ...data,
      })),
    }

    // ── 12. sales_velocity ───────────────────────────────────────
    const wonHistories = await prisma.stageHistory.findMany({
      where: {
        opportunity: { tenantId, status: 'WON', ...pipelineFilter },
        durationSeconds: { not: null },
        enteredAt: dateRange,
      },
      select: { durationSeconds: true },
    })

    const avgCycleDays = wonHistories.length > 0
      ? wonHistories.reduce((s, h) => s + (h.durationSeconds ?? 0), 0) / wonHistories.length / 86400
      : null

    const sales_velocity = {
      avg_cycle_days: avgCycleDays,
      sample_size: wonHistories.length,
    }

    // ── 13. top_loss_reasons ─────────────────────────────────────
    const lossGroups = await prisma.opportunity.groupBy({
      by: ['lostReasonId'],
      where: { ...baseOppWhere, status: 'LOST', lostDate: dateRange, lostReasonId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    })

    const lostReasonIds = lossGroups.map((g) => g.lostReasonId!).filter(Boolean)
    const lostReasons = await prisma.lostReason.findMany({
      where: { id: { in: lostReasonIds } },
      select: { id: true, name: true },
    })
    const lostReasonMap = new Map(lostReasons.map((r) => [r.id, r.name]))

    const top_loss_reasons = lossGroups.map((g) => ({
      lostReasonId: g.lostReasonId,
      name: g.lostReasonId ? (lostReasonMap.get(g.lostReasonId) ?? 'Unknown') : 'No reason',
      count: g._count.id,
    }))

    // ── 14. overdue_tasks ────────────────────────────────────────
    const overdue_tasks = await prisma.task.count({
      where: {
        tenantId,
        status: 'OVERDUE',
        ...(query.user_id ? { assignedToId: query.user_id } : !isManager ? { assignedToId: userId } : {}),
      },
    })

    // ── 15. upcoming_meetings ────────────────────────────────────
    const upcoming_meetings = await prisma.meeting.findMany({
      where: {
        tenantId,
        startDatetime: { gte: now },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
      orderBy: { startDatetime: 'asc' },
      take: 5,
      include: {
        contact: { select: { id: true, name: true, phone: true } },
        host: { select: { id: true, name: true, avatarUrl: true } },
        opportunity: { select: { id: true, title: true } },
      },
    })

    return reply.send({
      period,
      date_range: { start: startDate, end: now },
      widgets: {
        goal_progress: goalProgress,
        mrr_current,
        revenue_current,
        deal_count,
        new_leads_count,
        conversion_funnel,
        sdr_metrics,
        closer_metrics,
        closer_call_scores,
        pipeline_value,
        forecast,
        sales_velocity,
        top_loss_reasons,
        overdue_tasks,
        upcoming_meetings,
      },
    })
  })

  // ── GET /dashboard/config ────────────────────────────────────────
  app.get('/dashboard/config', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    })

    const settings = (tenant?.settings as any) ?? {}
    const dashboardConfig = settings.dashboardConfig ?? null

    return reply.send({ config: dashboardConfig })
  })

  // ── PUT /dashboard/config ────────────────────────────────────────
  app.put('/dashboard/config', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const body = request.body as any

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    })

    const currentSettings = (tenant?.settings as any) ?? {}
    const updatedSettings = {
      ...currentSettings,
      dashboardConfig: body,
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: updatedSettings },
    })

    return reply.send({ config: body })
  })

  // ── GET /admin/recompute-metrics ─────────────────────────────────
  app.get('/admin/recompute-metrics', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { role } = request.user as { role: string }
    if (!['ADMIN', 'MANAGER'].includes(role)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const { date } = request.query as { date?: string }

    // If date provided, compute synchronously for that date
    if (date) {
      const result = await computeDailyMetrics(new Date(date))
      return reply.send({ success: true, ...result })
    }

    // Otherwise enqueue for today
    await dailyMetricsQueue.add('compute-daily-metrics', { date: new Date().toISOString() })
    return reply.send({ success: true, message: 'Metrics recompute queued for today' })
  })
}
