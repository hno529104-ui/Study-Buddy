import { Router } from 'express'
import mongoose from 'mongoose'
import { courses } from '../constants.js'
import { requireAuth } from '../middleware/auth.js'
import { StudyNote } from '../models/StudyNote.js'
import { escapeRegex, validateStudyNoteFields } from '../utils/studyNotes.js'

const router = Router()
router.use(requireAuth)

function noteResponse(note) {
  return {
    id: note._id.toString(),
    title: note.title,
    content: note.content,
    course: note.course,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  }
}

router.get('/', async (request, response) => {
  const query = { userId: request.userId }
  const search = typeof request.query.search === 'string'
    ? request.query.search.trim()
    : ''
  const course = request.query.course

  if (search.length > 100) {
    return response.status(400).json({ error: 'Search must be 100 characters or fewer.' })
  }
  if (course !== undefined && course !== 'all') {
    if (!courses.includes(course)) {
      return response.status(400).json({ error: 'Choose one of the seven subjects.' })
    }
    query.course = course
  }
  if (search) {
    const literalSearch = new RegExp(escapeRegex(search), 'i')
    query.$or = [{ title: literalSearch }, { content: literalSearch }]
  }

  const notes = await StudyNote.find(query).sort({ updatedAt: -1 })
  return response.json({ notes: notes.map(noteResponse) })
})

router.post('/', async (request, response) => {
  const errors = validateStudyNoteFields(request.body)
  if (Object.keys(errors).length > 0) {
    return response.status(400).json({
      error: 'Check the note fields.',
      fields: errors,
    })
  }

  const note = await StudyNote.create({
    title: request.body.title.trim(),
    content: request.body.content.trim(),
    course: request.body.course,
    userId: request.userId,
  })
  return response.status(201).json({ note: noteResponse(note) })
})

router.patch('/:id', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Note ID is invalid.' })
  }
  const note = await StudyNote.findOne({
    _id: request.params.id,
    userId: request.userId,
  })
  if (!note) return response.status(404).json({ error: 'Note not found.' })

  const values = {
    title: Object.hasOwn(request.body, 'title') ? request.body.title : note.title,
    content: Object.hasOwn(request.body, 'content')
      ? request.body.content
      : note.content,
    course: Object.hasOwn(request.body, 'course')
      ? request.body.course
      : note.course,
  }
  if (
    !Object.hasOwn(request.body, 'title') &&
    !Object.hasOwn(request.body, 'content') &&
    !Object.hasOwn(request.body, 'course')
  ) {
    return response.status(400).json({ error: 'Make at least one change to the note.' })
  }
  const errors = validateStudyNoteFields(values)
  if (Object.keys(errors).length > 0) {
    return response.status(400).json({
      error: 'Check the note fields.',
      fields: errors,
    })
  }

  Object.assign(note, {
    title: values.title.trim(),
    content: values.content.trim(),
    course: values.course,
  })
  await note.save()
  return response.json({ note: noteResponse(note) })
})

router.delete('/:id', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Note ID is invalid.' })
  }
  const result = await StudyNote.deleteOne({
    _id: request.params.id,
    userId: request.userId,
  })
  if (result.deletedCount === 0) {
    return response.status(404).json({ error: 'Note not found.' })
  }
  return response.json({ message: 'Note deleted.' })
})

export default router
