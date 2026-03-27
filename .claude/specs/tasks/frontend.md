# FRONTEND TASKS — CashMind CRM

**Repositório:** c:/Users/marp0/OneDrive/Área de Trabalho/Projetos Ativos/Claude Code/CashMind/CashMachine
**Frontend:** frontend/src/
**Stack:** Next.js 14 App Router + TypeScript + TailwindCSS + shadcn/ui
**Referência:** .claude/specs/spec_2026-03-26.md

---

## ESTADO ATUAL DO FRONTEND

### Páginas existentes:
- `/` (dashboard) — KPIs, charts, atividades recentes
- `/funis` — lista de funis
- `/funis/[id]` — Kanban com header estilo Kommo (toggle kanban/lista, dropdown pipeline)
- `/contatos` — lista de contatos
- `/empresas` — lista de empresas
- `/leads` — lista de leads
- `/whatsapp` — inbox WhatsApp com AI suggestion bar
- `/tarefas` — lista de tarefas
- `/relatorios` — relatórios básicos
- `/performance` — performance do time
- `/transcricoes` — transcrições e IA
- `/configuracoes` — configurações (layout + sub-páginas)
- `/configuracoes/usuarios` — gestão de usuários
- `/configuracoes/canais` — canais
- `/configuracoes/whatsapp` — números WhatsApp
- `/configuracoes/campos-leads` — campos de leads
- `/configuracoes/metas` — metas
- `/configuracoes/dashboard` — config dashboard

### Componentes existentes:
- `components/layout/` — Sidebar, Navbar, MobileNav, ThemeToggle
- `components/kanban/` — KanbanBoard, KanbanCard, KanbanColumn, DealModal, DealConversationSheet, OpportunitySheet
- `components/dashboard/` — KpiCard, LeadsChart, FunnelHealthChart, CanalPerformanceChart, RecentActivities
- `components/shared/` — ConfirmDialog, DataTable, EmptyState, FileUpload
- `components/whatsapp/` — AiSuggestionBar, ChatWindow, ContactInfo, ConversationList, MessageBubble
- `components/ui/` — shadcn components

### O que FALTA criar/expandir:
- **Reuniões** — módulo calendário completo
- **Automações** — Digital Pipeline visual + SalesBot Builder
- **Campos personalizados** — configuração com UI completa
- **Contatos** — página de detalhes (contact profile)
- **Oportunidade** — sheet/modal com todos os campos, handoff UI, reuniões
- **Tarefas** — página melhorada com fila "minha agenda hoje"
- **Metas** — página interativa com progresso
- **Gravações** — página de upload e análise
- **Funis** — configuração de etapas (admin)
- **Sidebar** — adicionar itens em falta (Calendário, IA/Agentes, Gravações, Metas)
- **Configurações** — muitas sub-páginas faltando

---

## TAREFAS (em ordem de dependência)

### TASK FE-1 — Atualizar Sidebar com navegação completa
**Complexidade:** Baixa
**Arquivo:** frontend/src/components/layout/Sidebar.tsx
**Depende de:** nada
**O que fazer:**

Atualizar navItems para incluir todos os itens da spec:
```typescript
const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard:view' },
  { href: '/leads', label: 'Leads', icon: UserCheck, permission: 'leads:view' },
  { href: '/funis', label: 'Funis', icon: GitBranch, permission: 'pipelines:view' },
  { href: '/contatos', label: 'Contatos', icon: Users, permission: 'contacts:view' },
  { href: '/empresas', label: 'Empresas', icon: Building2, permission: 'contacts:view' },
  { href: '/tarefas', label: 'Tarefas', icon: CheckSquare, permission: 'tasks:view_own' },
  { href: '/calendario', label: 'Calendário', icon: Calendar, permission: 'meetings:view' },
  { href: '/whatsapp', label: 'Conversas', icon: MessageSquare, permission: 'whatsapp:view_own' },
  { href: '/ia-agentes', label: 'IA / Agentes', icon: Bot, permission: 'ai:view' },
  { href: '/gravacoes', label: 'Gravações', icon: Mic, permission: 'recordings:view' },
  { href: '/metas', label: 'Metas', icon: Target, permission: 'goals:view' },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart2, permission: 'reports:view' },
  { href: '/configuracoes', label: 'Configurações', icon: Settings, permission: 'settings:view' },
]
```

