# DATABASE TASKS — CashMind CRM

**Repositório:** c:/Users/marp0/OneDrive/Área de Trabalho/Projetos Ativos/Claude Code/CashMind/CashMachine
**Schema:** backend/prisma/schema.prisma
**Referência:** .claude/specs/spec_2026-03-26.md

---

## ESTADO ATUAL DO SCHEMA

Já existem no schema.prisma:
- Tenant, User (roles: ADMIN/MANAGER/SDR/CLOSER/VIEWER)
- Contact (sem: dateOfBirth, cpf separado do cnpj, address JSON, socialProfiles, isBlacklisted)
- Company (sem: phone, employeeCount, annualRevenue, address JSON)
- Lead (sem: sourceDetail, nurturing status, qualifiedAt, disqualifiedReason, convertedToOpportunityId)
- Pipeline (sem: sdrStages, closerStages, handoffStageId, handoffRequiredFields, autoAssignCloser, roundRobinUserIds)
- Stage (sem: type ENUM won/lost/normal, probability, autoCreateTasks)
- Opportunity (sem: monthlyValue, installments, installmentValue, paymentDetails, channel, lostReasonDetail, qualificationNotes, firstContactDate, scheduledDate, attendedDate, proposalSentDate, wonDate, lostDate, nextMeetingId, tags relation)
- StageHistory (existe)
- CustomFieldGroup, CustomField, CustomFieldValue (existem)
- Origin, SubOrigin, LostReason, Tag, TagAssignment (existem)
- Task (sem: dueDateRelativeTo, dueOffsetMinutes, completedBy relation, slaMinutes, slaBreach, automationId, meetingId, npsFollowUp, sendRecordingAction)
- TaskTemplate (NÃO existe)
- WhatsappNumber, WhatsappConversation, WhatsappMessage (existem — modelo antigo, precisa de Conversation/Message novo)
- CallTranscription (existe — modelo simplificado, spec pede Recording com mais campos)
- Activity, Notification (existem)

**NÃO existem ainda:**
- Meeting, CalendarIntegration, UserAvailability, BookingPage
- StageTrigger, StageTriggerLog
- SalesBot, SalesBotExecution
- Conversation (novo modelo), Message (novo modelo), MessageTemplate
- AIAgent, AISuggestion
- Recording (substitui/expande CallTranscription)
- Goal, GoalBreakdown
- DailyMetrics
- Form, FormSubmission
- AccountTemplate
- OpportunityAssignment
- Campos extras em Tenant (openaiApiKey, openaiModel)

---

## TAREFAS (em ordem de dependência)

### TASK DB-1 — Expandir model Tenant
**Complexidade:** Baixa
**Arquivo:** backend/prisma/schema.prisma
**O que fazer:**
Adicionar campos ao model Tenant:
```prisma
openaiApiKey  String?   // chave OpenAI do cliente (encryptada)
openaiModel   String?   @default("gpt-4o")
```
Também atualizar enum TenantPlan para substituir STANDARD por STARTER:
```prisma
enum TenantPlan {
  FREE
  STARTER
  PRO
  ENTERPRISE
}
```
**Dependências:** nenhuma

---

### TASK DB-2 — Expandir model Contact
**Complexidade:** Baixa
**Arquivo:** backend/prisma/schema.prisma
**O que fazer:**
Adicionar campos ao model Contact:
```prisma
cpf           String?
dateOfBirth   DateTime?
avatarUrl     String?
address       Json?     // {street, number, complement, city, state, zip, country}
socialProfiles Json?    // {instagram, linkedin, facebook, tiktok}
isBlacklisted Boolean   @default(false)
```
Renomear cpfCnpj para cpf (manter compatibilidade ou criar migration manual).
Adicionar relações:
```prisma
tagAssignments TagAssignment[]
customFieldValues CustomFieldValue[]
```
**Dependências:** nenhuma

---

### TASK DB-3 — Expandir model Company
**Complexidade:** Baixa
**Arquivo:** backend/prisma/schema.prisma
**O que fazer:**
Adicionar campos ao model Company:
```prisma
phone          String?
employeeCount  Int?
annualRevenue  Decimal?  @db.Decimal(15, 2)
addressJson    Json?     // renomear address (String?) para addressJson
```
Adicionar relação:
```prisma
customFieldValues CustomFieldValue[]
```
**Dependências:** nenhuma

---

