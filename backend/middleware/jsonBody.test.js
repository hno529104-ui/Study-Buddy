import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeJsonBody } from './jsonBody.js'

test('missing mutation bodies reach route-level validation as empty objects', () => {
  const request = { method: 'POST' }
  let nextCalled = false

  normalizeJsonBody(request, {}, () => {
    nextCalled = true
  })

  assert.deepEqual(request.body, {})
  assert.equal(nextCalled, true)
})

test('missing safe-method bodies remain undefined', () => {
  const request = { method: 'GET' }
  let nextCalled = false

  normalizeJsonBody(request, {}, () => {
    nextCalled = true
  })

  assert.equal(request.body, undefined)
  assert.equal(nextCalled, true)
})

test('non-object JSON bodies are rejected', () => {
  let statusCode
  let errorBody
  let nextCalled = false
  const response = {
    status(code) {
      statusCode = code
      return this
    },
    json(body) {
      errorBody = body
    },
  }

  normalizeJsonBody({ method: 'POST', body: [] }, response, () => {
    nextCalled = true
  })

  assert.equal(statusCode, 400)
  assert.deepEqual(errorBody, { error: 'Request body must be a JSON object.' })
  assert.equal(nextCalled, false)
})