Atualizar também os `pageTitles` em `(dashboard)/layout.tsx`.
Importar ícones: `Calendar, CheckSquare, Bot, Target` do lucide-react.

---

### TASK FE-2 — Atualizar Configurações — novas sub-páginas e sidebar
**Complexidade:** Média
**Arquivo:** frontend/src/app/(dashboard)/configuracoes/layout.tsx + novas páginas
**Depende de:** nada
**O que fazer:**

1. Atualizar o layout de configurações para mostrar menu lateral com todos os itens da spec:
   - Funis e Etapas → `/configuracoes/funis`
   - Campos Personalizados → `/configuracoes/campos`
   - Tags → `/configuracoes/tags`
   - Origens e Sub-origens → `/configuracoes/origens`
   - Motivos de Perda → `/configuracoes/motivos-perda`
   - Automações → `/configuracoes/automacoes`
   - Templates de Mensagem → `/configuracoes/templates-mensagem`
   - Formulários → `/configuracoes/formularios`
   - Integrações → `/configuracoes/integracoes`
   - Usuários e Permissões → `/configuracoes/usuarios` (já existe)
   - Metas → `/configuracoes/metas` (já existe)
   - Snapshots / Templates → `/configuracoes/snapshots`

2. Criar páginas placeholder para cada sub-rota que não existe ainda (mostrar "Em breve" com layout correto):
   - `configuracoes/funis/page.tsx`
   - `configuracoes/campos/page.tsx`
   - `configuracoes/tags/page.tsx`
   - `configuracoes/origens/page.tsx`
   - `configuracoes/motivos-perda/page.tsx`
   - `configuracoes/automacoes/page.tsx`
   - `configuracoes/templates-mensagem/page.tsx`
   - `configuracoes/formularios/page.tsx`
   - `configuracoes/integracoes/page.tsx`
   - `configuracoes/snapshots/page.tsx`

---

### TASK FE-3 — Implementar página de Calendário
**Complexidade:** Alta
**Arquivo:** frontend/src/app/(dashboard)/calendario/ (novo)
**Depende de:** BE-3
**O que fazer:**

1. Criar `app/(dashboard)/calendario/page.tsx`:
   - Calendário nativo com views: dia / semana / mês (usar biblioteca `@fullcalendar/react` ou construir com `date-fns`)
   - Exibir reuniões como eventos coloridos (cor por status)
   - Exibir tarefas com dueDate como eventos secundários
   - Filtros: por responsável, por pipeline, por tipo de reunião
   - Botão "Nova Reunião" → abre modal

2. Criar `components/meetings/MeetingModal.tsx`:
   - Formulário para criar/editar reunião
   - Campos: título, tipo, oportunidade (search), contato, host (Closer), data/hora início e fim, localização, videoLink, briefing SDR
   - Ao salvar: POST /api/meetings
   - Mostrar disponibilidade do Closer ao selecionar data (GET /api/calendar/availability/:userId)

3. Criar `components/meetings/MeetingCard.tsx`:
   - Card compacto exibido no calendário
   - Mostra: título, horário, host, status badge, contact name

4. Criar `components/meetings/MeetingSheet.tsx`:
   - Detalhes completos da reunião em Sheet lateral
   - Ações: Confirmar / Reagendar / Cancelar / Marcar No-show
   - Notas do Closer após reunião
   - Link para oportunidade e contato

5. Criar `hooks/useMeetings.ts`:
   - CRUD calls para /api/meetings
   - useQuery para listar, useMutation para criar/atualizar

---

### TASK FE-4 — Melhorar OpportunitySheet com todos os campos e handoff
**Complexidade:** Alta
**Arquivo:** frontend/src/components/kanban/OpportunitySheet.tsx (expandir)
**Depende de:** BE-1, BE-3
**O que fazer:**

Expandir o OpportunitySheet com as seguintes seções (accordion / abas):

1. **Header**: título, pipeline+etapa (badges), valor, temperatura indicator, tags

2. **Aba "Detalhes"**:
   - Contato (com link para perfil)
   - Empresa
   - Responsável (assignedTo), SDR, Closer
   - Origem + Sub-origem
   - Canal
   - Temperatura
   - Valor, valor mensal, parcelas

3. **Aba "Campos Personalizados"**:
   - Renderizar CustomFieldGroups como accordion
   - Cada grupo mostra seus campos
   - Campos com required_in_stages destacados se na etapa atual
   - Edição inline: clique no campo → input/select apropriado → salvar no onBlur