### TASK DB-4 — Expandir model Lead
**Complexidade:** Baixa
**Arquivo:** backend/prisma/schema.prisma
**O que fazer:**
Adicionar campos ao model Lead:
```prisma
sourceDetail              String?
qualifiedAt               DateTime?
disqualifiedReason        String?
convertedToOpportunityId  String?
```
Adicionar à enum LeadStatus:
```prisma
enum LeadStatus {
  NEW
  NURTURING
  QUALIFIED
  DISQUALIFIED
}
```
**Dependências:** nenhuma

---

### TASK DB-5 — Expandir models Pipeline e Stage
**Complexidade:** Média
**Arquivo:** backend/prisma/schema.prisma
**O que fazer:**

Em Pipeline, adicionar:
```prisma
sdrStages             Json?   // array de stage_ids
closerStages          Json?   // array de stage_ids
handoffStageId        String?
handoffRequiredFields Json?   // array de field_slugs
autoAssignCloser      AutoAssignMode @default(MANUAL)
fixedCloserId         String?
roundRobinUserIds     Json?   // array de user_ids
```
Adicionar enum:
```prisma
enum AutoAssignMode {
  MANUAL
  ROUND_ROBIN
  BY_SPECIALTY
  FIXED
}
```

Em Stage, modificar isWon/isLost para usar enum type:
```prisma
type      StageType @default(NORMAL)
probability Int     @default(0)
autoCreateTasks Json? // array de TaskTemplate configs
```
Adicionar enum:
```prisma
enum StageType {
  NORMAL
  WON
  LOST
}
```
Manter isWon e isLost como computed ou mantê-los para retrocompatibilidade.

Adicionar relações em Pipeline:
```prisma
stageTriggers StageTrigger[]
```
Adicionar relações em Stage:
```prisma
stageTriggers StageTrigger[]
```

**Dependências:** nenhuma

---

### TASK DB-6 — Expandir model Opportunity
**Complexidade:** Média
**Arquivo:** backend/prisma/schema.prisma
**O que fazer:**
Adicionar campos ao model Opportunity:
```prisma
monthlyValue       Decimal?   @db.Decimal(12, 2)
installments       Int?
installmentValue   Decimal?   @db.Decimal(12, 2)
paymentDetails     Json?
channel            String?
lostReasonDetail   String?
qualificationNotes String?
firstContactDate   DateTime?
scheduledDate      DateTime?
attendedDate       DateTime?
proposalSentDate   DateTime?
wonDate            DateTime?
lostDate           DateTime?
nextMeetingId      String?    // FK para Meeting (adicionado em DB-8)
```
Adicionar relações:
```prisma
tagAssignments    TagAssignment[]
customFieldValues CustomFieldValue[]
meetings          Meeting[]
assignments       OpportunityAssignment[]
```
**Dependências:** DB-8 (para nextMeeting FK)

---

### TASK DB-7 — Criar model TaskTemplate e expandir Task
**Complexidade:** Média
**Arquivo:** backend/prisma/schema.prisma
**O que fazer:**

Criar model TaskTemplate:
```prisma
model TaskTemplate {
  id                   String         @id @default(uuid())
  tenantId             String
  tenant               Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name                 String
  type                 TaskType
  titleTemplate        String
  descriptionTemplate  String?
  defaultPriority      TaskPriority   @default(MEDIUM)
  dueDateRelativeTo    String?        // "opportunity_created"|"stage_entered"|"meeting_date"|"custom_field_date"
  dueOffsetMinutes     Int?
  slaMinutes           Int?
  assignedRole         String?        // "sdr"|"closer"|"manager"|"auto_round_robin"
  createdAt            DateTime       @default(now())

  tasks Task[]

  @@index([tenantId])
  @@map("task_templates")
}
```

Adicionar ao model Tenant: `taskTemplates TaskTemplate[]`

Expandir model Task:
```prisma
dueDateRelativeTo String?   // "opportunity_created"|"stage_entered"|"meeting_date"
dueOffsetMinutes  Int?
completedById     String?
completedBy       User?     @relation("CompletedTasks", fields: [completedById], references: [id])
slaMinutes        Int?
slaBreach         Boolean   @default(false)
automationId      String?   // FK para StageTrigger (adicionado em DB-10)
meetingId         String?   // FK para Meeting (adicionado em DB-8)
templateId        String?
template          TaskTemplate? @relation(fields: [templateId], references: [id])
```
Adicionar à enum TaskType: `NPS_FOLLOW_UP` e `SEND_RECORDING_ACTION`
Adicionar relação ao User: `completedTasks Task[] @relation("CompletedTasks")`

