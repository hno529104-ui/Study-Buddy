export class ApiError extends Error {
  constructor(message, status = 500, fields = undefined) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields
  }
}

export async function apiRequest(
  path,
  { method = 'GET', body, csrfToken } = {},
) {
  const headers = {}
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers['X-CSRF-Token'] = csrfToken || ''
  }

  let response
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(
      'Cannot connect to the StudyBuddy server. Check that the API is running and try again.',
    )
  }
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(
      result.error || 'The request could not be completed.',
      response.status,
      result.fields,
    )
  }
  return result
}

export function uploadRequest(
  path,
  { body, csrfToken, onProgress } = {},
) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', `/api${path}`)
    request.withCredentials = true
    request.setRequestHeader('X-CSRF-Token', csrfToken || '')
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100))
      }
    })
    request.addEventListener('load', () => {
      let result = {}
      try {
        result = JSON.parse(request.responseText)
      } catch {
        result = {}
      }
      if (request.status < 200 || request.status >= 300) {
        reject(
          new ApiError(
            result.error || 'The upload could not be completed.',
            request.status,
            result.fields,
          ),
        )
        return
      }
      resolve(result)
    })
    request.addEventListener('error', () => {
      reject(
        new ApiError(
          'Cannot connect to the StudyBuddy server. Check that the API is running and try again.',
        ),
      )
    })
    request.addEventListener('abort', () => {
      reject(new ApiError('The upload was cancelled.'))
    })
    request.send(body)
  })
}
