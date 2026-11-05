const bodylessMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

export function normalizeJsonBody(request, response, next) {
  if (request.body === undefined && !bodylessMethods.has(request.method)) {
    request.body = {}
  }

  if (
    request.body !== undefined &&
    (request.body === null ||
      typeof request.body !== 'object' ||
      Array.isArray(request.body))
  ) {
    return response.status(400).json({ error: 'Request body must be a JSON object.' })
  }

  return next()
}
