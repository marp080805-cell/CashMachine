import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY || ''
  if (!keyHex || keyHex.length !== 64) {
    // Use a deterministic fallback derived from JWT_SECRET when ENCRYPTION_KEY is not set.
    // Strongly recommended to set ENCRYPTION_KEY=<openssl rand -hex 32> in production .env.
    const fallback = process.env.JWT_SECRET ?? 'cashmind-default-fallback-key-set-ENCRYPTION_KEY'
    const crypto = require('crypto') as typeof import('crypto')
    return crypto.createHash('sha256').update(fallback).digest()
  }
  return Buffer.from(keyHex, 'hex')
}

export function encrypt(text: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(data: string): string {
  const key = getKey()
  const parts = data.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted data format')
  const [ivHex, tagHex, encryptedHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8')
}

export function isEncrypted(value: string): boolean {
  return /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/.test(value)
}

export function encryptIfNeeded(value: string | null | undefined): string | null {
  if (!value) return null
  if (isEncrypted(value)) return value
  return encrypt(value)
}

export function decryptIfNeeded(value: string | null | undefined): string | null {
  if (!value) return null
  if (!isEncrypted(value)) return value
  return decrypt(value)
}