**Dependências:** DB-8 (para meetingId)

---

### TASK DB-8 — Criar models Meeting, CalendarIntegration, UserAvailability, BookingPage
**Complexidade:** Alta
**Arquivo:** backend/prisma/schema.prisma
**O que fazer:**

```prisma
model CalendarIntegration {
  id             String   @id @default(uuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider       CalendarProvider
  accessToken    String   // encryptado
  refreshToken   String?  // encryptado
  calendarId     String?
  isActive       Boolean  @default(true)
  connectedAt    DateTime @default(now())
  lastSyncedAt   DateTime?

  @@unique([userId, provider])
  @@index([userId])
  @@map("calendar_integrations")
}

enum CalendarProvider {
  GOOGLE_CALENDAR
  OUTLOOK
}

model UserAvailability {
  id                  String  @id @default(uuid())
  userId              String
  user                User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  dayOfWeek           DayOfWeek
  startTime           String  // "08:00"
  endTime             String  // "18:00"
  slotDurationMinutes Int     @default(60)
  bufferMinutes       Int     @default(15)
  isActive            Boolean @default(true)
  overrides           Json?   // bloqueios por data

  @@index([userId])
  @@map("user_availabilities")
}

enum DayOfWeek {
  MON
  TUE
  WED
  THU
  FRI
  SAT
  SUN
}

model Meeting {
  id                 String         @id @default(uuid())
  tenantId           String
  tenant             Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  opportunityId      String
  opportunity        Opportunity    @relation(fields: [opportunityId], references: [id])
  contactId          String
  contact            Contact        @relation(fields: [contactId], references: [id])
  organizerId        String
  organizer          User           @relation("OrganizedMeetings", fields: [organizerId], references: [id])
  hostId             String
  host               User           @relation("HostedMeetings", fields: [hostId], references: [id])
  title              String
  description        String?
  meetingType        MeetingType    @default(INITIAL_CONSULTATION)
  startDatetime      DateTime
  endDatetime        DateTime
  durationMinutes    Int            @default(60)
  locationType       LocationType   @default(VIDEO_CALL)
  locationDetails    String?
  videoLink          String?
  status             MeetingStatus  @default(SCHEDULED)
  confirmedAt        DateTime?
  rescheduledFromId  String?
  rescheduledFrom    Meeting?       @relation("Rescheduled", fields: [rescheduledFromId], references: [id])
  reschedulings      Meeting[]      @relation("Rescheduled")
  externalEventId    String?
  sdrBriefing        String?
  closerNotes        String?
  outcome            MeetingOutcome?
  recordingId        String?        // FK para Recording
  createdAt          DateTime       @default(now())
  updatedAt          DateTime       @updatedAt

  tasks Task[]

  @@index([tenantId])
  @@index([opportunityId])
  @@index([hostId])
  @@index([startDatetime])
  @@map("meetings")
}

enum MeetingType {
  INITIAL_CONSULTATION
  FOLLOW_UP_MEETING
  PROPOSAL_PRESENTATION
  CLOSING_MEETING
  ONBOARDING
  RETURN_VISIT
  CUSTOM
}

enum LocationType {
  IN_PERSON
  VIDEO_CALL
  PHONE_CALL
}

enum MeetingStatus {
  SCHEDULED
  CONFIRMED
  RESCHEDULED
  NO_SHOW
  CANCELLED
  COMPLETED
}

enum MeetingOutcome {
  POSITIVE
  NEUTRAL
  NEGATIVE
}

model BookingPage {
  id                  String   @id @default(uuid())
  tenantId            String
  tenant              Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  hostId              String
  host                User     @relation("BookingPages", fields: [hostId], references: [id])
  slug                String
  title               String
  description         String?
  meetingType         MeetingType @default(INITIAL_CONSULTATION)
  durationMinutes     Int      @default(60)
  pipelineId          String?
  stageId             String?
  requiredFields      Json?
  confirmationMessage String?
  reminderConfig      Json?
  styling             Json?
  isActive            Boolean  @default(true)
  createdAt           DateTime @default(now())

  @@unique([tenantId, slug])
  @@index([tenantId])
  @@map("booking_pages")
}
```

