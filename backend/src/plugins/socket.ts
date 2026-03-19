import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { Server } from 'socket.io'
import { env } from '../config/env'

declare module 'fastify' {
  interface FastifyInstance {
    io: Server
  }
}

export default fp(async function socketPlugin(app: FastifyInstance) {
  const io = new Server(app.server, {
    cors: {
      origin: [env.NEXT_PUBLIC_APP_URL, 'http://localhost:3000', 'http://localhost:3010'],
      credentials: true,
    },
    path: '/socket.io/',
  })

  io.on('connection', (socket) => {
    socket.on('join:user', (userId: string) => {
      socket.join(`user:${userId}`)
    })

    socket.on('join:conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`)
    })

    socket.on('leave:conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`)
    })
  })

  app.decorate('io', io)
})
