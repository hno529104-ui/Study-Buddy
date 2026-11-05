import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { sessionCookieName } from '../constants.js'
import { User } from '../models/User.js'

export async function requireAuth(request, response, next) {
  const token = request.cookies[sessionCookieName]
  if (!token) {
    return response.status(401).json({ error: 'Please sign in to continue.' })
  }

  let payload
  try {
    payload = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'studybuddy',
      audience: 'studybuddy-web',
    })
  } catch {
    response.clearCookie(sessionCookieName, { path: '/' })
    return response.status(401).json({ error: 'Your session has expired. Please sign in again.' })
  }

  const user = await User.findById(payload.sub).select('+tokenVersion')
  if (!user || payload.ver !== user.tokenVersion) {
    response.clearCookie(sessionCookieName, { path: '/' })
    return response.status(401).json({ error: 'Your session has expired. Please sign in again.' })
  }

  request.userId = user._id
  request.authUser = user
  return next()
}
