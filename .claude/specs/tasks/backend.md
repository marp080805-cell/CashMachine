# BACKEND TASKS — CashMind CRM

**Repositório:** c:/Users/marp0/OneDrive/Área de Trabalho/Projetos Ativos/Claude Code/CashMind/CashMachine
**Backend:** backend/src/
**Stack:** Fastify + Prisma + TypeScript + BullMQ/Redis
**Referência:** .claude/specs/spec_2026-03-26.md

---

## ESTADO ATUAL DO BACKEND

### Módulos existentes (com rotas já implementadas):
- `auth/` — login, JWT, multi-tenant
- `tenants/` — CRUD tenant
- `users/` — CRUD usuários com RBAC
- `contacts/` — CRUD contatos (básico — sem campos novos do schema)
- `companies/` — CRUD empresas
- `leads/` — CRUD leads
- `opportunities/` — CRUD + move + board (kanban)
- `pipelines/` — CRUD pipeline + stages
- `origins/` — CRUD origens/sub-origens
- `tags/` — CRUD tags + assignments
- `custom-fields/` — CRUD campos + valores
- `activities/` — log de atividades
- `tasks/` — CRUD tarefas + fila diária
- `dashboard/` — summary + KPIs
- `reports/` — funnel + by-origin + sales-velocity
- `notifications/` — CRUD notificações
- `whatsapp/` — Evolution API + inbox (modelo antigo)
- `ai/` — sugestões IA + transcrições (modelo básico)

### Queues existentes:
- `ai-suggestion.queue.ts`
- `email.queue.ts`
- `notification.queue.ts`
- `transcription.queue.ts`

### Módulos que PRECISAM ser criados:
- `meetings/` — Reuniões + CalendarIntegration + BookingPage
- `stage-triggers/` — Automações Camada 1
- `salesbots/` — Automações Camada 2
- `conversations/` — Inbox unificado (novo modelo)
- `message-templates/` — Templates de mensagem
- `ai-agents/` — AIAgent CRUD
- `recordings/` — Upload + Whisper + análise IA
- `goals/` — Metas + breakdowns
- `analytics/` — Endpoints de analytics avançados
- `forms/` — Builder de formulários
- `account-templates/` — Snapshots de conta

### Módulos existentes que precisam de EXPANSÃO:
- `opportunities/` — adicionar handoff, campos novos, atribuição, tags
- `tasks/` — TaskTemplate CRUD, SLA, my-queue melhorado
- `contacts/` — campos novos (dateOfBirth, cpf, address, social, blacklist)
- `companies/` — campos novos
- `pipelines/` — config SDR/Closer, handoff settings
- `dashboard/` — widgets completos
- `reports/` — analytics completos

---

## TAREFAS (em ordem de dependência)

### TASK BE-1 — Expandir módulo Opportunities com campos novos e handoff
**Complexidade:** Alta
**Arquivo:** backend/src/modules/opportunities/opportunities.routes.ts
**Depende de:** DB-6, DB-9
**O que fazer:**

1. Atualizar `createOpportunitySchema` para incluir: monthlyValue, installments, installmentValue, channel, tags (array de IDs)

2. Criar endpoint `POST /api/opportunities/:id/handoff`:
   - Validar campos obrigatórios do pipeline.handoffRequiredFields
   - Setar closerId, handoffAt, sdrBriefing
   - Criar OpportunityAssignment com role CLOSER
   - Atribuir based em pipeline.autoAssignCloser (manual/round_robin/by_specialty/fixed)
   - Criar Activity tipo HANDOFF
   - Notificar o Closer via queue de notificações
   - Retornar oportunidade atualizada

3. Atualizar endpoint `PUT /api/opportunities/:id` para suportar campos expandidos

4. Criar endpoint `GET /api/opportunities/:id/timeline` — histórico completo (StageHistory + Activities)

5. Criar endpoint `POST /api/opportunities/:id/tags` — adicionar tag
6. Criar endpoint `DELETE /api/opportunities/:id/tags/:tagId` — remover tag
7. Criar endpoint `GET /api/opportunities/:id/assignments` — histórico de responsáveis