4. **Aba "Tarefas"**:
   - Lista de tarefas vinculadas
   - Botão "Nova Tarefa"
   - Indicador SLA breach (vermelho se vencida)

5. **Aba "Reuniões"**:
   - Lista de reuniões da oportunidade
   - Próxima reunião destacada
   - Botão "Agendar Reunião"

6. **Aba "Conversas"**:
   - Histórico de mensagens WhatsApp/Email
   - Link para abrir conversa no inbox

7. **Aba "Atividades"**:
   - Timeline de atividades + stage history

8. **Seção "Handoff SDR → Closer"** (aparecer quando stage = handoff_stage_id):
   - Formulário de briefing estruturado
   - Campos obrigatórios do handoff destacados
   - Botão "Fazer Handoff" → POST /api/opportunities/:id/handoff
   - Após handoff: mudar assignedTo para Closer, mostrar confirmação

---

### TASK FE-5 — Implementar configuração de Campos Personalizados
**Complexidade:** Alta
**Arquivo:** frontend/src/app/(dashboard)/configuracoes/campos/page.tsx (novo)
**Depende de:** BE-1 (custom fields expandidos)
**O que fazer:**

1. Criar `configuracoes/campos/page.tsx`:
   - Tabs para: Oportunidade / Contato / Empresa
   - Lista de grupos (accordion draggable)
   - Dentro de cada grupo: lista de campos draggable
   - Botões: "Novo Grupo", "Novo Campo"

2. Criar `components/custom-fields/CustomFieldGroupCard.tsx`:
   - Accordion com nome do grupo
   - Toggle "colapsado por padrão"
   - Lista de campos dentro

3. Criar `components/custom-fields/CustomFieldEditor.tsx`:
   - Modal/sheet para criar/editar campo
   - Campos: nome, tipo (select com todos os tipos), slug (auto-gerado do nome)
   - Configuração de options (para select/multiselect): lista editável de opções
   - Toggle: obrigatório globalmente
   - Configuração por etapa: obrigatório em / visível em
   - Toggle: mostrar no card kanban
   - Tooltip e placeholder

4. Criar `components/custom-fields/CustomFieldRenderer.tsx`:
   - Componente genérico que renderiza um campo baseado no fieldType
   - TEXT → Input
   - TEXTAREA → Textarea
   - NUMBER/DECIMAL/CURRENCY → Input type="number"
   - DATE/DATETIME → DatePicker
   - SELECT → Select
   - MULTISELECT → MultiSelect (com badges)
   - CHECKBOX → Checkbox
   - URL/PHONE/EMAIL → Input com validação
   - FILE → FileUpload

---

### TASK FE-6 — Melhorar página de Tarefas com fila "Minha Agenda"
**Complexidade:** Média
**Arquivo:** frontend/src/app/(dashboard)/tarefas/page.tsx (reescrever)
**Depende de:** BE-2
**O que fazer:**

1. Redesenhar página de tarefas com 3 views/tabs:
   - **"Hoje"**: tarefas de hoje ordenadas por prioridade (URGENT → HIGH → MEDIUM → LOW)
   - **"Esta Semana"**: tarefas dos próximos 7 dias agrupadas por dia
   - **"Atrasadas"**: tarefas vencidas com destaque visual

2. Criar `components/tasks/TaskCard.tsx`:
   - Título, tipo (badge com emoji), oportunidade/contato vinculado (link)
   - Due date + indicador de SLA breach (vermelho se vencida)
   - Prioridade (indicador colorido)
   - Botão "Concluir" → abre modal de conclusão
   - Botão "Pular" → confirma com reason

3. Criar `components/tasks/TaskCompleteModal.tsx`:
   - Input obrigatório de completion notes
   - Botão confirmar → PUT /api/tasks/:id/complete

4. Criar `components/tasks/TaskCreateModal.tsx`:
   - Formulário de criação de tarefa
   - Vincular a oportunidade ou contato (search)
   - Tipo, prioridade, data, responsável

5. Adicionar filtros na página: por tipo, por prioridade, por oportunidade

---

### TASK FE-7 — Criar página de Contato (perfil completo)
**Complexidade:** Média
**Arquivo:** frontend/src/app/(dashboard)/contatos/[id]/page.tsx (novo)
**Depende de:** BE-14
**O que fazer:**

