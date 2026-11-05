import { Router } from 'express'
import mongoose from 'mongoose'
import { courses } from '../constants.js'
import { requireAuth } from '../middleware/auth.js'
import { StudySession } from '../models/StudySession.js'
import {
  getSessionDurationMs,
  getSessionResponse,
  getSessionSummary,
  isValidDateRange,
} from '../utils/studySessions.js'

const router = Router()
router.use(requireAuth)

function dateError(response) {
  return response.status(400).json({
    error: 'Choose a valid date range that is no longer than 32 days.',
  })
}

router.get('/active', async (request, response) => {
  const session = await StudySession.findOne({
    userId: request.userId,
    status: { $in: ['running', 'paused'] },
  })
  return response.json({
    session: session ? getSessionResponse(session) : null,
  })
})

router.get('/summary', async (request, response) => {
  const { from: fromValue, to: toValue } = request.query
  if (!isValidDateRange(fromValue, toValue)) return dateError(response)

  const from = new Date(fromValue)
  const to = new Date(toValue)
  const sessions = await StudySession.find({
    userId: request.userId,
    startedAt: { $lt: to },
    segments: { $elemMatch: { startedAt: { $lt: to } } },
  }).select('course segments')

  return response.json({ summary: getSessionSummary(sessions, from, to, new Date()) })
})

router.get('/', async (request, response) => {
  const query = { userId: request.userId }
  const { course, from: fromValue, to: toValue } = request.query
  if (course !== undefined) {
    if (!courses.includes(course)) {
      return response.status(400).json({ error: 'Choose one of the available subjects.' })
    }
    query.course = course
  }
  if (fromValue !== undefined || toValue !== undefined) {
    if (!isValidDateRange(fromValue, toValue)) return dateError(response)
    query.startedAt = { $gte: new Date(fromValue), $lt: new Date(toValue) }
  }
  const sessions = await StudySession.find(query).sort({ startedAt: -1 }).limit(100)
  return response.json({
    sessions: sessions.map((session) => getSessionResponse(session)),
  })
})

router.post('/start', async (request, response) => {
  if (!courses.includes(request.body.course)) {
    return response.status(400).json({ error: 'Choose one of the seven subjects first.' })
  }

  const now = new Date()
  try {
    const session = await StudySession.create({
      userId: request.userId,
      course: request.body.course,
      status: 'running',
      startedAt: now,
      segments: [{ startedAt: now }],
    })
    return response.status(201).json({ session: getSessionResponse(session, now) })
  } catch (error) {
    if (error?.code === 11000) {
      return response.status(409).json({
        error: 'A study session is already in progress. Resume or stop it first.',
      })
    }
    throw error
  }
})

router.post('/:id/pause', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Study session ID is invalid.' })
  }
  const session = await StudySession.findOne({
    _id: request.params.id,
    userId: request.userId,
    status: 'running',
  })
  if (!session) return response.status(404).json({ error: 'Running session not found.' })

  const now = new Date()
  const activeSegment = session.segments.at(-1)
  if (activeSegment && !activeSegment.endedAt) activeSegment.endedAt = now
  session.durationMs = getSessionDurationMs(session, now)
  session.status = 'paused'
  await session.save()
  return response.json({ session: getSessionResponse(session, now) })
})

router.post('/:id/resume', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Study session ID is invalid.' })
  }
  const session = await StudySession.findOne({
    _id: request.params.id,
    userId: request.userId,
    status: 'paused',
  })
  if (!session) return response.status(404).json({ error: 'Paused session not found.' })

  const now = new Date()
  session.status = 'running'
  session.segments.push({ startedAt: now })
  await session.save()
  return response.json({ session: getSessionResponse(session, now) })
})

router.post('/:id/stop', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Study session ID is invalid.' })
  }
  const session = await StudySession.findOne({
    _id: request.params.id,
    userId: request.userId,
  })
  if (!session) return response.status(404).json({ error: 'Study session not found.' })
  if (session.status === 'completed') {
    return response.json({ session: getSessionResponse(session) })
  }

  const now = new Date()
  const activeSegment = session.segments.at(-1)
  if (session.status === 'running' && activeSegment && !activeSegment.endedAt) {
    activeSegment.endedAt = now
  }
  session.durationMs = getSessionDurationMs(session, now)
  session.status = 'completed'
  session.endedAt = now
  await session.save()
  return response.json({ session: getSessionResponse(session, now) })
})

export default router
