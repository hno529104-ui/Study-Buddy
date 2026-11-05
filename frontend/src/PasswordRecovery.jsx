import { useEffect, useState } from 'react'
import { apiRequest } from './api.js'

const genericRequestMessage =
  'If an account exists with this email, you will receive password reset instructions.'
const invalidLinkMessage =
  'This password reset link is invalid or has expired. Request a new one.'

function isValidEmail(email) {
  return (
    typeof email === 'string' &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
}

function isValidPassword(password) {
  return (
    password.length >= 10 &&
    new TextEncoder().encode(password).length <= 72
  )
}

function PasswordRecovery({ csrfToken, connectionError, onRetry }) {
  const isResetPage = window.location.pathname === '/reset-password'
  const [token] = useState(
    () => new URLSearchParams(window.location.search).get('token') || '',
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [resetComplete, setResetComplete] = useState(false)

  useEffect(() => {
    if (isResetPage && window.location.search) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [isResetPage])

  const validToken = /^[A-Za-z0-9_-]{43}$/.test(token)
  const validPassword = isValidPassword(password)
  const passwordsMatch = password === confirmPassword

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!csrfToken) {
      setError(connectionError || 'The secure form is not ready. Try again.')
      return
    }
    if (isResetPage && !validToken) {
      setError(invalidLinkMessage)
      return
    }
    if (isResetPage && !validPassword) {
      setError('Use at least 10 characters and no more than 72 UTF-8 bytes.')
      return
    }
    if (isResetPage && !passwordsMatch) {
      setError('The passwords do not match.')
      return
    }

    setLoading(true)
    try {
      if (isResetPage) {
        await apiRequest('/auth/reset-password', {
          method: 'POST',
          csrfToken,
          body: { token, password },
        })
        setPassword('')
        setConfirmPassword('')
        setResetComplete(true)
      } else {
        await apiRequest('/auth/forgot-password', {
          method: 'POST',
          csrfToken,
          body: { email: email.trim() },
        })
        setRequestSent(true)
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  const showInvalidLink = isResetPage && !validToken
  const formDisabled =
    loading ||
    !csrfToken ||
    (isResetPage
      ? !validPassword || !passwordsMatch
      : !isValidEmail(email.trim()))

  return (
    <main className="auth-main">
      <section className="panel auth-panel" aria-labelledby="recovery-heading">
        <p className="eyebrow">YOUR PRIVATE STUDY SPACE</p>
        <h1 id="recovery-heading">
          {isResetPage
            ? resetComplete
              ? 'Password updated'
              : 'Reset your password'
            : 'Forgot your password?'}
        </h1>
        <p className="auth-description">
          {isResetPage
            ? resetComplete
              ? 'Your password has been reset. You can now sign in with your new password.'
              : 'Choose a new password for your StudyBuddy AI account.'
            : 'Enter the email address associated with your account and we will send reset instructions.'}
        </p>

        {connectionError && !csrfToken && (
          <div className="auth-error" role="alert">
            <span>{connectionError}</span>
            <button className="text-button" onClick={onRetry} type="button">
              Try again
            </button>
          </div>
        )}
        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}
        {!csrfToken && !connectionError && (
          <p className="panel-note" role="status">
            Preparing the secure form…
          </p>
        )}

        {isResetPage && resetComplete ? (
          <a className="button recovery-login-link" href="/">
            Return to sign in
          </a>
        ) : showInvalidLink ? (
          <div className="auth-success" role="status">
            {invalidLinkMessage}
            <p>
              <a className="text-button" href="/forgot-password">
                Request a new reset link
              </a>
            </p>
          </div>
        ) : requestSent ? (
          <div className="auth-success" role="status">
            {genericRequestMessage}
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            {isResetPage ? (
              <>
                <label className="field">
                  New Password
                  <input
                    autoComplete="new-password"
                    maxLength={72}
                    minLength={10}
                    name="new-password"
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    type="password"
                    value={password}
                  />
                  <span className="field-hint">
                    At least 10 characters and no more than 72 UTF-8 bytes.
                  </span>
                </label>
                {password && !validPassword && (
                  <p className="field-error" role="alert">
                    Use at least 10 characters and no more than 72 UTF-8 bytes.
                  </p>
                )}
                <label className="field">
                  Confirm New Password
                  <input
                    autoComplete="new-password"
                    maxLength={72}
                    minLength={10}
                    name="confirm-password"
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    required
                    type="password"
                    value={confirmPassword}
                  />
                </label>
                {confirmPassword && !passwordsMatch && (
                  <p className="field-error" role="alert">
                    The passwords do not match.
                  </p>
                )}
              </>
            ) : (
              <label className="field">
                Email
                <input
                  autoComplete="email"
                  maxLength={254}
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
            )}
            <button className="button" disabled={formDisabled} type="submit">
              {loading
                ? isResetPage
                  ? 'Resetting password…'
                  : 'Sending instructions…'
                : isResetPage
                  ? 'Reset password'
                  : 'Send reset instructions'}
            </button>
          </form>
        )}

        {!(isResetPage && resetComplete) && (
          <p className="auth-switch">
            Remembered your password?{' '}
            <a className="text-button" href="/">
              Sign in
            </a>
          </p>
        )}
      </section>
    </main>
  )
}

export default PasswordRecovery