1. Criar `contatos/[id]/page.tsx`:
   - Header: avatar, nome, empresa, tags
   - Dados de contato: email, phone, CPF, aniversário
   - Endereço
   - Redes sociais
   - Notas
   - Badge "Blacklisted" se isBlacklisted = true

2. Seções em tabs/accordion:
   - **Oportunidades**: lista de oportunidades vinculadas (abertas + fechadas)
   - **Conversas**: histórico de conversas WhatsApp
   - **Tarefas**: tarefas vinculadas
   - **Atividades**: timeline de atividades
   - **Campos Personalizados**: campos do tipo contact

3. Botões de ação:
   - Editar dados
   - Nova Oportunidade
   - Enviar Mensagem (WhatsApp)
   - Marcar blacklisted

---

### TASK FE-8 — Criar página de IA / Agentes
**Complexidade:** Média
**Arquivo:** frontend/src/app/(dashboard)/ia-agentes/page.tsx (novo)
**Depende de:** BE-7
**O que fazer:**

1. Criar `ia-agentes/page.tsx`:
   - Lista de AIAgents do tenant
   - Cada agente: nome, tipo, modelo, status (ativo/inativo), contagem de sugestões

2. Criar `components/ai/AIAgentCard.tsx`:
   - Card com nome, tipo badge, modelo, toggle ativo/inativo
   - Link para editar

3. Criar `components/ai/AIAgentEditor.tsx`:
   - Modal/sheet para criar/editar agente
   - Campos: nome, tipo (select), modelo (select: gpt-4o, gpt-4o-mini, etc.)
   - System prompt (textarea grande)
   - Context config (checkboxes: incluir mensagens recentes, dados da oportunidade, etc.)
   - Temperature slider (0.0 a 1.0)
   - Max tokens input
   - Botão "Testar agente" com input manual

4. Seção de estatísticas: total de sugestões, taxa de aprovação, taxa de edição, taxa de rejeição

---

### TASK FE-9 — Criar página de Gravações
**Complexidade:** Alta
**Arquivo:** frontend/src/app/(dashboard)/gravacoes/page.tsx (novo)
**Depende de:** BE-8
**O que fazer:**

1. Criar `gravacoes/page.tsx`:
   - Lista de gravações do tenant
   - Filtros: por closer, por oportunidade, por status
   - Botão "Upload Nova Gravação"

2. Criar `components/recordings/RecordingUploadModal.tsx`:
   - Drag & drop ou browse de arquivo de áudio/vídeo
   - Selecionar oportunidade (search)
   - Selecionar closer responsável
   - Título
   - Botão upload → POST /api/recordings/upload (multipart)
   - Barra de progresso

3. Criar `components/recordings/RecordingCard.tsx`:
   - Status badge (Aguardando / Transcrevendo / Analisando / Pronto / Erro)
   - Player de áudio básico (HTML5 audio)
   - Link para oportunidade
   - Se READY: mostrar overall_score (número + gauge colorido)
   - Botão "Ver Análise"

4. Criar `components/recordings/RecordingAnalysisSheet.tsx`:
   - Sheet lateral com análise completa da IA:
     - Score geral (grande, com cor: 0-5 vermelho, 6-7 amarelo, 8-10 verde)
     - Pontos fortes (lista com ícones ✓)
     - Pontos de melhoria (lista com ícones !)
     - Objeções detectadas
     - Itens de ação
     - Resumo da conversa
   - Transcrição completa (collapsable, com busca)
   - Tarefas geradas automaticamente (lista com status)

---

### TASK FE-10 — Criar página de Metas
**Complexidade:** Média
**Arquivo:** frontend/src/app/(dashboard)/metas/page.tsx (novo)
**Depende de:** BE-9
**O que fazer:**

1. Criar `metas/page.tsx`:
   - Overview: progresso geral das metas ativas
   - Lista de metas com progress bar
   - Filtros: por período, por tipo, por escopo

2. Criar `components/goals/GoalCard.tsx`:
   - Nome da meta, tipo, período
   - Progress bar colorida (vermelho < 50%, amarelo 50-80%, verde > 80%)
   - Valor atual vs target (ex: "R$ 45.000 / R$ 100.000")
   - % de progresso em destaque

3. Criar `components/goals/GoalCreateModal.tsx`:
   - Nome, tipo (select), período (tipo + datas início/fim)
   - Target value
   - Escopo: Global / Por usuário (select usuário) / Por canal
   - Ao salvar: POST /api/goals

