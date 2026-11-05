import { courses, priorities } from '../constants.js'

export function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

export function validateTaskFields(values, { allowLegacyDue = false } = {}) {
  const errors = {}

  if (typeof values.title !== 'string' || !values.title.trim()) {
    errors.title = 'Enter a task name.'
  } else if (values.title.trim().length > 200) {
    errors.title = 'Task names must be 200 characters or fewer.'
  }

  if (!courses.includes(values.course)) {
    errors.course = 'Choose one of the seven available subjects.'
  }

  if (
    typeof values.due !== 'string' ||
    (!allowLegacyDue && !isValidDate(values.due)) ||
    (allowLegacyDue && values.due.length > 80)
  ) {
    errors.due = allowLegacyDue
      ? 'The due date is invalid.'
      : 'Choose a valid due date.'
  }

  if (!priorities.includes(values.priority)) {
    errors.priority = 'Choose Low, Medium, or High priority.'
  }

  if (typeof values.done !== 'boolean') {
    errors.done = 'Task completion status is invalid.'
  }

  return errors
}

export function normalizeLegacyCourse(value) {
  const legacyCourses = {
    Biology: 'Artificial Intelligence',
    Math: 'Linear Algebra',
    History: 'Professional Practice',
  }
  return legacyCourses[value] || value
}
