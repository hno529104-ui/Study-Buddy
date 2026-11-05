import mongoose from 'mongoose'
import { courses } from '../constants.js'

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true, maxlength: 6000 },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
)

const aiConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    subject: { type: String, enum: courses, required: true },
    title: { type: String, required: true, maxlength: 80 },
    messages: {
      type: [messageSchema],
      default: [],
      validate: (messages) => messages.length <= 200,
    },
  },
  { timestamps: true },
)

aiConversationSchema.index({ userId: 1, updatedAt: -1 })

export const AIConversation = mongoose.model(
  'AIConversation',
  aiConversationSchema,
)
