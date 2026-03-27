# ORCHESTRATOR REPORT — CashMind CRM

**Data:** 2026-03-26
**Branch:** claude/cashmachine-b2b-platform-pL5Y2
**Orchestrator:** Claude Sonnet 4.6

---

## O que foi analisado

### 1. Especificação (spec_2026-03-26.md)
Sistema CRM SaaS multi-tenant completo (metodologia CASE), com:
- 18 entidades de dados principais
- 2 camadas de automação (Digital Pipeline + SalesBot Builder)
- Módulos: Pipeline/Kanban, Campo Engine, Task Engine, Calendário, Handoff SDR/Closer,
  Mensageria WhatsApp, IA Assistente, Gravações/Transcrições, Metas, Dashboard, Formulários, Snapshots
- 60+ endpoints de API
- Sprint plan de 13 sprints

### 2. Estado atual do código
**Backend (Fastify + Prisma + TypeScript):**
- Schema: 20 models existentes (Tenant, User, Contact, Company, Lead, Pipeline, Stage, Opportunity, Origin, SubOrigin, LostReason, Tag, TagAssignment, CustomField*, StageHistory, Task, WhatsappNumber, WhatsappConversation, WhatsappMessage, CallTranscription, Notification, Activity)
- Módulos de API: 18 módulos (auth, tenants, users, contacts, companies, leads, opportunities, pipelines, origins, tags, custom-fields, activities, tasks, dashboard, reports, notifications, whatsapp, ai)
- Queues BullMQ: ai-suggestion, email, notification, transcription

**Frontend (Next.js 14 + shadcn/ui):**
- 16 páginas existentes (dashboard, funis, contatos, empresas, leads, whatsapp, tarefas, relatorios, performance, transcricoes, configuracoes + sub-páginas)
- Componentes: Kanban completo, WhatsApp inbox com AI bar, Dashboard básico, Layout

**Infraestrutura:**
- Docker Compose: redis, api, frontend, nginx
- Redis 7 configurado
- Evolution API separada

### 3. Gap Analysis (o que falta)
**Banco de dados:** 21 novos models + expansão de 10 models existentes
**Backend:** 10 novos módulos + expansão de 6 módulos existentes + 4 novos workers BullMQ
**Frontend:** 12 novas páginas + expansão de 6 páginas + vários novos componentes
**Infra:** Variáveis de ambiente, storage de arquivos, encryption, health checks, cron jobs

---

## Planos criados

| Arquivo | Tarefas | Status |
|---------|---------|--------|
| `.claude/specs/tasks/database.md` | DB-1 a DB-20 (20 tasks) | EXECUTADO pelo Orchestrator |
| `.claude/specs/tasks/backend.md` | BE-1 a BE-16 (16 tasks) | PENDENTE — Agente BACKEND |
| `.claude/specs/tasks/frontend.md` | FE-1 a FE-19 (19 tasks) | PENDENTE — Agente FRONTEND |
| `.claude/specs/tasks/infra.md` | INFRA-1 a INFRA-9 (9 tasks) | PENDENTE — Agente INFRA |
| `.claude/specs/tasks/execution-order.md` | Roadmap completo | CRIADO |

---

## Agentes lançados

**Nota:** O CLI do Claude (`claude` command) não estava disponível neste ambiente de execução,
portanto os agentes foram planejados mas não puderam ser lançados como processos paralelos.
O ORCHESTRATOR executou diretamente a parte mais crítica (DATABASE) e criou todos os planos.

### Agente DATABASE — CONCLUÍDO (executado pelo Orchestrator)
- Schema Prisma v2 completamente reescrito
- 21 novos models adicionados
- 10 models existentes expandidos
- 20+ novos enums
- Retrocompatibilidade garantida
- Commit: 16341fe | Push: realizado

### Agente BACKEND — PENDENTE
**Missão:** Executar tarefas BE-1 a BE-16
**Prioridade:** Alta — desbloqueia o frontend
**Arquivo:** `.claude/specs/tasks/backend.md`

