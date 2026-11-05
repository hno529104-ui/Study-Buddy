import { Router } from 'express'
import mongoose from 'mongoose'
import { requireAuth } from '../middleware/auth.js'
import { Notification } from '../models/Notification.js'
import { Task } from '../models/Task.js'
import { User } from '../models/User.js'
import {
  getReminderDateKey,
  normalizeTodayDate,
} from '../utils/notifications.js'

const router = Router()
router.use(requireAuth)

function notificationResponse(notification) {
  return {
    id: notification._id.toString(),
    taskId: notification.taskId.toString(),
    type: notification.type,
    title: notification.title,
    subject: notification.subject,
    due: notification.due,
    read: Boolean(notification.readAt),
    createdAt: notification.createdAt.toISOString(),
  }
}

router.get('/', async (request, response) => {
  const user = await User.findById(request.userId).select('remindersEnabled')
  if (!user) {
    return response.status(404).json({ error: 'User account not found.' })
  }
  const remindersEnabled = user.remindersEnabled
  if (!remindersEnabled) {
    return response.json({ notifications: [], remindersEnabled })
  }

  const tasks = await Task.find({ userId: request.userId, done: false })
    .select('title course due')
    .lean()
  const today = normalizeTodayDate(request.query.today)
  const operations = []
  for (const task of tasks) {
    const period = getReminderDateKey(
      { ...task, id: task._id.toString() },
      today,
    )
    if (!period) continue
    operations.push({
      updateOne: {
        filter: { userId: request.userId, reminderKey: period.reminderKey },
        update: {
          $set: {
            taskId: task._id,
            type: period.type,
            title: task.title,
            subject: task.course,
            due: task.due,
          },
          $setOnInsert: { userId: request.userId },
        },
        upsert: true,
      },
    })
  }
  if (operations.length > 0) {
    await Notification.bulkWrite(operations, { ordered: false })
  }

  const activeKeys = operations.map(
    (operation) => operation.updateOne.filter.reminderKey,
  )
  const notifications =
    activeKeys.length === 0
      ? []
      : await Notification.find({
          userId: request.userId,
          reminderKey: { $in: activeKeys },
          clearedAt: null,
        }).sort({ due: 1, createdAt: -1 })
  return response.json({
    notifications: notifications.map(notificationResponse),
    remindersEnabled,
  })
})

router.patch('/settings', async (request, response) => {
  if (typeof request.body.remindersEnabled !== 'boolean') {
    return response.status(400).json({
      error: 'Reminder setting must be enabled or disabled.',
    })
  }
  const user = await User.findByIdAndUpdate(
    request.userId,
    { $set: { remindersEnabled: request.body.remindersEnabled } },
    { new: true, runValidators: true },
  ).select('remindersEnabled')
  if (!user) {
    return response.status(404).json({ error: 'User account not found.' })
  }
  return response.json({ remindersEnabled: user.remindersEnabled })
})

router.patch('/:id/read', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Notification ID is invalid.' })
  }
  const notification = await Notification.findOneAndUpdate(
    { _id: request.params.id, userId: request.userId },
    { $set: { readAt: new Date() } },
    { new: true },
  )
  if (!notification) {
    return response.status(404).json({ error: 'Notification not found.' })
  }
  return response.json({ notification: notificationResponse(notification) })
})

router.delete('/:id', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Notification ID is invalid.' })
  }
  const notification = await Notification.findOneAndUpdate(
    { _id: request.params.id, userId: request.userId },
    { $set: { clearedAt: new Date() } },
    { new: true },
  )
  if (!notification) {
    return response.status(404).json({ error: 'Notification not found.' })
  }
  return response.json({ message: 'Notification cleared.' })
})

router.delete('/', async (request, response) => {
  await Notification.updateMany(
    { userId: request.userId, clearedAt: null },
    { $set: { clearedAt: new Date() } },
  )
  return response.json({ message: 'Notifications cleared.' })
})

export default router
