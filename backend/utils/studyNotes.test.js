import test from 'node:test'
import assert from 'node:assert/strict'
import { escapeRegex, validateStudyNoteFields } from './studyNotes.js'

test('study notes accept valid fields and existing subjects', () => {
  assert.deepEqual(
    validateStudyNoteFields({
      title: '  Lecture summary  ',
      content: '  Key points from the lecture.  ',
      course: 'Artificial Intelligence',
    }),
    {},
  )
})

test('study notes reject empty fields and unsupported subjects', () => {
  assert.deepEqual(
    validateStudyNoteFields({ title: ' ', content: '', course: 'Biology' }),
    {
      title: 'Enter a title for this note.',
      content: 'Enter some note content.',
      course: 'Choose one of the seven subjects.',
    },
  )
})

test('study note fields enforce maximum lengths', () => {
  const errors = validateStudyNoteFields({
    title: 'a'.repeat(121),
    content: 'b'.repeat(6001),
    course: 'HQ',
  })
  assert.equal(errors.title, 'Note titles must be 120 characters or fewer.')
  assert.equal(errors.content, 'Note content must be 6,000 characters or fewer.')
})

test('search terms are escaped as literal text', () => {
  assert.equal(escapeRegex('AI (search).*'), 'AI \\(search\\)\\.\\*')
})
