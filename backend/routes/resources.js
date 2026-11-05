import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import mongoose from 'mongoose'
import { config } from '../config.js'
import { courses } from '../constants.js'
import { requireAuth } from '../middleware/auth.js'
import { Resource } from '../models/Resource.js'
import { User } from '../models/User.js'
import {
  allowedResourceTypes,
  hasValidResourceSignature,
  isAllowedResourceUpload,
  maxResourceFileSize,
  reportReasons,
  resourceTypes,
  sanitizeOriginalFilename,
  validateResourceDetails,
} from '../utils/resources.js'

const router = Router()
router.use(requireAuth)

await mkdir(config.resourceStorageDir, { recursive: true, mode: 0o700 })

const upload = multer({
  storage: multer.diskStorage({
    destination: (request, file, callback) => {
      callback(null, config.resourceStorageDir)
    },
    filename: (request, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase()
      callback(null, `${randomUUID()}${extension}`)
    },
  }),
  limits: { fileSize: maxResourceFileSize, files: 1 },
  fileFilter: (request, file, callback) => {
    if (!isAllowedResourceUpload(file)) {
      const error = new Error(
        'Use a PDF, DOCX, PPTX, XLSX, JPEG, PNG, GIF, or WEBP file.',
      )
      error.status = 400
      return callback(error)
    }
    return callback(null, true)
  },
})

function receiveUpload(request, response, next) {
  upload.single('file')(request, response, (error) => {
    if (!error) return next()
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return response.status(413).json({
        error: 'Files must be 15 MB or smaller.',
      })
    }
    if (error instanceof multer.MulterError) {
      return response.status(400).json({ error: 'Upload one supported file.' })
    }
    return response.status(error.status || 400).json({ error: error.message })
  })
}

function resourceResponse(resource, uploader = null) {
  const fileExtension = path.extname(resource.originalName).toLowerCase()
  return {
    id: resource._id.toString(),
    title: resource.title,
    description: resource.description,
    subject: resource.subject,
    resourceType: resource.resourceType,
    semester: resource.semester,
    examYear: resource.examYear,
    originalName: resource.originalName,
    mimeType: resource.mimeType,
    fileSize: resource.fileSize,
    previewable: Boolean(allowedResourceTypes[fileExtension]?.preview),
    uploader: uploader?.name || 'Student',
    uploaderId: resource.uploaderId.toString(),
    uploadedAt: resource.createdAt.toISOString(),
    updatedAt: resource.updatedAt.toISOString(),
  }
}

function safeStoredPath(storageKey) {
  const resolved = path.resolve(config.resourceStorageDir, storageKey)
  if (!resolved.startsWith(`${path.resolve(config.resourceStorageDir)}${path.sep}`)) {
    throw new Error('Stored resource path is invalid.')
  }
  return resolved
}

function validId(id) {
  return mongoose.isValidObjectId(id)
}

router.get('/', async (request, response) => {
  const { search, subject, resourceType, semester, examYear } = request.query
  const query = {}
  if (typeof search === 'string' && search.trim()) {
    if (search.trim().length > 100) {
      return response.status(400).json({ error: 'Search must be 100 characters or fewer.' })
    }
    const literal = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    query.$or = [
      { title: new RegExp(literal, 'i') },
      { description: new RegExp(literal, 'i') },
      { semester: new RegExp(literal, 'i') },
    ]
  }
  if (subject !== undefined && subject !== 'all') {
    if (!courses.includes(subject)) {
      return response.status(400).json({ error: 'Choose one of the seven subjects.' })
    }
    query.subject = subject
  }
  if (resourceType !== undefined && resourceType !== 'all') {
    if (!resourceTypes.includes(resourceType)) {
      return response.status(400).json({ error: 'Choose a valid resource type.' })
    }
    query.resourceType = resourceType
  }
  if (typeof semester === 'string' && semester.trim()) {
    if (semester.trim().length > 60) {
      return response.status(400).json({ error: 'Semester must be 60 characters or fewer.' })
    }
    query.semester = new RegExp(
      semester.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i',
    )
  }
  if (examYear !== undefined && examYear !== 'all') {
    const year = Number(examYear)
    if (!Number.isInteger(year) || year < 1900 || year > 2200) {
      return response.status(400).json({ error: 'Choose a valid exam year.' })
    }
    query.examYear = year
  }

  const resources = await Resource.find(query)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('uploaderId', 'name')
  return response.json({
    resources: resources.map((resource) =>
      resourceResponse(resource, resource.uploaderId),
    ),
  })
})

router.post('/', receiveUpload, async (request, response, next) => {
  const uploadedPath = request.file?.path
  try {
    if (!request.file) {
      return response.status(400).json({ error: 'Choose a file to share.' })
    }
    const values = {
      title: request.body.title,
      description: request.body.description,
      subject: request.body.subject,
      resourceType: request.body.resourceType,
      semester: request.body.semester,
      examYear: request.body.examYear || null,
    }
    const errors = validateResourceDetails(values)
    if (Object.keys(errors).length > 0) {
      await rm(uploadedPath, { force: true })
      return response.status(400).json({
        error: 'Check the resource details.',
        fields: errors,
      })
    }

    const extension = path.extname(request.file.originalname).toLowerCase()
    const definition = allowedResourceTypes[extension]
    const bytes = await readFile(uploadedPath)
    if (!hasValidResourceSignature(extension, bytes)) {
      await rm(uploadedPath, { force: true })
      return response.status(400).json({
        error: 'The file contents do not match a supported file format.',
      })
    }
    const originalName = sanitizeOriginalFilename(request.file.originalname)
    if (!originalName) {
      await rm(uploadedPath, { force: true })
      return response.status(400).json({ error: 'The uploaded filename is invalid.' })
    }

    const resource = await Resource.create({
      uploaderId: request.userId,
      title: values.title.trim(),
      description: values.description.trim(),
      subject: values.subject,
      resourceType: values.resourceType,
      semester: values.semester.trim(),
      examYear: values.examYear ? Number(values.examYear) : null,
      originalName,
      storageKey: request.file.filename,
      mimeType: definition.mimeType,
      fileSize: request.file.size,
    })
    const uploader = await User.findById(request.userId).select('name')
    return response.status(201).json({
      resource: resourceResponse(resource, uploader),
    })
  } catch (error) {
    if (uploadedPath) {
      await rm(uploadedPath, { force: true }).catch((cleanupError) => {
        console.error('Unable to remove a failed resource upload:', cleanupError)
      })
    }
    return next(error)
  }
})