8. Atualizar endpoint `PUT /api/opportunities/:id/move`:
   - Ao mover, verificar required_fields da stage destino
   - Se campos obrigatórios não preenchidos, retornar 422 com lista de campos
   - Criar StageHistory (entrada e saída)
   - Disparar StageTriggers da stage destino (via queue)
   - Retornar oportunidade atualizada

---

### TASK BE-2 — Expandir módulo Tasks com TaskTemplate e melhorias
**Complexidade:** Média
**Arquivo:** backend/src/modules/tasks/tasks.routes.ts (novo arquivo para templates)
**Depende de:** DB-7
**O que fazer:**

1. Criar arquivo `backend/src/modules/tasks/task-templates.routes.ts`:
   - `GET /api/task-templates` — listar templates do tenant
   - `POST /api/task-templates` — criar template (admin/manager apenas)
   - `PUT /api/task-templates/:id` — atualizar
   - `DELETE /api/task-templates/:id` — deletar

2. Expandir `tasks.routes.ts`:
   - `GET /api/tasks/my-queue` — fila do usuário logado, ordenada por prioridade + dueDate
   - `GET /api/tasks/overdue` — tarefas vencidas
   - `PUT /api/tasks/:id/complete` — completar com notes obrigatórias (verifica se completionNotes foi fornecido)
   - `PUT /api/tasks/:id/skip` — marcar como skipped com reason
   - Ao criar tarefa, suportar dueOffsetMinutes + dueDateRelativeTo para calcular dueDate
   - SLA breach: ao listar, calcular slaBreach = (dueDate < now && status != COMPLETED)

3. Registrar `task-templates.routes.ts` no `index.ts`

---

### TASK BE-3 — Criar módulo Meetings (reuniões, calendário, booking)
**Complexidade:** Alta
**Arquivo:** backend/src/modules/meetings/ (novo)
**Depende de:** DB-8
**O que fazer:**

Criar `backend/src/modules/meetings/meetings.routes.ts`:

1. `GET /api/meetings` — listar reuniões do tenant (filtros: hostId, organizerId, status, pipelineId, dateFrom, dateTo)
2. `POST /api/meetings` — criar reunião vinculada a opportunity + contact
   - Validar: opportunityId, contactId, hostId, startDatetime, endDatetime
   - Criar Meeting + criar Activity MEETING
   - Se Google Calendar conectado, criar evento externo (via service)
   - Notificar host (Closer)
3. `GET /api/meetings/:id` — detalhes com opportunity, contact, organizer, host
4. `PUT /api/meetings/:id` — atualizar (status, notes, outcome)
5. `DELETE /api/meetings/:id` — cancelar meeting
6. `PUT /api/meetings/:id/confirm` — confirmar presença
7. `PUT /api/meetings/:id/reschedule` — reagendar (cria novo Meeting, liga rescheduledFromId)
8. `GET /api/meetings/:id/availability/:userId?date=YYYY-MM-DD` — disponibilidade do host numa data

Criar `backend/src/modules/meetings/calendar.routes.ts`:
9. `GET /api/calendar/availability/:userId?date=YYYY-MM-DD` — slots disponíveis
10. `POST /api/calendar/integrations` — conectar Google Calendar (OAuth callback)
11. `GET /api/calendar/integrations` — listar integrações do usuário
12. `DELETE /api/calendar/integrations/:id` — desconectar

Criar `backend/src/modules/meetings/booking.routes.ts`:
13. `GET /api/booking/:slug` — página pública de agendamento (sem auth)
14. `POST /api/booking/:slug/schedule` — agendar pelo formulário público
15. `GET /api/booking-pages` — listar booking pages do tenant
16. `POST /api/booking-pages` — criar booking page
17. `PUT /api/booking-pages/:id` — atualizar
18. `DELETE /api/booking-pages/:id` — deletar

Registrar as 3 rotas no `index.ts`.

---

### TASK BE-4 — Criar módulo Stage Triggers (Automações Camada 1)
**Complexidade:** Alta
**Arquivo:** backend/src/modules/stage-triggers/ (novo)
**Depende de:** DB-10, BE-1
**O que fazer:**

