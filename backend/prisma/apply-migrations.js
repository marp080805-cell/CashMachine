// Startup migration script - runs before API starts
// Uses @prisma/client (production dep) to apply schema changes
const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()

  // ── pipelines: typeName (free-text pipeline type label) ──────────
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS "typeName" TEXT
    `)
    console.log('[migration] pipelines.typeName ok')
  } catch (e) {
    console.warn('[migration] pipelines.typeName warning:', e.message)
  }

  // ── pipelines: cardFields (JSON array of card field slugs) ────────
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS "cardFields" TEXT DEFAULT '[]'
    `)
    console.log('[migration] pipelines.cardFields ok')
  } catch (e) {
    console.warn('[migration] pipelines.cardFields warning:', e.message)
  }

  // ── pipelines: cardTaskStatuses (JSON array of task status filters) ──
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS "cardTaskStatuses" TEXT DEFAULT '["PENDING","IN_PROGRESS"]'
    `)
    console.log('[migration] pipelines.cardTaskStatuses ok')
  } catch (e) {
    console.warn('[migration] pipelines.cardTaskStatuses warning:', e.message)
  }

  // ── tasks.status: convert from enum to TEXT to support custom status values ──
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE tasks ALTER COLUMN status TYPE TEXT USING status::text
    `)
    console.log('[migration] tasks.status → TEXT ok')
  } catch (e) {
    console.warn('[migration] tasks.status TEXT warning:', e.message)
  }

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE whatsapp_numbers
        ADD COLUMN IF NOT EXISTS "apiUrl" TEXT,
        ADD COLUMN IF NOT EXISTS "apiKey" TEXT
    `)
    console.log('[migration] whatsapp_numbers columns ok')
  } catch (e) {
    console.warn('[migration] warning:', e.message)
  }

  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CustomFieldType') THEN
          CREATE TYPE "CustomFieldType" AS ENUM ('TEXT','NUMBER','SELECT','MULTI_SELECT','DATE','BOOLEAN','URL');
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS custom_field_definitions (
        id          TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name        TEXT NOT NULL,
        label       TEXT NOT NULL,
        type        "CustomFieldType" NOT NULL DEFAULT 'TEXT',
        entity      TEXT NOT NULL DEFAULT 'lead',
        options     JSONB,
        required    BOOLEAN NOT NULL DEFAULT false,
        position    INTEGER NOT NULL DEFAULT 0,
        "isActive"  BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (name, entity)
      );

      CREATE TABLE IF NOT EXISTS dashboard_configs (
        id          TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "userId"    TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        widgets     JSONB NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GoalPeriod') THEN
          CREATE TYPE "GoalPeriod" AS ENUM ('MONTHLY','QUARTERLY','ANNUAL');
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS goals (
        id            TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name          TEXT NOT NULL,
        metric        TEXT NOT NULL,
        target        DOUBLE PRECISION NOT NULL,
        period        "GoalPeriod" NOT NULL DEFAULT 'MONTHLY',
        month         INTEGER,
        year          INTEGER NOT NULL,
        "channelId"   TEXT REFERENCES channels(id),
        "createdById" TEXT NOT NULL REFERENCES users(id),
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)
    console.log('[migration] customization tables ok')
  } catch (e) {
    console.warn('[migration] customization warning:', e.message)
  }

  // ── pipelines: aiEnabled + aiAgentId (controle de IA por funil) ──
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE pipelines
        ADD COLUMN IF NOT EXISTS "aiEnabled" BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS "aiAgentId" TEXT
    `)
    console.log('[migration] pipelines.ai columns ok')
  } catch (e) {
    console.warn('[migration] pipelines.ai warning:', e.message)
  }

  // ── whatsapp_conversations: aiEnabled + aiAgentId (controle por conversa) ──
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE whatsapp_conversations
        ADD COLUMN IF NOT EXISTS "aiEnabled" BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS "aiAgentId" TEXT
    `)
    console.log('[migration] whatsapp_conversations.ai columns ok')
  } catch (e) {
    console.warn('[migration] whatsapp_conversations.ai warning:', e.message)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e); process.exit(0) })
