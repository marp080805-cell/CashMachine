import { MessageSquare, Phone, Mail, FileText, Star, ArrowRight, CheckSquare, Mic } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatRelativeDate, getInitials } from '@/lib/utils'
import type { Activity, ActivityType } from '@/types'

const activityIcons: Record<ActivityType, React.ElementType> = {
  NOTE: FileText,
  EMAIL: Mail,
  CALL: Phone,
  MEETING: Star,
  WHATSAPP_MESSAGE: MessageSquare,
  DEAL_MOVED: ArrowRight,
  DEAL_CREATED: Star,
  DEAL_WON: CheckSquare,
  DEAL_LOST: FileText,
  TASK_COMPLETED: CheckSquare,
  FILE_UPLOADED: FileText,
  AI_SUGGESTION: Mic,
}

const activityColors: Record<ActivityType, string> = {
  NOTE: 'text-blue-500 bg-blue-50',
  EMAIL: 'text-purple-500 bg-purple-50',
  CALL: 'text-green-500 bg-green-50',
  MEETING: 'text-amber-500 bg-amber-50',
  WHATSAPP_MESSAGE: 'text-emerald-500 bg-emerald-50',
  DEAL_MOVED: 'text-indigo-500 bg-indigo-50',
  DEAL_CREATED: 'text-indigo-500 bg-indigo-50',
  DEAL_WON: 'text-green-500 bg-green-50',
  DEAL_LOST: 'text-red-500 bg-red-50',
  TASK_COMPLETED: 'text-teal-500 bg-teal-50',
  FILE_UPLOADED: 'text-muted-foreground bg-muted',
  AI_SUGGESTION: 'text-violet-500 bg-violet-50',
}

interface RecentActivitiesProps {
  activities: Activity[]
}

export function RecentActivities({ activities }: RecentActivitiesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Atividades Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade recente</p>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => {
              const Icon = activityIcons[activity.type] ?? FileText
              const colorClass = activityColors[activity.type] ?? 'text-muted-foreground bg-muted'

              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground line-clamp-2">{activity.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={activity.user.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-[8px]">{getInitials(activity.user.name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">{activity.user.name}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{formatRelativeDate(activity.createdAt)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
