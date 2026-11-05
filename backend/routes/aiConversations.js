import { Router } from 'express'
import mongoose from 'mongoose'
import { rateLimit } from 'express-rate-limit'
import { config } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import { AIConversation } from '../models/AIConversation.js'
import {
  buildAssistantInput,
  extractResponseText,
  makeConversationTitle,
  validateAssistantPrompt,
} from '../utils/aiAssistant.js'

const router = Router()
router.use(requireAuth)
const assistantLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (request) => request.userId.toString(),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'You have sent several questions recently. Please try again later.',
  },
})

function messageResponse(message) {
  return {
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  }
}

function conversationResponse(conversation, includeMessages = false) {
  const lastMessage = conversation.messages.at(-1)
  return {
    id: conversation._id.toString(),
    subject: conversation.subject,
    title: conversation.title,
    updatedAt: conversation.updatedAt.toISOString(),
    lastMessage: lastMessage?.content.slice(0, 120) ?? '',
    ...(includeMessages
      ? { messages: conversation.messages.map(messageResponse) }
      : {}),
  }
}

function ollamaUrl(path) {
  return `${config.ollamaBaseUrl.replace(/\/+$/, '')}${path}`
}

async function requestAssistant(subject, history, message) {
  let response
  try {
    response = await fetch(ollamaUrl('/api/chat'), {
      method: 'POST',
      signal: AbortSignal.timeout(45_000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        messages: buildAssistantInput(subject, history, message),
        stream: false,
        options: { num_predict: 1200 },
      }),
    })
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw error
    }
    throw Object.assign(
      new Error('Ollama is not running. Start Ollama and try again.'),
      { status: 503, code: 'OLLAMA_UNAVAILABLE' },
    )
  }

  if (!response.ok) {
    let details
    try {
      details = await response.json()
    } catch {
      details = null
    }
    if (
      response.status === 404 ||
      /model .* not found/i.test(details?.error || '')
    ) {
      throw Object.assign(
        new Error(
          `Ollama model "${config.ollamaModel}" is missing. Run "ollama pull ${config.ollamaModel}" and try again.`,
        ),
        { status: 503, code: 'OLLAMA_MODEL_MISSING' },
      )
    }
    console.error(`Ollama request failed with HTTP ${response.status}.`)
    throw Object.assign(
      new Error(
        'Ollama could not generate a response. Check that the local service is ready and try again.',
      ),
      { status: 502 },
    )
  }

  let result
  try {
    result = await response.json()
  } catch {
    throw Object.assign(
      new Error('Ollama returned an unreadable response. Please try again.'),
      { status: 502 },
    )
  }
  const text = extractResponseText(result)
  if (!text) {
    throw Object.assign(
      new Error('Ollama returned an empty response. Please try again.'),
      { status: 502 },
    )
  }
  return text
}

router.get('/status', async (request, response) => {
  try {
    const ollamaResponse = await fetch(ollamaUrl('/api/tags'), {
      signal: AbortSignal.timeout(3000),
    })
    if (!ollamaResponse.ok) {
      return response.json({
        configured: false,
        model: config.ollamaModel,
        message: 'Ollama is not responding. Start Ollama and try again.',
      })
    }
    const result = await ollamaResponse.json()
    const modelInstalled = (result.models || []).some(
      (model) =>
        model.name === config.ollamaModel || model.model === config.ollamaModel,
    )
    return response.json({
      configured: modelInstalled,
      model: config.ollamaModel,
      message: modelInstalled
        ? ''
        : `Ollama model "${config.ollamaModel}" is missing. Run "ollama pull ${config.ollamaModel}" and try again.`,
    })
  } catch {
    return response.json({
      configured: false,
      model: config.ollamaModel,
      message:
        'Ollama is not running or did not return a valid status. Start Ollama and try again.',
    })
  }
})

router.get('/', async (request, response) => {
  const conversations = await AIConversation.find({ userId: request.userId })
    .sort({ updatedAt: -1 })
    .limit(50)
    .select('subject title messages updatedAt')
    .slice('messages', -1)
  return response.json({
    conversations: conversations.map((conversation) =>
      conversationResponse(conversation),
    ),
  })
})

router.get('/:id', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Conversation ID is invalid.' })
  }
  const conversation = await AIConversation.findOne({
    _id: request.params.id,
    userId: request.userId,
  })
  if (!conversation) {
    return response.status(404).json({ error: 'Conversation not found.' })
  }
  return response.json({
    conversation: conversationResponse(conversation, true),
  })
})

router.post('/', assistantLimiter, async (request, response) => {
  const errors = validateAssistantPrompt(request.body)
  if (Object.keys(errors).length > 0) {
    return response.status(400).json({
      error: 'Choose a subject and enter a valid study question.',
      fields: errors,
    })
  }

  const message = request.body.message.trim()
  let answer
  try {
    answer = await requestAssistant(request.body.subject, [], message)
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return response.status(504).json({
        error: 'The AI response took too long. Please try again.',
      })
    }
    return response.status(error.status || 502).json({ error: error.message })
  }

  const now = new Date()
  const conversation = await AIConversation.create({
    userId: request.userId,
    subject: request.body.subject,
    title: makeConversationTitle(message),
    messages: [
      { role: 'user', content: message, createdAt: now },
      { role: 'assistant', content: answer, createdAt: now },
    ],
  })
  return response.status(201).json({
    conversation: conversationResponse(conversation, true),
  })
})

router.post('/:id/messages', assistantLimiter, async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Conversation ID is invalid.' })
  }
  const conversation = await AIConversation.findOne({
    _id: request.params.id,
    userId: request.userId,
  })
  if (!conversation) {
    return response.status(404).json({ error: 'Conversation not found.' })
  }
  const errors = validateAssistantPrompt({
    subject: conversation.subject,
    message: request.body.message,
  })
  if (Object.keys(errors).length > 0) {
    return response.status(400).json({
      error: 'Enter a valid study question.',
      fields: errors,
    })
  }
  if (conversation.messages.length > 198) {
    return response.status(409).json({
      error:
        'This conversation has reached its message limit. Start a new conversation to continue.',
    })
  }

  const message = request.body.message.trim()
  let answer
  try {
    answer = await requestAssistant(
      conversation.subject,
      conversation.messages,
      message,
    )
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return response.status(504).json({
        error: 'The AI response took too long. Please try again.',
      })
    }
    return response.status(error.status || 502).json({ error: error.message })
  }

  const now = new Date()
  const updated = await AIConversation.findOneAndUpdate(
    {
      _id: conversation._id,
      userId: request.userId,
      __v: conversation.__v,
    },
    {
      $push: {
        messages: {
          $each: [
            { role: 'user', content: message, createdAt: now },
            { role: 'assistant', content: answer, createdAt: now },
          ],
          $slice: -200,
        },
      },
      $set: { updatedAt: now },
      $inc: { __v: 1 },
    },
    { new: true, runValidators: true },
  )
  if (!updated) {
    return response.status(409).json({
      error:
        'This conversation changed while the response was being prepared. Refresh it and try again.',
    })
  }
  return response.json({
    conversation: conversationResponse(updated, true),
  })
})

router.delete('/:id', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Conversation ID is invalid.' })
  }
  const result = await AIConversation.deleteOne({
    _id: request.params.id,
    userId: request.userId,
  })
  if (result.deletedCount === 0) {
    return response.status(404).json({ error: 'Conversation not found.' })
  }
  return response.json({ message: 'Conversation deleted.' })
})

export default router