Criar `backend/src/modules/stage-triggers/stage-triggers.routes.ts`:

1. `GET /api/stage-triggers` — listar (filtros: pipelineId, stageId)
2. `POST /api/stage-triggers` — criar trigger (admin/manager apenas)
3. `PUT /api/stage-triggers/:id` — atualizar
4. `DELETE /api/stage-triggers/:id` — deletar
5. `PUT /api/stage-triggers/:id/toggle` — ativar/desativar
6. `GET /api/pipelines/:id/triggers` — triggers de um pipeline
7. `GET /api/stages/:id/triggers` — triggers de uma etapa
8. `GET /api/stage-triggers/:id/logs` — últimas 50 execuções (StageTriggerLog)
9. `POST /api/stage-triggers/:id/test` — executar trigger manualmente com opportunityId

Criar `backend/src/modules/stage-triggers/trigger-executor.service.ts`:
- Função `executeTrigger(triggerId, opportunityId)`:
  - Carrega trigger, opportunity, contact
  - Verifica condições (conditions array)
  - Verifica activeHours
  - Executa actionType:
    - `CREATE_TASK`: cria Task (usando template ou config inline)
    - `SEND_MESSAGE`: enfileira mensagem WhatsApp via BullMQ
    - `CHANGE_STAGE`: move oportunidade para outra etapa
    - `MOVE_TO_PIPELINE`: move para outro pipeline+etapa
    - `SET_FIELD`: preenche CustomFieldValue (suporta variáveis: {{now}}, {{contact.name}}, etc.)
    - `ADD_TAG`/`REMOVE_TAG`: adiciona/remove TagAssignment
    - `CHANGE_RESPONSIBLE`: muda assignedToId (manual/round_robin)
    - `NOTIFY_USER`: enfileira notificação
    - `WEBHOOK`: faz HTTP POST para URL configurada
    - `SALESBOT`: inicia execução do SalesBot (enfileira no BullMQ)
    - `CREATE_OPPORTUNITY`: duplica oportunidade para outro pipeline
  - Registra StageTriggerLog com status e resultado
  - Incrementa executionCount

Criar `backend/src/queues/trigger.queue.ts`:
- Worker BullMQ que processa jobs de trigger
- Job: `{triggerId, opportunityId, event}`
- Chama `trigger-executor.service.ts`

Registrar rotas e worker no `index.ts`.

---

### TASK BE-5 — Criar módulo SalesBot (Automações Camada 2)
**Complexidade:** Alta
**Arquivo:** backend/src/modules/salesbots/ (novo)
**Depende de:** DB-11, BE-4
**O que fazer:**

Criar `backend/src/modules/salesbots/salesbots.routes.ts`:

1. `GET /api/salesbots` — listar bots do tenant
2. `POST /api/salesbots` — criar bot com steps JSON
3. `GET /api/salesbots/:id` — detalhes com steps
4. `PUT /api/salesbots/:id` — atualizar steps/config
5. `DELETE /api/salesbots/:id` — deletar
6. `POST /api/salesbots/:id/duplicate` — duplicar bot
7. `GET /api/salesbots/:id/export` — exportar JSON
8. `POST /api/salesbots/import` — importar JSON
9. `GET /api/salesbots/:id/executions` — listar execuções (SalesBotExecution)
10. `PUT /api/salesbots/executions/:id/pause` — pausar execução
11. `PUT /api/salesbots/executions/:id/resume` — retomar execução

Criar `backend/src/modules/salesbots/bot-executor.service.ts`:
- Função `executeBotStep(executionId, stepId)`:
  - Carrega SalesBotExecution + SalesBot
  - Executa step baseado no type:
    - `send_message`: envia via WhatsApp
    - `send_message_with_buttons`: envia com botões interativos
    - `wait`: agenda próximo step via BullMQ delayed job
    - `wait_for_response`: aguarda resposta do lead (pausa bot)
    - `condition`: avalia regras e determina next_step
    - `set_field`, `add_tag`, `remove_tag`, `change_stage`, etc.
    - `collect_field`: envia pergunta, aguarda resposta
    - `stop`/`stop_and_notify`: encerra bot + notifica
  - Atualiza currentStepId e stepHistory no SalesBotExecution
  - Agenda próximo step se houver next_steps