Adicionar relações em User:
```prisma
calendarIntegrations CalendarIntegration[]
userAvailabilities   UserAvailability[]
organizedMeetings    Meeting[]    @relation("OrganizedMeetings")
hostedMeetings       Meeting[]    @relation("HostedMeetings")
bookingPages         BookingPage[] @relation("BookingPages")
```

Adicionar em Tenant:
```prisma
meetings    Meeting[]
bookingPages BookingPage[]
```

Adicionar em Contact: `meetings Meeting[]`

**Dependências:** DB-6 (Opportunity.meetings)

---

### TASK DB-9 — Criar model OpportunityAssignment
**Complexidade:** Baixa
**Arquivo:** backend/prisma/schema.prisma
**O que fazer:**

```prisma
model OpportunityAssignment {
  id            String   @id @default(uuid())
  opportunityId String
  opportunity   Opportunity @relation(fields: [opportunityId], references: [id], onDelete: Cascade)
  userId        String
  user          User     @relation("OpportunityAssignments", fields: [userId], references: [id])
  role          AssignmentRole
  assignedAt    DateTime @default(now())
  unassignedAt  DateTime?
  assignedById  String
  assignedBy    User     @relation("AssignedByAssignments", fields: [assignedById], references: [id])
  isCurrent     Boolean  @default(true)

  @@index([opportunityId])
  @@index([userId])
  @@map("opportunity_assignments")
}

enum AssignmentRole {
  SDR
  CLOSER
  MANAGER
}
```

Adicionar em User:
```prisma
opportunityAssignments    OpportunityAssignment[] @relation("OpportunityAssignments")
assignedByAssignments     OpportunityAssignment[] @relation("AssignedByAssignments")
```

**Dependências:** DB-6

---

### TASK DB-10 — Criar models StageTrigger e StageTriggerLog
**Complexidade:** Alta
**Arquivo:** backend/prisma/schema.prisma
**O que fazer:**

```prisma
model StageTrigger {
  id                  String        @id @default(uuid())
  stageId             String
  stage               Stage         @relation(fields: [stageId], references: [id], onDelete: Cascade)
  pipelineId          String
  pipeline            Pipeline      @relation(fields: [pipelineId], references: [id], onDelete: Cascade)
  tenantId            String
  tenant              Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name                String
  isActive            Boolean       @default(true)
  sortOrder           Int           @default(0)
  applyToExisting     Boolean       @default(false)
  triggerEvent        TriggerEvent
  triggerConfig       Json?         // {delay_minutes: X} or {cron: "..."} etc.
  conditions          Json?         // array de condições
  actionType          TriggerActionType
  actionConfig        Json?
  activeHours         Json?         // {enabled, timezone, schedule, outside_hours_action}
  executionCount      Int           @default(0)
  lastExecutedAt      DateTime?
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  logs StageTriggerLog[]

  @@index([tenantId])
  @@index([stageId])
  @@index([pipelineId])
  @@map("stage_triggers")
}

enum TriggerEvent {
  ON_ENTER
  ON_EXIT
  ON_CREATE_IN_STAGE
  ON_ENTER_OR_CREATE
  ON_RESPONSIBLE_CHANGED
  AFTER_TIME_IN_STAGE
  ON_FIELD_CHANGED
  ON_MESSAGE_RECEIVED
  ON_MESSAGE_READ
  SCHEDULED
}

enum TriggerActionType {
  SALESBOT
  CREATE_TASK
  SEND_EMAIL
  SEND_MESSAGE
  CHANGE_RESPONSIBLE
  CHANGE_STAGE
  MOVE_TO_PIPELINE
  SET_FIELD
  ADD_TAG
  REMOVE_TAG
  CREATE_OPPORTUNITY
  WEBHOOK
  NOTIFY_USER
  AI_SUGGEST_RESPONSE
  SCHEDULE_MEETING
  DUPLICATE_TO_PIPELINE
}

model StageTriggerLog {
  id             String        @id @default(uuid())
  triggerId      String
  trigger        StageTrigger  @relation(fields: [triggerId], references: [id], onDelete: Cascade)
  opportunityId  String
  opportunity    Opportunity   @relation(fields: [opportunityId], references: [id], onDelete: Cascade)
  status         TriggerLogStatus
  executedAt     DateTime      @default(now())
  skippedReason  String?
  errorMessage   String?
  actionResult   Json?
  durationMs     Int?

  @@index([triggerId])
  @@index([opportunityId])
  @@map("stage_trigger_logs")
}

enum TriggerLogStatus {
  SUCCESS
  FAILED
  SKIPPED
  QUEUED
}
```

