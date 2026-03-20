// Startup migration script - runs before API starts
// Uses @prisma/client (production dep) to apply schema changes
const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE whatsapp_numbers
        ADD COLUMN IF NOT EXISTS "apiUrl" TEXT,
        ADD COLUMN IF NOT EXISTS "apiKey" TEXT
    `)
    console.log('[migration] whatsapp_numbers columns ok')
  } catch (e) {
    console.warn('[migration] warning:', e.message)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e); process.exit(0) })
