import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
    },
    reminderKey: { type: String, required: true },
    type: {
      type: String,
      enum: ['upcoming', 'due_today', 'overdue'],
      required: true,
    },
    title: { type: String, required: true },
    subject: { type: String, required: true },
    due: { type: String, required: true },
    readAt: { type: Date, default: null },
    clearedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

notificationSchema.index({ userId: 1, reminderKey: 1 }, { unique: true })
notificationSchema.index({ userId: 1, due: 1 })

export const Notification = mongoose.model('Notification', notificationSchema)
