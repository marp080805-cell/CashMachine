# CashMind — Plataforma Comercial B2B

Central de gestão comercial com CRM Kanban, WhatsApp multi-número com sugestões IA, planejamento de canais, relatórios e transcrição de chamadas.

## Pré-requisitos

- Docker + Docker Compose v2
- Conta [Supabase](https://supabase.com) (projeto criado)
- **Evolution API** já instalada e rodando (externa a este projeto) — [docs](https://doc.evolution-api.com)
- Chave API [OpenAI](https://platform.openai.com) (GPT-4o-mini + Whisper)
- Chave API [Resend](https://resend.com) para e-mails
- Domínio com SSL (Let's Encrypt) para produção
- Nginx instalado no servidor (opcional para produção)

## Configuração

### 1. Clone e configure variáveis de ambiente

```bash
git clone <repo-url> cashmind
cd cashmind
cp .env.example .env
```

Edite `.env` com seus valores:

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | URL pooled do Supabase (porta 6543 com `?pgbouncer=true`) |
| `DIRECT_URL` | URL direta do Supabase (porta 5432, sem pgbouncer) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anon do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (backend apenas) |
| `JWT_SECRET` | String aleatória ≥ 32 chars (use `openssl rand -hex 32`) |
| `EVOLUTION_API_KEY` | Chave de acesso da Evolution API |
| `OPENAI_API_KEY` | Chave da OpenAI |
| `RESEND_API_KEY` | Chave do Resend |
| `EMAIL_FROM` | Remetente dos e-mails (ex: `CashMind <no-reply@seudominio.com>`) |
| `NEXT_PUBLIC_API_URL` | URL pública da API (ex: `https://app.seudominio.com/api`) |
| `NEXT_PUBLIC_WS_URL` | URL pública do WebSocket (ex: `wss://app.seudominio.com`) |

### 2. Subir com Docker

```bash
make up
```

Aguarde os containers iniciarem (~30s na primeira vez enquanto baixa as imagens).

### 3. Rodar migrations do banco

```bash
make migrate
```

### 4. Popular com dados iniciais

```bash
make seed
```

### 5. Acessar

- **Frontend**: http://localhost:3010
- **API**: http://localhost:3011
- **Evolution API**: http://localhost:8080
- **Prisma Studio**: `make studio` → http://localhost:5555

## Credenciais padrão (seed)

| Usuário | E-mail | Senha | Perfil |
|---------|--------|-------|--------|
| Admin | admin@cashmind.com | Admin@123 | ADMIN |
| Gestor | gestor@cashmind.com | Gestor@123 | GESTOR |
| SDR 1 | sdr1@cashmind.com | Sdr@123 | SDR |
| SDR 2 | sdr2@cashmind.com | Sdr@123 | SDR |
| Closer | closer@cashmind.com | Closer@123 | CLOSER |

> **Atenção:** Troque todas as senhas antes de ir para produção.

## Comandos úteis

```bash
make up        # Sobe todos os containers (build + start)
make down      # Para e remove os containers
make logs      # Acompanha logs em tempo real
make migrate   # Aplica migrations do Prisma
make studio    # Abre o Prisma Studio (GUI do banco)
make seed      # Popula o banco com dados iniciais
make restart   # Reinicia api e frontend sem rebuild
```

## Configurar Nginx (produção)

Copie o arquivo de configuração para o Nginx do servidor — **não substitua** o nginx.conf principal:

```bash
sudo cp nginx/cashmind.conf /etc/nginx/sites-available/cashmind
sudo ln -s /etc/nginx/sites-available/cashmind /etc/nginx/sites-enabled/
```

Edite o arquivo trocando `app.seudominio.com` pelo seu domínio real, depois:

```bash
sudo certbot --nginx -d app.seudominio.com   # gera SSL
sudo nginx -t && sudo systemctl reload nginx
```

## Configurar WhatsApp

Este projeto usa sua **Evolution API existente** — não sobe uma instância própria.

### Pré-requisito: configurar o webhook na Evolution

Na sua instância Evolution, configure o webhook global (ou por instância) apontando para:

```
https://app.seudominio.com/api/whatsapp/webhook/{instanceName}
```

Eventos necessários: `messages.upsert`, `connection.update`

### Conectar um número

1. Acesse **Configurações → WhatsApp** no painel
2. Clique em **Conectar Número**
3. Escaneie o QR Code com o WhatsApp no celular
4. O número aparece com status **Conectado** após autenticação

## Arquitetura

```
Internet
  │
Nginx (443/SSL)
  ├── / → Frontend Next.js (3010)
  ├── /api/ → Backend Fastify (3011)
  └── /socket.io/ → Socket.io (3011)

Backend (Fastify)
  ├── Prisma → Supabase (Postgres)
  ├── ioredis → Redis (cache + filas)
  ├── BullMQ workers (AI, email, notificações)
  ├── Socket.io (WebSocket)
  └── Evolution API client → WhatsApp

Frontend (Next.js 14)
  ├── App Router + RSC
  ├── TanStack Query (server state)
  ├── Zustand (client state)
  └── Socket.io-client
```

## Módulos

| Módulo | Rota | Descrição |
|--------|------|-----------|
| Dashboard | `/` | KPIs, gráficos, atividades recentes |
| Funis CRM | `/funis` | Kanban drag-and-drop com deals |
| WhatsApp | `/whatsapp` | Gestor multi-número estilo WhatsApp Web |
| Leads | `/leads` | Tabela de contatos com filtros |
| Planejamento | `/planejamento` | Metas e métricas por canal |
| Tarefas | `/tarefas` | Lista e calendário de tarefas |
| Relatórios | `/relatorios` | Análises de canal, funil, time e forecast |
| Performance | `/performance` | Ranking e comparativo do time |
| Transcrições | `/transcricoes` | Upload de áudio + análise IA |
| Configurações | `/configuracoes` | Usuários, canais, WhatsApp |

## Suporte e contribuição

Abra uma issue no repositório para reportar bugs ou sugerir melhorias.
