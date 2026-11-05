import { useCallback, useEffect, useMemo, useState } from 'react'
import { courses } from './sampleData.js'
import { apiRequest } from './api.js'

function getLocalDayRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  return { from: start.toISOString(), to: end.toISOString() }
}

function formatClock(durationMs) {
  const seconds = Math.floor(Math.max(0, durationMs) / 1000)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return [hours, minutes, seconds % 60]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
}

function formatDuration(durationMs) {
  const totalSeconds = Math.floor(Math.max(0, durationMs) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function localDateKey(value) {
  const date = new Date(value)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function StudyTimer({ csrfToken }) {
  const [selectedCourse, setSelectedCourse] = useState('')
  const [session, setSession] = useState(null)
  const [summary, setSummary] = useState({ totalMs: 0, bySubject: {} })
  const [summaryUpdatedAt, setSummaryUpdatedAt] = useState(() => Date.now())
  const [history, setHistory] = useState([])
  const [historyCourse, setHistoryCourse] = useState('all')
  const [historyDate, setHistoryDate] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [todayKey, setTodayKey] = useState(() => localDateKey(new Date()))
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const todayRange = useMemo(
    () => getLocalDayRange(new Date(`${todayKey}T12:00:00`)),
    [todayKey],
  )
  const liveSummaryDelta =
    session?.status === 'running'
      ? Math.max(0, now - summaryUpdatedAt)
      : 0
  const elapsedMs = session
    ? session.durationMs +
      (session.status === 'running' && session.runningSince
        ? Math.max(0, now - Date.parse(session.runningSince))
        : 0)
    : 0

  const loadHistory = useCallback(async () => {
    const params = new URLSearchParams()
    if (historyCourse !== 'all') params.set('course', historyCourse)
    if (historyDate) {
      const range = getLocalDayRange(new Date(`${historyDate}T12:00:00`))
      params.set('from', range.from)
      params.set('to', range.to)
    }
    const suffix = params.size ? `?${params.toString()}` : ''
    const result = await apiRequest(`/study-sessions${suffix}`)
    return result.sessions
  }, [historyCourse, historyDate])

  async function loadSummary() {
    const params = new URLSearchParams(todayRange)
    const result = await apiRequest(`/study-sessions/summary?${params.toString()}`)
    setSummary(result.summary)
    setSummaryUpdatedAt(Date.now())
  }

  async function refreshSession() {
    const result = await apiRequest('/study-sessions/active')
    setSession(result.session)
    if (result.session) setSelectedCourse(result.session.course)
  }

  useEffect(() => {
    let cancelled = false
    async function loadInitialData() {
      setLoading(true)
      setError('')
      try {
        const [activeResult, summaryResult, historyResult] = await Promise.all([
          apiRequest('/study-sessions/active'),
          apiRequest(
            `/study-sessions/summary?${new URLSearchParams(todayRange).toString()}`,
          ),
          apiRequest('/study-sessions'),
        ])
        if (cancelled) return
        setSession(activeResult.session)
        if (activeResult.session) setSelectedCourse(activeResult.session.course)
        setSummary(summaryResult.summary)
        setSummaryUpdatedAt(Date.now())
        setHistory(historyResult.sessions)
      } catch (loadError) {
        if (!cancelled) setError(loadError.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadInitialData()
    return () => {
      cancelled = true
    }
  }, [todayRange])

  useEffect(() => {
    const clockInterval = session?.status === 'running'
      ? window.setInterval(() => setNow(Date.now()), 250)
      : undefined
    const dayInterval = window.setInterval(() => {
      const date = new Date()
      setTodayKey(localDateKey(date))
      if (session?.status !== 'running') setNow(date.getTime())
    }, 60_000)
    return () => {
      if (clockInterval !== undefined) window.clearInterval(clockInterval)
      window.clearInterval(dayInterval)
    }
  }, [session])

  useEffect(() => {
    if (loading) return
    let cancelled = false
    async function updateHistory() {
      try {
        const sessions = await loadHistory()
        if (!cancelled) setHistory(sessions)
      } catch (historyError) {
        if (!cancelled) setError(historyError.message)
      }
    }
    updateHistory()
    return () => {
      cancelled = true
    }
  }, [historyCourse, historyDate, loading, loadHistory])

  async function performAction(action, body) {
    setBusy(true)
    setError('')
    try {
      const result = await apiRequest(`/study-sessions${action}`, {
        method: 'POST',
        csrfToken,
        body,
      })
      setSession(result.session?.status === 'completed' ? null : result.session)
      const [, sessions] = await Promise.all([loadSummary(), loadHistory()])
      setHistory(sessions)
    } catch (actionError) {
      setError(actionError.message)
      try {
        await refreshSession()
      } catch (refreshError) {
        setError(`${actionError.message} ${refreshError.message}`)
      }
    } finally {
      setBusy(false)
    }
  }

  function startSession() {
    if (!courses.some((course) => course.name === selectedCourse)) {
      setError('Choose one of the seven subjects before starting.')
      return
    }
    performAction('/start', { course: selectedCourse })
  }

  function updateSession(action) {
    if (session) performAction(`/${session.id}/${action}`, {})
  }

  const heading = session
    ? session.status === 'paused'
      ? 'Session paused'
      : 'Session in progress'
    : 'Ready for a study session?'

  return (
    <section className="panel timer-panel" aria-labelledby="timer-heading">
      <div className="timer-heading">
        <div>
          <p className="eyebrow">FOCUS TIME</p>
          <h2 id="timer-heading">Study Timer</h2>
        </div>
        <p className="timer-today-total">
          Today: <strong>{formatDuration(summary.totalMs + liveSummaryDelta)}</strong>
        </p>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {loading ? (
        <p className="empty" role="status">Loading your study sessions…</p>
      ) : (
        <>
          <div className="timer-controls">
            <div className="timer-display" aria-live="off">
              <p>{heading}</p>
              <output aria-label="Elapsed study time">{formatClock(elapsedMs)}</output>
              {session && <span>{session.course}</span>}
            </div>
            <div className="timer-actions">
              {!session ? (
                <>
                  <label className="field">
                    Study subject
                    <select
                      value={selectedCourse}
                      onChange={(event) => setSelectedCourse(event.target.value)}
                    >
                      <option value="">Choose a subject</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.name}>
                          {course.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="button" disabled={busy} onClick={startSession} type="button">
                    Start
                  </button>
                </>
              ) : (
                <>
                  {session.status === 'running' ? (
                    <button
                      className="button button-secondary"
                      disabled={busy}
                      onClick={() => updateSession('pause')}
                      type="button"
                    >
                      Pause
                    </button>
                  ) : (
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => updateSession('resume')}
                      type="button"
                    >
                      Resume
                    </button>
                  )}
                  <button
                    className="button button-danger"
                    disabled={busy}
                    onClick={() => updateSession('stop')}
                    type="button"
                  >
                    Stop and save
                  </button>
                </>
              )}
            </div>
          </div>

          <section className="timer-subject-summary" aria-labelledby="timer-subject-heading">
            <h3 id="timer-subject-heading">Today by subject</h3>
            <ul className="timer-subject-list">
              {courses.map((course) => (
                <li key={course.id}>
                  <span>{course.name}</span>
                  <strong>
                    {formatDuration(
                      (summary.bySubject[course.name] ?? 0) +
                        (session?.status === 'running' && session.course === course.name
                          ? liveSummaryDelta
                          : 0),
                    )}
                  </strong>
                </li>
              ))}
            </ul>
          </section>

          <section className="timer-history" aria-labelledby="timer-history-heading">
            <div className="timer-history-heading">
              <h3 id="timer-history-heading">Study session history</h3>
              <div className="timer-filters">
                <label className="field">
                  Subject
                  <select
                    value={historyCourse}
                    onChange={(event) => setHistoryCourse(event.target.value)}
                  >
                    <option value="all">All subjects</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.name}>{course.name}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Date
                  <input
                    type="date"
                    value={historyDate}
                    onChange={(event) => setHistoryDate(event.target.value)}
                  />
                </label>
              </div>
            </div>
            {history.length === 0 ? (
              <p className="dashboard-empty">No study sessions match these filters.</p>
            ) : (
              <ul className="study-history-list">
                {history.map((item) => {
                  const liveDuration = item.id === session?.id ? elapsedMs : item.durationMs
                  return (
                    <li key={item.id}>
                      <div>
                        <strong>{item.course}</strong>
                        <time dateTime={item.startedAt}>
                          {new Date(item.startedAt).toLocaleString()}
                        </time>
                      </div>
                      <div className="study-history-meta">
                        <span>{formatDuration(liveDuration)}</span>
                        <span className={`session-status status-${item.status}`}>
                          {item.status === 'running' && item.id === session?.id
                            ? 'In progress'
                            : item.status}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </section>
  )
}

export default StudyTimer
