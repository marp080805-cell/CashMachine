'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  ChevronLeft, ChevronRight, Plus, Calendar, Clock, Loader2,
} from 'lucide-react'
import { cn, formatDateTime, formatDate } from '@/lib/utils'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths,
  addWeeks, subWeeks, parseISO, getHours,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ── Types ──

interface Meeting {
  id: string
  title: string
  scheduledAt: string
  status: string
  type: string
  opportunity?: { id: string; title: string } | null
}

interface CalTask {
  id: string
  title: string
  dueDate: string | null
  priority: string
  status: string
}

type CalendarEvent =
  | { kind: 'meeting'; date: string; meeting: Meeting }
  | { kind: 'task'; date: string; task: CalTask }

// ── Helpers ──

const meetingTypeLabels: Record<string, string> = {
  DEMO: 'Demo',
  DISCOVERY: 'Discovery',
  PROPOSAL: 'Proposta',
  CLOSING: 'Fechamento',
  FOLLOW_UP: 'Follow-up',
  OTHER: 'Outro',
}

const meetingStatusColors: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  DONE: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-700',
  NO_SHOW: 'bg-orange-100 text-orange-700',
}

const HOUR_SLOTS = Array.from({ length: 14 }, (_, i) => i + 7) // 7..20

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// ── EventChip ──

function EventChip({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  if (event.kind === 'meeting') {
    return (
      <button
        onClick={onClick}
        className="w-full text-left truncate rounded px-1 py-0.5 text-[11px] font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
        title={event.meeting.title}
      >
        {format(parseISO(event.date), 'HH:mm')} {event.meeting.title}
      </button>
    )
  }
  const priorityChip: Record<string, string> = {
    URGENT: 'bg-red-100 text-red-800',
    HIGH: 'bg-orange-100 text-orange-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800',
    LOW: 'bg-gray-100 text-gray-700',
  }
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left truncate rounded px-1 py-0.5 text-[11px] font-medium hover:opacity-80 transition-opacity',
        priorityChip[event.task.priority] ?? 'bg-gray-100 text-gray-700',
      )}
      title={event.task.title}
    >
      {event.task.title}
    </button>
  )
}

// ── EventDetailSheet ──

