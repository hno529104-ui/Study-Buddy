import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isPasswordResetEmailAccepted,
  validatePasswordResetEmailConfig,
} from './passwordResetEmailConfig.js'

const validSettings = {
  smtpHost: 'smtp.example.invalid',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPassword: '',
  smtpFrom: 'no-reply@example.invalid',
}

test('password reset email configuration requires SMTP host and sender', () => {
  assert.throws(
    () =>
      validatePasswordResetEmailConfig({
        ...validSettings,
        smtpHost: '',
        smtpFrom: '',
      }),
    (error) => {
      assert.equal(error.code, 'SMTP_CONFIG_MISSING')
      assert.deepEqual(error.missingSettings, ['SMTP_HOST', 'SMTP_FROM'])
      return true
    },
  )
})

test('password reset email configuration validates port and paired credentials', () => {
  assert.throws(
    () =>
      validatePasswordResetEmailConfig({
        ...validSettings,
        smtpPort: 0,
      }),
    (error) => error.code === 'SMTP_CONFIG_INVALID',
  )
  assert.throws(
    () =>
      validatePasswordResetEmailConfig({
        ...validSettings,
        smtpUser: 'configured',
      }),
    (error) => {
      assert.equal(error.code, 'SMTP_AUTH_CONFIG_INCOMPLETE')
      assert.deepEqual(error.missingSettings, ['SMTP_USER', 'SMTP_PASSWORD'])
      return true
    },
  )
  assert.doesNotThrow(() => validatePasswordResetEmailConfig(validSettings))
})

test('password reset email delivery requires SMTP acceptance of the recipient', () => {
  assert.equal(
    isPasswordResetEmailAccepted(
      { accepted: ['Student@example.invalid'] },
      'student@example.invalid',
    ),
    true,
  )
  assert.equal(
    isPasswordResetEmailAccepted(
      { accepted: [], rejected: ['student@example.invalid'] },
      'student@example.invalid',
    ),
    false,
  )
  assert.equal(isPasswordResetEmailAccepted({}, 'student@example.invalid'), false)
})
