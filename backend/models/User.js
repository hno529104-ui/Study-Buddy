import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    tokenVersion: {
      type: Number,
      default: 0,
      select: false,
    },
    passwordResetTokenHash: {
      type: String,
      select: false,
      index: true,
    },
    passwordResetExpiresAt: {
      type: Date,
      select: false,
    },
    remindersEnabled: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)

export const User = mongoose.model('User', userSchema)