Adicionar em Tenant: `stageTriggers StageTrigger[]`
Adicionar em Opportunity: `stageTriggerLogs StageTriggerLog[]`

**Dependências:** DB-5 (Pipeline e Stage expandidos)

---

### TASK DB-11 — Criar models SalesBot e SalesBotExecution
**Complexidade:** Alta
**Arquivo:** backend/prisma/schema.prisma
**O que fazer:**

```prisma
model SalesBot {
  id               String       @id @default(uuid())
  tenantId         String
  tenant           Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name             String
  description      String?
  isActive         Boolean      @default(true)
  type             SalesBotType @default(CONVERSATION_BOT)
  steps            Json         // árvore de steps do builder visual
  entryPoint       String       // ID do primeiro step
  variables        Json?        // variáveis customizadas do bot
  createdById      String
  createdBy        User         @relation("CreatedBots", fields: [createdById], references: [id])
  exportJson       String?
  executionCount   Int          @default(0)
  lastExecutedAt   DateTime?
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  executions SalesBotExecution[]

  @@index([tenantId])
  @@map("sales_bots")
}

enum SalesBotType {
  CONVERSATION_BOT
  INTERNAL_WORKFLOW
  HYBRID
}

model SalesBotExecution {
  id             String              @id @default(uuid())
  botId          String
  bot            SalesBot            @relation(fields: [botId], references: [id])
  opportunityId  String
  opportunity    Opportunity         @relation(fields: [opportunityId], references: [id])
  contactId      String
  contact        Contact             @relation(fields: [contactId], references: [id])
  status         BotExecutionStatus  @default(RUNNING)
  currentStepId  String?
  startedAt      DateTime            @default(now())
  completedAt    DateTime?
  pausedReason   String?
  stepHistory    Json?               // log de cada step
  createdAt      DateTime            @default(now())

  @@index([botId])
  @@index([opportunityId])
  @@map("sales_bot_executions")
}

enum BotExecutionStatus {
  RUNNING
  COMPLETED
  PAUSED
  FAILED
  STOPPED_BY_HUMAN
}
```

Adicionar em Tenant: `salesBots SalesBot[]`
Adicionar em User: `createdBots SalesBot[] @relation("CreatedBots")`
Adicionar em Opportunity: `salesBotExecutions SalesBotExecution[]`
Adicionar em Contact: `salesBotExecutions SalesBotExecution[]`

**Dependências:** DB-5, DB-6

---

### TASK DB-12 — Criar models Conversation, Message, MessageTemplate (novo modelo)
**Complexidade:** Média
**Arquivo:** backend/prisma/schema.prisma
**Nota:** O WhatsApp atual usa WhatsappConversation/WhatsappMessage. O spec pede um modelo mais genérico. Criar NOVOS models sem remover os antigos para não quebrar código existente.
**O que fazer:**

```prisma
model MessageTemplate {
  id          String          @id @default(uuid())
  tenantId    String
  tenant      Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name        String
  channel     MessageChannel  @default(WHATSAPP)
  body        String
  hasButtons  Boolean         @default(false)
  buttons     Json?           // [{label, value}, ...]
  mediaUrl    String?
  createdAt   DateTime        @default(now())

  @@index([tenantId])
  @@map("message_templates")
}

enum MessageChannel {
  WHATSAPP
  EMAIL
  SMS
  INSTAGRAM
  WEBCHAT
}

model Conversation {
  id             String              @id @default(uuid())
  tenantId       String
  tenant         Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  contactId      String
  contact        Contact             @relation("ContactConversations", fields: [contactId], references: [id])
  opportunityId  String?
  opportunity    Opportunity?        @relation("OpportunityConversations", fields: [opportunityId], references: [id])
  channel        MessageChannel      @default(WHATSAPP)
  status         ConversationStatus  @default(OPEN)
  assignedToId   String?
  assignedTo     User?               @relation("ConversationAssignees", fields: [assignedToId], references: [id])
  aiEnabled      Boolean             @default(false)
  aiAgentId      String?             // FK para AIAgent
  lastMessageAt  DateTime?
  createdAt      DateTime            @default(now())

  messages Message[]

  @@index([tenantId])
  @@index([contactId])
  @@map("conversations")
}

enum ConversationStatus {
  OPEN
  WAITING
  CLOSED
}

model Message {
  id                    String        @id @default(uuid())
  conversationId        String
  conversation          Conversation  @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  direction             MessageDirection
  content               String?
  mediaUrl              String?
  sentBy                MessageSender @default(USER)
  sentByUserId          String?
  sentByUser            User?         @relation("SentMessages", fields: [sentByUserId], references: [id])
  aiSuggested           Boolean       @default(false)
  aiOriginalSuggestion  String?
  aiWasEdited           Boolean       @default(false)
  status                MessageStatus @default(SENT)
  externalId            String?
  createdAt             DateTime      @default(now())

  @@index([conversationId])
  @@map("messages")
}

enum MessageDirection {
  INBOUND
  OUTBOUND
}

enum MessageSender {
  USER
  AUTOMATION
  AI_AGENT
}
```

