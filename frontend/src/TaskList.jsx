// TaskList is a component: a reusable piece of the page.
// useState is React memory. When it changes, React redraws this part of the page.
import { useEffect, useState } from 'react'
import { courses } from './sampleData.js'
import { apiRequest } from './api.js'

const STORAGE_KEY = 'studybuddy-tasks'
const priorities = ['Low', 'Medium', 'High']

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function formatDueDate(due) {
  if (!isIsoDate(due)) {
    return due || 'No due date'
  }

  const [year, month, day] = due.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function isOverdue(task) {
  return !task.done && isIsoDate(task.due) && task.due < getDateKey(new Date())
}

function getDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function loadBrowserTasks() {
  try {
    const savedTasks = window.localStorage.getItem(STORAGE_KEY)
    if (!savedTasks) return []
    const parsedTasks = JSON.parse(savedTasks)
    return Array.isArray(parsedTasks) ? parsedTasks : []
  } catch (error) {
    console.error('Unable to read browser-saved tasks for import.', error)
    return []
  }
}

function Dashboard({ tasks }) {
  const [currentDate] = useState(() => new Date())
  const today = getDateKey(currentDate)
  const completedTasks = tasks.filter((task) => task.done)
  const pendingTasks = tasks.filter((task) => !task.done)
  const overdueTasks = pendingTasks.filter(isOverdue)
  const todayTasks = tasks.filter((task) => task.due === today)
  const upcomingTasks = pendingTasks
    .filter((task) => isIsoDate(task.due) && task.due > today)
    .sort((first, second) => first.due.localeCompare(second.due))
    .slice(0, 5)

  return (
    <section
      className="panel dashboard-panel"
      aria-labelledby="dashboard-heading"
    >
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">YOUR PROGRESS</p>
          <h2 id="dashboard-heading">Dashboard</h2>
        </div>
        <p className="dashboard-date">
          {currentDate.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      <div className="dashboard-stats">
        {[
          ['Total tasks', tasks.length, 'stat-total'],
          ['Completed', completedTasks.length, 'stat-completed'],
          ['Pending', pendingTasks.length, 'stat-pending'],
          ['Overdue', overdueTasks.length, 'stat-overdue'],
          ["Today's tasks", todayTasks.length, 'stat-today'],
        ].map(([label, value, className]) => (
          <article className={`stat-card ${className}`} key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
          </article>
        ))}
      </div>

      <div className="dashboard-lower">
        <section
          className="dashboard-subjects"
          aria-labelledby="subjects-heading"
        >
          <h3 id="subjects-heading">Subject overview</h3>
          <ul className="subject-overview-list">
            {courses.map((course) => {
              const subjectTasks = tasks.filter(
                (task) => task.course === course.name,
              )
              const subjectPending = subjectTasks.filter(
                (task) => !task.done,
              ).length

              return (
                <li className="subject-overview-card" key={course.id}>
                  <h4>{course.name}</h4>
                  <p>
                    {subjectTasks.length}{' '}
                    {subjectTasks.length === 1 ? 'task' : 'tasks'}
                  </p>
                  <span>{subjectPending} pending</span>
                </li>
              )
            })}
          </ul>
        </section>

        <section
          className="dashboard-deadlines"
          aria-labelledby="deadlines-heading"
        >
          <h3 id="deadlines-heading">Upcoming deadlines</h3>
          {upcomingTasks.length === 0 ? (
            <p className="dashboard-empty">No upcoming deadlines.</p>
          ) : (
            <ul className="deadline-list">
              {upcomingTasks.map((task) => (
                <li className="deadline-item" key={task.id}>
                  <div>
                    <strong>{task.title}</strong>
                    <span>{task.course}</span>
                  </div>
                  <time dateTime={task.due}>{formatDueDate(task.due)}</time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  )
}

function TaskList({ user, csrfToken }) {
  const [tasks, setTasks] = useState([])
  const [taskLoading, setTaskLoading] = useState(true)
  const [taskError, setTaskError] = useState('')
  const [browserTasks] = useState(loadBrowserTasks)
  const [importedBrowserTasks, setImportedBrowserTasks] = useState(false)
  const [importMessage, setImportMessage] = useState('')
  const [title, setTitle] = useState('')
  const [course, setCourse] = useState('')
  const [due, setDue] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [filter, setFilter] = useState('all')
  const [courseFilter, setCourseFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState('ascending')
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    let cancelled = false

    apiRequest('/tasks')
      .then((result) => {
        if (!cancelled) setTasks(result.tasks)
      })
      .catch((error) => {
        if (!cancelled) setTaskError(error.message)
      })
      .finally(() => {
        if (!cancelled) setTaskLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user.id])

  async function handleAdd(event) {
    event.preventDefault()

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setFormError('Enter a task name before saving.')
      return
    }

    if (!courses.some((item) => item.name === course)) {
      setFormError('Choose a subject for this task.')
      return
    }

    if (!due) {
      setFormError('Choose a due date for this task.')
      return
    }

    if (!priorities.includes(priority)) {
      setFormError('Choose Low, Medium, or High priority.')
      return
    }

    const trimmedFields = { title: trimmedTitle, course, due, priority }
    setFormError('')
    setTaskError('')
    try {
      if (editingTaskId !== null) {
        const result = await apiRequest(`/tasks/${editingTaskId}`, {
          method: 'PATCH',
          csrfToken,
          body: trimmedFields,
        })
        setTasks((currentTasks) =>
          currentTasks.map((task) =>
            task.id === editingTaskId ? result.task : task,
          ),
        )
      } else {
        const result = await apiRequest('/tasks', {
          method: 'POST',
          csrfToken,
          body: trimmedFields,
        })
        setTasks((currentTasks) => [...currentTasks, result.task])
      }
      resetForm()
    } catch (error) {
      setTaskError(error.message)
    }
  }

  function resetForm() {
    setTitle('')
    setCourse('')
    setDue('')
    setPriority('Medium')
    setEditingTaskId(null)
    setFormError('')
  }

  function handleEdit(task) {
    setEditingTaskId(task.id)
    setTitle(task.title)
    setCourse(task.course)
    setDue(isIsoDate(task.due) ? task.due : '')
    setPriority(priorities.includes(task.priority) ? task.priority : 'Medium')
    setFormError('')
  }

  async function handleToggleDone(task) {
    setTaskError('')
    try {
      const result = await apiRequest(`/tasks/${task.id}`, {
        method: 'PATCH',
        csrfToken,
        body: { done: !task.done },
      })
      setTasks((currentTasks) =>
        currentTasks.map((item) => (item.id === task.id ? result.task : item)),
      )
    } catch (error) {
      setTaskError(error.message)
    }
  }

  async function handleDelete(taskId) {
    setTaskError('')
    try {
      await apiRequest(`/tasks/${taskId}`, { method: 'DELETE', csrfToken })
      setTasks((currentTasks) =>
        currentTasks.filter((task) => task.id !== taskId),
      )
    } catch (error) {
      setTaskError(error.message)
      return
    }
    if (editingTaskId === taskId) {
      resetForm()
    }
  }

  async function handleImportBrowserTasks() {
    setTaskError('')
    setImportMessage('')
    try {
      const result = await apiRequest('/tasks/import', {
        method: 'POST',
        csrfToken,
        body: { tasks: browserTasks },
      })
      setTasks(result.tasks)
      setImportedBrowserTasks(true)
      setImportMessage(
        `${result.imported} browser task${result.imported === 1 ? '' : 's'} imported. Your original browser copy was kept.`,
      )
    } catch (error) {
      setTaskError(error.message)
    }
  }

  const visibleTasks = tasks
    .filter((task) => {
      if (filter === 'active' && task.done) return false
      if (filter === 'completed' && !task.done) return false
      return courseFilter === 'all' || task.course === courseFilter
    })
    .sort((first, second) => {
      const firstHasDate = isIsoDate(first.due)
      const secondHasDate = isIsoDate(second.due)
      if (!firstHasDate) return secondHasDate ? 1 : 0
      if (!secondHasDate) return -1
      return sortOrder === 'ascending'
        ? first.due.localeCompare(second.due)
        : second.due.localeCompare(first.due)
    })

  return (
    <>
      <Dashboard tasks={tasks} />

      <section className="panel tasks-panel" aria-labelledby="tasks-heading">
        <h2 id="tasks-heading">Study tasks</h2>
        <p className="panel-note">
          Add and organize tasks by subject, status, and due date. Changes are
          saved privately to your account.
        </p>

        {browserTasks.length > 0 && !importedBrowserTasks && (
          <div className="browser-import">
            <p>
              {browserTasks.length} task
              {browserTasks.length === 1 ? ' is' : 's are'} saved in this
              browser. Import a copy into {user.name}&apos;s account?
            </p>
            <button
              className="button button-secondary"
              onClick={handleImportBrowserTasks}
              type="button"
            >
              Import browser tasks
            </button>
          </div>
        )}

        {importMessage && (
          <p className="import-success" role="status">
            {importMessage}
          </p>
        )}
        {taskError && (
          <p className="storage-error" role="alert">
            {taskError}
          </p>
        )}

        <form className="task-form" onSubmit={handleAdd} noValidate>
          <label className="field">
            Task
            <input
              type="text"
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Example: Read chapter 4"
              aria-invalid={Boolean(formError && !title.trim())}
            />
          </label>

          <label className="field">
            Course
            <select
              name="course"
              value={course}
              onChange={(event) => setCourse(event.target.value)}
              aria-invalid={Boolean(formError && !course)}
            >
              <option value="" disabled>
                Choose a subject
              </option>
              {courses.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Due
            <input
              type="date"
              name="due"
              value={due}
              onChange={(event) => setDue(event.target.value)}
              aria-invalid={Boolean(formError && !due)}
            />
          </label>

          <label className="field">
            Priority
            <select
              name="priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              aria-invalid={Boolean(formError && !priorities.includes(priority))}
            >
              {priorities.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <div className="task-form-actions">
            <button type="submit" className="button">
              {editingTaskId === null ? 'Add task' : 'Save changes'}
            </button>
            {editingTaskId !== null && (
              <button
                type="button"
                className="button button-secondary"
                onClick={resetForm}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}

        <div className="task-controls">
          <label className="field">
            Status
            <select
              name="statusFilter"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </label>

          <label className="field">
            Subject
            <select
              name="courseFilter"
              value={courseFilter}
              onChange={(event) => setCourseFilter(event.target.value)}
            >
              <option value="all">All subjects</option>
              {courses.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Sort by due date
            <select
              name="sortOrder"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            >
              <option value="ascending">Soonest first</option>
              <option value="descending">Latest first</option>
            </select>
          </label>
        </div>

          {taskLoading ? (
            <p className="empty" role="status">
              Loading your tasks…
            </p>
          ) : visibleTasks.length === 0 ? (
            <p className="empty">
            {tasks.length === 0
              ? 'No tasks yet. Add one above.'
              : 'No tasks match these filters.'}
          </p>
        ) : (
          <ul className="card-list">
            {visibleTasks.map((task) => {
              const overdue = isOverdue(task)

              return (
                <li
                  key={task.id}
                  className={task.done ? 'card card-done' : 'card'}
                >
                  <label className="complete-label">
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => handleToggleDone(task)}
                    />
                    <span>Mark complete</span>
                  </label>
                  <h3>{task.title}</h3>
                  <p>Subject: {task.course}</p>
                  <p className={overdue ? 'due-overdue' : undefined}>
                    Due: {formatDueDate(task.due)}
                    {overdue && <span> · Overdue</span>}
                  </p>
                  <span
                    className={`priority-badge priority-${(task.priority || 'Medium').toLowerCase()}`}
                  >
                    {task.priority || 'Medium'} priority
                  </span>
                  <div className="task-card-actions">
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => handleEdit(task)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="button button-danger"
                      onClick={() => handleDelete(task.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}

export default TaskList
