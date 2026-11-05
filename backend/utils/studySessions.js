export function getSessionDurationMs(session, now = new Date()) {
  return session.segments.reduce((total, segment) => {
    const end = segment.endedAt ?? now
    return total + Math.max(0, end.getTime() - segment.startedAt.getTime())
  }, 0)
}

export function getSessionResponse(session, now = new Date()) {
  const durationMs = getSessionDurationMs(session, now)
  return {
    id: session._id.toString(),
    course: session.course,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    durationMs,
    runningSince:
      session.status === 'running'
        ? session.segments.at(-1)?.startedAt.toISOString() ?? null
        : null,
  }
}

export function getSessionSummary(sessions, from, to, now = new Date()) {
  const bySubject = new Map()
  let totalMs = 0

  for (const session of sessions) {
    let subjectMs = 0
    for (const segment of session.segments) {
      const start = Math.max(segment.startedAt.getTime(), from.getTime())
      const end = Math.min(
        (segment.endedAt ?? now).getTime(),
        to.getTime(),
      )
      subjectMs += Math.max(0, end - start)
    }
    totalMs += subjectMs
    bySubject.set(session.course, (bySubject.get(session.course) ?? 0) + subjectMs)
  }

  return { totalMs, bySubject: Object.fromEntries(bySubject) }
}

export function isValidDateRange(fromValue, toValue) {
  if (typeof fromValue !== 'string' || typeof toValue !== 'string') return false
  const from = new Date(fromValue)
  const to = new Date(toValue)
  return (
    Number.isFinite(from.getTime()) &&
    Number.isFinite(to.getTime()) &&
    from < to &&
    to.getTime() - from.getTime() <= 32 * 24 * 60 * 60 * 1000
  )
}
