import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) })
const backendDirectory = fileURLToPath(new URL('.', import.meta.url))
const resourceStorageDir = path.resolve(
  backendDirectory,
  process.env.RESOURCE_STORAGE_DIR || 'private-resources',
)
const frontendDirectory = path.resolve(backendDirectory, '../frontend')
const relativeStoragePath = path.relative(frontendDirectory, resourceStorageDir)
if (
  relativeStoragePath === '' ||
  (!relativeStoragePath.startsWith(`..${path.sep}`) &&
    relativeStoragePath !== '..' &&
    !path.isAbsolute(relativeStoragePath))
) {
  throw new Error('RESOURCE_STORAGE_DIR must be outside the frontend directory.')
}

const jwtSecret = process.env.JWT_SECRET
if (
  !jwtSecret ||
  jwtSecret.length < 32 ||
  jwtSecret.includes('replace-with-a-random-secret')
) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters.')
}

const mongoUri = process.env.MONGODB_URI
if (!mongoUri) {
  throw new Error('MONGODB_URI must be configured before starting the API.')
}

export const config = {
  port: Number(process.env.PORT) || 3001,
  mongoUri,
  jwtSecret,
  resourceStorageDir,
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'qwen2.5:3b',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPassword: process.env.SMTP_PASSWORD || '',
  smtpFrom: process.env.SMTP_FROM || '',
  isProduction: process.env.NODE_ENV === 'production',
}
