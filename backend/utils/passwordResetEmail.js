import nodemailer from 'nodemailer'
import { config } from '../config.js'
import {
  isPasswordResetEmailAccepted,
  validatePasswordResetEmailConfig,
} from './passwordResetEmailConfig.js'

export { validatePasswordResetEmailConfig } from './passwordResetEmailConfig.js'

export async function sendPasswordResetEmail({ to, resetUrl }) {
  validatePasswordResetEmailConfig(config)

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    ...(config.smtpUser
      ? { auth: { user: config.smtpUser, pass: config.smtpPassword } }
      : {}),
  })

  const info = await transporter.sendMail({
    from: config.smtpFrom,
    to,
    subject: 'Reset your StudyBuddy AI password',
    text: `Use this link within 15 minutes to reset your StudyBuddy AI password:\n\n${resetUrl}\n\nIf you did not request a password reset, you can ignore this email.`,
    html: `<p>Use this link within 15 minutes to reset your StudyBuddy AI password:</p><p><a href="${resetUrl}">Reset your password</a></p><p>If you did not request a password reset, you can ignore this email.</p>`,
  })
  if (!isPasswordResetEmailAccepted(info, to)) {
    const error = new Error('SMTP did not accept the password reset recipient.')
    error.code = 'SMTP_RECIPIENT_REJECTED'
    throw error
  }
}
