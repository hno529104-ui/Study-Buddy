import { useState } from 'react'

function AuthForm({ onSubmit, onRetry, error, loading }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const isRegister = mode === 'register'

  async function handleSubmit(event) {
    event.preventDefault()
    await onSubmit({ mode, name, email, password })
    setPassword('')
  }

  return (
    <main className="auth-main">
      <section className="panel auth-panel" aria-labelledby="auth-heading">
        <p className="eyebrow">YOUR PRIVATE STUDY SPACE</p>
        <h1 id="auth-heading">{isRegister ? 'Create your account' : 'Welcome back'}</h1>
        <p className="auth-description">
          {isRegister
            ? 'Sign up to keep your subjects and study tasks private to your account.'
            : 'Sign in to access your private subjects and study tasks.'}
        </p>

        {error && (
          <div className="auth-error" role="alert">
            <span>{error}</span>
            {error.includes('connect') && (
              <button
                type="button"
                className="text-button"
                onClick={onRetry}
              >
                Try again
              </button>
            )}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister && (
            <label className="field">
              Name
              <input
                autoComplete="name"
                maxLength={80}
                name="name"
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
          )}
          <label className="field">
            Email
            <input
              autoComplete="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label className="field">
            Password
            <input
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              minLength={isRegister ? 10 : undefined}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            {isRegister && (
              <span className="field-hint">
                Use at least 10 characters (maximum 72 bytes).
              </span>
            )}
          </label>
          {!isRegister && (
            <a className="auth-forgot-link" href="/forgot-password">
              Forgot Password?
            </a>
          )}
          <button className="button" disabled={loading} type="submit">
            {loading
              ? 'Please wait…'
              : isRegister
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          {isRegister ? 'Already have an account?' : 'New to StudyBuddy?'}{' '}
          <button
            className="text-button"
            onClick={() => {
              setMode(isRegister ? 'login' : 'register')
              setPassword('')
            }}
            type="button"
          >
            {isRegister ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </section>
    </main>
  )
}

export default AuthForm