Adicionar em Tenant: `conversations Conversation[]`, `messageTemplates MessageTemplate[]`
Adicionar em Contact: `conversations Conversation[] @relation("ContactConversations")`
Adicionar em Opportunity: `conversations Conversation[] @relation("OpportunityConversations")`
Adicionar em User: `conversationAssignments Conversation[] @relation("ConversationAssignees")`, `sentMessages Message[] @relation("SentMessages")`

**Dependências:** DB-6

---

### TASK DB-13 — Criar models AIAgent e AISuggestion
**Complexidade:** Média
**Arquivo:** backend/prisma/schema.prisma
**O que fazer:**

```prisma
model AIAgent {
  id             String        @id @default(uuid())
  tenantId       String
  tenant         Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name           String
  type           AIAgentType
  model          String        @default("gpt-4o")
  systemPrompt   String
  contextConfig  Json?         // quais dados do CRM injetar
  temperature    Float         @default(0.3)
  maxTokens      Int           @default(500)
  isActive       Boolean       @default(true)
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  suggestions AISuggestion[]

  @@index([tenantId])
  @@map("ai_agents")
}

enum AIAgentType {
  CONVERSATION_ASSISTANT
  RECORDING_ANALYZER
  LEAD_QUALIFIER
  CUSTOM
}

model AISuggestion {
  id              String           @id @default(uuid())
  agentId         String
  agent           AIAgent          @relation(fields: [agentId], references: [id])
  conversationId  String?
  opportunityId   String?
  inputContext    Json
  suggestionText  String
  action          AISuggestionAction @default(PENDING)
  editedText      String?
  responseTimeMs  Int?
  tokensUsed      Int?
  costUsd         Decimal?         @db.Decimal(10, 6)
  createdAt       DateTime         @default(now())

  @@index([agentId])
  @@index([conversationId])
  @@map("ai_suggestions")
}

enum AISuggestionAction {
  APPROVED_AS_IS
  EDITED_AND_SENT
  REJECTED
  PENDING
}
```

Adicionar em Tenant: `aiAgents AIAgent[]`

**Dependências:** DB-12 (Conversation)

---

### TASK DB-14 — Criar model Recording (expande CallTranscription)
**Complexidade:** Média
**Arquivo:** backend/prisma/schema.prisma
**Nota:** Manter CallTranscription existente para não quebrar código. Criar Recording como novo model mais completo.
**O que fazer:**

```prisma
model Recording {
  id                       String           @id @default(uuid())
  tenantId                 String
  tenant                   Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  meetingId                String?
  meeting                  Meeting?         @relation(fields: [meetingId], references: [id])
  opportunityId            String
  opportunity              Opportunity      @relation(fields: [opportunityId], references: [id])
  closerId                 String
  closer                   User             @relation("CloserRecordings", fields: [closerId], references: [id])
  title                    String
  fileUrl                  String
  fileSizeBytes            BigInt?
  durationSeconds          Int?
  uploadStatus             RecordingStatus  @default(UPLOADING)
  transcriptionText        String?
  transcriptionSegments    Json?
  transcriptionProvider    String?          // "openai_whisper"|"deepgram"|"assembly_ai"
  transcribedAt            DateTime?
  aiAnalysis               Json?            // {overall_score, strengths, improvements, objections_detected, action_items, summary}
  aiAgentId                String?
  analyzedAt               DateTime?
  autoTasksCreated         Boolean          @default(false)
  createdAt                DateTime         @default(now())
  updatedAt                DateTime         @updatedAt

  @@index([tenantId])
  @@index([opportunityId])
  @@index([closerId])
  @@map("recordings")
}

enum RecordingStatus {
  UPLOADING
  PROCESSING
  TRANSCRIBING
  ANALYZING
  READY
  FAILED
}
```

