const hourMs = 60 * 60 * 1000
const maxRangeMs = 8 * 24 * hourMs

export function hoursToMilliseconds(value, maxHours) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > maxHours
  ) {
    return null
  }
  return Math.round(value * hourMs)
}

export function isValidProgressRanges(dayFromValue, dayToValue, weekFromValue, weekToValue) {
  const values = [dayFromValue, dayToValue, weekFromValue, weekToValue]
  if (values.some((value) => typeof value !== 'string')) return false
  const [dayFrom, dayTo, weekFrom, weekTo] = values.map((value) => new Date(value))
  return (
    [dayFrom, dayTo, weekFrom, weekTo].every((date) =>
      Number.isFinite(date.getTime()),
    ) &&
    dayFrom < dayTo &&
    weekFrom < weekTo &&
    dayTo.getTime() - dayFrom.getTime() <= 26 * hourMs &&
    weekTo.getTime() - weekFrom.getTime() <= maxRangeMs &&
    weekFrom <= dayFrom &&
    weekTo >= dayTo
  )
}

export function getGoalProgress(targetMs, actualMs) {
  if (targetMs === null || targetMs === undefined) return null
  return {
    targetMs,
    actualMs,
    remainingMs: Math.max(0, targetMs - actualMs),
    percentage: Math.min(
      100,
      Number(((actualMs / targetMs) * 100).toFixed(2)),
    ),
  }
}
