import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidDate,
  normalizeLegacyCourse,
  validateTaskFields,
} from './validation.js'

const validTask = {
  title: 'Read chapter one',
  course: 'Artificial Intelligence',
  due: '2026-11-02',
  priority: 'High',
  done: false,
}

test('accepts a valid task using an allowed subject and priority', () => {
  assert.deepEqual(validateTaskFields(validTask), {})
})

test('rejects missing and invalid task fields', () => {
  const errors = validateTaskFields({
    ...validTask,
    title: '  ',
    course: 'Math',
    due: '2026-02-30',
    priority: 'Urgent',
  })

  assert.deepEqual(Object.keys(errors).sort(), [
    'course',
    'due',
    'priority',
    'title',
  ])
})

test('validates calendar dates rather than date-shaped strings only', () => {
  assert.equal(isValidDate('2024-02-29'), true)
  assert.equal(isValidDate('2025-02-29'), false)
  assert.equal(isValidDate('2026-13-01'), false)
})

test('normalizes legacy browser task subjects without changing current subjects', () => {
  assert.equal(normalizeLegacyCourse('Biology'), 'Artificial Intelligence')
  assert.equal(normalizeLegacyCourse('Math'), 'Linear Algebra')
  assert.equal(normalizeLegacyCourse('History'), 'Professional Practice')
  assert.equal(normalizeLegacyCourse('HQ'), 'HQ')
})

test('allows legacy task due-date text during non-destructive import', () => {
  assert.deepEqual(
    validateTaskFields({ ...validTask, due: 'This weekend' }, {
      allowLegacyDue: true,
    }),
    {},
  )
})
