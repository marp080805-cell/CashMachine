# INFRA TASKS — CashMind CRM

**Repositório:** c:/Users/marp0/OneDrive/Área de Trabalho/Projetos Ativos/Claude Code/CashMind/CashMachine
**Stack:** Docker Compose + Nginx + Redis + BullMQ + PostgreSQL
**Referência:** .claude/specs/spec_2026-03-26.md

---

## ESTADO ATUAL DA INFRA

### O que já existe:
- `docker-compose.yml` — serviços: redis, api (Fastify), frontend (Next.js), nginx
- Rede: `cashmind_network`
- Redis configurado com 256mb maxmemory (allkeys-lru)
- API exposta em 127.0.0.1:3011
- Nginx em 0.0.0.0:8002
- Queues BullMQ: ai-suggestion, email, notification, transcription
- `.env` com variáveis de ambiente
- Evolution API em `evolution/` (serviço separado)

### O que FALTA:
- Variáveis de ambiente para novas features (OpenAI por tenant, storage, Google Calendar OAuth)
- Worker de trigger (BullMQ) para StageTriggers
- Worker de bot-execution para SalesBots
- Worker de recording-analysis para análise IA de gravações
- Worker de daily-metrics para cron diário
- Storage de arquivos para gravações (local ou S3/R2)
- Cron jobs para: StageTrigger tipo SCHEDULED, DailyMetrics, SLA breach check
- Possível serviço dedicado para bot execution (heavy workload)

---

## TAREFAS

### TASK INFRA-1 — Atualizar variáveis de ambiente (.env.example)
**Complexidade:** Baixa
**Arquivo:** criar `backend/.env.example` e atualizar `.env.example` na raiz
**Depende de:** nada
**O que fazer:**

Criar/atualizar `backend/.env.example` com todas as variáveis necessárias:

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/cashmind"

# Auth
JWT_SECRET="your-jwt-secret-here"
JWT_EXPIRY="7d"

# Server
NODE_ENV="production"
PORT=3011
API_PREFIX="/api"

# Redis
REDIS_URL="redis://cashmind_redis:6379"

# WhatsApp (Evolution API)
EVOLUTION_API_URL="http://evolution:8080"
EVOLUTION_API_KEY="your-evolution-key"

# OpenAI (sistema — fallback quando tenant não tem própria key)
OPENAI_API_KEY="sk-..."
OPENAI_DEFAULT_MODEL="gpt-4o"

# Storage de arquivos (gravações)
STORAGE_TYPE="local"  # "local" | "s3" | "r2"
STORAGE_LOCAL_PATH="/app/uploads"
STORAGE_BASE_URL="https://your-domain.com/uploads"

# AWS S3 (se STORAGE_TYPE=s3)
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_REGION="us-east-1"
AWS_S3_BUCKET="cashmind-recordings"

# Cloudflare R2 (se STORAGE_TYPE=r2)
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET="cashmind-recordings"
R2_PUBLIC_URL="https://pub-xxx.r2.dev"

# Google Calendar OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="https://your-domain.com/api/calendar/oauth/callback"

# Encryption (para tokens OAuth e API keys dos tenants)
ENCRYPTION_KEY="32-byte-hex-key-for-aes256"

# Email (para notificações)
SMTP_HOST=""
SMTP_PORT=587
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="noreply@cashmind.com.br"

# Frontend URL (para links de booking pages, formulários)
APP_URL="https://your-domain.com"

# Whisper / Transcrição
WHISPER_PROVIDER="openai"  # "openai" | "deepgram" | "assembly_ai"
DEEPGRAM_API_KEY=""
ASSEMBLY_AI_API_KEY=""

# BullMQ
BULL_REDIS_URL="redis://cashmind_redis:6379"
```

Criar também `frontend/.env.example`:
```bash
NEXT_PUBLIC_API_URL="https://your-domain.com/api"
NEXT_PUBLIC_WS_URL="wss://your-domain.com"
NEXT_PUBLIC_APP_URL="https://your-domain.com"
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-nextauth-secret"
```

---

### TASK INFRA-2 — Adicionar volumes para storage de gravações no Docker Compose
**Complexidade:** Baixa
**Arquivo:** docker-compose.yml
**Depende de:** INFRA-1
**O que fazer:**

Adicionar volume para uploads na API:
```yaml
cashmind_api:
  # ... existente ...
  volumes:
    - cashmind_uploads:/app/uploads

