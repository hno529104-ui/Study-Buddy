import mongoose from 'mongoose'
import { courses } from '../constants.js'

const segmentSchema = new mongoose.Schema(
  {
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
  },
  { _id: false },
)

const studySessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    course: {
      type: String,
      required: true,
      enum: courses,
    },
    status: {
      type: String,
      enum: ['running', 'paused', 'completed'],
      required: true,
      default: 'running',
    },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date, default: null },
    segments: { type: [segmentSchema], default: [] },
    durationMs: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
)

studySessionSchema.index(
  { userId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['running', 'paused'] } },
  },
)
studySessionSchema.index({ userId: 1, startedAt: -1 })

export const StudySession = mongoose.model('StudySession', studySessionSchema)