4. Criar `components/goals/GoalDetailSheet.tsx`:
   - Progresso detalhado
   - Breakdown por canal (se configurado)
   - Histórico de evolução (chart de linha com DailyMetrics)

5. Também atualizar `/configuracoes/metas/page.tsx` (já existe) para configuração das metas (CRUD admin).

---

### TASK FE-11 — Implementar configuração de Funis e Etapas
**Complexidade:** Alta
**Arquivo:** frontend/src/app/(dashboard)/configuracoes/funis/page.tsx (novo)
**Depende de:** BE-16, BE-4
**O que fazer:**

1. Criar `configuracoes/funis/page.tsx`:
   - Lista de funis com edição inline de nome/tipo
   - Botão "Novo Funil"
   - Cada funil: link para configuração detalhada

2. Criar `configuracoes/funis/[id]/page.tsx`:
   - Header: nome do funil, tipo, prefix, toggle ativo/inativo
   - Seção de Etapas: lista draggable de etapas
     - Cada etapa: cor (color picker), nome, tipo (NORMAL/WON/LOST), probabilidade
     - Botão "+" para adicionar campos obrigatórios de entrada
     - Botão de edição expandida

3. Criar `components/pipeline-config/StageConfigCard.tsx`:
   - Card expandível por etapa
   - Configurar: nome, cor, tipo, probabilidade, descrição/tooltip
   - Required fields na ENTRADA (multiselect de custom fields)
   - Visible fields (multiselect)
   - Auto-create tasks (lista de templates)

4. Implementar **Digital Pipeline** (automações visuais por etapa):
   - Abaixo de cada etapa, mostrar triggers ativos (como Kommo)
   - Cada trigger: ícone do tipo de ação, nome, status toggle
   - Botão "+" para adicionar trigger
   - Modal de criação de StageTrigger (select evento, condições, ação, config)

5. Criar `components/pipeline-config/TriggerEditor.tsx`:
   - Select: "Quando" (trigger_event)
   - Seção de condições (add/remove rows)
   - Select: "O que fazer" (action_type)
   - Configuração específica por action_type (dinâmica)
   - Toggle: horário de funcionamento

6. Seção de configuração SDR/Closer do pipeline:
   - Select multiselect de etapas SDR vs etapas Closer
   - Select etapa de handoff
   - Select campos obrigatórios no handoff
   - Config de atribuição automática do Closer

---

### TASK FE-12 — Criar Builder de SalesBot (Automações Camada 2)
**Complexidade:** Alta (mais complexa do sistema)
**Arquivo:** frontend/src/app/(dashboard)/configuracoes/automacoes/[id]/page.tsx (novo)
**Depende de:** BE-5
**O que fazer:**

1. Criar `configuracoes/automacoes/page.tsx`:
   - Lista de SalesBots do tenant
   - Cada bot: nome, tipo, status, contagem de execuções
   - Botão "Novo Bot", botão "Importar JSON"

2. Criar `configuracoes/automacoes/[id]/page.tsx` — o Builder visual:
   - Canvas de arrastar e soltar (usar `reactflow` ou `@xyflow/react`)
   - Toolbar lateral com tipos de steps (drag para o canvas)
   - Cada step é um nó do graph com: ícone do tipo, preview do config
   - Conexões entre steps (edges com labels opcionais)
   - Ao clicar em step: painel de configuração lateral

3. Criar `components/salesbot/StepNode.tsx` — nó individual no canvas:
   - Header com ícone + tipo do step
   - Preview resumido da config
   - Handles de entrada/saída para conexões

4. Criar `components/salesbot/StepConfigPanel.tsx` — painel de configuração do step selecionado:
   - Formulário dinâmico baseado no step.type:
     - send_message: textarea de texto, select de template
     - send_message_with_buttons: texto + lista de botões editável
     - wait: duração em minutos/horas/dias
     - wait_for_response: timeout + on_response/on_timeout
     - condition: lista de regras (field + operator + value + next_step)
     - collect_field: pergunta + select de campo + validação
     - Ações: set_field, add_tag, change_stage, etc.

5. Toolbar:
   - Botão "Salvar" → PUT /api/salesbots/:id
   - Botão "Exportar JSON"
   - Botão "Testar" (executa com oportunidade de teste)

6. Criar `components/salesbot/BotExecutionLog.tsx` — log de execuções em sheet lateral

---

