import { courses } from '../constants.js'

export function validateStudyNoteFields({ title, content, course }) {
  const errors = {}
  if (typeof title !== 'string' || !title.trim()) {
    errors.title = 'Enter a title for this note.'
  } else if (title.trim().length > 120) {
    errors.title = 'Note titles must be 120 characters or fewer.'
  }
  if (typeof content !== 'string' || !content.trim()) {
    errors.content = 'Enter some note content.'
  } else if (content.trim().length > 6000) {
    errors.content = 'Note content must be 6,000 characters or fewer.'
  }
  if (!courses.includes(course)) {
    errors.course = 'Choose one of the seven subjects.'
  }
  return errors
}

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