volumes:
  cashmind_redis_data:
  cashmind_uploads:   # NOVO
```

Atualizar Nginx para servir arquivos de upload (quando STORAGE_TYPE=local):
```nginx
# Em nginx/cashmind.conf, adicionar location:
location /uploads/ {
  proxy_pass http://cashmind_api:3011/uploads/;
  # OU se servindo diretamente:
  alias /var/uploads/;
  expires 1y;
  add_header Cache-Control "public, immutable";
}
```

Se usando Nginx para servir arquivos direto, adicionar volume ao nginx:
```yaml
cashmind_nginx:
  volumes:
    - ./nginx/cashmind.conf:/etc/nginx/conf.d/default.conf:ro
    - cashmind_uploads:/var/uploads:ro  # NOVO (se serving direto)
```

---

### TASK INFRA-3 — Configurar novos workers BullMQ no backend
**Complexidade:** Média
**Arquivo:** backend/src/index.ts + backend/src/queues/
**Depende de:** BE-4, BE-5, BE-8, BE-13
**O que fazer:**

Em `backend/src/index.ts`, no bootstrap(), iniciar os novos workers:
```typescript
// Importar
import { startTriggerWorker } from './queues/trigger.queue'
import { startBotExecutionWorker } from './queues/bot-execution.queue'
import { startRecordingAnalysisWorker } from './queues/recording-analysis.queue'
import { startDailyMetricsWorker } from './queues/daily-metrics.queue'

// No bootstrap()
startTriggerWorker()
startBotExecutionWorker()
startRecordingAnalysisWorker()
startDailyMetricsWorker()
```

Garantir que todos os workers tenham:
- Tratamento de erros com retry (maxAttempts: 3, backoff exponencial)
- Log de erros estruturado
- Graceful shutdown no SIGTERM

Criar `backend/src/queues/cron.queue.ts`:
- Usar BullMQ repeat jobs para:
  - DailyMetrics: todo dia às 01:00 (cron: "0 1 * * *")
  - SLA breach check: a cada hora (cron: "0 * * * *")
  - StageTrigger SCHEDULED: verificar triggers agendados a cada minuto (cron: "* * * * *")
  - SalesBot `after_time_in_stage`: verificar oportunidades elegíveis a cada 15 min

Iniciar também: `startCronWorker()` no bootstrap.

---

### TASK INFRA-4 — Configurar rota de arquivos estáticos no Fastify
**Complexidade:** Baixa
**Arquivo:** backend/src/index.ts
**Depende de:** INFRA-2
**O que fazer:**

Quando STORAGE_TYPE=local, o Fastify deve servir arquivos de `/app/uploads`:

```typescript
// Instalar: npm install @fastify/static
import staticPlugin from '@fastify/static'
import path from 'path'

// No bootstrap(), condicional:
if (process.env.STORAGE_TYPE === 'local') {
  await app.register(staticPlugin, {
    root: process.env.STORAGE_LOCAL_PATH || '/app/uploads',
    prefix: '/uploads/',
    decorateReply: false,
  })
}
```

Criar `backend/src/lib/storage.service.ts`:
```typescript
// Service genérico de storage com suporte a local/S3/R2
export async function uploadFile(buffer: Buffer, filename: string, contentType: string): Promise<string>
export async function deleteFile(fileUrl: string): Promise<void>
export async function getSignedUrl(fileUrl: string, expiresIn: number): Promise<string>
```

---

### TASK INFRA-5 — Configurar encryption para API keys e OAuth tokens
**Complexidade:** Média
**Arquivo:** backend/src/lib/encryption.ts (novo)
**Depende de:** INFRA-1
**O que fazer:**

Criar `backend/src/lib/encryption.ts`:
```typescript
// AES-256-GCM encryption para:
// - tenant.openaiApiKey
// - CalendarIntegration.accessToken e refreshToken
// - WhatsappNumber.apiKey

import crypto from 'crypto'

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')

export function encrypt(text: string): string {
  // retorna "iv:encryptedText" como string hex
}

