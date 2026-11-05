import test from 'node:test'
import assert from 'node:assert/strict'
import {
  hasValidResourceSignature,
  isAllowedResourceUpload,
  maxResourceFileSize,
  sanitizeOriginalFilename,
  validateResourceDetails,
} from './resources.js'

test('resource upload limits and accepted extension/MIME pairs are explicit', () => {
  assert.equal(maxResourceFileSize, 15 * 1024 * 1024)
  assert.equal(
    isAllowedResourceUpload({
      originalname: 'notes.pdf',
      mimetype: 'application/pdf',
    }),
    true,
  )
  assert.equal(
    isAllowedResourceUpload({
      originalname: 'notes.exe',
      mimetype: 'application/pdf',
    }),
    false,
  )
  assert.equal(
    isAllowedResourceUpload({
      originalname: 'notes.pdf',
      mimetype: 'text/html',
    }),
    false,
  )
})

test('file content signatures are verified independently of filename', () => {
  assert.equal(
    hasValidResourceSignature('.pdf', Buffer.from('%PDF-1.7 data')),
    true,
  )
  assert.equal(
    hasValidResourceSignature('.pdf', Buffer.from('<html>fake pdf</html>')),
    false,
  )
  assert.equal(
    hasValidResourceSignature(
      '.png',
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ),
    true,
  )
})

test('resource metadata validation accepts valid data and rejects invalid types', () => {
  const valid = {
    title: 'Past paper',
    description: 'Midterm review',
    subject: 'Artificial Intelligence',
    resourceType: 'Past Paper',
    semester: 'Fall 2026',
    examYear: 2025,
  }
  assert.deepEqual(validateResourceDetails(valid), {})
  assert.ok(
    validateResourceDetails({
      ...valid,
      subject: 'Other subject',
      resourceType: 'Executable',
      examYear: 'not a year',
    }).subject,
  )
})

test('original filenames cannot contain path traversal or control characters', () => {
  assert.equal(
    sanitizeOriginalFilename('C:\\unsafe\\notes\r\n.pdf'),
    'notes.pdf',
  )
})
