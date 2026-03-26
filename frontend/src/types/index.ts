// ─── ENUMS ────────────────────────────────────────────────────────

export type TenantPlan = 'FREE' | 'STANDARD' | 'PRO' | 'ENTERPRISE'
export type UserRole = 'ADMIN' | 'MANAGER' | 'SDR' | 'CLOSER' | 'VIEWER'
export type LeadStatus = 'NEW' | 'QUALIFIED' | 'DISQUALIFIED'
export type OpportunityStatus = 'OPEN' | 'WON' | 'LOST'
export type Temperature = 'COLD' | 'WARM' | 'HOT'
export type PipelineType = 'SALES' | 'TREATMENT' | 'RESCUE' | 'RELATIONSHIP' | 'CUSTOM'
export type TagCategory = 'QUALIFICATION' | 'TEMPERATURE' | 'STATUS' | 'CUSTOM'
export type CustomFieldType = 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DATE' | 'DATETIME' | 'SELECT' | 'MULTISELECT' | 'CHECKBOX' | 'URL' | 'PHONE' | 'EMAIL' | 'CURRENCY'
export type TaskType = 'FIRST_CONTACT' | 'FOLLOW_UP' | 'QUALIFY' | 'SCHEDULE_MEETING' | 'CONFIRM_PRESENCE' | 'PREPARE_BRIEFING' | 'SEND_PROPOSAL' | 'FOLLOW_UP_PROPOSAL' | 'CALL' | 'MEETING' | 'EMAIL' | 'REMINDER' | 'RESCUE_CONTACT' | 'CUSTOM'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'OVERDUE'
export type ActivityType = 'NOTE' | 'EMAIL' | 'CALL' | 'MEETING' | 'WHATSAPP_MESSAGE' | 'OPPORTUNITY_MOVED' | 'OPPORTUNITY_CREATED' | 'OPPORTUNITY_WON' | 'OPPORTUNITY_LOST' | 'TASK_COMPLETED' | 'FILE_UPLOADED' | 'AI_SUGGESTION' | 'STAGE_CHANGED' | 'HANDOFF'
export type WhatsappStatus = 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'ERROR'
export type MessageType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' | 'STICKER' | 'LOCATION'
export type MessageStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'
export type TranscriptionStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'ERROR'
export type NotificationType = 'TASK_DUE' | 'OPPORTUNITY_ASSIGNED' | 'WHATSAPP_MESSAGE' | 'AI_SUGGESTION' | 'REPORT_READY' | 'HANDOFF_RECEIVED' | 'SYSTEM'

// ─── TENANT ───────────────────────────────────────────────────────

export interface Tenant {
  id: string
  name: string
  slug: string
  plan: TenantPlan
  settings: Record<string, unknown> | null
  isActive: boolean
  createdAt: string
}

// ─── USER ─────────────────────────────────────────────────────────

export interface User {
  id: string
  tenantId: string
  email: string
  name: string
  avatarUrl: string | null
  role: UserRole
  isActive: boolean
  lastLoginAt: string | null
  permissions: string[]
  tenant?: Pick<Tenant, 'id' | 'name' | 'slug' | 'plan'>
  createdAt?: string
}

// ─── CONTACT ──────────────────────────────────────────────────────

export interface Contact {
  id: string
  tenantId: string
  name: string
  email: string | null
  phone: string | null
  cpfCnpj: string | null
  originId: string | null
  origin: Pick<Origin, 'id' | 'name'> | null
  subOriginId: string | null
  subOrigin: Pick<SubOrigin, 'id' | 'name'> | null
  companyId: string | null
  company: Pick<Company, 'id' | 'name'> | null
  firstContactDate: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  opportunities?: OpportunitySummary[]
  activities?: Activity[]
  tasks?: Task[]
}

// ─── COMPANY ──────────────────────────────────────────────────────

export interface Company {
  id: string
  tenantId: string
  name: string
  cnpj: string | null
  segment: string | null
  website: string | null
  address: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  _count?: { contacts: number; opportunities: number }
}

