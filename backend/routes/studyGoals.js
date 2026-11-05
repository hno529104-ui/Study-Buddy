import { Router } from 'express'
import mongoose from 'mongoose'
import { courses } from '../constants.js'
import { requireAuth } from '../middleware/auth.js'
import { StudyGoal } from '../models/StudyGoal.js'
import { StudySession } from '../models/StudySession.js'
import { getSessionSummary } from '../utils/studySessions.js'
import {
  getGoalProgress,
  hoursToMilliseconds,
  isValidProgressRanges,
} from '../utils/studyGoals.js'

const router = Router()
router.use(requireAuth)

function serializeGoal(goal) {
  if (!goal) return null
  return {
    id: goal._id.toString(),
    dailyTargetMs: goal.dailyTargetMs,
    weeklyTargetMs: goal.weeklyTargetMs,
    subjectGoals: goal.subjectGoals.map((subjectGoal) => ({
      id: subjectGoal._id.toString(),
      course: subjectGoal.course,
      period: subjectGoal.period,
      targetMs: subjectGoal.targetMs,
    })),
  }
}

router.get('/', async (request, response) => {
  const goal = await StudyGoal.findOne({ userId: request.userId })
  return response.json({ goal: serializeGoal(goal) })
})

router.get('/progress', async (request, response) => {
  const {
    dayFrom: dayFromValue,
    dayTo: dayToValue,
    weekFrom: weekFromValue,
    weekTo: weekToValue,
  } = request.query
  if (
    !isValidProgressRanges(
      dayFromValue,
      dayToValue,
      weekFromValue,
      weekToValue,
    )
  ) {
    return response.status(400).json({
      error: 'Choose valid local day and week dates to calculate goal progress.',
    })
  }

  const dayFrom = new Date(dayFromValue)
  const dayTo = new Date(dayToValue)
  const weekFrom = new Date(weekFromValue)
  const weekTo = new Date(weekToValue)
  const [goal, sessions] = await Promise.all([
    StudyGoal.findOne({ userId: request.userId }),
    StudySession.find({
      userId: request.userId,
      status: 'completed',
      startedAt: { $lt: weekTo },
      segments: { $elemMatch: { startedAt: { $lt: weekTo } } },
    }).select('course status segments'),
  ])

  const today = getSessionSummary(sessions, dayFrom, dayTo)
  const week = getSessionSummary(sessions, weekFrom, weekTo)
  const subjectGoals = (goal?.subjectGoals ?? []).map((subjectGoal) => {
    const actualMs =
      subjectGoal.period === 'daily'
        ? today.bySubject[subjectGoal.course] ?? 0
        : week.bySubject[subjectGoal.course] ?? 0
    return {
      id: subjectGoal._id.toString(),
      course: subjectGoal.course,
      period: subjectGoal.period,
      ...getGoalProgress(subjectGoal.targetMs, actualMs),
    }
  })

  return response.json({
    progress: {
      day: {
        actualMs: today.totalMs,
        goal: getGoalProgress(goal?.dailyTargetMs, today.totalMs),
      },
      week: {
        actualMs: week.totalMs,
        goal: getGoalProgress(goal?.weeklyTargetMs, week.totalMs),
      },
      bySubject: today.bySubject,
      bySubjectWeek: week.bySubject,
      subjectGoals,
    },
  })
})

