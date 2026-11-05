import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcrypt'

test('bcrypt stores a one-way password hash and verifies credentials', async () => {
  const password = 'studybuddy-password-123'
  const passwordHash = await bcrypt.hash(password, 4)

  assert.notEqual(passwordHash, password)
  assert.equal(await bcrypt.compare(password, passwordHash), true)
  assert.equal(await bcrypt.compare('wrong-password', passwordHash), false)
})