function EventDetailSheet({
  event,
  open,
  onClose,
}: {
  event: CalendarEvent | null
  open: boolean
  onClose: () => void
}) {
  if (!event) return null
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {event.kind === 'meeting' ? event.meeting.title : event.task.title}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3 text-sm">
          {event.kind === 'meeting' ? (
            <>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{formatDateTime(event.meeting.scheduledAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Tipo:</span>
                <span>{meetingTypeLabels[event.meeting.type] ?? event.meeting.type}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Status:</span>
                <Badge className={cn('text-xs', meetingStatusColors[event.meeting.status])}>
                  {event.meeting.status}
                </Badge>
              </div>
              {event.meeting.opportunity && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Oportunidade:</span>
                  <span>{event.meeting.opportunity.title}</span>
                </div>
              )}
            </>
          ) : (
            <>
              {event.task.dueDate && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{formatDateTime(event.task.dueDate)}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Prioridade:</span>
                <span>{event.task.priority}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Status:</span>
                <span>{event.task.status}</span>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── MonthView ──

function MonthView({
  currentDate,
  events,
  onEventClick,
}: {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick: (e: CalendarEvent) => void
}) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  function eventsForDay(day: Date) {
    return events.filter((e) => isSameDay(parseISO(e.date), day))
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 bg-muted/50">
        {DAY_NAMES.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      {/* Cells */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = eventsForDay(day)
          const isCurrentMonth = isSameMonth(day, currentDate)
          const isToday = isSameDay(day, new Date())
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'min-h-[90px] border-b border-r p-1 flex flex-col gap-0.5',
                !isCurrentMonth && 'bg-muted/30',
              )}
            >
              <span
                className={cn(
                  'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full self-end',
                  isToday && 'bg-primary text-primary-foreground',
                  !isCurrentMonth && 'text-muted-foreground',
                )}
              >
                {format(day, 'd')}
              </span>
              {dayEvents.slice(0, 3).map((ev, i) => (
                <EventChip key={i} event={ev} onClick={() => onEventClick(ev)} />
              ))}
              {dayEvents.length > 3 && (
                <span className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} mais</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── WeekView ──

function WeekView({
  currentDate,
  events,
  onEventClick,
}: {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick: (e: CalendarEvent) => void
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  function eventsForDayHour(day: Date, hour: number) {
    return events.filter((e) => {
      const d = parseISO(e.date)
      return isSameDay(d, day) && getHours(d) === hour
    })
  }

  function allDayEventsForDay(day: Date) {
    return events.filter((e) => {
      const d = parseISO(e.date)
      return isSameDay(d, day) && e.kind === 'task'
    })
  }

  return (
    <div className="rounded-lg border overflow-auto">
      {/* Header */}
      <div className="grid grid-cols-8 border-b bg-muted/50 sticky top-0 z-10">
        <div className="py-2 px-2 text-xs font-medium text-muted-foreground text-right" />
        {days.map((day) => {
          const isToday = isSameDay(day, new Date())
          return (
            <div key={day.toISOString()} className="py-2 text-center">
              <div className="text-xs text-muted-foreground">{DAY_NAMES[day.getDay()]}</div>
              <div className={cn(
                'text-sm font-semibold mx-auto w-7 h-7 flex items-center justify-center rounded-full',
                isToday && 'bg-primary text-primary-foreground',
              )}>
                {format(day, 'd')}
              </div>
            </div>
          )
        })}
      </div>
      {/* All-day tasks row */}
      <div className="grid grid-cols-8 border-b">
        <div className="py-1 px-2 text-[10px] text-muted-foreground text-right">Tarefas</div>
        {days.map((day) => {
          const dayTasks = allDayEventsForDay(day)
          return (
            <div key={day.toISOString()} className="p-0.5 space-y-0.5 min-h-[24px]">
              {dayTasks.slice(0, 2).map((ev, i) => (
                <EventChip key={i} event={ev} onClick={() => onEventClick(ev)} />
              ))}
            </div>
          )
        })}
      </div>
      {/* Hour rows */}
      {HOUR_SLOTS.map((hour) => (
        <div key={hour} className="grid grid-cols-8 border-b min-h-[48px]">
          <div className="py-1 px-2 text-[10px] text-muted-foreground text-right">
            {String(hour).padStart(2, '0')}:00
          </div>
          {days.map((day) => {
            const slotEvents = eventsForDayHour(day, hour).filter((e) => e.kind === 'meeting')
            return (
              <div key={day.toISOString()} className="p-0.5 space-y-0.5 border-l">
                {slotEvents.map((ev, i) => (
                  <EventChip key={i} event={ev} onClick={() => onEventClick(ev)} />
                ))}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── Main Page ──

export default function CalendarioPage() {
  const [view, setView] = useState<'month' | 'week'>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [newMeetingOpen, setNewMeetingOpen] = useState(false)
  const [meetingForm, setMeetingForm] = useState({
    title: '',
    scheduledAt: '',
    type: 'DEMO',
  })

  const queryClient = useQueryClient()

  // Date range for queries
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (view === 'month') {
      const ms = startOfMonth(currentDate)
      const me = endOfMonth(currentDate)
      return {
        rangeStart: startOfWeek(ms, { weekStartsOn: 0 }).toISOString(),
        rangeEnd: endOfWeek(me, { weekStartsOn: 0 }).toISOString(),
      }
    } else {
      return {
        rangeStart: startOfWeek(currentDate, { weekStartsOn: 0 }).toISOString(),
        rangeEnd: endOfWeek(currentDate, { weekStartsOn: 0 }).toISOString(),
      }
    }
  }, [view, currentDate])

  const { data: meetings = [] } = useQuery({
    queryKey: ['meetings', rangeStart, rangeEnd],
    queryFn: () => api.get<Meeting[]>(`/meetings?startDate=${rangeStart}&endDate=${rangeEnd}`),
  })

  const { data: tasks = [] } = useQuery({
    queryKey: ['calendar-tasks', rangeStart, rangeEnd],
    queryFn: () => api.get<CalTask[]>(`/tasks?startDate=${rangeStart}&endDate=${rangeEnd}`),
  })

  const createMeetingMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Meeting>('/meetings', body),
    onSuccess: () => {
      toast.success('Reunião criada!')
      setNewMeetingOpen(false)
      setMeetingForm({ title: '', scheduledAt: '', type: 'DEMO' })
      void queryClient.invalidateQueries({ queryKey: ['meetings'] })
    },
    onError: () => toast.error('Erro ao criar reunião'),
  })

  // Build unified events list
  const events: CalendarEvent[] = useMemo(() => {
    const meetingEvents: CalendarEvent[] = meetings.map((m) => ({
      kind: 'meeting' as const,
      date: m.scheduledAt,
      meeting: m,
    }))
    const taskEvents: CalendarEvent[] = tasks
      .filter((t) => t.dueDate !== null)
      .map((t) => ({
        kind: 'task' as const,
        date: t.dueDate!,
        task: t,
      }))
    return [...meetingEvents, ...taskEvents]
  }, [meetings, tasks])

  function handleEventClick(event: CalendarEvent) {
    setSelectedEvent(event)
    setSheetOpen(true)
  }

  function navigate(dir: 'prev' | 'next') {
    if (view === 'month') {
      setCurrentDate(dir === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1))
    } else {
      setCurrentDate(dir === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1))
    }
  }

  function periodLabel() {
    if (view === 'month') {
      return format(currentDate, 'MMMM yyyy', { locale: ptBR })
    } else {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 })
      const we = endOfWeek(currentDate, { weekStartsOn: 0 })
      return `${format(ws, 'd MMM', { locale: ptBR })} – ${format(we, 'd MMM yyyy', { locale: ptBR })}`
    }
  }

  function handleCreateMeeting(e: React.FormEvent) {
    e.preventDefault()
    if (!meetingForm.title.trim()) { toast.error('Título é obrigatório'); return }
    if (!meetingForm.scheduledAt) { toast.error('Data/hora é obrigatória'); return }
    createMeetingMutation.mutate({
      title: meetingForm.title,
      scheduledAt: new Date(meetingForm.scheduledAt).toISOString(),
      type: meetingForm.type,
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Calendário</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-md border overflow-hidden">
            <button
              className={cn('px-3 py-1.5 text-sm', view === 'month' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}
              onClick={() => setView('month')}
            >
              Mês
            </button>
            <button
              className={cn('px-3 py-1.5 text-sm border-l', view === 'week' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}
              onClick={() => setView('week')}
            >
              Semana
            </button>
          </div>
          <Button size="sm" onClick={() => setNewMeetingOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nova Reunião
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate('prev')}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="text-sm font-medium px-3" onClick={() => setCurrentDate(new Date())}>
          Hoje
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate('next')}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-base font-semibold capitalize">{periodLabel()}</span>
      </div>

      {/* Calendar */}
      {view === 'month' ? (
        <MonthView currentDate={currentDate} events={events} onEventClick={handleEventClick} />
      ) : (
        <WeekView currentDate={currentDate} events={events} onEventClick={handleEventClick} />
      )}

      {/* Event Detail Sheet */}
      <EventDetailSheet
        event={selectedEvent}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />

      {/* New Meeting Dialog */}
      <Dialog open={newMeetingOpen} onOpenChange={setNewMeetingOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Reunião</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateMeeting} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Ex: Demo com cliente"
                value={meetingForm.title}
                onChange={(e) => setMeetingForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data e Hora <span className="text-red-500">*</span></Label>
              <Input
                type="datetime-local"
                value={meetingForm.scheduledAt}
                onChange={(e) => setMeetingForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={meetingForm.type} onValueChange={(v) => setMeetingForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(meetingTypeLabels).map(([val, lbl]) => (
                    <SelectItem key={val} value={val}>{lbl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setNewMeetingOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={createMeetingMutation.isPending}>
                {createMeetingMutation.isPending
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</>
                  : 'Criar Reunião'
                }
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
