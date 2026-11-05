import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getSessionDurationMs,
  getSessionResponse,
  getSessionSummary,
  isValidDateRange,
} from './studySessions.js'

const date = (value) => new Date(value)

test('session duration counts completed and current running segments', () => {
  const session = {
    segments: [
      { startedAt: date('2026-10-27T10:00:00Z'), endedAt: date('2026-10-27T10:10:00Z') },
      { startedAt: date('2026-10-27T10:20:00Z'), endedAt: null },
    ],
  }
  assert.equal(
    getSessionDurationMs(session, date('2026-10-27T10:25:00Z')),
    15 * 60 * 1000,
  )
})

test('today summary intersects session segments with the requested day', () => {
  const sessions = [
    {
      course: 'Artificial Intelligence',
      segments: [{
        startedAt: date('2026-10-26T23:50:00Z'),
        endedAt: date('2026-10-27T00:10:00Z'),
      }],
    },
    {
      course: 'Linear Algebra',
      segments: [{
        startedAt: date('2026-10-27T01:00:00Z'),
        endedAt: null,
      }],
    },
  ]
  const summary = getSessionSummary(
    sessions,
    date('2026-10-27T00:00:00Z'),
    date('2026-10-27T02:00:00Z'),
    date('2026-10-27T01:30:00Z'),
  )
  assert.equal(summary.totalMs, 40 * 60 * 1000)
  assert.deepEqual(summary.bySubject, {
    'Artificial Intelligence': 10 * 60 * 1000,
    'Linear Algebra': 30 * 60 * 1000,
  })
})

test('session responses include live duration and timestamps', () => {
  const session = {
    _id: { toString: () => 'session-id' },
    course: 'HQ',
    status: 'running',
    startedAt: date('2026-10-27T10:00:00Z'),
    endedAt: null,
    segments: [{ startedAt: date('2026-10-27T10:00:00Z'), endedAt: null }],
  }
  const response = getSessionResponse(session, date('2026-10-27T10:00:05Z'))
  assert.equal(response.id, 'session-id')
  assert.equal(response.durationMs, 5000)
  assert.equal(response.endedAt, null)
})

test('summary date ranges must be ordered and no longer than 32 days', () => {
  assert.equal(isValidDateRange('2026-10-27T00:00:00Z', '2026-10-28T00:00:00Z'), true)
  assert.equal(isValidDateRange('bad', '2026-10-28T00:00:00Z'), false)
  assert.equal(isValidDateRange('2026-10-28T00:00:00Z', '2026-10-27T00:00:00Z'), false)
  assert.equal(isValidDateRange('2026-10-01T00:00:00Z', '2026-11-05T00:00:00Z'), false)
})
