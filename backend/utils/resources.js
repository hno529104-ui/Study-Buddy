import path from 'node:path'
import { courses } from '../constants.js'

export const maxResourceFileSize = 15 * 1024 * 1024

export const allowedResourceTypes = {
  '.pdf': {
    mimeType: 'application/pdf',
    preview: true,
  },
  '.docx': {
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    archiveMarker: 'word/document.xml',
    preview: false,
  },
  '.pptx': {
    mimeType:
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    archiveMarker: 'ppt/presentation.xml',
    preview: false,
  },
  '.xlsx': {
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    archiveMarker: 'xl/workbook.xml',
    preview: false,
  },
  '.jpg': { mimeType: 'image/jpeg', signature: 'jpeg', preview: true },
  '.jpeg': { mimeType: 'image/jpeg', signature: 'jpeg', preview: true },
  '.png': { mimeType: 'image/png', signature: 'png', preview: true },
  '.gif': { mimeType: 'image/gif', signature: 'gif', preview: true },
  '.webp': { mimeType: 'image/webp', signature: 'webp', preview: true },
}

export const resourceTypes = ['Past Paper', 'Notes', 'Assignment', 'Other']
export const reportReasons = [
  'inappropriate',
  'misleading',
  'unauthorized',
  'other',
]

export function getResourceExtension(filename) {
  return path.extname(filename || '').toLowerCase()
}

export function isAllowedResourceUpload(file) {
  const extension = getResourceExtension(file.originalname)
  const expected = allowedResourceTypes[extension]
  return Boolean(
    expected &&
      (!file.mimetype ||
        file.mimetype === expected.mimeType ||
        file.mimetype === 'application/octet-stream'),
  )
}

function hasJpegSignature(buffer) {
  return (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  )
}

export function hasValidResourceSignature(extension, buffer) {
  const definition = allowedResourceTypes[extension]
  if (!definition || buffer.length < 4) return false
  if (definition.signature === 'jpeg') return hasJpegSignature(buffer)
  if (definition.signature === 'png') {
    return buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  }
  if (definition.signature === 'gif') {
    const header = buffer.subarray(0, 6).toString('ascii')
    return header === 'GIF87a' || header === 'GIF89a'
  }
  if (definition.signature === 'webp') {
    return (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    )
  }
  if (extension === '.pdf') {
    return buffer.subarray(0, 5).toString('ascii') === '%PDF-'
  }
  if (definition.archiveMarker) {
    const zipHeader =
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      [0x03, 0x05, 0x07].includes(buffer[2]) &&
      [0x04, 0x06, 0x08].includes(buffer[3])
    return (
      zipHeader &&
      buffer.includes(Buffer.from('[Content_Types].xml')) &&
      buffer.includes(Buffer.from(definition.archiveMarker))
    )
  }
  return false
}

export function validateResourceDetails(values) {
  const errors = {}
  if (typeof values.title !== 'string' || !values.title.trim()) {
    errors.title = 'Enter a resource title.'
  } else if (values.title.trim().length > 120) {
    errors.title = 'Resource titles must be 120 characters or fewer.'
  }
  if (typeof values.description !== 'string' || !values.description.trim()) {
    errors.description = 'Enter a short description.'
  } else if (values.description.trim().length > 2000) {
    errors.description = 'Descriptions must be 2,000 characters or fewer.'
  }
  if (!courses.includes(values.subject)) {
    errors.subject = 'Choose a subject.'
  }
  if (!resourceTypes.includes(values.resourceType)) {
    errors.resourceType = 'Choose a resource type.'
  }
  if (typeof values.semester !== 'string' || !values.semester.trim()) {
    errors.semester = 'Enter the semester.'
  } else if (values.semester.trim().length > 60) {
    errors.semester = 'Semester must be 60 characters or fewer.'
  }
  if (
    values.examYear !== undefined &&
    values.examYear !== null &&
    values.examYear !== '' &&
    (!Number.isInteger(Number(values.examYear)) ||
      Number(values.examYear) < 1900 ||
      Number(values.examYear) > new Date().getFullYear() + 1)
  ) {
    errors.examYear = 'Enter a valid exam year.'
  }
  return errors
}

export function sanitizeOriginalFilename(filename) {
  const basename = String(filename || '').replace(/\\/g, '/').split('/').pop()
  return basename
    .split('')
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code >= 32 && code !== 127
    })
    .join('')
    .trim()
    .slice(0, 180)
}
