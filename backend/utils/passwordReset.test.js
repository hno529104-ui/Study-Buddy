import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  isValidEmail,
  isValidPassword,
  isValidResetToken,
  passwordResetDurationMs,
} from './passwordReset.js'

test('password reset tokens are random and only their hash is stored', () => {
  const first = createPasswordResetToken()
  const second = createPasswordResetToken()

  assert.match(first.token, /^[A-Za-z0-9_-]{43}$/)
  assert.equal(isValidResetToken(first.token), true)
  assert.equal(first.tokenHash, hashPasswordResetToken(first.token))
  assert.notEqual(first.tokenHash, first.token)
  assert.notEqual(first.tokenHash, second.tokenHash)
  assert.equal(isValidResetToken('invalid-token'), false)
})

test('password reset tokens expire after 15 minutes', () => {
  assert.equal(passwordResetDurationMs, 15 * 60 * 1000)
})

test('password reset validation accepts valid emails and passwords only', () => {
  assert.equal(isValidEmail('student@example.com'), true)
  assert.equal(isValidEmail('invalid-email'), false)
  assert.equal(isValidEmail(`${'a'.repeat(251)}@b.c`), false)
  assert.equal(isValidPassword('a-valid-password'), true)
  assert.equal(isValidPassword('short'), false)
  assert.equal(isValidPassword('é'.repeat(37)), false)
  assert.equal(isValidPassword(null), false)
})
