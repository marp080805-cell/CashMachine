export type UserRole = 'ADMIN' | 'GESTOR' | 'SDR' | 'CLOSER'
export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'UNQUALIFIED' | 'CUSTOMER' | 'LOST'
export type DealStatus = 'OPEN' | 'WON' | 'LOST' | 'FROZEN'
export type FunnelType = 'PROSPECTING' | 'SALES' | 'POST_SALES' | 'CUSTOM'
export type TaskType = 'CALL' | 'EMAIL' | 'MEETING' | 'VISIT' | 'PROPOSAL' | 'FOLLOW_UP' | 'OTHER'
export type ActivityType = 'NOTE' | 'EMAIL' | 'CALL' | 'MEETING' | 'WHATSAPP_MESSAGE' | 'DEAL_MOVED' | 'DEAL_CREATED' | 'DEAL_WON' | 'DEAL_LOST' | 'TASK_COMPLETED' | 'FILE_UPLOADED' | 'AI_SUGGESTION'
export type ChannelType = 'ONLINE_PAID' | 'ONLINE_ORGANIC' | 'PRESENTIAL_EVENT' | 'PRESENTIAL_COMMUNITY' | 'OFFLINE_REFERRAL_PARTNER' | 'OFFLINE_REFERRAL_CLIENT' | 'OUTBOUND' | 'CUSTOM'
export type ChannelStatus = 'ACTIVE' | 'PAUSED' | 'TESTING' | 'INACTIVE'
export type WhatsappStatus = 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'ERROR'
export type MessageType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' | 'STICKER' | 'LOCATION'
export type MessageStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'
export type TranscriptionStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'ERROR'
export type NotificationType = 'TASK_DUE' | 'DEAL_ASSIGNED' | 'WHATSAPP_MESSAGE' | 'AI_SUGGESTION' | 'REPORT_READY' | 'SYSTEM'

export interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  role: UserRole
  isActive: boolean
  teamId: string | null
  permissions: string[]
  createdAt?: string
  updatedAt?: string
}

export interface Team {
  id: string
  name: string
  createdAt: string
}

export interface Company {
  id: string
  name: string
  cnpj: string | null
  website: string | null
  segment: string | null
  city: string | null
  state: string | null
  createdAt: string
  updatedAt: string
}

export interface Channel {
  id: string
  name: string
  type: ChannelType
  status: ChannelStatus
  priority: number
  cplTarget: number | null
  cacTarget: number | null
  leadToCallRate: number
  callToContractRate: number
  createdAt: string
  updatedAt: string
}

export interface ChannelMetric {
  id: string
  channelId: string
  month: number
  year: number
  leadsGoal: number
  leadsGenerated: number
  totalCost: number
  callsReal: number
  contractsReal: number
  callsEstimated: number
  contractsEstimated: number
  createdAt: string
  updatedAt: string
}

export interface Lead {
  id: string
  name: string
  email: string | null
  phone: string | null
  whatsapp: string | null
  position: string | null
  companyId: string | null
  company: Pick<Company, 'id' | 'name'> | null
  channelId: string | null
  channel: Pick<Channel, 'id' | 'name'> | null
  status: LeadStatus
  tags: string[]
  notes: string | null
  customFields: Record<string, unknown> | null
  createdById: string
  createdBy: Pick<User, 'id' | 'name' | 'avatarUrl'>
  createdAt: string
  updatedAt: string
}

export interface FunnelStage {
  id: string
  name: string
  position: number
  color: string
  funnelId: string
  createdAt: string
}

export interface Funnel {
  id: string
  name: string
  description: string | null
  type: FunnelType
  isActive: boolean
  position: number
  stages: FunnelStage[]
  createdAt: string
  updatedAt: string
  _count?: { deals: number }
}

export interface Deal {
  id: string
  title: string
  value: number | null
  probability: number | null
  expectedClose: string | null
  status: DealStatus
  lossReason: string | null
  notes: string | null
  isFrozen: boolean
  funnelId: string
  funnel: Pick<Funnel, 'id' | 'name'>
  stageId: string
  stage: Pick<FunnelStage, 'id' | 'name' | 'color'>
  leadId: string | null
  lead: Pick<Lead, 'id' | 'name'> | null
  companyId: string | null
  company: Pick<Company, 'id' | 'name'> | null
  assignedToId: string
  assignedTo: Pick<User, 'id' | 'name' | 'avatarUrl'>
  createdAt: string
  updatedAt: string
}

