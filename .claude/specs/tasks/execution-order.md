# ORDEM DE EXECUÇÃO — CashMind CRM

**Data:** 2026-03-26
**Branch:** claude/cashmachine-b2b-platform-pL5Y2

---

## PRINCÍPIOS

1. **Database SEMPRE antes do Backend** — as APIs precisam do schema
2. **Backend SEMPRE antes do Frontend** — o frontend consome as APIs
3. **Infra pode rodar em paralelo** com banco/backend (são configs independentes)
4. **Tarefas complexas BLOQUEIAM outras** — identificadas abaixo

---

## FASE 1 — FUNDAÇÃO (Semana 1)

Executar em PARALELO:

| Agente | Tarefas | Bloqueia |
|--------|---------|---------|
| DATABASE | DB-1, DB-2, DB-3, DB-4, DB-5, DB-7, DB-15, DB-16, DB-17, DB-18, DB-19 | Todo o backend |
| INFRA | INFRA-1 (variáveis), INFRA-2 (volumes), INFRA-5 (encryption), INFRA-6 (Dockerfile), INFRA-9 (health checks) | INFRA-3, INFRA-4 |
| FRONTEND | FE-1 (sidebar), FE-2 (config layout), FE-18 (rotas placeholder), FE-13 (tags/origens CRUD simples) | FE-3 a FE-17 |

**Resultado da Fase 1:** Schema base expandido, infra configurada, navegação frontend funcionando.

---

## FASE 2 — CORE ENTITIES (Semana 1-2)

Sequencial após Fase 1:

```
DB-6 (Opportunity expandido)
     ↓
DB-8, DB-9 (Meeting + OpportunityAssignment) — PARALELO
     ↓
DB-10, DB-11, DB-12 (StageTrigger + SalesBot + Conversation) — PARALELO
     ↓
DB-13, DB-14 (AIAgent + Recording) — PARALELO
     ↓
DB-20 (MIGRATION FINAL + SEED) ← BLOQUEADOR CRÍTICO
```

Após DB-20, em PARALELO:
```
BE-14 (contacts/companies)    BE-16 (pipelines)    BE-2 (tasks)
```

---

## FASE 3 — BACKEND CORE (Semana 2-3)

Sequencial + paralelo:

```
BE-1 (opportunities expandido com handoff)
     ↓
BE-3 (meetings + calendar)    BE-4 (stage-triggers)    BE-9 (goals)
     ↓
BE-5 (salesbots)    BE-6 (conversations)    BE-10 (dashboard)
     ↓
BE-7 (ai-agents)
     ↓
BE-8 (recordings)
     ↓
BE-11 (forms)    BE-12 (account-templates)    BE-13 (daily metrics)    BE-15 (webhooks)
```

Paralelo com BE-4: INFRA-3 (workers BullMQ)

---

## FASE 4 — FRONTEND CORE (Semana 3-4)

Em PARALELO (frontend pode trabalhar em múltiplas áreas):

```
FE-4 (opportunity sheet completo)    FE-6 (tarefas)    FE-7 (perfil contato)
FE-19 (leads melhorado)             FE-5 (campos personalizados config)
     ↓
FE-3 (calendário)    FE-8 (ia-agentes)    FE-10 (metas)    FE-14 (dashboard)
     ↓
FE-9 (gravações)    FE-11 (config funis + digital pipeline)
     ↓
FE-12 (salesbot builder — mais complexa)    FE-15 (formulários)    FE-17 (snapshots)
     ↓
FE-16 (migrar transcrições para novo modelo)
```

---

## TAREFAS QUE BLOQUEIAM OUTRAS

### BLOQUEADORES CRÍTICOS (não pode pular):

1. **DB-20 (Migration Final)** — sem isso, NENHUM backend pode funcionar em produção
   - Bloqueia: TODO o backend e frontend

2. **BE-1 (Opportunities handoff)** — core do CRM
   - Bloqueia: BE-4 (triggers de move), FE-4 (opportunity sheet)

3. **BE-4 (Stage Triggers)** — automações
   - Bloqueia: BE-5 (salesbot), FE-11 (config funis)

4. **INFRA-3 (Workers BullMQ)** — sem workers, automações não executam
   - Bloqueia: qualquer funcionalidade de automação em produção

### BLOQUEADORES MODERADOS:

