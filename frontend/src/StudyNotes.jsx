import { useEffect, useState } from 'react'
import { courses } from './sampleData.js'
import { apiRequest } from './api.js'

function getNotesPath(search, courseFilter) {
  const params = new URLSearchParams()
  if (search.trim()) params.set('search', search.trim())
  if (courseFilter !== 'all') params.set('course', courseFilter)
  const suffix = params.size ? `?${params.toString()}` : ''
  return `/notes${suffix}`
}

function StudyNotes({ csrfToken }) {
  const [notes, setNotes] = useState([])
  const [notesLoading, setNotesLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [courseFilter, setCourseFilter] = useState('all')
  const [editingNoteId, setEditingNoteId] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [course, setCourse] = useState('')

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setNotesLoading(true)
      setError('')
      try {
        const result = await apiRequest(getNotesPath(search, courseFilter))
        if (!cancelled) setNotes(result.notes)
      } catch (loadError) {
        if (!cancelled) setError(loadError.message)
      } finally {
        if (!cancelled) setNotesLoading(false)
      }
    }, search.trim() ? 200 : 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [search, courseFilter])

  function resetForm() {
    setEditingNoteId('')
    setTitle('')
    setContent('')
    setCourse('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await apiRequest(
        editingNoteId ? `/notes/${editingNoteId}` : '/notes',
        {
          method: editingNoteId ? 'PATCH' : 'POST',
          csrfToken,
          body: { title, content, course },
        },
      )
      setNotice(editingNoteId ? 'Note updated.' : 'Note created.')
      resetForm()
      const updatedNotes = await apiRequest(getNotesPath(search, courseFilter))
      setNotes(updatedNotes.notes)
      return result.note
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
    return null
  }

  function startEditing(note) {
    setEditingNoteId(note.id)
    setTitle(note.title)
    setContent(note.content)
    setCourse(note.course)
    setError('')
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(noteId) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await apiRequest(`/notes/${noteId}`, {
        method: 'DELETE',
        csrfToken,
      })
      if (editingNoteId === noteId) resetForm()
      setNotes((currentNotes) => currentNotes.filter((note) => note.id !== noteId))
      setNotice('Note deleted.')
    } catch (deleteError) {
      setError(deleteError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel notes-panel" aria-labelledby="notes-heading">
      <div className="notes-heading">
        <div>
          <p className="eyebrow">KEEP YOUR IDEAS ORGANIZED</p>
          <h2 id="notes-heading">Study Notes</h2>
        </div>
        <p>Your notes are private to your account.</p>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="import-success" role="status">{notice}</p>}

      <form className="note-form" onSubmit={handleSubmit}>
        <h3>{editingNoteId ? 'Edit note' : 'Create a note'}</h3>
        <label className="field">
          Title
          <input
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Give your note a title"
            required
            value={title}
          />
        </label>
        <label className="field">
          Subject
          <select
            onChange={(event) => setCourse(event.target.value)}
            required
            value={course}
          >
            <option value="">Choose a subject</option>
            {courses.map((item) => (
              <option key={item.id} value={item.name}>{item.name}</option>
            ))}
          </select>
        </label>
        <label className="field note-content-field">
          Content
          <textarea
            maxLength={6000}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Write your study notes…"
            required
            rows={7}
            value={content}
          />
          <span className="note-character-count">{content.length}/6000</span>
        </label>
        <div className="note-form-actions">
          <button className="button" disabled={saving} type="submit">
            {saving ? 'Saving…' : editingNoteId ? 'Save changes' : 'Create note'}
          </button>
          {editingNoteId && (
            <button
              className="button button-secondary"
              disabled={saving}
              onClick={resetForm}
              type="button"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <section className="notes-library" aria-labelledby="notes-library-heading">
        <div className="notes-library-heading">
          <div>
            <h3 id="notes-library-heading">Your notes</h3>
            <p>Search titles and note content, or filter by subject.</p>
          </div>
          <div className="notes-filters">
            <label className="field">
              Search notes
              <input
                maxLength={100}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title or content"
                type="search"
                value={search}
              />
            </label>
            <label className="field">
              Subject
              <select
                onChange={(event) => setCourseFilter(event.target.value)}
                value={courseFilter}
              >
                <option value="all">All subjects</option>
                {courses.map((item) => (
                  <option key={item.id} value={item.name}>{item.name}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {notesLoading ? (
          <p className="empty" role="status">Loading your notes…</p>
        ) : notes.length === 0 ? (
          <p className="dashboard-empty">
            {search.trim() || courseFilter !== 'all'
              ? 'No notes match your search and subject filter.'
              : 'No notes yet. Create your first note above.'}
          </p>
        ) : (
          <ul className="note-list">
            {notes.map((note) => (
              <li className="note-card" key={note.id}>
                <div className="note-card-heading">
                  <div>
                    <span className="note-subject">{note.course}</span>
                    <h4>{note.title}</h4>
                  </div>
                  <div className="note-card-actions">
                    <button
                      className="button button-secondary"
                      disabled={saving}
                      onClick={() => startEditing(note)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="button button-danger"
                      disabled={saving}
                      onClick={() => handleDelete(note.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="note-content">{note.content}</p>
                <time dateTime={note.updatedAt}>
                  Updated {new Date(note.updatedAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}

export default StudyNotes
