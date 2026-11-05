import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getGoalProgress,
  hoursToMilliseconds,
  isValidProgressRanges,
} from './studyGoals.js'

test('goal hours must be positive finite values within their period limit', () => {
  assert.equal(hoursToMilliseconds(1.5, 24), 5_400_000)
  assert.equal(hoursToMilliseconds(0, 24), null)
  assert.equal(hoursToMilliseconds(25, 24), null)
  assert.equal(hoursToMilliseconds(Number.NaN, 168), null)
})

test('goal progress reports actual, remaining, and capped percentage', () => {
  assert.deepEqual(getGoalProgress(3_600_000, 900_000), {
    targetMs: 3_600_000,
    actualMs: 900_000,
    remainingMs: 2_700_000,
    percentage: 25,
  })
  assert.equal(getGoalProgress(100, 200).percentage, 100)
  assert.equal(getGoalProgress(null, 200), null)
})

test('progress dates must form a bounded week containing the day', () => {
  assert.equal(
    isValidProgressRanges(
      '2026-10-27T00:00:00.000Z',
      '2026-10-28T00:00:00.000Z',
      '2026-10-26T00:00:00.000Z',
      '2026-11-02T00:00:00.000Z',
    ),
    true,
  )
  assert.equal(
    isValidProgressRanges('bad', 'bad', 'bad', 'bad'),
    false,
  )
  assert.equal(
    isValidProgressRanges(
      '2026-10-27T00:00:00.000Z',
      '2026-10-28T12:00:00.000Z',
      '2026-10-26T00:00:00.000Z',
      '2026-11-02T00:00:00.000Z',
    ),
    false,
  )
})