Criar `backend/src/queues/bot-execution.queue.ts`:
- Worker BullMQ para execução de steps
- Suporte a delayed jobs (para steps `wait`)

Registrar no `index.ts`.

---

### TASK BE-6 — Criar módulo Conversations (inbox unificado)
**Complexidade:** Média
**Arquivo:** backend/src/modules/conversations/ (novo)
**Depende de:** DB-12, DB-13
**O que fazer:**

Criar `backend/src/modules/conversations/conversations.routes.ts`:

1. `GET /api/conversations` — listar conversas (filtros: status, channel, assignedToId, contactId, opportunityId)
   - Incluir: contact, lastMessage, unreadCount
   - Ordenar: lastMessageAt desc
2. `POST /api/conversations` — criar conversa
3. `GET /api/conversations/:id` — detalhes com mensagens paginadas
4. `POST /api/conversations/:id/messages` — enviar mensagem
   - Salva Message
   - Se WhatsApp: chama Evolution API para enviar
   - Atualiza lastMessageAt
5. `GET /api/conversations/:id/ai-suggest` — gerar sugestão de resposta IA
   - Carrega contexto (últimas N mensagens + dados da oportunidade/contato)
   - Chama AIAgent via OpenAI
   - Salva AISuggestion com status PENDING
   - Retorna sugestão
6. `PUT /api/ai-suggestions/:id/action` — registrar ação (APPROVED_AS_IS / EDITED_AND_SENT / REJECTED)
7. `PUT /api/conversations/:id/assign` — atribuir conversa a usuário
8. `PUT /api/conversations/:id/close` — fechar conversa

Criar `backend/src/modules/conversations/message-templates.routes.ts`:
9. `GET /api/message-templates` — listar templates do tenant
10. `POST /api/message-templates` — criar template
11. `PUT /api/message-templates/:id` — atualizar
12. `DELETE /api/message-templates/:id` — deletar

Registrar no `index.ts`.

---

### TASK BE-7 — Criar módulo AIAgents
**Complexidade:** Média
**Arquivo:** backend/src/modules/ai-agents/ (novo)
**Depende de:** DB-13
**O que fazer:**

Criar `backend/src/modules/ai-agents/ai-agents.routes.ts`:

1. `GET /api/ai-agents` — listar agentes do tenant
2. `POST /api/ai-agents` — criar agente (admin/manager)
3. `GET /api/ai-agents/:id` — detalhes
4. `PUT /api/ai-agents/:id` — atualizar
5. `DELETE /api/ai-agents/:id` — deletar
6. `GET /api/ai-suggestions` — listar sugestões (filtros: conversationId, opportunityId, action)
7. `POST /api/ai-agents/:id/test` — testar agente com input manual

Criar `backend/src/modules/ai-agents/ai-agent.service.ts`:
- Função `callAgent(agentId, inputContext)`:
  - Carrega AIAgent
  - Usa tenant.openaiApiKey (ou default do sistema)
  - Chama OpenAI API (chat completion)
  - Retorna texto sugerido
  - Salva AISuggestion
  - Registra tokens_used e cost_usd

Registrar no `index.ts`.

---

### TASK BE-8 — Criar módulo Recordings
**Complexidade:** Alta
**Arquivo:** backend/src/modules/recordings/ (novo)
**Depende de:** DB-14, BE-7
**O que fazer:**

Criar `backend/src/modules/recordings/recordings.routes.ts`:

1. `POST /api/recordings/upload` — upload de arquivo de áudio/vídeo
   - Recebe multipart/form-data
   - Salva arquivo (local ou S3/R2 — usar env STORAGE_TYPE)
   - Cria Recording com status UPLOADING
   - Enfileira job de transcrição no BullMQ
   - Retorna recording criado