router.get('/:id/file', async (request, response) => {
  if (!validId(request.params.id)) {
    return response.status(400).json({ error: 'Resource ID is invalid.' })
  }
  const resource = await Resource.findById(request.params.id)
  if (!resource) {
    return response.status(404).json({ error: 'Resource not found.' })
  }

  let filePath
  try {
    filePath = safeStoredPath(resource.storageKey)
  } catch (error) {
    console.error('Stored resource path validation failed:', error)
    return response.status(500).json({ error: 'The stored resource is unavailable.' })
  }

  const previewable = Boolean(
    allowedResourceTypes[path.extname(resource.originalName).toLowerCase()]
      ?.preview,
  )
  const disposition =
    request.query.download === '1' || !previewable ? 'attachment' : 'inline'
  const encodedName = encodeURIComponent(resource.originalName).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  response.set({
    'Content-Type': resource.mimeType,
    'Content-Disposition': `${disposition}; filename*=UTF-8''${encodedName}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  })
  return response.sendFile(filePath, (error) => {
    if (!error) return
    if (error.code === 'ENOENT' && !response.headersSent) {
      return response.status(404).json({ error: 'The resource file is missing.' })
    }
    if (!response.headersSent) {
      return response.status(500).json({ error: 'The resource file could not be opened.' })
    }
    return response.destroy(error)
  })
})

router.patch('/:id', async (request, response) => {
  if (!validId(request.params.id)) {
    return response.status(400).json({ error: 'Resource ID is invalid.' })
  }
  const resource = await Resource.findOne({
    _id: request.params.id,
    uploaderId: request.userId,
  })
  if (!resource) {
    return response.status(404).json({ error: 'Your resource was not found.' })
  }
  const allowedFields = [
    'title',
    'description',
    'subject',
    'resourceType',
    'semester',
    'examYear',
  ]
  const hasChanges = allowedFields.some((field) =>
    Object.hasOwn(request.body, field),
  )
  if (!hasChanges) {
    return response.status(400).json({ error: 'Provide at least one resource change.' })
  }
  const values = {}
  for (const field of allowedFields) {
    values[field] = Object.hasOwn(request.body, field)
      ? request.body[field]
      : resource[field]
  }
  const errors = validateResourceDetails(values)
  if (Object.keys(errors).length > 0) {
    return response.status(400).json({
      error: 'Check the resource details.',
      fields: errors,
    })
  }
  resource.title = values.title.trim()
  resource.description = values.description.trim()
  resource.subject = values.subject
  resource.resourceType = values.resourceType
  resource.semester = values.semester.trim()
  resource.examYear =
    values.examYear === '' || values.examYear === null
      ? null
      : Number(values.examYear)
  await resource.save()
  const uploader = await User.findById(request.userId).select('name')
  return response.json({ resource: resourceResponse(resource, uploader) })
})

router.delete('/:id', async (request, response) => {
  if (!validId(request.params.id)) {
    return response.status(400).json({ error: 'Resource ID is invalid.' })
  }
  const resource = await Resource.findOne({
    _id: request.params.id,
    uploaderId: request.userId,
  })
  if (!resource) {
    return response.status(404).json({ error: 'Your resource was not found.' })
  }
  const filePath = safeStoredPath(resource.storageKey)
  await resource.deleteOne()
  try {
    await rm(filePath, { force: true })
  } catch (error) {
    console.error('Resource metadata was removed but file cleanup failed:', error)
    return response.status(500).json({
      error: 'The resource was removed, but its stored file could not be cleaned up.',
    })
  }
  return response.json({ message: 'Resource deleted.' })
})

router.post('/:id/report', async (request, response) => {
  if (!validId(request.params.id)) {
    return response.status(400).json({ error: 'Resource ID is invalid.' })
  }
  if (!reportReasons.includes(request.body.reason)) {
    return response.status(400).json({ error: 'Choose a valid report reason.' })
  }
  const resource = await Resource.findOneAndUpdate(
    {
      _id: request.params.id,
      uploaderId: { $ne: request.userId },
      'reports.userId': { $ne: request.userId },
    },
    {
      $push: {
        reports: { userId: request.userId, reason: request.body.reason },
      },
    },
    { new: true },
  )
  if (!resource) {
    const exists = await Resource.exists({ _id: request.params.id })
    if (!exists) {
      return response.status(404).json({ error: 'Resource not found.' })
    }
    return response.status(409).json({
      error: 'You have already reported this resource or cannot report your own upload.',
    })
  }
  return response.status(201).json({ message: 'Report submitted for review.' })
})

export default router
