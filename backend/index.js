import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import mongoose from 'mongoose'
import { config } from './config.js'
import { connectDatabase } from './db.js'
import { requireCsrf } from './middleware/csrf.js'
import { normalizeJsonBody } from './middleware/jsonBody.js'
import authRoutes from './routes/auth.js'
import aiConversationRoutes from './routes/aiConversations.js'
import notificationRoutes from './routes/notifications.js'
import resourceRoutes from './routes/resources.js'
import studyGoalRoutes from './routes/studyGoals.js'
import studyNoteRoutes from './routes/studyNotes.js'
import studySessionRoutes from './routes/studySessions.js'
import taskRoutes from './routes/tasks.js'

const app = express()
app.disable('x-powered-by')
app.use(helmet())
app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true,
  }),
)
app.use(express.json({ limit: '32kb' }))
app.use(cookieParser())
app.use(normalizeJsonBody)
app.use(requireCsrf)

app.get('/api/health', (request, response) => {
  response.json({ status: 'ok' })
})
app.use('/api/auth', authRoutes)
app.use('/api/ai/conversations', aiConversationRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/resources', resourceRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/study-goals', studyGoalRoutes)
app.use('/api/notes', studyNoteRoutes)
app.use('/api/study-sessions', studySessionRoutes)
app.use((request, response) => {
  response.status(404).json({ error: 'API route not found.' })
})
app.use((error, request, response, next) => {
  if (response.headersSent) {
    return next(error)
  }
  console.error('API request failed:', error)
  const status = error instanceof SyntaxError && 'status' in error ? 400 : 500
  return response.status(status).json({
    error:
      status === 400
        ? 'Request body must contain valid JSON.'
        : 'Something went wrong. Please try again.',
  })
})

await connectDatabase(config.mongoUri)
const server = app.listen(config.port, () => {
  console.info(`StudyBuddy API listening on port ${config.port}.`)
})

async function shutdown(signal) {
  console.info(`${signal} received; shutting down.`)
  server.close(async (error) => {
    if (error) {
      console.error('HTTP server shutdown failed:', error)
      process.exitCode = 1
    }
    await mongoose.disconnect()
    process.exit()
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