export function decrypt(encryptedText: string): string {
  // reverso do encrypt
}
```

Usar nas rotas que recebem/retornam estas keys:
- Ao salvar: encrypt() antes do Prisma
- Ao retornar: NUNCA retornar a key decryptada para o frontend (exceto para uso interno no servidor)
- Ao usar (ex: chamar OpenAI): decrypt() internamente no service

---

### TASK INFRA-6 — Atualizar Dockerfile do backend para suporte a uploads
**Complexidade:** Baixa
**Arquivo:** backend/Dockerfile
**Depende de:** INFRA-2
**O que fazer:**

Verificar e atualizar `backend/Dockerfile` para:
1. Garantir que `ffmpeg` está instalado (para processar áudio/vídeo se necessário)
2. Criar diretório `/app/uploads` com permissões corretas
3. Garantir que sharp/canvas não é necessário (só Whisper/OpenAI)

```dockerfile
# Adicionar ao Dockerfile existente (alpine package)
RUN apk add --no-cache ffmpeg

# Criar diretório de uploads
RUN mkdir -p /app/uploads && chmod 755 /app/uploads
```

---

### TASK INFRA-7 — Configurar BullMQ Board (monitoring opcional)
**Complexidade:** Baixa
**Arquivo:** backend/src/index.ts (opcional, só dev)
**Depende de:** INFRA-3
**O que fazer:**

Para monitoramento de filas em desenvolvimento/staging:
```typescript
// Instalar: npm install @bull-board/fastify @bull-board/api
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { FastifyAdapter } from '@bull-board/fastify'

if (process.env.NODE_ENV !== 'production') {
  const serverAdapter = new FastifyAdapter()
  createBullBoard({
    queues: [/* todas as queues */],
    serverAdapter,
  })
  serverAdapter.setBasePath('/admin/queues')
  app.register(serverAdapter.registerPlugin(), { basePath: '/', prefix: '/admin/queues' })
}
```

---

### TASK INFRA-8 — Script de migration e deploy
**Complexidade:** Baixa
**Arquivo:** Makefile + scripts/
**Depende de:** DB-20
**O que fazer:**

Atualizar `Makefile` com targets úteis:
```makefile
migrate:
  docker compose exec cashmind_api npx prisma migrate deploy

seed:
  docker compose exec cashmind_api npx ts-node prisma/seed.ts

migrate-dev:
  cd backend && npx prisma migrate dev

generate:
  cd backend && npx prisma generate

studio:
  cd backend && npx prisma studio

logs-api:
  docker compose logs -f cashmind_api

logs-all:
  docker compose logs -f

rebuild:
  docker compose up -d --build

deploy:
  git pull origin claude/cashmachine-b2b-platform-pL5Y2
  docker compose up -d --build
  docker compose exec cashmind_api npx prisma migrate deploy
```

---

### TASK INFRA-9 — Configurar health checks no Docker Compose
**Complexidade:** Baixa
**Arquivo:** docker-compose.yml
**Depende de:** nada
**O que fazer:**

Adicionar health checks para garantir ordem de startup:

```yaml
cashmind_api:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3011/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s

cashmind_redis:
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 3

cashmind_frontend:
  depends_on:
    cashmind_api:
      condition: service_healthy
```

Adicionar endpoint `GET /health` na API:
```typescript
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))
```

---

## ORDEM DE EXECUÇÃO

```
INFRA-1 (variáveis de ambiente) — PRIMEIRO, tudo depende
       ↓
INFRA-5 (encryption) — depende de INFRA-1
       ↓
INFRA-2 (volumes Docker) — independente
INFRA-4 (storage service) — depende de INFRA-2
INFRA-6 (Dockerfile) — independente, pode ser paralelo
INFRA-9 (health checks) — independente
       ↓
INFRA-3 (workers BullMQ) — depende de BE-4, BE-5, BE-8, BE-13
       ↓
INFRA-7 (BullMQ Board) — opcional, depende de INFRA-3
INFRA-8 (scripts deploy) — depende de DB-20
```

## NOTAS IMPORTANTES

1. **ENCRYPTION_KEY**: gerar com `openssl rand -hex 32` e guardar no .env da VPS — nunca commitar no git
2. **STORAGE_TYPE**: para MVP, usar `local` com volume Docker. Para produção escalar, migrar para R2 (mais barato que S3)
3. **Workers BullMQ**: todos os workers devem ser idempotentes — podem ser executados múltiplas vezes sem efeito colateral (usar upsert quando possível)
4. **StageTrigger SCHEDULED**: o cron de 1 em 1 minuto só verifica triggers marcados como `SCHEDULED`. Usar índice no banco para não fazer full scan.
5. **Graceful shutdown**: ao receber SIGTERM, parar de aceitar novos jobs, aguardar jobs em execução completarem (timeout 30s), então fechar.
