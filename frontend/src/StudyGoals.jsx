import { useCallback, useEffect, useState } from 'react'
import { courses } from './sampleData.js'
import { apiRequest } from './api.js'

function progressRanges(date = new Date()) {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  const daysSinceMonday = (dayStart.getDay() + 6) % 7
  const weekStart = new Date(
    dayStart.getFullYear(),
    dayStart.getMonth(),
    dayStart.getDate() - daysSinceMonday,
  )
  const weekEnd = new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate() + 7,
  )
  return {
    dayFrom: dayStart.toISOString(),
    dayTo: dayEnd.toISOString(),
    weekFrom: weekStart.toISOString(),
    weekTo: weekEnd.toISOString(),
  }
}

function formatDuration(durationMs) {
  const totalSeconds = Math.floor(Math.max(0, durationMs) / 1000)
  const totalMinutes = Math.floor(totalSeconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function ProgressBar({ progress, label }) {
  if (!progress) {
    return (
      <div className="goal-no-target">
        <strong>{formatDuration(0)}</strong>
        <span>Set a goal to track progress</span>
      </div>
    )
  }
  return (
    <div className="goal-progress">
      <div
        className="goal-progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={progress.percentage}
      >
        <span style={{ width: `${progress.percentage}%` }} />
      </div>
      <div className="goal-progress-meta">
        <span>
          {formatDuration(progress.actualMs)} of {formatDuration(progress.targetMs)}
        </span>
        <strong>{progress.percentage}%</strong>
      </div>
      <p>
        {progress.remainingMs === 0
          ? 'Goal reached!'
          : `${formatDuration(progress.remainingMs)} remaining`}
      </p>
    </div>
  )
}

function StudyGoals({ csrfToken }) {
  const [goal, setGoal] = useState(null)
  const [progress, setProgress] = useState(null)
  const [dailyHours, setDailyHours] = useState('')
  const [weeklyHours, setWeeklyHours] = useState('')
  const [subject, setSubject] = useState('')
  const [period, setPeriod] = useState('daily')
  const [subjectHours, setSubjectHours] = useState('')
  const [editingSubjectId, setEditingSubjectId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadProgress = useCallback(async () => {
    const params = new URLSearchParams(progressRanges())
    const result = await apiRequest(`/study-goals/progress?${params.toString()}`)
    setProgress(result.progress)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadInitialData() {
      try {
        const [goalResult, progressResult] = await Promise.all([
          apiRequest('/study-goals'),
          apiRequest(`/study-goals/progress?${new URLSearchParams(progressRanges())}`),
        ])
        if (cancelled) return
        const nextGoal = goalResult.goal
        setGoal(nextGoal)
        setDailyHours(
          nextGoal?.dailyTargetMs
            ? String(nextGoal.dailyTargetMs / 3_600_000)
            : '',
        )
        setWeeklyHours(
          nextGoal?.weeklyTargetMs
            ? String(nextGoal.weeklyTargetMs / 3_600_000)
            : '',
        )
        setProgress(progressResult.progress)
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
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadProgress().catch((loadError) => setError(loadError.message))
    }, 60_000)
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        loadProgress().catch((loadError) => setError(loadError.message))
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadProgress])

  async function handleSaveGoals(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await apiRequest('/study-goals', {
        method: 'PUT',
        csrfToken,
        body: {
          dailyHours: dailyHours === '' ? null : Number(dailyHours),
          weeklyHours: weeklyHours === '' ? null : Number(weeklyHours),
        },
      })
      setGoal(result.goal)
      setDailyHours(
        result.goal?.dailyTargetMs
          ? String(result.goal.dailyTargetMs / 3_600_000)
          : '',
      )
      setWeeklyHours(
        result.goal?.weeklyTargetMs
          ? String(result.goal.weeklyTargetMs / 3_600_000)
          : '',
      )
      setNotice('Study goals saved.')
      await loadProgress()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  function resetSubjectForm() {
    setEditingSubjectId('')
    setSubject('')
    setPeriod('daily')
    setSubjectHours('')
  }

  async function handleSaveSubject(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await apiRequest(
        editingSubjectId
          ? `/study-goals/subjects/${editingSubjectId}`
          : '/study-goals/subjects',
        {
          method: editingSubjectId ? 'PATCH' : 'POST',
          csrfToken,
          body: { course: subject, period, hours: Number(subjectHours) },
        },
      )
      setGoal(result.goal)
      resetSubjectForm()
      setNotice(editingSubjectId ? 'Subject goal updated.' : 'Subject goal added.')
      await loadProgress()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  function startEditSubject(subjectGoal) {
    setEditingSubjectId(subjectGoal.id)
    setSubject(subjectGoal.course)
    setPeriod(subjectGoal.period)
    setSubjectHours(String(subjectGoal.targetMs / 3_600_000))
    setError('')
    setNotice('')
  }

  async function handleDeleteSubject(subjectGoalId) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await apiRequest(`/study-goals/subjects/${subjectGoalId}`, {
        method: 'DELETE',
        csrfToken,
      })
      setGoal(result.goal)
      if (editingSubjectId === subjectGoalId) resetSubjectForm()
      setNotice('Subject goal deleted.')
      await loadProgress()
    } catch (deleteError) {
      setError(deleteError.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <section className="panel goals-panel" aria-labelledby="goals-heading">
        <p className="empty" role="status">Loading your study goals…</p>
      </section>
    )
  }

  return (
    <section className="panel goals-panel" aria-labelledby="goals-heading">
      <div className="goals-heading">
        <div>
          <p className="eyebrow">BUILD A STEADY ROUTINE</p>
          <h2 id="goals-heading">Study Goals</h2>
        </div>
        <p>Progress is calculated from completed Study Timer sessions.</p>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="import-success" role="status">{notice}</p>}

      {progress && (
        <section className="goal-overview" aria-labelledby="goal-overview-heading">
          <h3 id="goal-overview-heading">Your progress</h3>
          <div className="goal-overview-grid">
            <article className="goal-card">
              <div>
                <h4>Today</h4>
                <span>{formatDuration(progress.day.actualMs)} studied</span>
              </div>
              <ProgressBar
                label="Daily study goal progress"
                progress={progress.day.goal}
              />
            </article>
            <article className="goal-card">
              <div>
                <h4>This week</h4>
                <span>{formatDuration(progress.week.actualMs)} studied</span>
              </div>
              <ProgressBar
                label="Weekly study goal progress"
                progress={progress.week.goal}
              />
            </article>
          </div>
        </section>
      )}

      <form className="goal-form" onSubmit={handleSaveGoals}>
        <div className="goal-form-heading">
          <div>
            <h3>Daily and weekly goals</h3>
            <p>Enter hours. Leave a field blank to remove that overall goal.</p>
          </div>
        </div>
        <div className="goal-form-fields">
          <label className="field">
            Daily goal (hours)
            <input
              max="24"
              min="0.1"
              onChange={(event) => setDailyHours(event.target.value)}
              placeholder="For example, 2"
              step="0.1"
              type="number"
              value={dailyHours}
            />
          </label>
          <label className="field">
            Weekly goal (hours)
            <input
              max="168"
              min="0.1"
              onChange={(event) => setWeeklyHours(event.target.value)}
              placeholder="For example, 10"
              step="0.1"
              type="number"
              value={weeklyHours}
            />
          </label>
          <button className="button" disabled={saving} type="submit">
            {saving ? 'Saving…' : 'Save time goals'}
          </button>
        </div>
      </form>

      <section className="goal-subject-section" aria-labelledby="subject-goals-heading">
        <div className="goal-form-heading">
          <div>
            <h3 id="subject-goals-heading">Subject goals</h3>
            <p>Set daily or weekly targets for any of your seven subjects.</p>
          </div>
        </div>

        {goal?.subjectGoals?.length ? (
          <ul className="subject-goal-list">
            {goal.subjectGoals.map((subjectGoal) => {
              const actualMs =
                subjectGoal.period === 'daily'
                  ? progress?.bySubject[subjectGoal.course] ?? 0
                  : progress?.bySubjectWeek[subjectGoal.course] ?? 0
              const subjectProgress = progress?.subjectGoals.find(
                (item) => item.id === subjectGoal.id,
              )
              return (
                <li className="subject-goal-card" key={subjectGoal.id}>
                  <div className="subject-goal-heading">
                    <div>
                      <h4>{subjectGoal.course}</h4>
                      <span>{subjectGoal.period === 'daily' ? 'Daily' : 'Weekly'} goal</span>
                    </div>
                    <div className="subject-goal-actions">
                      <button
                        className="button button-secondary"
                        disabled={saving}
                        onClick={() => startEditSubject(subjectGoal)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="button button-danger"
                        disabled={saving}
                        onClick={() => handleDeleteSubject(subjectGoal.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <ProgressBar
                    label={`${subjectGoal.course} ${subjectGoal.period} goal progress`}
                    progress={
                      subjectProgress ?? {
                        targetMs: subjectGoal.targetMs,
                        actualMs,
                        remainingMs: Math.max(0, subjectGoal.targetMs - actualMs),
                        percentage: Math.min(
                          100,
                          Number(
                            ((actualMs / subjectGoal.targetMs) * 100).toFixed(2),
                          ),
                        ),
                      }
                    }
                  />
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="dashboard-empty">No subject goals yet. Add one below.</p>
        )}

        <form className="subject-goal-form" onSubmit={handleSaveSubject}>
          <label className="field">
            Subject
            <select
              onChange={(event) => setSubject(event.target.value)}
              required
              value={subject}
            >
              <option value="">Choose a subject</option>
              {courses.map((course) => (
                <option key={course.id} value={course.name}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Goal period
            <select
              onChange={(event) => setPeriod(event.target.value)}
              value={period}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
          <label className="field">
            Goal (hours)
            <input
              max={period === 'daily' ? 24 : 168}
              min="0.1"
              onChange={(event) => setSubjectHours(event.target.value)}
              required
              step="0.1"
              type="number"
              value={subjectHours}
            />
          </label>
          <div className="subject-goal-form-actions">
            <button className="button" disabled={saving} type="submit">
              {saving ? 'Saving…' : editingSubjectId ? 'Update subject goal' : 'Add subject goal'}
            </button>
            {editingSubjectId && (
              <button
                className="button button-secondary"
                disabled={saving}
                onClick={resetSubjectForm}
                type="button"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="goal-all-subjects" aria-labelledby="all-subjects-heading">
        <h3 id="all-subjects-heading">Study time by subject</h3>
        <ul className="timer-subject-list">
          {courses.map((course) => (
            <li key={course.id}>
              <span>{course.name}</span>
              <strong>
                Today {formatDuration(progress?.bySubject[course.name] ?? 0)}
                {' · '}
                Week {formatDuration(progress?.bySubjectWeek[course.name] ?? 0)}
              </strong>
            </li>
          ))}
        </ul>
      </section>
    </section>
  )
}

export default StudyGoals
