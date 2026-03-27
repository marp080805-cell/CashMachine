import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'

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

// ─── analytics routes ─────────────────────────────────────────────

export default async function analyticsRoutes(app: FastifyInstance) {

  // ── GET /analytics/funnel ────────────────────────────────────────
  app.get('/analytics/funnel', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId, id: userId, role } = request.user as {
      tenantId: string; id: string; role: string
    }
    const isManager = ['ADMIN', 'MANAGER'].includes(role)

    const query = request.query as {
      period?: string
      pipeline_id?: string
      origin_id?: string
      user_id?: string
      start?: string
      end?: string
    }

    const { startDate, now } = getPeriodDates(query.period ?? '30d', query.start, query.end)
    const dateRange = { gte: startDate, lte: now }

    const baseWhere: any = {
      tenantId,
      createdAt: dateRange,
      ...(query.pipeline_id && { pipelineId: query.pipeline_id }),
      ...(query.origin_id && { originId: query.origin_id }),
      ...(query.user_id
        ? { assignedToId: query.user_id }
        : !isManager ? { assignedToId: userId } : {}),
    }

    // Count by stage
    const stageGroups = await prisma.opportunity.groupBy({
      by: ['stageId'],
      where: baseWhere,
      _count: { id: true },
      _sum: { value: true },
    })

    const stageIds = stageGroups.map((g) => g.stageId)
    const stages = await prisma.stage.findMany({
      where: { id: { in: stageIds } },
      select: { id: true, name: true, sortOrder: true, color: true, type: true, probability: true },
      orderBy: { sortOrder: 'asc' },
    })
    const stageMap = new Map(stages.map((s) => [s.id, s]))

    // Overall funnel metrics
    const [total, scheduled, attended, won, lost] = await Promise.all([
      prisma.opportunity.count({ where: baseWhere }),
      prisma.opportunity.count({ where: { ...baseWhere, scheduledDate: { not: null } } }),
      prisma.opportunity.count({ where: { ...baseWhere, attendedDate: { not: null } } }),
      prisma.opportunity.count({ where: { ...baseWhere, status: 'WON' } }),
      prisma.opportunity.count({ where: { ...baseWhere, status: 'LOST' } }),
    ])

    const byStage = stageGroups
      .map((g) => {
        const stage = stageMap.get(g.stageId)
        return {
          stageId: g.stageId,
          stageName: stage?.name ?? 'Unknown',
          stageColor: stage?.color ?? '#6366f1',
          sortOrder: stage?.sortOrder ?? 0,
          type: stage?.type ?? 'NORMAL',
          count: g._count.id,
          value: Number(g._sum.value ?? 0),
        }
      })
      .sort((a, b) => a.sortOrder - b.sortOrder)

    return reply.send({
      period: query.period ?? '30d',
      date_range: { start: startDate, end: now },
      funnel: {
        total,
        scheduled,
        attended,
        won,
        lost,
        scheduled_pct: total > 0 ? (scheduled / total) * 100 : 0,
        attended_pct: scheduled > 0 ? (attended / scheduled) * 100 : 0,
        won_pct: attended > 0 ? (won / attended) * 100 : 0,
        overall_conversion: total > 0 ? (won / total) * 100 : 0,
      },
      by_stage: byStage,
    })
  })

  // ── GET /analytics/forecast ──────────────────────────────────────
  app.get('/analytics/forecast', { preHandler: [app.authenticate] }, async (request, reply) => {
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

    const baseWhere: any = {
      tenantId,
      status: 'OPEN',
      ...(query.pipeline_id && { pipelineId: query.pipeline_id }),
      ...(query.origin_id && { originId: query.origin_id }),
      ...(query.user_id
        ? { assignedToId: query.user_id }
        : !isManager ? { assignedToId: userId } : {}),
    }

    const openOpps = await prisma.opportunity.findMany({
      where: baseWhere,
      select: { id: true, stageId: true, value: true, monthlyValue: true, expectedCloseDate: true },
    })

    const stageIds = [...new Set(openOpps.map((o) => o.stageId))]
    const stages = await prisma.stage.findMany({
      where: { id: { in: stageIds } },
      select: { id: true, name: true, color: true, sortOrder: true, probability: true },
    })
    const stageMap = new Map(stages.map((s) => [s.id, s]))

    const byStage = new Map<
      string,
      { stageName: string; color: string; sortOrder: number; probability: number; count: number; value: number; weighted: number; mrr: number; weightedMrr: number }
    >()

    let totalValue = 0
    let totalWeighted = 0

    for (const opp of openOpps) {
      const stage = stageMap.get(opp.stageId)
      if (!stage) continue
      const val = Number(opp.value ?? 0)
      const mrr = Number(opp.monthlyValue ?? 0)
      const prob = stage.probability / 100
      totalValue += val
      totalWeighted += val * prob

      const existing = byStage.get(opp.stageId)
      if (existing) {
        existing.count++
        existing.value += val
        existing.weighted += val * prob
        existing.mrr += mrr
        existing.weightedMrr += mrr * prob
      } else {
        byStage.set(opp.stageId, {
          stageName: stage.name,
          color: stage.color,
          sortOrder: stage.sortOrder,
          probability: stage.probability,
          count: 1,
          value: val,
          weighted: val * prob,
          mrr,
          weightedMrr: mrr * prob,
        })
      }
    }

    const stageList = Array.from(byStage.entries())
      .map(([stageId, data]) => ({ stageId, ...data }))
      .sort((a, b) => a.sortOrder - b.sortOrder)

    return reply.send({
      total_open_value: totalValue,
      weighted_forecast: totalWeighted,
      total_deals: openOpps.length,
      by_stage: stageList,
    })
  })

  // ── GET /analytics/sdr-dashboard ────────────────────────────────
  app.get('/analytics/sdr-dashboard', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId, id: userId, role } = request.user as {
      tenantId: string; id: string; role: string
    }
    const isManager = ['ADMIN', 'MANAGER'].includes(role)

    const query = request.query as {
      period?: string
      pipeline_id?: string
      origin_id?: string
      user_id?: string
      start?: string
      end?: string
    }

    const { startDate, now } = getPeriodDates(query.period ?? '30d', query.start, query.end)
    const dateRange = { gte: startDate, lte: now }

    const userTarget = query.user_id
      ? { assignedToId: query.user_id }
      : !isManager ? { assignedToId: userId } : {}

    const oppWhere: any = {
      tenantId,
      ...userTarget,
      ...(query.pipeline_id && { pipelineId: query.pipeline_id }),
      ...(query.origin_id && { originId: query.origin_id }),
    }

    const [leadsCreated, scheduled, attended, wonCount] = await Promise.all([
      prisma.opportunity.count({ where: { ...oppWhere, createdAt: dateRange } }),
      prisma.opportunity.count({
        where: { ...oppWhere, scheduledDate: { gte: startDate, lte: now } },
      }),
      prisma.opportunity.count({
        where: { ...oppWhere, attendedDate: { gte: startDate, lte: now } },
      }),
      prisma.opportunity.count({
        where: { ...oppWhere, status: 'WON', wonDate: dateRange },
      }),
    ])

    // SLA compliance for FIRST_CONTACT tasks
    const firstContactTasks = await prisma.task.findMany({
      where: {
        tenantId,
        type: 'FIRST_CONTACT',
        status: 'COMPLETED',
        createdAt: dateRange,
        slaMinutes: { not: null },
        completedAt: { not: null },
        ...(query.user_id
          ? { assignedToId: query.user_id }
          : !isManager ? { assignedToId: userId } : {}),
      },
      select: { createdAt: true, completedAt: true, slaMinutes: true },
    })

    const slaCompliant = firstContactTasks.filter((t) => {
      if (!t.completedAt || !t.slaMinutes) return false
      const diffMin = (t.completedAt.getTime() - t.createdAt.getTime()) / 60000
      return diffMin <= t.slaMinutes
    }).length

    // By origin breakdown
    const byOrigin = await prisma.opportunity.groupBy({
      by: ['originId'],
      where: { ...oppWhere, createdAt: dateRange },
      _count: { id: true },
    })

    const originIds = byOrigin.map((g) => g.originId).filter(Boolean) as string[]
    const origins = await prisma.origin.findMany({
      where: { id: { in: originIds } },
      select: { id: true, name: true },
    })
    const originMap = new Map(origins.map((o) => [o.id, o.name]))

    return reply.send({
      period: query.period ?? '30d',
      date_range: { start: startDate, end: now },
      leads_created: leadsCreated,
      scheduled,
      meetings_confirmed: attended,
      won: wonCount,
      conversion_to_meeting: leadsCreated > 0 ? (scheduled / leadsCreated) * 100 : 0,
      conversion_meeting_to_attended: scheduled > 0 ? (attended / scheduled) * 100 : 0,
      conversion_attended_to_won: attended > 0 ? (wonCount / attended) * 100 : 0,
      sla: {
        total: firstContactTasks.length,
        compliant: slaCompliant,
        compliance_rate: firstContactTasks.length > 0 ? (slaCompliant / firstContactTasks.length) * 100 : 0,
      },
      by_origin: byOrigin.map((g) => ({
        originId: g.originId,
        originName: g.originId ? (originMap.get(g.originId) ?? 'Unknown') : 'Direct',
        count: g._count.id,
      })),
    })
  })

  // ── GET /analytics/closer-dashboard ─────────────────────────────
  app.get('/analytics/closer-dashboard', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId, id: userId, role } = request.user as {
      tenantId: string; id: string; role: string
    }
    const isManager = ['ADMIN', 'MANAGER'].includes(role)

    const query = request.query as {
      period?: string
      pipeline_id?: string
      origin_id?: string
      user_id?: string
      start?: string
      end?: string
    }

    const { startDate, now } = getPeriodDates(query.period ?? '30d', query.start, query.end)
    const dateRange = { gte: startDate, lte: now }

    const meetingUserFilter = query.user_id
      ? { hostId: query.user_id }
      : !isManager ? { hostId: userId } : {}

    const oppUserFilter = query.user_id
      ? { closerId: query.user_id }
      : !isManager ? { closerId: userId } : {}

    const oppWhere: any = {
      tenantId,
      ...oppUserFilter,
      ...(query.pipeline_id && { pipelineId: query.pipeline_id }),
      ...(query.origin_id && { originId: query.origin_id }),
    }

    const [
      meetingsTotal,
      meetingsNoShow,
      meetingCompleted,
      proposalsSent,
      wonCount,
      wonAgg,
    ] = await Promise.all([
      prisma.meeting.count({ where: { tenantId, ...meetingUserFilter, startDatetime: dateRange } }),
      prisma.meeting.count({
        where: { tenantId, ...meetingUserFilter, startDatetime: dateRange, status: 'NO_SHOW' },
      }),
      prisma.meeting.count({
        where: { tenantId, ...meetingUserFilter, startDatetime: dateRange, status: 'COMPLETED' },
      }),
      prisma.opportunity.count({
        where: { ...oppWhere, proposalSentDate: { gte: startDate, lte: now } },
      }),
      prisma.opportunity.count({
        where: { ...oppWhere, status: 'WON', wonDate: dateRange },
      }),
      prisma.opportunity.aggregate({
        where: { ...oppWhere, status: 'WON', wonDate: dateRange },
        _sum: { value: true, monthlyValue: true },
      }),
    ])

    const revenue = Number(wonAgg._sum.value ?? 0)
    const mrr = Number(wonAgg._sum.monthlyValue ?? 0)
    const ticket_medio = wonCount > 0 ? revenue / wonCount : 0

    // Call scores from recordings
    const recordings = await prisma.recording.findMany({
      where: {
        tenantId,
        createdAt: dateRange,
        ...(query.user_id ? { closerId: query.user_id } : !isManager ? { closerId: userId } : {}),
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

    return reply.send({
      period: query.period ?? '30d',
      date_range: { start: startDate, end: now },
      meetings_total: meetingsTotal,
      meetings_completed: meetingCompleted,
      no_show_count: meetingsNoShow,
      no_show_rate: meetingsTotal > 0 ? (meetingsNoShow / meetingsTotal) * 100 : 0,
      proposals_sent: proposalsSent,
      won_count: wonCount,
      closing_rate: meetingCompleted > 0 ? (wonCount / meetingCompleted) * 100 : 0,
      revenue,
      mrr,
      ticket_medio,
      call_scores: {
        average_score: scoreCount > 0 ? totalScore / scoreCount : null,
        total_analyzed: scoreCount,
        total_recordings: recordings.length,
      },
    })
  })

  // ── GET /analytics/origin-impact ────────────────────────────────
  app.get('/analytics/origin-impact', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId, id: userId, role } = request.user as {
      tenantId: string; id: string; role: string
    }
    const isManager = ['ADMIN', 'MANAGER'].includes(role)

    const query = request.query as {
      period?: string
      pipeline_id?: string
      user_id?: string
      start?: string
      end?: string
    }

    const { startDate, now } = getPeriodDates(query.period ?? '30d', query.start, query.end)
    const dateRange = { gte: startDate, lte: now }

    const baseWhere: any = {
      tenantId,
      createdAt: dateRange,
      ...(query.pipeline_id && { pipelineId: query.pipeline_id }),
      ...(query.user_id
        ? { assignedToId: query.user_id }
        : !isManager ? { assignedToId: userId } : {}),
    }

    // All opps by origin
    const allByOrigin = await prisma.opportunity.groupBy({
      by: ['originId'],
      where: baseWhere,
      _count: { id: true },
    })

    // WON by origin
    const wonByOrigin = await prisma.opportunity.groupBy({
      by: ['originId'],
      where: { ...baseWhere, status: 'WON' },
      _count: { id: true },
      _sum: { value: true },
    })

    const wonMap = new Map(wonByOrigin.map((g) => [g.originId, g]))

    const originIds = [...new Set([
      ...allByOrigin.map((g) => g.originId),
    ])].filter(Boolean) as string[]

    const origins = await prisma.origin.findMany({
      where: { id: { in: originIds } },
      select: { id: true, name: true },
    })
    const originMap = new Map(origins.map((o) => [o.id, o.name]))

    const result = allByOrigin.map((g) => {
      const won = wonMap.get(g.originId)
      const totalCount = g._count.id
      const wonCount = won?._count.id ?? 0
      const revenue = Number(won?._sum.value ?? 0)
      return {
        originId: g.originId,
        originName: g.originId ? (originMap.get(g.originId) ?? 'Unknown') : 'Direct',
        total_leads: totalCount,
        won_count: wonCount,
        revenue: revenue,
        conversion_rate: totalCount > 0 ? (wonCount / totalCount) * 100 : 0,
      }
    })

    result.sort((a, b) => b.revenue - a.revenue)

    return reply.send({
      period: query.period ?? '30d',
      date_range: { start: startDate, end: now },
      by_origin: result,
    })
  })

  // ── GET /analytics/sales-velocity ───────────────────────────────
  app.get('/analytics/sales-velocity', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId, id: userId, role } = request.user as {
      tenantId: string; id: string; role: string
    }
    const isManager = ['ADMIN', 'MANAGER'].includes(role)

    const query = request.query as {
      period?: string
      pipeline_id?: string
      origin_id?: string
      user_id?: string
      start?: string
      end?: string
    }

    const { startDate, now } = getPeriodDates(query.period ?? '30d', query.start, query.end)
    const dateRange = { gte: startDate, lte: now }

    const baseOppWhere: any = {
      tenantId,
      ...(query.pipeline_id && { pipelineId: query.pipeline_id }),
      ...(query.origin_id && { originId: query.origin_id }),
      ...(query.user_id
        ? { assignedToId: query.user_id }
        : !isManager ? { assignedToId: userId } : {}),
    }

    // Get stage histories with duration in the period
    const histories = await prisma.stageHistory.findMany({
      where: {
        opportunity: baseOppWhere,
        durationSeconds: { not: null },
        enteredAt: dateRange,
      },
      select: {
        stageId: true,
        durationSeconds: true,
        opportunity: { select: { status: true } },
      },
    })

    const stageIds = [...new Set(histories.map((h) => h.stageId))]
    const stages = await prisma.stage.findMany({
      where: { id: { in: stageIds } },
      select: { id: true, name: true, sortOrder: true, color: true, type: true },
    })
    const stageMap = new Map(stages.map((s) => [s.id, s]))

    // Aggregate by stage
    const byStage = new Map<string, { count: number; totalSeconds: number }>()

    for (const h of histories) {
      const existing = byStage.get(h.stageId)
      if (existing) {
        existing.count++
        existing.totalSeconds += h.durationSeconds ?? 0
      } else {
        byStage.set(h.stageId, { count: 1, totalSeconds: h.durationSeconds ?? 0 })
      }
    }

    const byStageResult = Array.from(byStage.entries())
      .map(([stageId, data]) => {
        const stage = stageMap.get(stageId)
        return {
          stageId,
          stageName: stage?.name ?? 'Unknown',
          color: stage?.color ?? '#6366f1',
          sortOrder: stage?.sortOrder ?? 0,
          type: stage?.type ?? 'NORMAL',
          sample_count: data.count,
          avg_days: data.count > 0 ? (data.totalSeconds / data.count) / 86400 : 0,
          total_days: data.totalSeconds / 86400,
        }
      })
      .sort((a, b) => a.sortOrder - b.sortOrder)

    // Overall cycle for WON deals
    const wonHistories = histories.filter((h) => h.opportunity.status === 'WON')
    const totalWonSeconds = wonHistories.reduce((s, h) => s + (h.durationSeconds ?? 0), 0)
    const avgCycleDays = wonHistories.length > 0 ? (totalWonSeconds / wonHistories.length) / 86400 : null

    return reply.send({
      period: query.period ?? '30d',
      date_range: { start: startDate, end: now },
      avg_cycle_days: avgCycleDays,
      sample_size: wonHistories.length,
      by_stage: byStageResult,
    })
  })
}
