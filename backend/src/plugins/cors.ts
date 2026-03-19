import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import fastifyCors from '@fastify/cors'
import { env } from '../config/env'

export default fp(async function corsPlugin(app: FastifyInstance) {
  await app.register(fastifyCors, {
    origin: [env.NEXT_PUBLIC_APP_URL, 'http://localhost:3000', 'http://localhost:3010'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
})
