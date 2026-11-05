import { useCallback, useEffect, useState } from 'react'
import { studentName } from './sampleData.js'
import { apiRequest } from './api.js'
import AIAssistant from './AIAssistant.jsx'
import AuthForm from './AuthForm.jsx'
import PasswordRecovery from './PasswordRecovery.jsx'
import StudyGoals from './StudyGoals.jsx'
import StudyNotes from './StudyNotes.jsx'
import StudyTimer from './StudyTimer.jsx'
import TaskList from './TaskList.jsx'
import NotificationsBell from './NotificationsBell.jsx'
import ResourceLibrary from './ResourceLibrary.jsx'
import './App.css'

function App() {
  const isPasswordRecoveryRoute = [
    '/forgot-password',
    '/reset-password',
  ].includes(window.location.pathname)
  const [user, setUser] = useState(null)
  const [csrfToken, setCsrfToken] = useState('')
  const [authState, setAuthState] = useState('checking')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [activeSection, setActiveSection] = useState(() =>
    window.location.hash === '#study-timer'
      ? 'timer'
      : window.location.hash === '#study-goals'
        ? 'goals'
        : window.location.hash === '#study-notes'
          ? 'notes'
          : window.location.hash === '#ai-assistant'
            ? 'assistant'
            : window.location.hash === '#resource-library'
              ? 'resources'
            : 'dashboard',
  )

  function navigateSection(section) {
    setActiveSection(section)
    window.history.replaceState(
      null,
      '',
      section === 'timer'
        ? '#study-timer'
        : section === 'goals'
          ? '#study-goals'
          : section === 'notes'
            ? '#study-notes'
            : section === 'assistant'
              ? '#ai-assistant'
              : section === 'resources'
                ? '#resource-library'
              : '#dashboard',
    )
  }

  const initializeAuth = useCallback(async () => {
    setAuthState('checking')
    setAuthError('')
    try {
      const csrfResponse = await fetch('/api/auth/csrf', {
        credentials: 'include',
      })
      if (!csrfResponse.ok) {
        throw new Error('Cannot connect to the StudyBuddy server.')
      }
      const { csrfToken: nextCsrfToken } = await csrfResponse.json()
      setCsrfToken(nextCsrfToken)

      const result = await apiRequest('/auth/me')
      setUser(result.user)
      setAuthState('authenticated')
    } catch (error) {
      setUser(null)
      setAuthState('unauthenticated')
      setAuthError(
        error.status === 401
          ? ''
          : 'Cannot connect to the StudyBuddy server. Start the API and check your MongoDB setup.',
      )
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      try {
        const csrfResponse = await fetch('/api/auth/csrf', {
          credentials: 'include',
        })
        if (!csrfResponse.ok) {
          throw new Error('Cannot connect to the StudyBuddy server.')
        }
        const { csrfToken: nextCsrfToken } = await csrfResponse.json()
        if (cancelled) return
        setCsrfToken(nextCsrfToken)

        const result = await apiRequest('/auth/me')
        if (cancelled) return
        setUser(result.user)
        setAuthState('authenticated')
      } catch (error) {
        if (cancelled) return
        setUser(null)
        setAuthState('unauthenticated')
        setAuthError(
          error.status === 401
            ? ''
            : 'Cannot connect to the StudyBuddy server. Start the API and check your MongoDB setup.',
        )
      }
    }

    restoreSession()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleAuthSubmit({ mode, name, email, password }) {
    setAuthLoading(true)
    setAuthError('')
    try {
      const result = await apiRequest(
        mode === 'register' ? '/auth/register' : '/auth/login',
        {
          method: 'POST',
          csrfToken,
          body: { name, email, password },
        },
      )
      setUser(result.user)
      setAuthState('authenticated')
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleLogout() {
    setAuthError('')
    setAuthState('checking')
    setUser(null)
    try {
      await apiRequest('/auth/logout', { method: 'POST', csrfToken })
      await initializeAuth()
    } catch (error) {
      setAuthState('unauthenticated')
      setAuthError(error.message)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <p className="logo">StudyBuddy AI</p>
        <div className="header-account">
          <p className="tagline">Your student study assistant</p>
          {authState === 'authenticated' && (
            <>
              <NotificationsBell key={user.id} userId={user.id} csrfToken={csrfToken} />
              <span className="account-name">{user.name}</span>
              <button
                className="button button-secondary header-logout"
                onClick={handleLogout}
                type="button"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </header>

      {isPasswordRecoveryRoute ? (
        <PasswordRecovery
          connectionError={authError}
          csrfToken={csrfToken}
          onRetry={initializeAuth}
        />
      ) : authState === 'checking' ? (
        <main className="auth-main">
          <p className="panel-note" role="status">
            Checking your session…
          </p>
        </main>
      ) : authState === 'authenticated' ? (
        <main className="main">
          <section className="welcome">
            <div className="welcome-copy">
              <p className="eyebrow">YOUR STUDY SPACE</p>
              <h1>Welcome, {user.name || studentName}</h1>
              <p>
                Keep your classes and study tasks organized in one place. Add a
                task, track your progress, and make time for what matters.
              </p>
            </div>
            <div className="welcome-mark" aria-hidden="true">
              SB
            </div>
          </section>

          {authError && (
            <p className="form-error" role="alert">
              {authError}
            </p>
          )}
          <nav className="primary-nav" aria-label="Main navigation">
            <button
              className={activeSection === 'dashboard' ? 'filter-button filter-active' : 'filter-button'}
              onClick={() => navigateSection('dashboard')}
              type="button"
              aria-current={activeSection === 'dashboard' ? 'page' : undefined}
            >
              Dashboard
            </button>
            <button
              className={activeSection === 'timer' ? 'filter-button filter-active' : 'filter-button'}
              onClick={() => navigateSection('timer')}
              type="button"
              aria-current={activeSection === 'timer' ? 'page' : undefined}
            >
              Study Timer
            </button>
            <button
              className={activeSection === 'goals' ? 'filter-button filter-active' : 'filter-button'}
              onClick={() => navigateSection('goals')}
              type="button"
              aria-current={activeSection === 'goals' ? 'page' : undefined}
            >
              Study Goals
            </button>
            <button
              className={activeSection === 'notes' ? 'filter-button filter-active' : 'filter-button'}
              onClick={() => navigateSection('notes')}
              type="button"
              aria-current={activeSection === 'notes' ? 'page' : undefined}
            >
              Study Notes
            </button>
            <button
              className={activeSection === 'assistant' ? 'filter-button filter-active' : 'filter-button'}
              onClick={() => navigateSection('assistant')}
              type="button"
              aria-current={activeSection === 'assistant' ? 'page' : undefined}
            >
              AI Assistant
            </button>
            <button
              className={activeSection === 'resources' ? 'filter-button filter-active' : 'filter-button'}
              onClick={() => navigateSection('resources')}
              type="button"
              aria-current={activeSection === 'resources' ? 'page' : undefined}
            >
              Resource Library
            </button>
          </nav>
          {activeSection === 'dashboard' ? (
            <TaskList key={user.id} user={user} csrfToken={csrfToken} />
          ) : activeSection === 'timer' ? (
            <StudyTimer key={user.id} csrfToken={csrfToken} />
          ) : activeSection === 'goals' ? (
            <StudyGoals key={user.id} csrfToken={csrfToken} />
          ) : activeSection === 'notes' ? (
            <StudyNotes key={user.id} csrfToken={csrfToken} />
          ) : activeSection === 'resources' ? (
            <ResourceLibrary
              key={user.id}
              userId={user.id}
              csrfToken={csrfToken}
            />
          ) : (
            <AIAssistant key={user.id} csrfToken={csrfToken} />
          )}
        </main>
      ) : (
        <AuthForm
          error={authError}
          loading={authLoading}
          onRetry={initializeAuth}
          onSubmit={handleAuthSubmit}
        />
      )}
    </div>
  )
}

export default App