### TASK FE-13 — Criar páginas de Configurações faltantes (Tags, Origens, Motivos de Perda, Templates)
**Complexidade:** Média
**Arquivos:** múltiplas páginas em configuracoes/
**Depende de:** nada (CRUD simples)
**O que fazer:**

1. `configuracoes/tags/page.tsx`:
   - Tabela de tags: nome, cor (badge colorido), categoria, locked status
   - Criar/editar/deletar tags (admin apenas para isLocked)
   - Color picker para a cor da tag

2. `configuracoes/origens/page.tsx`:
   - Tabela de origens com sub-origens em expand
   - CRUD origens + sub-origens

3. `configuracoes/motivos-perda/page.tsx`:
   - Tabela simples de motivos de perda
   - CRUD com toggle ativo/inativo

4. `configuracoes/templates-mensagem/page.tsx`:
   - Lista de templates por canal (WhatsApp / Email)
   - Editor de template com preview de variáveis
   - Suporte a botões para WhatsApp

5. `configuracoes/integracoes/page.tsx`:
   - Cards de integrações disponíveis:
     - **WhatsApp** → link para /configuracoes/whatsapp
     - **Google Calendar** → OAuth connect button + status
     - **OpenAI** → input de API key do tenant (salva encryptado)

---

### TASK FE-14 — Melhorar Dashboard com widgets completos
**Complexidade:** Alta
**Arquivo:** frontend/src/app/(dashboard)/page.tsx + componentes dashboard
**Depende de:** BE-10
**O que fazer:**

1. Redesenhar `app/(dashboard)/page.tsx`:
   - Grid responsivo de widgets
   - Widgets v1 (fixo conforme spec):

2. Criar/atualizar `components/dashboard/GoalProgressWidget.tsx`:
   - Barra de progresso colorida
   - Valor atual vs target
   - Nome e período da meta

3. Criar `components/dashboard/ConversionFunnelWidget.tsx`:
   - Funil visual (barras decrescentes por etapa)
   - % de conversão entre etapas

4. Criar `components/dashboard/ForecastWidget.tsx`:
   - Valor previsto de fechamento (sum value * probability)
   - Por pipeline/período

5. Criar `components/dashboard/SDRMetricsWidget.tsx`:
   - Leads atribuídos, meetings agendados, taxa conv. para meeting

6. Criar `components/dashboard/CloserMetricsWidget.tsx`:
   - Oportunidades, ganhos, ticket médio, taxa de fechamento

7. Criar `components/dashboard/SalesVelocityWidget.tsx`:
   - Score numérico + breakdowns

8. Criar `components/dashboard/TopLossReasonsWidget.tsx`:
   - Lista ordenada de motivos de perda com contagem

9. Criar `components/dashboard/UpcomingMeetingsWidget.tsx`:
   - Próximas 5 reuniões com data/hora e contato

10. Atualizar `components/dashboard/KpiCard.tsx`:
    - Suportar indicador de variação (MoM %)
    - Ícone colorido por tipo

---

### TASK FE-15 — Criar módulo de Formulários
**Complexidade:** Média
**Arquivo:** frontend/src/app/(dashboard)/configuracoes/formularios/page.tsx (novo)
**Depende de:** BE-11
**O que fazer:**

1. Criar `configuracoes/formularios/page.tsx`:
   - Lista de formulários ativos
   - Botão "Novo Formulário"
   - Cada form: nome, slug, status, link de embed/submissão

2. Criar `components/forms/FormBuilder.tsx`:
   - Lista de campos do form (draggable para reordenar)
   - Tipos de campo disponíveis: text, email, phone, select, textarea, checkbox
   - Configurar: label, placeholder, required
   - Preview em tempo real

3. Criar `components/forms/FormSettings.tsx`:
   - Pipeline destino + etapa inicial
   - Responsável automático
   - URL de redirecionamento
   - Toggle UTM tracking

4. Criar página pública de form: `app/forms/[slug]/page.tsx` (fora do dashboard):
   - Renderizar campos do form
   - Enviar para POST /api/forms/:slug/submit
   - Mostrar mensagem de confirmação ou redirect

---

### TASK FE-16 — Melhorar análise de Transcrições (já existe, expandir)
**Complexidade:** Média
**Arquivo:** frontend/src/app/(dashboard)/transcricoes/page.tsx + gravacoes/page.tsx
**Depende de:** BE-8
**O que fazer:**

