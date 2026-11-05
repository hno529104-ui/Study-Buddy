import { createHash, randomBytes } from 'node:crypto'

export const passwordResetDurationMs = 15 * 60 * 1000

export function isValidEmail(email) {
  return (
    typeof email === 'string' &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
}

export function isValidPassword(password) {
  return (
    typeof password === 'string' &&
    password.length >= 10 &&
    Buffer.byteLength(password, 'utf8') <= 72
  )
}

export function isValidResetToken(token) {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)
}

export function hashPasswordResetToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export function createPasswordResetToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashPasswordResetToken(token) }
}
