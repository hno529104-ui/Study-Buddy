import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from './api.js'

function getTodayKey() {
  const today = new Date()
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatDueDate(due) {
  const [year, month, day] = due.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

const notificationLabels = {
  overdue: 'Overdue task',
  due_today: 'Due today',
  upcoming: 'Upcoming deadline',
}

function NotificationsBell({ userId, csrfToken }) {
  const [notifications, setNotifications] = useState([])
  const [remindersEnabled, setRemindersEnabled] = useState(true)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refreshNotifications = useCallback(async () => {
    const result = await apiRequest(
      `/notifications?today=${encodeURIComponent(getTodayKey())}`,
    )
    setNotifications(result.notifications)
    setRemindersEnabled(result.remindersEnabled)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadNotifications() {
      try {
        await refreshNotifications()
      } catch (loadError) {
        if (!cancelled) setError(loadError.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadNotifications()
    const intervalId = window.setInterval(loadNotifications, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [userId, refreshNotifications])

  const unreadCount = notifications.filter((item) => !item.read).length

  async function markAsRead(notification) {
    if (notification.read) return
    setError('')
    try {
      await apiRequest(`/notifications/${notification.id}/read`, {
        method: 'PATCH',
        csrfToken,
      })
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, read: true } : item,
        ),
      )
    } catch (actionError) {
      setError(actionError.message)
    }
  }

  async function clearNotification(notification) {
    setError('')
    try {
      await apiRequest(`/notifications/${notification.id}`, {
        method: 'DELETE',
        csrfToken,
      })
      setNotifications((current) =>
        current.filter((item) => item.id !== notification.id),
      )
    } catch (actionError) {
      setError(actionError.message)
    }
  }

  async function clearAll() {
    setError('')
    try {
      await apiRequest('/notifications', { method: 'DELETE', csrfToken })
      setNotifications([])
    } catch (actionError) {
      setError(actionError.message)
    }
  }

  async function updateReminderSetting(event) {
    const enabled = event.target.checked
    setError('')
    try {
      const result = await apiRequest('/notifications/settings', {
        method: 'PATCH',
        csrfToken,
        body: { remindersEnabled: enabled },
      })
      setRemindersEnabled(result.remindersEnabled)
      await refreshNotifications()
    } catch (actionError) {
      setError(actionError.message)
    }
  }

  return (
    <div className="notification-menu">
      <button
        aria-expanded={open}
        aria-label={`Notifications, ${unreadCount} unread`}
        className="notification-bell"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <svg
          aria-hidden="true"
          fill="none"
          viewBox="0 0 24 24"
          width="21"
          height="21"
        >
          <path
            d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="notification-count" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <section
          aria-label="Notifications and reminders"
          className="notification-panel"
        >
          <div className="notification-panel-heading">
            <div>
              <p className="eyebrow">YOUR STUDY PLAN</p>
              <h2>Notifications</h2>
            </div>
            {notifications.length > 0 && (
              <button
                className="text-button"
                onClick={clearAll}
                type="button"
              >
                Clear all
              </button>
            )}
          </div>
          <label className="notification-setting">
            <span>
              <strong>Task reminders</strong>
              <small>Upcoming, due today, and overdue tasks</small>
            </span>
            <input
              checked={remindersEnabled}
              onChange={updateReminderSetting}
              type="checkbox"
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {loading ? (
            <p className="dashboard-empty" role="status">
              Loading notifications…
            </p>
          ) : !remindersEnabled ? (
            <p className="dashboard-empty">
              Reminders are turned off. Enable them to see task deadline alerts.
            </p>
          ) : notifications.length === 0 ? (
            <p className="dashboard-empty">You’re all caught up.</p>
          ) : (
            <ul className="notification-list">
              {notifications.map((notification) => (
                <li
                  className={
                    notification.read
                      ? 'notification-item'
                      : 'notification-item notification-unread'
                  }
                  key={notification.id}
                >
                  <div className="notification-copy">
                    <strong>{notificationLabels[notification.type]}</strong>
                    <span>{notification.title}</span>
                    <small>
                      {notification.subject} · Due {formatDueDate(notification.due)}
                    </small>
                  </div>
                  <div className="notification-actions">
                    {!notification.read && (
                      <button
                        aria-label={`Mark ${notification.title} as read`}
                        className="text-button"
                        onClick={() => markAsRead(notification)}
                        type="button"
                      >
                        Mark read
                      </button>
                    )}
                    <button
                      aria-label={`Clear notification for ${notification.title}`}
                      className="text-button notification-clear"
                      onClick={() => clearNotification(notification)}
                      type="button"
                    >
                      Clear
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="notification-footnote">
            In-app reminders refresh while StudyBuddy is open.
          </p>
        </section>
      )}
    </div>
  )
}

export default NotificationsBell