2. `GET /api/recordings` — listar (filtros: closerId, opportunityId, status)
3. `GET /api/recordings/:id` — detalhes com análise IA
4. `POST /api/recordings/:id/analyze` — forçar re-análise com IA
5. `GET /api/recordings/:id/tasks` — tarefas geradas pela análise

Expandir `backend/src/queues/transcription.queue.ts`:
- Worker existente: receber job, chamar Whisper API, salvar transcriptionText
- Após transcrição: enfileira job de análise IA (novo)

Criar `backend/src/queues/recording-analysis.queue.ts`:
- Worker: carregar Recording + Tenant (para saber modelo OpenAI)
- Chamar AIAgent tipo RECORDING_ANALYZER
- Salvar aiAnalysis: {overall_score, strengths, improvements, objections_detected, action_items, summary}
- Criar Tasks automáticas baseadas em action_items se autoTasksCreated = false
- Marcar autoTasksCreated = true
- Emitir evento WebSocket para frontend

Registrar no `index.ts`.

---

### TASK BE-9 — Criar módulo Goals (Metas)
**Complexidade:** Média
**Arquivo:** backend/src/modules/goals/ (novo)
**Depende de:** DB-15
**O que fazer:**

Criar `backend/src/modules/goals/goals.routes.ts`:

1. `GET /api/goals` — listar metas do tenant (filtros: type, periodType, scope, userId)
2. `POST /api/goals` — criar meta (admin/manager)
3. `GET /api/goals/:id` — detalhes com progresso atual
4. `PUT /api/goals/:id` — atualizar
5. `DELETE /api/goals/:id` — deletar
6. `GET /api/goals/progress` — progresso de todas as metas ativas
   - Para cada meta, calcular currentValue e progressPercentage:
     - REVENUE: somar value das oportunidades WON no período
     - MRR: somar monthlyValue das oportunidades WON
     - DEAL_COUNT: contar oportunidades WON
     - NEW_LEADS: contar Leads criados no período
     - MEETINGS_BOOKED: contar Meetings criados
     - CONVERSION_SDR: % de leads que viraram oportunidades
     - CONVERSION_CLOSER: % de oportunidades WON/total
     - CPL: custo por lead (requer dado externo — deixar campo para input manual por agora)
7. `GET /api/goals/:id/breakdowns` — breakdown por canal
8. `POST /api/goals/:id/breakdowns` — criar breakdown
9. `PUT /api/goals/:id/breakdowns/:breakdownId` — atualizar
10. `DELETE /api/goals/:id/breakdowns/:breakdownId` — deletar

Registrar no `index.ts`.

---

### TASK BE-10 — Expandir módulo Dashboard e Analytics
**Complexidade:** Alta
**Arquivo:** backend/src/modules/dashboard/dashboard.routes.ts + reports.routes.ts
**Depende de:** DB-16, BE-9
**O que fazer:**

Expandir `dashboard.routes.ts`:

1. `GET /api/dashboard/widgets` — retornar todos os widgets v1 (fixo):
   - **goal_progress**: progresso das metas ativas do tenant
   - **mrr_current**: MRR total do mês (soma monthlyValue das WON)
   - **revenue_current**: receita do mês (soma value das WON)
   - **deal_count**: oportunidades WON do mês
   - **new_leads_count**: leads criados no mês
   - **new_leads_by_channel**: leads agrupados por origem
   - **conversion_funnel**: funil de conversão etapa por etapa
   - **sdr_metrics**: por SDR: leads assignados, meetings agendados, taxa de conv.
   - **closer_metrics**: por Closer: oportunidades, WON, taxa de fechamento, avg ticket
   - **pipeline_value**: valor total em aberto por pipeline/etapa
   - **forecast**: previsão de fechamento (sum(value * probability) por stage)
   - **top_loss_reasons**: top 5 motivos de perda
   - **overdue_tasks**: contagem de tarefas vencidas do usuário
   - **upcoming_meetings**: próximas reuniões (7 dias)
   - **sales_velocity**: (oportunidades * win_rate * avg_value) / avg_cycle_days

2. `GET /api/dashboard/config` — config de widgets do usuário
3. `PUT /api/dashboard/config` — salvar config de widgets

Expandir `reports.routes.ts`:

4. `GET /api/analytics/funnel?pipeline_id=X&period=30d` — funil de conversão completo (já existe, expandir)
5. `GET /api/analytics/forecast` — previsão por stage (sum value * probability)
6. `GET /api/analytics/sales-station` — "Plantão de Vendas": oportunidades com reunião hoje + propostas em aberto + próximos follow-ups
7. `GET /api/analytics/sdr-dashboard` — métricas completas do SDR logado
8. `GET /api/analytics/closer-dashboard` — métricas completas do Closer logado
9. `GET /api/analytics/origin-impact` — impacto por origem: leads, conversões, receita
10. `GET /api/analytics/sales-velocity` — velocity score completo

---

### TASK BE-11 — Criar módulo Forms
**Complexidade:** Média
**Arquivo:** backend/src/modules/forms/ (novo)
**Depende de:** DB-17
**O que fazer:**

Criar `backend/src/modules/forms/forms.routes.ts`:

1. `GET /api/forms` — listar formulários do tenant
2. `POST /api/forms` — criar formulário (admin/manager)
3. `GET /api/forms/:id` — detalhes
4. `PUT /api/forms/:id` — atualizar
5. `DELETE /api/forms/:id` — deletar
6. `GET /api/forms/:slug/public` — retornar form público (sem auth) para embed
7. `POST /api/forms/:slug/submit` — processar submissão (sem auth para forms públicos):
   - Salvar FormSubmission com data + UTMs + IP
   - Criar Contact (ou vincular existente por phone/email)
   - Criar Opportunity na pipeline/stage configurada
   - Disparar StageTrigger ON_ENTER
   - Retornar redirect_url ou mensagem de sucesso
8. `GET /api/forms/:id/submissions` — listar submissões

Registrar no `index.ts`.

---

### TASK BE-12 — Criar módulo Account Templates (Snapshots)
**Complexidade:** Média
**Arquivo:** backend/src/modules/account-templates/ (novo)
**Depende de:** DB-18
**O que fazer:**

Criar `backend/src/modules/account-templates/account-templates.routes.ts`:

1. `GET /api/account-templates` — listar templates públicos + os do tenant
2. `POST /api/account-templates` — criar template (captura snapshot completo do tenant)
3. `GET /api/account-templates/:id` — detalhes
4. `DELETE /api/account-templates/:id` — deletar (somente criador)
5. `POST /api/account-templates/:id/apply` — aplicar template:
   - Criar pipelines + stages
   - Criar custom field groups + fields
   - Criar origins + lost reasons + tags
   - Criar task templates + message templates
   - Criar automation triggers (StageTrigger)
   - Criar ai agents
   - Retornar resumo do que foi criado

Lógica do snapshot (ao criar template):
- Serializar todos os pipelines do tenant com stages, triggers, fields

Registrar no `index.ts`.

---

### TASK BE-13 — Criar endpoint de daily metrics e cron
**Complexidade:** Média
**Arquivo:** backend/src/queues/ (novo worker) + dashboard routes
**Depende de:** DB-16, BE-10
**O que fazer:**

1. Criar `backend/src/queues/daily-metrics.queue.ts`:
   - Worker BullMQ que roda todo dia à meia-noite (ou ao ser chamado)
   - Para cada tenant, para cada pipeline:
     - Calcular e upsert DailyMetrics do dia
     - Usar Prisma aggregation para: newOpportunities, wonOpportunities, lostOpportunities
     - Calcular totalValueWon, totalValueOpen, totalMrrWon
     - Calcular conversion_rates by stage
     - Calcular by_origin, by_user breakdowns

2. Criar `GET /api/admin/recompute-metrics` (admin apenas) — força recompute manual

3. Iniciar worker no `bootstrap()` do index.ts.

---

### TASK BE-14 — Expandir módulo Contacts e Companies
**Complexidade:** Baixa
**Arquivo:** backend/src/modules/contacts/contacts.routes.ts + companies.routes.ts
**Depende de:** DB-2, DB-3
**O que fazer:**