1. A página `/transcricoes` existente usa o modelo antigo (CallTranscription).
2. Criar ou adaptar para usar o novo modelo Recording (BE-8).
3. Unificar com a nova página `/gravacoes` criada em FE-9.
4. Considerar manter `/transcricoes` como redirect para `/gravacoes` por compatibilidade.

---

### TASK FE-17 — Criar página de Snapshots / Account Templates
**Complexidade:** Média
**Arquivo:** frontend/src/app/(dashboard)/configuracoes/snapshots/page.tsx (novo)
**Depende de:** BE-12
**O que fazer:**

1. Criar `configuracoes/snapshots/page.tsx`:
   - Seção "Templates públicos" — grid de cards por categoria (Clínica, E-commerce, etc.)
   - Seção "Meus snapshots" — snapshots criados pelo tenant

2. Criar `components/templates/AccountTemplateCard.tsx`:
   - Nome, categoria, descrição
   - Botão "Aplicar" → confirma e chama POST /api/account-templates/:id/apply

3. Criar `components/templates/CreateSnapshotModal.tsx`:
   - Nome e descrição do snapshot
   - Toggle "público"
   - Botão criar → POST /api/account-templates

---

### TASK FE-18 — Adicionar rotas faltantes ao sistema de navegação
**Complexidade:** Baixa
**Arquivos:** frontend/src/app/(dashboard)/
**Depende de:** FE-1
**O que fazer:**

Criar páginas placeholder (estrutura básica) para:
- `calendario/page.tsx` — implementado em FE-3
- `ia-agentes/page.tsx` — implementado em FE-8
- `gravacoes/page.tsx` — implementado em FE-9
- `metas/page.tsx` — implementado em FE-10

Também garantir que o `(dashboard)/layout.tsx` tenha `pageTitles` atualizados para todas as rotas.

---

### TASK FE-19 — Melhorar página de Leads
**Complexidade:** Baixa
**Arquivo:** frontend/src/app/(dashboard)/leads/page.tsx (expandir)
**Depende de:** BE-1
**O que fazer:**

1. Adicionar filtros: status (NEW/NURTURING/QUALIFIED/DISQUALIFIED), score
2. Mostrar score como progress bar colorida
3. Botão "Qualificar" → modal para selecionar pipeline/etapa e converter em Oportunidade
4. Botão "Desqualificar" → modal com reason
5. Coluna de origem/sub-origem na tabela

---

## ORDEM DE EXECUÇÃO

```
FE-1 (sidebar) — independente, fazer primeiro
FE-2 (config sub-páginas) — independente, fazer em paralelo com FE-1

Após FE-1 e FE-2:
FE-18 (rotas placeholder) — rápido, desbloqueia navegação

Em paralelo:
FE-3 (calendário) — depende de BE-3
FE-6 (tarefas melhoradas) — depende de BE-2
FE-7 (perfil contato) — depende de BE-14
FE-13 (config simples: tags, origens, etc.) — independente
FE-19 (leads melhorado) — depende de BE-1

Após base pronta:
FE-4 (opportunity sheet completo) — depende de BE-1, BE-3
FE-5 (campos personalizados config) — depende de schema
FE-8 (ia-agentes) — depende de BE-7
FE-9 (gravações) — depende de BE-8
FE-10 (metas) — depende de BE-9
FE-14 (dashboard melhorado) — depende de BE-10

Complexas (deixar por último):
FE-11 (config funis + digital pipeline) — depende de BE-4, BE-16
FE-12 (salesbot builder) — depende de BE-5
FE-15 (formulários) — depende de BE-11
FE-17 (snapshots) — depende de BE-12
FE-16 (transcrições migrate) — depende de BE-8
```

## NOTAS IMPORTANTES

- Usar `react-query` (TanStack Query) para todos os fetches — já está no projeto
- Manter padrão visual do projeto: dark sidebar + light content área
- Todos os modals devem ser Dialog do shadcn/ui
- Sheets laterais (SlideOver) para detalhes de entidades
- Usar `react-beautiful-dnd` ou `@dnd-kit/core` para drag-and-drop (kanban já usa, expandir)
- Para o SalesBot Builder (FE-12): instalar `@xyflow/react` (ReactFlow)
- Para calendário (FE-3): usar `@fullcalendar/react` com plugins dayGrid + timeGrid
- Todos os formulários: `react-hook-form` + `zod` para validação — padrão já existente