Adicionar em Tenant: `recordings Recording[]`
Adicionar em Opportunity: `recordings Recording[]`
Adicionar em User: `closerRecordings Recording[] @relation("CloserRecordings")`
Adicionar em Meeting: `recordings Recording[]`

**Dependências:** DB-8 (Meeting), DB-6

---

### TASK DB-15 — Criar models Goal e GoalBreakdown
**Complexidade:** Média
**Arquivo:** backend/prisma/schema.prisma
**O que fazer:**

```prisma
model Goal {
  id                 String        @id @default(uuid())
  tenantId           String
  tenant             Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name               String
  periodType         GoalPeriodType
  startDate          DateTime
  endDate            DateTime
  type               GoalType
  targetValue        Decimal       @db.Decimal(15, 2)
  scope              GoalScope     @default(GLOBAL)
  userId             String?
  user               User?         @relation("UserGoals", fields: [userId], references: [id])
  teamIds            Json?
  originId           String?
  origin             Origin?       @relation(fields: [originId], references: [id])
  subOriginId        String?
  subOrigin          SubOrigin?    @relation(fields: [subOriginId], references: [id])
  isActive           Boolean       @default(true)
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt

  breakdowns GoalBreakdown[]

  @@index([tenantId])
  @@map("goals")
}

enum GoalPeriodType {
  MONTHLY
  QUARTERLY
  YEARLY
  CUSTOM
}

enum GoalType {
  REVENUE
  MRR
  DEAL_COUNT
  NEW_LEADS
  MEETINGS_BOOKED
  CONVERSION_SDR
  CONVERSION_CLOSER
  CPL
}

enum GoalScope {
  GLOBAL
  BY_USER
  BY_TEAM
  BY_CHANNEL
}

model GoalBreakdown {
  id                              String   @id @default(uuid())
  goalId                          String
  goal                            Goal     @relation(fields: [goalId], references: [id], onDelete: Cascade)
  originId                        String
  origin                          Origin   @relation("GoalBreakdownOrigin", fields: [originId], references: [id])
  subOriginId                     String?
  subOrigin                       SubOrigin? @relation("GoalBreakdownSubOrigin", fields: [subOriginId], references: [id])
  targetLeads                     Int?
  targetCpl                       Decimal?  @db.Decimal(10, 2)
  targetConversionToMeeting       Decimal?  @db.Decimal(5, 2)
  targetConversionToSale          Decimal?  @db.Decimal(5, 2)
  updatedAt                       DateTime  @updatedAt

  @@index([goalId])
  @@map("goal_breakdowns")
}
```

Adicionar em Tenant: `goals Goal[]`
Adicionar em User: `goals Goal[] @relation("UserGoals")`
Adicionar em Origin: `goals Goal[]`, `goalBreakdowns GoalBreakdown[] @relation("GoalBreakdownOrigin")`
Adicionar em SubOrigin: `goals Goal[]`, `goalBreakdowns GoalBreakdown[] @relation("GoalBreakdownSubOrigin")`

**Dependências:** nenhuma (exceto Tenant, User, Origin)

---

### TASK DB-16 — Criar model DailyMetrics
**Complexidade:** Baixa
**Arquivo:** backend/prisma/schema.prisma
**O que fazer:**

```prisma
model DailyMetrics {
  id                      String   @id @default(uuid())
  tenantId                String
  tenant                  Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  date                    DateTime @db.Date
  pipelineId              String?
  newOpportunities        Int      @default(0)
  wonOpportunities        Int      @default(0)
  lostOpportunities       Int      @default(0)
  totalValueWon           Decimal  @default(0) @db.Decimal(15, 2)
  totalValueLost          Decimal  @default(0) @db.Decimal(15, 2)
  totalValueOpen          Decimal  @default(0) @db.Decimal(15, 2)
  totalMrrWon             Decimal  @default(0) @db.Decimal(15, 2)
  conversionRatesByStage  Json?
  avgCycleDays            Decimal? @db.Decimal(10, 2)
  byOrigin                Json?
  byUser                  Json?
  byChannel               Json?
  computedAt              DateTime @default(now())

  @@unique([tenantId, date, pipelineId])
  @@index([tenantId])
  @@index([date])
  @@map("daily_metrics")
}
```

Adicionar em Tenant: `dailyMetrics DailyMetrics[]`