export interface Activity {
  id: string
  type: ActivityType
  description: string
  metadata: Record<string, unknown> | null
  leadId: string | null
  lead: Pick<Lead, 'id' | 'name'> | null
  dealId: string | null
  deal: Pick<Deal, 'id' | 'title'> | null
  userId: string
  user: Pick<User, 'id' | 'name' | 'avatarUrl'>
  createdAt: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  type: TaskType
  dueDate: string
  isCompleted: boolean
  completedAt: string | null
  leadId: string | null
  lead: Pick<Lead, 'id' | 'name'> | null
  dealId: string | null
  deal: Pick<Deal, 'id' | 'title'> | null
  assignedToId: string
  assignedTo: Pick<User, 'id' | 'name' | 'avatarUrl'>
  createdAt: string
  updatedAt: string
}

export interface WhatsappNumber {
  id: string
  phone: string
  instanceName: string
  status: WhatsappStatus
  userId: string
  user: Pick<User, 'id' | 'name'>
  createdAt: string
  updatedAt: string
}

export interface WhatsappConversation {
  id: string
  remoteJid: string
  remotePhone: string
  remoteName: string | null
  remoteAvatar: string | null
  numberId: string
  number: Pick<WhatsappNumber, 'id' | 'phone' | 'status'>
  leadId: string | null
  lead: Pick<Lead, 'id' | 'name' | 'status'> | null
  lastMessage: string | null
  lastMessageAt: string | null
  unreadCount: number
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

export interface WhatsappMessage {
  id: string
  remoteId: string
  conversationId: string
  content: string | null
  type: MessageType
  mediaUrl: string | null
  fromMe: boolean
  status: MessageStatus
  aiSuggestion: string | null
  aiSuggestionUsed: boolean
  timestamp: string
  createdAt: string
}

export interface CallTranscription {
  id: string
  title: string
  audioUrl: string | null
  transcript: string | null
  duration: number | null
  leadId: string | null
  dealId: string | null
  analysis: CallAnalysis | null
  status: TranscriptionStatus
  uploadedById: string
  createdAt: string
  updatedAt: string
}

export interface CallAnalysis {
  pontos_positivos: string[]
  objecoes: string[]
  oportunidades_perdidas: string[]
  proximo_passo: string
  score: number
  justificativa_score: string
}

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  link: string | null
  isRead: boolean
  createdAt: string
}

export interface DashboardKPIs {
  leadsThisMonth: number
  leadsGoal: number
  leadsAttainment: number
  callsThisMonth: number
  contractsThisMonth: number
  contractsGoal: number
  totalCost: number
  cplAverage: number
  cacAverage: number
  conversionRate: number
}

export interface ChannelPerformance {
  channelId: string
  channelName: string
  leadsGenerated: number
  leadsGoal: number
  attainment: number
  cost: number
  cpl: number
  delta: number
}

export interface MonthlyTrend {
  month: string
  leads: number
  contracts: number
  cost: number
}

export interface TeamPerformance {
  userId: string
  userName: string
  leadsCreated: number
  dealsCreated: number
  tasksCompleted: number
  callsMade: number
}

export interface DashboardSummary {
  period: { month: number; year: number }
  kpis: DashboardKPIs
  channelPerformance: ChannelPerformance[]
  monthlyTrend: MonthlyTrend[]
  teamPerformance: TeamPerformance[]
  recentActivities: Activity[]
  upcomingTasks: Task[]
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface ApiError {
  error: string
  details?: unknown
}

// ─── PERSONALIZAÇÃO ──────────────────────────────────────────────

export type CustomFieldType = 'TEXT' | 'NUMBER' | 'SELECT' | 'MULTI_SELECT' | 'DATE' | 'BOOLEAN' | 'URL'
export type GoalPeriod = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'

export interface CustomFieldOption {
  label: string
  value: string
}

export interface CustomFieldDefinition {
  id: string
  name: string
  label: string
  type: CustomFieldType
  entity: string
  options: CustomFieldOption[] | null
  required: boolean
  position: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface DashboardWidget {
  id: string
  type: 'kpi' | 'chart' | 'table' | 'list'
  label: string
  enabled: boolean
  position: number
}

export interface Goal {
  id: string
  name: string
  metric: string
  target: number
  period: GoalPeriod
  month: number | null
  year: number
  channelId: string | null
  channel: Pick<Channel, 'id' | 'name'> | null
  createdById: string
  createdAt: string
  updatedAt: string
}
