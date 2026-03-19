'use client'

import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env['NEXT_PUBLIC_WS_URL'] ?? 'http://localhost:3011', {
      path: '/socket.io/',
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })
  }
  return socket
}

export function connectSocket(userId: string): void {
  const s = getSocket()
  if (!s.connected) {
    s.connect()
    s.once('connect', () => {
      s.emit('join:user', userId)
    })
  }
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect()
  }
}