router.put('/', async (request, response) => {
  const { dailyHours, weeklyHours } = request.body
  const updates = {}
  if (Object.hasOwn(request.body, 'dailyHours')) {
    const target = dailyHours === null ? null : hoursToMilliseconds(dailyHours, 24)
    if (dailyHours !== null && target === null) {
      return response.status(400).json({ error: 'Daily goal must be greater than 0 and no more than 24 hours.' })
    }
    updates.dailyTargetMs = target
  }
  if (Object.hasOwn(request.body, 'weeklyHours')) {
    const target = weeklyHours === null ? null : hoursToMilliseconds(weeklyHours, 168)
    if (weeklyHours !== null && target === null) {
      return response.status(400).json({ error: 'Weekly goal must be greater than 0 and no more than 168 hours.' })
    }
    updates.weeklyTargetMs = target
  }
  if (Object.keys(updates).length === 0) {
    return response.status(400).json({ error: 'Set at least a daily or weekly study goal.' })
  }
  const existing = await StudyGoal.findOne({ userId: request.userId })
  const nextDailyTarget =
    Object.hasOwn(updates, 'dailyTargetMs')
      ? updates.dailyTargetMs
      : existing?.dailyTargetMs ?? null
  const nextWeeklyTarget =
    Object.hasOwn(updates, 'weeklyTargetMs')
      ? updates.weeklyTargetMs
      : existing?.weeklyTargetMs ?? null
  if (
    nextDailyTarget === null &&
    nextWeeklyTarget === null &&
    !existing?.subjectGoals.length
  ) {
    await StudyGoal.deleteOne({ userId: request.userId })
    return response.json({ goal: null })
  }

  const goal = await StudyGoal.findOneAndUpdate(
    { userId: request.userId },
    { $set: updates, $setOnInsert: { userId: request.userId } },
    { new: true, upsert: true, runValidators: true },
  )
  return response.json({ goal: serializeGoal(goal) })
})

router.post('/subjects', async (request, response) => {
  const { course, period, hours } = request.body
  if (!courses.includes(course)) {
    return response.status(400).json({ error: 'Choose one of the seven subjects.' })
  }
  if (!['daily', 'weekly'].includes(period)) {
    return response.status(400).json({ error: 'Choose a daily or weekly subject goal.' })
  }
  const targetMs = hoursToMilliseconds(hours, period === 'daily' ? 24 : 168)
  if (targetMs === null) {
    return response.status(400).json({
      error: `Subject goal must be greater than 0 and no more than ${period === 'daily' ? 24 : 168} hours.`,
    })
  }

  await StudyGoal.updateOne(
    { userId: request.userId },
    { $setOnInsert: { userId: request.userId } },
    { upsert: true },
  )
  const goal = await StudyGoal.findOneAndUpdate(
    {
      userId: request.userId,
      subjectGoals: { $not: { $elemMatch: { course, period } } },
    },
    { $push: { subjectGoals: { course, period, targetMs } } },
    { new: true, runValidators: true },
  )
  if (!goal) {
    return response.status(409).json({ error: 'A goal for this subject and period already exists. Edit the existing goal instead.' })
  }
  return response.status(201).json({ goal: serializeGoal(goal) })
})

router.patch('/subjects/:id', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Subject goal ID is invalid.' })
  }
  const { course, period, hours } = request.body
  if (!courses.includes(course) || !['daily', 'weekly'].includes(period)) {
    return response.status(400).json({ error: 'Choose a valid subject and daily or weekly period.' })
  }
  const targetMs = hoursToMilliseconds(hours, period === 'daily' ? 24 : 168)
  if (targetMs === null) {
    return response.status(400).json({
      error: `Subject goal must be greater than 0 and no more than ${period === 'daily' ? 24 : 168} hours.`,
    })
  }
  const goal = await StudyGoal.findOne({ userId: request.userId })
  if (!goal) return response.status(404).json({ error: 'Study goal not found.' })
  const subjectGoal = goal.subjectGoals.id(request.params.id)
  if (!subjectGoal) return response.status(404).json({ error: 'Subject goal not found.' })
  const duplicate = goal.subjectGoals.find(
    (item) =>
      item.id !== request.params.id &&
      item.course === course &&
      item.period === period,
  )
  if (duplicate) {
    return response.status(409).json({ error: 'A goal for this subject and period already exists.' })
  }
  subjectGoal.course = course
  subjectGoal.period = period
  subjectGoal.targetMs = targetMs
  await goal.save()
  return response.json({ goal: serializeGoal(goal) })
})

router.delete('/subjects/:id', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Subject goal ID is invalid.' })
  }
  const goal = await StudyGoal.findOne({
    userId: request.userId,
    'subjectGoals._id': request.params.id,
  })
  if (!goal) return response.status(404).json({ error: 'Subject goal not found.' })
  goal.subjectGoals.pull({ _id: request.params.id })
  if (goal.dailyTargetMs == null && goal.weeklyTargetMs == null && goal.subjectGoals.length === 0) {
    await goal.deleteOne()
  } else {
    await goal.save()
  }
  return response.json({ goal: serializeGoal(goal) })
})

export default router
