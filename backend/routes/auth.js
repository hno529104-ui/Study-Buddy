import { randomBytes } from 'node:crypto'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { config } from '../config.js'
import {
  csrfCookieName,
  sessionCookieName,
  sessionDurationMs,
} from '../constants.js'
import { requireAuth } from '../middleware/auth.js'
import { User } from '../models/User.js'
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  isValidEmail,
  isValidPassword,
  isValidResetToken,
  passwordResetDurationMs,
} from '../utils/passwordReset.js'
import {
  sendPasswordResetEmail,
  validatePasswordResetEmailConfig,
} from '../utils/passwordResetEmail.js'

const router = Router()
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please try again later.' },
})
const passwordResetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many password reset requests. Please try again later.' },
})
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many password reset attempts. Please try again later.' },
})
const passwordResetRequestMessage =
  'If an account exists with this email, you will receive password reset instructions.'
const invalidPasswordResetMessage =
  'This password reset link is invalid or has expired. Request a new one.'
const passwordResetEmailUnavailableMessage =
  'Password reset email is temporarily unavailable. Please try again later.'

function logPasswordResetEmailFailure(stage, error) {
  const details = {
    stage,
    errorType:
      error instanceof Error && /^[A-Za-z][A-Za-z0-9]{0,40}$/.test(error.name)
        ? error.name
        : 'UnknownError',
  }
  if (
    typeof error?.code === 'string' &&
    /^[A-Z][A-Z0-9_]{0,31}$/.test(error.code)
  ) {
    details.smtpCode = error.code
  }
  if (Array.isArray(error?.missingSettings)) {
    details.configuration = error.missingSettings.filter((setting) =>
      ['SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM', 'SMTP_USER', 'SMTP_PASSWORD'].includes(
        setting,
      ),
    )
  }
  if (
    typeof error?.command === 'string' &&
    /^(CONNECT|CONN|AUTH|MAIL|RCPT|DATA|STARTTLS|QUIT|EHLO|HELO)\b/.test(
      error.command,
    )
  ) {
    details.smtpCommand = error.command.split(/\s/, 1)[0]
  }
  if (Number.isInteger(error?.responseCode)) {
    details.smtpResponseCode = error.responseCode
  }
  console.error('Password reset email delivery failed.', details)
}

function setSessionCookie(response, user) {
  const token = jwt.sign({ ver: user.tokenVersion || 0 }, config.jwtSecret, {
    algorithm: 'HS256',
    subject: user._id.toString(),
    issuer: 'studybuddy',
    audience: 'studybuddy-web',
    expiresIn: '7d',
  })

  response.cookie(sessionCookieName, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    maxAge: sessionDurationMs,
    path: '/',
  })
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
  }
}

router.get('/csrf', (request, response) => {
  const token = randomBytes(32).toString('hex')
  response.cookie(csrfCookieName, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    maxAge: sessionDurationMs,
    path: '/',
  })
  response.json({ csrfToken: token })
})

router.post('/register', authLimiter, async (request, response) => {
  const name = typeof request.body.name === 'string' ? request.body.name.trim() : ''
  const email =
    typeof request.body.email === 'string'
      ? request.body.email.trim().toLowerCase()
      : ''
  const password =
    typeof request.body.password === 'string' ? request.body.password : ''

  if (!name || name.length > 80) {
    return response.status(400).json({ error: 'Enter your name (80 characters or fewer).' })
  }
  if (!isValidEmail(email)) {
    return response.status(400).json({ error: 'Enter a valid email address.' })
  }
  if (!isValidPassword(password)) {
    return response.status(400).json({
      error: 'Password must be at least 10 characters and no more than 72 bytes.',
    })
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await User.create({ name, email, passwordHash })
    setSessionCookie(response, user)
    return response.status(201).json({ user: publicUser(user) })
  } catch (error) {
    if (error?.code === 11000) {
      return response.status(409).json({ error: 'An account with that email already exists.' })
    }
    throw error
  }
})

