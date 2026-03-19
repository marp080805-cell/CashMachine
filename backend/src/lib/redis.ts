import Redis from 'ioredis'
import { env } from '../config/env'

let redisInstance: Redis | null = null

export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })

    redisInstance.on('error', (err) => {
      console.error('Redis error:', err)
    })
  }

  return redisInstance
}

export const redis = getRedis()
