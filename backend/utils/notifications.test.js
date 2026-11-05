import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getReminderDateKey,
  normalizeTodayDate,
} from './notifications.js'

const today = '2026-10-27'

test('notification date accepts only valid dates near the server date', () => {
  const now = new Date('2026-10-27T12:00:00.000Z')
  assert.equal(normalizeTodayDate('2026-10-28', now), '2026-10-28')
  assert.equal(normalizeTodayDate('2025-01-01', now), '2026-10-27')
  assert.equal(normalizeTodayDate('2026-02-30', now), '2026-10-27')
})

test('notification periods cover overdue, today, and the next seven days', () => {
  assert.deepEqual(
    getReminderDateKey({ id: 'task-1', due: '2026-10-26', done: false }, today),
    { type: 'overdue', reminderKey: 'task-1:overdue:2026-10-26' },
  )
  assert.deepEqual(
    getReminderDateKey({ id: 'task-2', due: today, done: false }, today),
    { type: 'due_today', reminderKey: `task-2:due_today:${today}` },
  )
  assert.deepEqual(
    getReminderDateKey({ id: 'task-3', due: '2026-11-03', done: false }, today),
    { type: 'upcoming', reminderKey: 'task-3:upcoming:2026-11-03' },
  )
  assert.equal(
    getReminderDateKey({ id: 'task-4', due: '2026-11-04', done: false }, today),
    null,
  )
})

test('completed tasks and invalid dates do not produce reminders', () => {
  assert.equal(
    getReminderDateKey({ id: 'task-1', due: today, done: true }, today),
    null,
  )
  assert.equal(
    getReminderDateKey({ id: 'task-2', due: '2026-02-30', done: false }, today),
    null,
  )
  assert.equal(
    getReminderDateKey({ id: 'task-3', due: 'legacy date', done: false }, today),
    null,
  )
})
