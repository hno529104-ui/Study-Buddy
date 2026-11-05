import mongoose from 'mongoose'
import { courses, priorities } from '../constants.js'

const taskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    course: {
      type: String,
      required: true,
      enum: courses,
    },
    due: {
      type: String,
      default: '',
    },
    priority: {
      type: String,
      enum: priorities,
      default: 'Medium',
    },
    done: {
      type: Boolean,
      default: false,
    },
    legacyId: {
      type: String,
      default: undefined,
    },
  },
  { timestamps: true },
)

taskSchema.index(
  { userId: 1, legacyId: 1 },
  { unique: true, partialFilterExpression: { legacyId: { $type: 'string' } } },
)

export const Task = mongoose.model('Task', taskSchema)
