import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  API_PORT: z.coerce.number().default(3011),
  API_URL: z.string().default('http://localhost:3011'),
  EVOLUTION_API_URL: z.string().default('http://localhost:8080'),
  EVOLUTION_API_KEY: z.string().default(''),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  RESEND_API_KEY: z.string().default(''),
  EMAIL_FROM: z.string().default('CashMachine <noreply@cashmachine.com>'),
  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ADMIN_NAME: z.string().default('Admin'),
  ADMIN_EMAIL: z.string().email().default('admin@cashmachine.com'),
  ADMIN_PASSWORD: z.string().min(8).default('Admin@123'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