// ─── LEAD (pré-qualificação) ──────────────────────────────────────

export interface Lead {
  id: string
  tenantId: string
  contactId: string
  contact: Contact
  source: string | null
  status: LeadStatus
  score: number
  createdAt: string
  updatedAt: string
}

// ─── PIPELINE & STAGE ────────────────────────────────────────────

export interface Stage {
  id: string
  pipelineId: string
  name: string
  color: string
  sortOrder: number
  isWon: boolean
  isLost: boolean
  requiredFields: string[] | null
  visibleFields: string[] | null
  description: string | null
  createdAt: string
  _count?: { opportunities: number }
}

export interface Pipeline {
  id: string
  tenantId: string
  name: string
  prefix: string | null
  description: string | null
  type: PipelineType
  isActive: boolean
  sortOrder: number
  defaultCloseDays: number | null
  stages: Stage[]
  createdAt: string
  updatedAt: string
  _count?: { opportunities: number }
}

// ─── OPPORTUNITY ──────────────────────────────────────────────────

export type OpportunitySummary = {
  id: string
  title: string
  status: OpportunityStatus
  value: number | null
  stage: Pick<Stage, 'id' | 'name'>
  pipeline: Pick<Pipeline, 'id' | 'name'>
}

export interface Opportunity {
  id: string
  tenantId: string
  contactId: string
  contact: Pick<Contact, 'id' | 'name' | 'phone' | 'email'>
  companyId: string | null
  company: Pick<Company, 'id' | 'name'> | null
  pipelineId: string
  pipeline: Pick<Pipeline, 'id' | 'name' | 'prefix'>
  stageId: string
  stage: Pick<Stage, 'id' | 'name' | 'color'>
  assignedToId: string
  assignedTo: Pick<User, 'id' | 'name' | 'avatarUrl'>
  sdrId: string | null
  sdr: Pick<User, 'id' | 'name'> | null
  closerId: string | null
  closer: Pick<User, 'id' | 'name'> | null
  title: string
  value: number | null
  originId: string | null
  origin: Pick<Origin, 'id' | 'name'> | null
  subOriginId: string | null
  subOrigin: Pick<SubOrigin, 'id' | 'name'> | null
  expectedCloseDate: string | null
  closedAt: string | null
  lostReasonId: string | null
  lostReason: Pick<LostReason, 'id' | 'name'> | null
  rescueEligible: boolean
  temperature: Temperature | null
  qualificationScore: number | null
  position: number
  handoffAt: string | null
  sdrBriefing: string | null
  slaFirstContactAt: string | null
  status: OpportunityStatus
  notes: string | null
  createdAt: string
  updatedAt: string
  stageHistories?: StageHistory[]
  activities?: Activity[]
  tasks?: Task[]
}

export interface StageHistory {
  id: string
  opportunityId: string
  stageId: string
  stage: Pick<Stage, 'id' | 'name'>
  enteredAt: string
  exitedAt: string | null
  movedById: string
  movedBy: Pick<User, 'id' | 'name'>
  durationSeconds: number | null
}

// ─── ORIGIN ───────────────────────────────────────────────────────

export interface SubOrigin {
  id: string
  originId: string
  name: string
  isActive: boolean
  createdAt: string
}

export interface Origin {
  id: string
  tenantId: string
  name: string
  isActive: boolean
  subOrigins: SubOrigin[]
  createdAt: string
}

export interface LostReason {
  id: string
  tenantId: string
  name: string
  isActive: boolean
  createdAt: string
}

// ─── TAGS ─────────────────────────────────────────────────────────

export interface Tag {
  id: string
  tenantId: string
  name: string
  color: string
  category: TagCategory
  createdById: string
  isLocked: boolean
  createdAt: string
}

// ─── CAMPOS PERSONALIZADOS ────────────────────────────────────────

export interface CustomFieldOption {
  label: string
  value: string
}