Em `contacts.routes.ts`:
1. Atualizar schema de criação/atualização para incluir: cpf, dateOfBirth, avatarUrl, address (JSON), socialProfiles (JSON), isBlacklisted
2. Criar `PUT /api/contacts/:id/blacklist` — marcar como blacklisted
3. Criar `GET /api/contacts/:id/opportunities` — listar oportunidades do contato
4. Criar `GET /api/contacts/:id/conversations` — listar conversas do contato
5. Criar `GET /api/contacts/:id/tasks` — listar tarefas do contato
6. Criar `GET /api/contacts/:id/activities` — atividades do contato

Em `companies.routes.ts`:
7. Atualizar schema para incluir: phone, employeeCount, annualRevenue, addressJson (JSON)
8. Criar `GET /api/companies/:id/contacts` — listar contatos da empresa
9. Criar `GET /api/companies/:id/opportunities` — listar oportunidades da empresa

---

### TASK BE-15 — Adicionar webhooks externos e integração WhatsApp melhorada
**Complexidade:** Média
**Arquivo:** backend/src/modules/whatsapp/whatsapp.routes.ts (expansão)
**Depende de:** DB-12, BE-6
**O que fazer:**

1. No webhook incoming do WhatsApp (já existe), quando mensagem recebida:
   - Buscar ou criar Contact pelo phone
   - Buscar ou criar Conversation (novo modelo) vinculada ao contact
   - Salvar Message no novo modelo
   - Se a oportunidade tem StageTrigger ON_MESSAGE_RECEIVED ativo → enfileirar execução
   - Emitir evento WebSocket para inbox em tempo real

2. Criar `POST /api/webhooks` — registrar webhook externo (para integração com sistemas externos):
   ```
   {url, events: ["opportunity.won", "opportunity.moved", "lead.created"]}
   ```
3. Criar `POST /api/webhooks/incoming/:id` — receber webhooks externos (para formulários, landing pages)

4. Na execução de StageTrigger action `WEBHOOK`:
   - Fazer HTTP POST para URL configurada com payload + variáveis resolvidas

---

### TASK BE-16 — Implementar sistema de Pipelines com configuração SDR/Closer
**Complexidade:** Média
**Arquivo:** backend/src/modules/pipelines/pipelines.routes.ts
**Depende de:** DB-5
**O que fazer:**

1. Atualizar schema de criação/atualização de Pipeline para incluir:
   - sdrStages, closerStages, handoffStageId, handoffRequiredFields
   - autoAssignCloser, fixedCloserId, roundRobinUserIds

2. Criar `GET /api/pipelines/:id/board` — kanban completo com cards (melhorar o existente):
   - Incluir custom field values configurados como showInCard
   - Incluir tags das oportunidades
   - Incluir próxima reunião de cada oportunidade
   - Incluir SLA breach status de tarefas abertas

3. Criar `GET /api/pipelines/:id/config` — configuração completa do pipeline (etapas + triggers)

4. Na criação de Stage, suportar: type (NORMAL/WON/LOST), probability, autoCreateTasks

5. Criar `GET /api/pipelines/:id/stage-triggers` — triggers agrupados por stage (para UI digital pipeline)

---

## ORDEM DE EXECUÇÃO DAS TASKS

```
BE-14 (contacts/companies expandidos — independente, baixo risco)
       ↓
BE-16 (pipelines expandidos)
       ↓
BE-1 (opportunities expandidos com handoff)
       ↓
BE-2 (tasks + templates)
       ↓
BE-3 (meetings + calendar + booking)
       ↓
BE-4 (stage-triggers — depende de BE-1 para moves)
       ↓
BE-5 (salesbots — depende de BE-4)
       ↓
BE-6 (conversations — depende de DB-12)
       ↓
BE-7 (ai-agents — depende de BE-6)
       ↓
BE-8 (recordings — depende de BE-7)
       ↓
BE-9 (goals)
       ↓
BE-10 (dashboard/analytics — depende de BE-9)
       ↓
BE-11, BE-12, BE-13, BE-15 (paralelos)
```

Paralelos independentes: BE-11 (forms), BE-12 (templates), BE-15 (webhooks) podem rodar em paralelo após DB migrations.
