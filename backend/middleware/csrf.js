import { timingSafeEqual } from 'node:crypto'
import { csrfCookieName } from '../constants.js'

export function requireCsrf(request, response, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return next()
  }

  const cookieToken = request.cookies[csrfCookieName]
  const headerToken = request.get('x-csrf-token')
  if (
    !cookieToken ||
    !headerToken ||
    cookieToken.length !== headerToken.length ||
    !timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
  ) {
    return response.status(403).json({ error: 'Security check failed. Refresh the page and try again.' })
  }

  return next()
}