router.post(
  '/forgot-password',
  passwordResetRequestLimiter,
  async (request, response) => {
    const body =
      request.body && typeof request.body === 'object' ? request.body : {}
    const email =
      typeof body.email === 'string'
        ? body.email.trim().toLowerCase()
        : ''
    if (!isValidEmail(email)) {
      return response.status(400).json({ error: 'Enter a valid email address.' })
    }

    try {
      validatePasswordResetEmailConfig(config)
    } catch (error) {
      logPasswordResetEmailFailure('configuration', error)
      return response
        .status(503)
        .json({ error: passwordResetEmailUnavailableMessage })
    }

    const user = await User.findOne({ email })
    if (user) {
      const { token, tokenHash } = createPasswordResetToken()
      const expiresAt = new Date(Date.now() + passwordResetDurationMs)
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            passwordResetTokenHash: tokenHash,
            passwordResetExpiresAt: expiresAt,
          },
        },
      )

      const resetUrl = new URL('/reset-password', config.clientOrigin)
      resetUrl.searchParams.set('token', token)
      try {
        await sendPasswordResetEmail({
          to: email,
          resetUrl: resetUrl.toString(),
        })
        console.info('Password reset email accepted by SMTP.')
      } catch (error) {
        logPasswordResetEmailFailure('send', error)
        try {
          await User.updateOne(
            { _id: user._id, passwordResetTokenHash: tokenHash },
            { $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 } },
          )
        } catch (cleanupError) {
          logPasswordResetEmailFailure('token-cleanup', cleanupError)
        }
        return response
          .status(503)
          .json({ error: passwordResetEmailUnavailableMessage })
      }
    }

    return response.json({ message: passwordResetRequestMessage })
  },
)

router.post(
  '/reset-password',
  passwordResetLimiter,
  async (request, response) => {
    const body =
      request.body && typeof request.body === 'object' ? request.body : {}
    const { token, password } = body
    if (!isValidResetToken(token) || !isValidPassword(password)) {
      return response.status(400).json({
        error: isValidResetToken(token)
          ? 'Password must be at least 10 characters and no more than 72 bytes.'
          : invalidPasswordResetMessage,
      })
    }

    const tokenHash = hashPasswordResetToken(token)
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await User.findOneAndUpdate(
      {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { $gt: new Date() },
      },
      {
        $set: { passwordHash },
        $inc: { tokenVersion: 1 },
        $unset: {
          passwordResetTokenHash: 1,
          passwordResetExpiresAt: 1,
        },
      },
      { new: true },
    )
    if (!user) {
      await User.updateOne(
        {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: { $lte: new Date() },
        },
        { $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 } },
      )
      return response.status(400).json({ error: invalidPasswordResetMessage })
    }

    return response.json({ message: 'Your password has been reset successfully.' })
  },
)

router.post('/login', authLimiter, async (request, response) => {
  const email =
    typeof request.body.email === 'string'
      ? request.body.email.trim().toLowerCase()
      : ''
  const password =
    typeof request.body.password === 'string' ? request.body.password : ''

  if (!email || !password) {
    return response.status(400).json({ error: 'Enter your email and password.' })
  }

  const user = await User.findOne({ email }).select('+passwordHash +tokenVersion')
  const passwordMatches = user
    ? await bcrypt.compare(password, user.passwordHash)
    : false
  if (!passwordMatches) {
    return response.status(401).json({ error: 'Email or password is incorrect.' })
  }

  setSessionCookie(response, user)
  return response.json({ user: publicUser(user) })
})

router.get('/me', requireAuth, async (request, response) => {
  return response.json({ user: publicUser(request.authUser) })
})

router.post('/logout', requireAuth, async (request, response) => {
  await User.updateOne(
    { _id: request.userId },
    { $inc: { tokenVersion: 1 } },
  )
  response.clearCookie(sessionCookieName, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
  })
  response.clearCookie(csrfCookieName, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
  })
  return response.json({ message: 'Signed out successfully.' })
})

export default router
