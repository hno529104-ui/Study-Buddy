import mongoose from 'mongoose'
import { courses } from '../constants.js'

const studyNoteSchema = new mongoose.Schema(
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
      maxlength: 120,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 6000,
    },
    course: {
      type: String,
      required: true,
      enum: courses,
    },
  },
  { timestamps: true },
)

studyNoteSchema.index({ userId: 1, updatedAt: -1 })

export const StudyNote = mongoose.model('StudyNote', studyNoteSchema)
