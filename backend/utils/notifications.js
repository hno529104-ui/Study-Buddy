const datePattern = /^\d{4}-\d{2}-\d{2}$/

export function normalizeTodayDate(value, now = new Date()) {
  const currentDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  const currentKey = currentDate.toISOString().slice(0, 10)
  if (typeof value !== 'string' || !datePattern.test(value)) {
    return currentKey
  }

  const [year, month, day] = value.split('-').map(Number)
  const candidate = new Date(Date.UTC(year, month - 1, day))
  const candidateKey = candidate.toISOString().slice(0, 10)
  const difference = (candidate - currentDate) / 86_400_000
  return candidateKey === value && Math.abs(difference) <= 1
    ? candidateKey
    : currentKey
}

export function getReminderDateKey(task, today, daysAhead = 7) {
  if (
    task.done ||
    typeof task.due !== 'string' ||
    !datePattern.test(task.due)
  ) {
    return null
  }

  const [year, month, day] = task.due.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null
  }

  const [todayYear, todayMonth, todayDay] = today.split('-').map(Number)
  const todayDate = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay))
  const todayValue = todayDate.toISOString().slice(0, 10)
  if (todayValue !== today) {
    return null
  }

  if (task.due < today) {
    return { type: 'overdue', reminderKey: `${task.id}:overdue:${task.due}` }
  }
  if (task.due === today) {
    return {
      type: 'due_today',
      reminderKey: `${task.id}:due_today:${today}`,
    }
  }

  const latestDate = new Date(todayDate)
  latestDate.setUTCDate(latestDate.getUTCDate() + daysAhead)
  if (task.due <= latestDate.toISOString().slice(0, 10)) {
    return {
      type: 'upcoming',
      reminderKey: `${task.id}:upcoming:${task.due}`,
    }
  }
  return null
}
