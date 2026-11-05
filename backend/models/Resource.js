import mongoose from 'mongoose'
import { courses } from '../constants.js'

const resourceReportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      enum: ['inappropriate', 'misleading', 'unauthorized', 'other'],
      required: true,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

const resourceSchema = new mongoose.Schema(
  {
    uploaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    subject: { type: String, required: true, enum: courses },
    resourceType: {
      type: String,
      enum: ['Past Paper', 'Notes', 'Assignment', 'Other'],
      required: true,
    },
    semester: { type: String, required: true, trim: true, maxlength: 60 },
    examYear: { type: Number, min: 1900, max: 2200, default: null },
    originalName: { type: String, required: true, maxlength: 180 },
    storageKey: { type: String, required: true, unique: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true, min: 1 },
    reports: { type: [resourceReportSchema], default: [] },
  },
  { timestamps: true },
)

resourceSchema.index({ createdAt: -1 })
resourceSchema.index({ subject: 1, resourceType: 1, semester: 1, examYear: 1 })

export const Resource = mongoose.model('Resource', resourceSchema)
