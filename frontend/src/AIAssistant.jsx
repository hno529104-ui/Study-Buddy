import { useEffect, useRef, useState } from 'react'
import { courses } from './sampleData.js'
import { apiRequest } from './api.js'

function AIAssistant({ csrfToken }) {
  const [configured, setConfigured] = useState(null)
  const [setupMessage, setSetupMessage] = useState('')
  const [conversations, setConversations] = useState([])
  const [conversation, setConversation] = useState(null)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const messagesEndRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function loadAssistant() {
      try {
        const [statusResult, historyResult] = await Promise.all([
          apiRequest('/ai/conversations/status'),
          apiRequest('/ai/conversations'),
        ])
        if (cancelled) return
        setConfigured(statusResult.configured)
        setSetupMessage(statusResult.message)
        setConversations(historyResult.conversations)
      } catch (loadError) {
        if (!cancelled) setError(loadError.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadAssistant()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [conversation?.messages])

  function startNewConversation() {
    setConversation(null)
    setMessage('')
    setSubject('')
    setError('')
    setNotice('')
  }

  async function openConversation(id) {
    setError('')
    setNotice('')
    setLoading(true)
    try {
      const result = await apiRequest(`/ai/conversations/${id}`)
      setConversation(result.conversation)
      setSubject(result.conversation.subject)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  async function refreshConversations() {
    const result = await apiRequest('/ai/conversations')
    setConversations(result.conversations)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const prompt = message.trim()
    if (!courses.some((item) => item.name === subject)) {
      setError('Choose one of the seven subjects before asking a question.')
      return
    }
    if (!prompt) {
      setError('Type a study question before sending.')
      return
    }
    setSending(true)
    setError('')
    setNotice('')
    try {
      const result = await apiRequest(
        conversation
          ? `/ai/conversations/${conversation.id}/messages`
          : '/ai/conversations',
        {
          method: 'POST',
          csrfToken,
          body: conversation
            ? { message: prompt }
            : { subject, message: prompt },
        },
      )
      setConversation(result.conversation)
      setSubject(result.conversation.subject)
      setMessage('')
      setNotice('Response saved to your conversation.')
      try {
        await refreshConversations()
      } catch {
        setError('Your response was saved, but the conversation list could not refresh.')
      }
    } catch (sendError) {
      setError(sendError.message)
    } finally {
      setSending(false)
    }
  }

  async function handleDeleteConversation(id) {
    setError('')
    setNotice('')
    try {
      await apiRequest(`/ai/conversations/${id}`, {
        method: 'DELETE',
        csrfToken,
      })
      setConversations((current) =>
        current.filter((item) => item.id !== id),
      )
      if (conversation?.id === id) startNewConversation()
      setNotice('Conversation deleted.')
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  return (
    <section className="panel assistant-panel" aria-labelledby="assistant-heading">
      <div className="assistant-heading">
        <div>
          <p className="eyebrow">YOUR STUDY COMPANION</p>
          <h2 id="assistant-heading">AI Assistant</h2>
        </div>
        <button
          className="button button-secondary"
          onClick={startNewConversation}
          type="button"
        >
          New conversation
        </button>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="import-success" role="status">{notice}</p>}
      {configured === false && (
        <div className="assistant-setup" role="status">
          <strong>Ollama needs attention</strong>
          <p>
            {setupMessage || 'Check the Ollama service and configured model.'}
          </p>
          <p>
            Previous conversations remain available. Start Ollama and install
            the configured model to ask new questions.
          </p>
        </div>
      )}

      <div className="assistant-layout">
        <aside className="conversation-sidebar" aria-label="Previous conversations">
          <h3>Previous conversations</h3>
          {loading && conversations.length === 0 ? (
            <p className="dashboard-empty" role="status">Loading conversations…</p>
          ) : conversations.length === 0 ? (
            <p className="dashboard-empty">No previous conversations yet.</p>
          ) : (
            <ul className="conversation-list">
              {conversations.map((item) => (
                <li key={item.id}>
                  <button
                    className={
                      conversation?.id === item.id
                        ? 'conversation-button conversation-active'
                        : 'conversation-button'
                    }
                    onClick={() => openConversation(item.id)}
                    type="button"
                  >
                    <strong>{item.title}</strong>
                    <span>{item.subject}</span>
                    <small>{new Date(item.updatedAt).toLocaleDateString()}</small>
                  </button>
                  <button
                    aria-label={`Delete conversation: ${item.title}`}
                    className="conversation-delete"
                    onClick={() => handleDeleteConversation(item.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="assistant-chat">
          <div className="chat-transcript" aria-live="polite" aria-label="Conversation">
            {loading && conversation ? (
              <p className="empty" role="status">Loading conversation…</p>
            ) : conversation?.messages?.length ? (
              conversation.messages.map((item, index) => (
                <article
                  className={`chat-message chat-${item.role}`}
                  key={`${item.createdAt}-${index}`}
                >
                  <strong>{item.role === 'assistant' ? 'StudyBuddy AI' : 'You'}</strong>
                  <p>{item.content}</p>
                  <time dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </time>
                </article>
              ))
            ) : (
              <div className="chat-empty">
                <h3>{configured === false ? 'Conversation history' : 'What are you studying today?'}</h3>
                <p>
                  {configured === false
                    ? 'Select an earlier conversation or configure the AI service to begin.'
                    : 'Ask for a simple explanation, a definition, a summary, or practice questions.'}
                </p>
              </div>
            )}
            {sending && (
              <p className="assistant-thinking" role="status">
                StudyBuddy AI is preparing a response…
              </p>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="assistant-composer" onSubmit={handleSubmit}>
            <label className="field">
              Subject
              <select
                disabled={Boolean(conversation)}
                onChange={(event) => setSubject(event.target.value)}
                required
                value={subject}
              >
                <option value="">Choose a subject</option>
                {courses.map((item) => (
                  <option key={item.id} value={item.name}>{item.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Your question
              <textarea
                disabled={!configured || sending}
                maxLength={4000}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={
                  configured
                    ? 'Ask a question about your subject…'
                    : setupMessage || 'Start Ollama to ask a question.'
                }
                required
                rows={3}
                value={message}
              />
              <span className="assistant-character-count">{message.length}/4000</span>
            </label>
            <button
              className="button"
              disabled={!configured || sending || !message.trim()}
              type="submit"
            >
              {sending ? 'Getting response…' : 'Send question'}
            </button>
          </form>
          <p className="assistant-privacy-note">
            Questions are sent to your local Ollama service to generate an
            answer, then the conversation is saved to your account.
          </p>
        </div>
      </div>
    </section>
  )
}

export default AIAssistant
