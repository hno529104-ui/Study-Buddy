import mongoose from 'mongoose'
import { courses } from '../constants.js'

const subjectGoalSchema = new mongoose.Schema(
  {
    course: { type: String, required: true, enum: courses },
    period: { type: String, enum: ['daily', 'weekly'], required: true },
    targetMs: { type: Number, required: true, min: 1 },
  },
  { timestamps: true },
)

const studyGoalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    dailyTargetMs: { type: Number, default: null, min: 1 },
    weeklyTargetMs: { type: Number, default: null, min: 1 },
    subjectGoals: { type: [subjectGoalSchema], default: [] },
  },
  { timestamps: true },
)

export const StudyGoal = mongoose.model('StudyGoal', studyGoalSchema)