// Simplified definition used by settings pages
export interface CustomFieldDefinition {
  id: string
  name: string
  label: string
  type: CustomFieldType
  required: boolean
  options: CustomFieldOption[] | null
  position: number
}

export interface CustomField {
  id: string
  groupId: string
  entityType: string
  name: string
  slug: string
  fieldType: CustomFieldType
  options: string[] | null
  isRequiredGlobal: boolean
  requiredInStages: string[] | null
  visibleInStages: string[] | null
  showInCard: boolean
  tooltip: string | null
  defaultValue: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
}

export interface CustomFieldGroup {
  id: string
  tenantId: string
  entityType: string
  name: string
  sortOrder: number
  isCollapsedByDefault: boolean
  customFields: CustomField[]
  createdAt: string
}

export interface CustomFieldValue {
  id: string
  customFieldId: string
  customField: Pick<CustomField, 'id' | 'name' | 'fieldType' | 'slug'>
  entityType: string
  entityId: string
  valueText: string | null
  valueNumber: number | null
  valueDate: string | null
  valueJson: unknown | null
  updatedAt: string
}

// ─── ATIVIDADES ───────────────────────────────────────────────────

export interface Activity {
  id: string
  tenantId: string
  type: ActivityType
  description: string
  metadata: Record<string, unknown> | null
  contactId: string | null
  contact: Pick<Contact, 'id' | 'name'> | null
  opportunityId: string | null
  opportunity: Pick<Opportunity, 'id' | 'title'> | null
  userId: string
  user: Pick<User, 'id' | 'name' | 'avatarUrl'>
  createdAt: string
}

// ─── TAREFAS ──────────────────────────────────────────────────────

export interface Task {
  id: string
  tenantId: string
  opportunityId: string | null
  opportunity: Pick<Opportunity, 'id' | 'title'> | null
  contactId: string | null
  contact: Pick<Contact, 'id' | 'name'> | null
  stageId: string | null
  stage: Pick<Stage, 'id' | 'name'> | null
  assignedToId: string
  assignedTo: Pick<User, 'id' | 'name' | 'avatarUrl'>
  createdById: string
  title: string
  description: string | null
  type: TaskType
  dueDate: string | null
  completedAt: string | null
  completionNotes: string | null
  isAutomated: boolean
  priority: TaskPriority
  status: TaskStatus
  createdAt: string
  updatedAt: string
}

// ─── WHATSAPP ─────────────────────────────────────────────────────

export interface WhatsappNumber {
  id: string
  tenantId: string
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
  contactId: string | null
  contact: Pick<Contact, 'id' | 'name' | 'phone'> | null
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

// ─── NOTIFICAÇÕES ─────────────────────────────────────────────────

export interface Notification {
  id: string
  tenantId: string
  userId: string
  type: NotificationType
  title: string
  body: string
  link: string | null
  isRead: boolean
  createdAt: string
}

// ─── TRANSCRICÕES ─────────────────────────────────────────────────

export interface CallTranscription {
  id: string
  tenantId: string
  title: string
  audioUrl: string | null
  transcript: string | null
  duration: number | null
  contactId: string | null
  opportunityId: string | null
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

// ─── DASHBOARD ────────────────────────────────────────────────────

export interface DashboardKPIs {
  openOpportunities: number
  wonThisMonth: number
  revenueWon: number
  lostThisMonth: number
  newContacts: number
  winRate: number
}

export interface PipelineStageSummary {
  stageId: string
  stageName: string
  color: string
  count: number
}

export interface PipelineSummary {
  pipelineId: string
  pipelineName: string
  openCount: number
  stages: PipelineStageSummary[]
}

export interface DashboardSummary {
  kpis: DashboardKPIs
  recentActivities: Activity[]
  upcomingTasks: Task[]
  pipelineSummary: PipelineSummary[]
}

// ─── RESPOSTAS PAGINADAS ──────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export interface ApiError {
  error: string
  details?: unknown
}
