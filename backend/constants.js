import { courseNames } from '../shared/courses.js'

export const courses = courseNames

export const priorities = ['Low', 'Medium', 'High']

export const sessionCookieName = 'studybuddy_session'
export const csrfCookieName = 'studybuddy_csrf'
export const sessionDurationMs = 7 * 24 * 60 * 60 * 1000