Ordem sugerida:
1. BE-14 (contacts/companies)
2. BE-16 (pipelines config)
3. BE-2 (tasks + templates)
4. BE-1 (opportunities handoff)
5. BE-3 (meetings + booking)
6. BE-4 (stage triggers) — CRÍTICO para automações
7. BE-9 (goals)
8. BE-6 (conversations)
9. BE-7 (ai-agents)
10. BE-5 (salesbots)
11. BE-8 (recordings)
12. BE-10 (dashboard/analytics)
13. BE-11, BE-12, BE-13, BE-15 (paralelos)

### Agente FRONTEND — PENDENTE
**Missão:** Executar tarefas FE-1 a FE-19
**Prioridade:** Alta — pode começar FE-1/FE-2/FE-18/FE-13 imediatamente (não dependem de backend novo)
**Arquivo:** `.claude/specs/tasks/frontend.md`

Pode começar imediatamente:
- FE-1 (sidebar atualizada)
- FE-2 (config layout)
- FE-18 (rotas placeholder)
- FE-13 (tags/origens/motivos CRUD)

Aguardar backend:
- FE-3 (calendário) → BE-3
- FE-4 (opportunity sheet) → BE-1
- FE-11 (config funis + digital pipeline) → BE-4
- FE-12 (salesbot builder) → BE-5

### Agente INFRA — PENDENTE
**Missão:** Executar tarefas INFRA-1 a INFRA-9
**Prioridade:** Média — pode ser feito em paralelo
**Arquivo:** `.claude/specs/tasks/infra.md`

Pode começar imediatamente:
- INFRA-1 (.env.example atualizado)
- INFRA-2 (volumes Docker)
- INFRA-5 (encryption lib)
- INFRA-6 (Dockerfile)
- INFRA-9 (health checks)

Aguardar backend:
- INFRA-3 (workers BullMQ) → BE-4, BE-5, BE-8, BE-13
- INFRA-4 (storage service) → BE-8
- INFRA-8 (scripts deploy) → DB-20

---

## Paralelo vs Sequencial

```
[CONCLUÍDO] DATABASE schema
     ↓
[PARALELO] BACKEND + FRONTEND(FE-1,2,13,18) + INFRA(INFRA-1,2,5,6,9)
     ↓
[SEQUENCIAL] FRONTEND complexo (FE-4,11,12) aguarda BACKEND (BE-1,4,5)
     ↓
[FINAL] INFRA workers + deploy scripts
```

---

## Avisos Críticos

### Para o Agente BACKEND:
1. **SEMPRE filtrar por tenantId** em todos os queries Prisma
2. **Usar encrypt/decrypt** ao salvar/usar openaiApiKey e OAuth tokens
3. **Novos módulos** devem ser registrados no `backend/src/index.ts`
4. **Workers BullMQ** devem ser idempotentes (retry-safe)
5. **Não remover** módulos existentes — só expandir

### Para o Agente FRONTEND:
1. **O SalesBot Builder** (FE-12) é o componente mais complexo — instalar `@xyflow/react`
2. **O Calendário** (FE-3) precisa de `@fullcalendar/react`
3. **Não quebrar** navegação existente — só adicionar
4. **OpportunitySheet** (FE-4) é o componente mais importante do CRM — caprichar

### Para o Agente INFRA:
1. **ENCRYPTION_KEY** deve ser gerada com `openssl rand -hex 32` na VPS — NUNCA commitar
2. **Storage local** para MVP, escalar para R2 depois
3. **Cron de daily_metrics** e **SLA breach check** são críticos para o dashboard funcionar

---

## Próximos passos imediatos para o usuário

### Na VPS — aplicar o schema:
```bash
cd /opt/cashmachine/CashMachine && git pull origin claude/cashmachine-b2b-platform-pL5Y2 && docker compose up -d --build
# Aguardar build completar, depois:
docker compose exec cashmind_api npx prisma migrate dev --name feat_full_crm_schema_v2
```

### Localmente — continuar desenvolvimento:
Os agentes BACKEND, FRONTEND e INFRA devem ser lançados para executar as tarefas dos planos.
Cada agente deve ler seu arquivo de tarefas e executar em ordem.
