import { Router } from 'express'
import mongoose from 'mongoose'
import { courses, priorities } from '../constants.js'
import { requireAuth } from '../middleware/auth.js'
import { Task } from '../models/Task.js'
import {
  isValidDate,
  normalizeLegacyCourse,
  validateTaskFields,
} from '../utils/validation.js'

const router = Router()
router.use(requireAuth)

function taskResponse(task) {
  return {
    id: task._id.toString(),
    title: task.title,
    course: task.course,
    due: task.due,
    priority: task.priority,
    done: task.done,
  }
}

router.get('/', async (request, response) => {
  const tasks = await Task.find({ userId: request.userId }).sort({ createdAt: 1 })
  return response.json({ tasks: tasks.map(taskResponse) })
})

router.post('/', async (request, response) => {
  const values = {
    title: request.body.title,
    course: request.body.course,
    due: request.body.due,
    priority: request.body.priority,
    done: false,
  }
  const errors = validateTaskFields(values)
  if (Object.keys(errors).length > 0) {
    return response.status(400).json({ error: 'Check the task fields.', fields: errors })
  }

  const task = await Task.create({ ...values, userId: request.userId })
  return response.status(201).json({ task: taskResponse(task) })
})

router.post('/import', async (request, response) => {
  if (!Array.isArray(request.body.tasks) || request.body.tasks.length > 200) {
    return response.status(400).json({ error: 'Choose up to 200 browser tasks to import.' })
  }

  const operations = []
  const errors = []
  request.body.tasks.forEach((task, index) => {
    const course = normalizeLegacyCourse(task?.course)
    const priority = priorities.includes(task?.priority) ? task.priority : 'Medium'
    const values = {
      title: task?.title,
      course,
      due: typeof task?.due === 'string' ? task.due : '',
      priority,
      done: task?.done,
    }
    const taskErrors = validateTaskFields(values, { allowLegacyDue: true })
    if (
      !task ||
      (typeof task.id !== 'string' && typeof task.id !== 'number') ||
      !courses.includes(course) ||
      Object.keys(taskErrors).length > 0
    ) {
      errors.push({ index, error: 'This browser task has invalid or unsupported fields.' })
      return
    }

    operations.push({
      updateOne: {
        filter: { userId: request.userId, legacyId: String(task.id) },
        update: {
          $setOnInsert: {
            ...values,
            userId: request.userId,
            legacyId: String(task.id),
          },
        },
        upsert: true,
      },
    })
  })

  if (errors.length > 0) {
    return response.status(400).json({
      error: 'Some browser tasks could not be imported. Your original browser data remains unchanged.',
      fields: errors,
    })
  }

  if (operations.length > 0) {
    await Task.bulkWrite(operations, { ordered: false })
  }
  const tasks = await Task.find({ userId: request.userId }).sort({ createdAt: 1 })
  return response.json({
    tasks: tasks.map(taskResponse),
    imported: operations.length,
  })
})

router.patch('/:id', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Task ID is invalid.' })
  }

  const allowedFields = ['title', 'course', 'due', 'priority', 'done']
  const updates = {}
  for (const field of allowedFields) {
    if (Object.hasOwn(request.body, field)) {
      updates[field] = request.body[field]
    }
  }
  if (Object.keys(updates).length === 0) {
    return response.status(400).json({ error: 'No task changes were provided.' })
  }

  const current = await Task.findOne({
    _id: request.params.id,
    userId: request.userId,
  })
  if (!current) {
    return response.status(404).json({ error: 'Task not found.' })
  }

  const nextValues = {
    title: updates.title ?? current.title,
    course: updates.course ?? current.course,
    due: updates.due ?? current.due,
    priority: updates.priority ?? current.priority,
    done: updates.done ?? current.done,
  }
  const errors = validateTaskFields(nextValues, {
    allowLegacyDue: !isValidDate(nextValues.due),
  })
  if (Object.keys(errors).length > 0) {
    return response.status(400).json({ error: 'Check the task fields.', fields: errors })
  }

  Object.assign(current, updates)
  await current.save()
  return response.json({ task: taskResponse(current) })
})

router.delete('/:id', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Task ID is invalid.' })
  }

  const result = await Task.deleteOne({
    _id: request.params.id,
    userId: request.userId,
  })
  if (result.deletedCount === 0) {
    return response.status(404).json({ error: 'Task not found.' })
  }
  return response.json({ message: 'Task deleted.' })
})

export default router
