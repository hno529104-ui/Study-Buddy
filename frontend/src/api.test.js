import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, apiRequest } from './api.js'

test('network failures show a clear server connection message', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    throw new TypeError('fetch failed')
  }

  try {
    await assert.rejects(apiRequest('/auth/login'), (error) => {
      assert.ok(error instanceof ApiError)
      assert.match(error.message, /Cannot connect to the StudyBuddy server/)
      return true
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})
