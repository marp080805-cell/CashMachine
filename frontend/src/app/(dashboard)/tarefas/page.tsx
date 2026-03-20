'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { Task } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckSquare, Phone, Mail, Users, Calendar, FileText } from 'lucide-react'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import Link from 'next/link'

const taskTypeIcons: Record<string, React.ElementType> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Users,
  VISIT: Calendar,
  PROPOSAL: FileText,
  FOLLOW_UP: Phone,
  OTHER: FileText,
}

type FilterTab = 'today' | 'week' | 'overdue' | 'all'

function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date() && !isTaskToday(dueDate)
}

function isTaskToday(dueDate: string): boolean {
  return new Date(dueDate).toDateString() === new Date().toDateString()
}

export default function TarefasPage() {
  const [filter, setFilter] = useState<FilterTab>('today')
  const queryClient = useQueryClient()

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', filter],
    queryFn: () =>
      api.get<Task[]>(`/tasks?filter=${filter}`),
  })

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/tasks/${id}/complete`),
    onSuccess: () => {
      toast.success('Tarefa concluída!')
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: () => toast.error('Erro ao completar tarefa'),
  })

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'today', label: 'Hoje' },
    { key: 'week', label: 'Esta Semana' },
    { key: 'overdue', label: 'Atrasadas' },
    { key: 'all', label: 'Todas' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                filter === tab.key
                  ? 'bg-white shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Button size="sm">Nova Tarefa</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : tasks?.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma tarefa neste período</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks?.map((task) => {
            const Icon = taskTypeIcons[task.type] ?? FileText
            const overdueTask = isOverdue(task.dueDate)
            const todayTask = isTaskToday(task.dueDate)

            return (
              <div
                key={task.id}
                className={cn(
                  'flex items-center gap-4 rounded-lg border bg-white p-4',
                  task.isCompleted && 'opacity-60',
                  overdueTask && !task.isCompleted && 'border-red-200',
                  todayTask && !task.isCompleted && !overdueTask && 'border-amber-200'
                )}
              >
                <button
                  onClick={() => !task.isCompleted && completeMutation.mutate(task.id)}
                  disabled={task.isCompleted || completeMutation.isPending}
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
                    task.isCompleted
                      ? 'border-primary bg-primary text-white'
                      : 'border-muted-foreground hover:border-primary'
                  )}
                >
                  {task.isCompleted && <CheckSquare className="h-3 w-3" />}
                </button>

                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', task.isCompleted && 'line-through')}>{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    {task.lead && (
                      <Link href={`/leads/${task.lead.id}`} className="hover:underline text-primary">
                        {task.lead.name}
                      </Link>
                    )}
                    {task.deal && <span>{task.deal.title}</span>}
                    <span>·</span>
                    <span>{formatDateTime(task.dueDate)}</span>
                  </div>
                </div>

                <Badge
                  variant={
                    task.isCompleted ? 'success' : overdueTask ? 'danger' : todayTask ? 'warning' : 'secondary'
                  }
                  className="shrink-0"
                >
                  {task.isCompleted ? 'Concluída' : overdueTask ? 'Atrasada' : todayTask ? 'Hoje' : 'Futura'}
                </Badge>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