**Dependências:** nenhuma

---

### TASK DB-17 — Criar models Form e FormSubmission
**Complexidade:** Baixa
**Arquivo:** backend/prisma/schema.prisma
**O que fazer:**

```prisma
model Form {
  id              String   @id @default(uuid())
  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name            String
  slug            String
  fields          Json
  pipelineId      String?
  initialStageId  String?
  autoAssignToId  String?
  autoAssignTo    User?    @relation("FormAssignees", fields: [autoAssignToId], references: [id])
  utmTracking     Boolean  @default(true)
  redirectUrl     String?
  styling         Json?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())

  submissions FormSubmission[]

  @@unique([tenantId, slug])
  @@index([tenantId])
  @@map("forms")
}

model FormSubmission {
  id              String   @id @default(uuid())
  formId          String
  form            Form     @relation(fields: [formId], references: [id])
  data            Json
  utmSource       String?
  utmMedium       String?
  utmCampaign     String?
  utmContent      String?
  utmTerm         String?
  ipAddress       String?
  userAgent       String?
  referrerUrl     String?
  opportunityId   String?
  createdAt       DateTime @default(now())

  @@index([formId])
  @@map("form_submissions")
}
```

Adicionar em Tenant: `forms Form[]`
Adicionar em User: `formAssignments Form[] @relation("FormAssignees")`

**Dependências:** nenhuma

---

### TASK DB-18 — Criar model AccountTemplate
**Complexidade:** Baixa
**Arquivo:** backend/prisma/schema.prisma
**O que fazer:**

```prisma
model AccountTemplate {
  id            String   @id @default(uuid())
  name          String
  description   String?
  category      String?
  templateData  Json     // snapshot completo com pipelines, stages, fields, etc.
  createdById   String
  createdBy     User     @relation("CreatedTemplates", fields: [createdById], references: [id])
  isPublic      Boolean  @default(false)
  createdAt     DateTime @default(now())

  @@index([createdById])
  @@map("account_templates")
}
```

Adicionar em User: `createdTemplates AccountTemplate[] @relation("CreatedTemplates")`

**Dependências:** nenhuma

---

### TASK DB-19 — Adicionar campos em TagCategory enum
**Complexidade:** Baixa
**Arquivo:** backend/prisma/schema.prisma
**O que fazer:**
Adicionar `AI_CONTROL` ao enum TagCategory:
```prisma
enum TagCategory {
  QUALIFICATION
  TEMPERATURE
  STATUS
  AI_CONTROL
  CUSTOM
}
```

**Dependências:** nenhuma

---

### TASK DB-20 — Executar migrations e seed inicial
**Complexidade:** Alta
**Arquivos:** backend/prisma/schema.prisma, backend/prisma/seed.ts
**O que fazer:**

1. Após todas as alterações do schema estarem prontas, rodar:
   ```bash
   cd backend && npx prisma generate
   npx prisma migrate dev --name "feat_full_crm_schema_v2"
   ```

2. Atualizar backend/prisma/seed.ts para incluir dados default:
   - Tags pré-configuradas (conforme seção 5 da spec: Lead VIP, Lead Qualificado, Desqualificado, Zona Cinza, Frio, Morno, Quente, Confirmado, No-show, Reagendar, IA, Humano)
   - 4 Funis pré-configurados (FV, FT, FR, FREL) com suas etapas
   - Origens padrão (Mídia Paga, Orgânico, Indicação, Base de Clientes)
   - Motivos de perda padrão (Preço, Concorrência, Medo, Sem resposta, Timing)

3. Migration manual para conversão de dados se necessário (cpfCnpj → cpf)

**Dependências:** DB-1 até DB-19

---

## ORDEM DE EXECUÇÃO DAS TASKS

```
DB-1, DB-2, DB-3, DB-4, DB-5, DB-7, DB-15, DB-16, DB-17, DB-18, DB-19
        ↓
      DB-6 (Opportunity expandido)
        ↓
    DB-8, DB-9 (Meeting, OpportunityAssignment)
        ↓
    DB-10, DB-11, DB-12 (StageTrigger, SalesBot, Conversation)
        ↓
    DB-13, DB-14 (AIAgent, Recording)
        ↓
      DB-20 (migration final + seed)
```

Tasks paralelas: DB-1 a DB-5 podem ser feitas simultaneamente.
DB-7, DB-15 a DB-19 podem ser feitas em paralelo com DB-6 a DB-14.