5. **DB-8 (Meeting)** — bloqueia BE-3 (meetings API) e FE-3 (calendário)
6. **DB-12 (Conversation)** — bloqueia BE-6 (inbox unificado)
7. **DB-13 (AIAgent)** — bloqueia BE-7 (ai-agents)
8. **DB-14 (Recording)** — bloqueia BE-8 (recordings)

---

## TAREFAS QUE PODEM RODAR EM PARALELO

### Frontend independente do backend:
- FE-1, FE-2, FE-18 — estrutura de navegação
- FE-13 (tags, origens, motivos de perda) — só CRUD, API já existe
- FE-19 (leads melhorado) — API já existe parcialmente

### Backend independente entre si (após DB-20):
- BE-9 (goals) — não depende de outros módulos novos
- BE-11 (forms) — independente
- BE-12 (account templates) — independente
- BE-14 (contacts/companies expansão) — independente
- BE-15 (webhooks) — independente

### Infra pode rodar sempre:
- INFRA-1 a INFRA-9 — podem ser feitas a qualquer momento antes de deploy

---

## SPRINTS SUGERIDOS (para agente executar)

### Sprint A (Agente DATABASE):
1. Fazer TODAS as tasks DB-1 a DB-19 no schema.prisma
2. Rodar `npx prisma generate` para validar
3. Rodar `npx prisma migrate dev` para criar migration
4. Atualizar seed.ts com dados padrão
5. Commit e push

### Sprint B (Agente BACKEND) — após Sprint A:
1. Fase 1: BE-14, BE-16, BE-2
2. Fase 2: BE-1
3. Fase 3: BE-3, BE-4, BE-9 (paralelo)
4. Fase 4: BE-5, BE-6, BE-10 (paralelo)
5. Fase 5: BE-7, BE-8
6. Fase 6: BE-11, BE-12, BE-13, BE-15 (paralelo)
7. Commit + push após cada task

### Sprint C (Agente FRONTEND) — pode começar imediatamente:
1. FE-1, FE-2, FE-18 (imediato)
2. FE-13 (imediato — CRUD simples)
3. FE-19 (após BE parcialmente pronto)
4. Demais em ordem do frontend.md

### Sprint D (Agente INFRA) — pode começar imediatamente:
1. INFRA-1 (variáveis — PRIMEIRO)
2. INFRA-2, INFRA-5, INFRA-6, INFRA-9 (paralelo)
3. INFRA-3, INFRA-4 (após BE-4, BE-5 prontos)
4. INFRA-7, INFRA-8 (após tudo)

---

## AVISOS IMPORTANTES PARA OS AGENTES

### Para o AGENTE DATABASE:
- Ao modificar o schema, sempre rodar `npx prisma validate` antes de commitar
- Manter retrocompatibilidade: NÃO remover models existentes (só adicionar campos)
- O model `CallTranscription` existente deve ser mantido — criar `Recording` como novo model
- O model `WhatsappConversation/Message` existente deve ser mantido — criar `Conversation/Message` como novos models
- Ao renomear campos (ex: cpfCnpj → cpf), criar migration com transformação de dados

### Para o AGENTE BACKEND:
- Sempre adicionar `preHandler: [app.authenticate]` nas rotas protegidas
- Sempre filtrar por `tenantId` em TODOS os queries
- Para rotas de admin/manager: usar `requirePermission` do middleware RBAC
- Ao criar um novo módulo: registrar no `backend/src/index.ts`
- Os workers BullMQ devem ser idempotentes (retry safe)
- Ao usar OpenAI: primeiro tentar `tenant.openaiApiKey`, fallback para `OPENAI_API_KEY` do env

### Para o AGENTE FRONTEND:
- O frontend usa TanStack Query (`@tanstack/react-query`) para fetches
- Todos os forms usam `react-hook-form` + `zod`
- Componentes UI: usar `shadcn/ui` components existentes
- Para drag-and-drop: `@dnd-kit/core` (já instalado no kanban)
- Para SalesBot Builder: instalar `@xyflow/react`
- Para Calendário: instalar `@fullcalendar/react`
- Manter padrão visual: sidebar escura (#1a1a2e ou similar), conteúdo claro
- NUNCA remover rotas existentes — só adicionar

### Para o AGENTE INFRA:
- O `.env` real na VPS nunca deve ser commitado — apenas `.env.example`
- ENCRYPTION_KEY deve ser gerada uma vez na VPS com `openssl rand -hex 32`
- Ao adicionar novos workers, garantir que são iniciados no bootstrap do index.ts
- Health checks são importantes para o deploy não quebrar com restart
