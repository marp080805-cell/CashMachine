import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

export interface StorageFile {
  url: string
  key: string
  size: number
  mimetype: string
}

class StorageService {
  private uploadDir: string

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
    if (process.env.STORAGE_TYPE !== 's3') {
      fs.mkdirSync(this.uploadDir, { recursive: true })
    }
  }

  async save(buffer: Buffer, originalName: string, mimetype: string): Promise<StorageFile> {
    const ext = path.extname(originalName) || this.mimeToExt(mimetype)
    const key = `${randomUUID()}${ext}`

    if (process.env.STORAGE_TYPE === 's3') {
      return this.saveToS3(buffer, key, mimetype)
    }

    const filePath = path.join(this.uploadDir, key)
    fs.writeFileSync(filePath, buffer)

    return {
      url: `/uploads/${key}`,
      key,
      size: buffer.length,
      mimetype,
    }
  }

  async delete(key: string): Promise<void> {
    if (process.env.STORAGE_TYPE === 's3') {
      await this.deleteFromS3(key)
      return
    }
    const filePath = path.join(this.uploadDir, key)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  }

  getUrl(key: string): string {
    if (process.env.STORAGE_TYPE === 's3') {
      const bucket = process.env.AWS_BUCKET
      const region = process.env.AWS_REGION || 'us-east-1'
      return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
    }
    const appUrl = process.env.APP_URL || ''
    return `${appUrl}/uploads/${key}`
  }

  private async saveToS3(buffer: Buffer, key: string, mimetype: string): Promise<StorageFile> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3') as any
    const client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' })
    await client.send(new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    }))
    return { url: this.getUrl(key), key, size: buffer.length, mimetype }
  }

  private async deleteFromS3(key: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3') as any
    const client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' })
    await client.send(new DeleteObjectCommand({ Bucket: process.env.AWS_BUCKET, Key: key }))
  }

  private mimeToExt(mimetype: string): string {
    const map: Record<string, string> = {
      'audio/mpeg': '.mp3',
      'audio/mp4': '.m4a',
      'audio/wav': '.wav',
      'audio/ogg': '.ogg',
      'audio/webm': '.webm',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'application/pdf': '.pdf',
    }
    return map[mimetype] || ''
  }
}

export const storageService = new StorageService()
