import { useCallback, useEffect, useState } from 'react'
import { apiRequest, uploadRequest } from './api.js'
import { courses } from './sampleData.js'

const resourceTypes = ['Past Paper', 'Notes', 'Assignment', 'Other']
const reportOptions = [
  ['inappropriate', 'Inappropriate material'],
  ['misleading', 'Misleading information'],
  ['unauthorized', 'Unauthorized material'],
  ['other', 'Other concern'],
]
const maxExamYear = new Date().getFullYear() + 1

const emptyDetails = {
  title: '',
  description: '',
  subject: '',
  resourceType: 'Notes',
  semester: '',
  examYear: '',
}

function formatUploadDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatFileSize(size) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.ceil(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function getResourcePath(filters) {
  const params = new URLSearchParams()
  if (filters.search.trim()) params.set('search', filters.search.trim())
  if (filters.subject) params.set('subject', filters.subject)
  if (filters.resourceType) params.set('resourceType', filters.resourceType)
  if (filters.semester.trim()) params.set('semester', filters.semester.trim())
  if (filters.examYear) params.set('examYear', filters.examYear)
  const query = params.toString()
  return `/resources${query ? `?${query}` : ''}`
}

function ResourceLibrary({ userId, csrfToken }) {
  const [resources, setResources] = useState([])
  const [filters, setFilters] = useState({
    search: '',
    subject: '',
    resourceType: '',
    semester: '',
    examYear: '',
  })
  const [details, setDetails] = useState(emptyDetails)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState('')
  const [editDetails, setEditDetails] = useState(emptyDetails)
  const [reporting, setReporting] = useState('')
  const [reportReason, setReportReason] = useState('inappropriate')

  const loadResources = useCallback(
    async (activeFilters, cancelled = () => false) => {
      setLoading(true)
      setError('')
      try {
        const result = await apiRequest(getResourcePath(activeFilters))
        if (!cancelled()) setResources(result.resources)
      } catch (loadError) {
        if (!cancelled()) setError(loadError.message)
      } finally {
        if (!cancelled()) setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    let cancelled = false
    const timeout = window.setTimeout(
      () => loadResources(filters, () => cancelled),
      filters.search.trim() ? 200 : 0,
    )
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [filters, loadResources, userId])

  function updateDetails(field, value) {
    setDetails((current) => ({ ...current, [field]: value }))
  }

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }))
  }

  async function handleUpload(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    if (!file) {
      setError('Choose a file to share.')
      return
    }
    setUploading(true)
    setUploadProgress(0)
    setError('')
    setNotice('')
    const body = new FormData()
    Object.entries(details).forEach(([key, value]) => body.append(key, value))
    body.append('file', file)
    try {
      await uploadRequest('/resources', {
        body,
        csrfToken,
        onProgress: setUploadProgress,
      })
      await loadResources(filters)
      setDetails(emptyDetails)
      setFile(null)
      formElement.reset()
      setNotice('Resource uploaded and shared with signed-in students.')
    } catch (uploadError) {
      setError(uploadError.message)
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  function beginEdit(resource) {
    setEditing(resource.id)
    setEditDetails({
      title: resource.title,
      description: resource.description,
      subject: resource.subject,
      resourceType: resource.resourceType,
      semester: resource.semester,
      examYear: resource.examYear ? String(resource.examYear) : '',
    })
    setError('')
    setNotice('')
  }

  async function saveEdit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await apiRequest(`/resources/${editing}`, {
        method: 'PATCH',
        csrfToken,
        body: editDetails,
      })
      setResources((current) =>
        current.map((resource) =>
          resource.id === editing ? result.resource : resource,
        ),
      )
      setEditing('')
      setNotice('Resource details updated.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteResource(resource) {
    if (!window.confirm(`Delete "${resource.title}" and its uploaded file?`)) {
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await apiRequest(`/resources/${resource.id}`, {
        method: 'DELETE',
        csrfToken,
      })
      setResources((current) =>
        current.filter((item) => item.id !== resource.id),
      )
      setNotice('Your resource was deleted.')
    } catch (deleteError) {
      setError(deleteError.message)
    } finally {
      setBusy(false)
    }
  }

  async function submitReport(event, resource) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await apiRequest(`/resources/${resource.id}/report`, {
        method: 'POST',
        csrfToken,
        body: { reason: reportReason },
      })
      setReporting('')
      setNotice('Thank you. Your report was submitted for review.')
    } catch (reportError) {
      setError(reportError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-labelledby="resource-library-heading"
      className="panel resource-library"
    >
      <div className="resource-heading">
        <div>
          <p className="eyebrow">LEARN TOGETHER</p>
          <h2 id="resource-library-heading">Student Resource Library</h2>
        </div>
        <p>Shared resources are available to signed-in students only.</p>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="import-success" role="status">{notice}</p>}

      <form className="resource-upload-form" onSubmit={handleUpload}>
        <h3>Share a learning resource</h3>
        <label className="field">
          Title
          <input
            maxLength={120}
            onChange={(event) => updateDetails('title', event.target.value)}
            required
            value={details.title}
          />
        </label>
        <label className="field">
          Subject
          <select
            onChange={(event) => updateDetails('subject', event.target.value)}
            required
            value={details.subject}
          >
            <option value="">Choose a subject</option>
            {courses.map((course) => (
              <option key={course.id} value={course.name}>{course.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Resource type
          <select
            onChange={(event) => updateDetails('resourceType', event.target.value)}
            required
            value={details.resourceType}
          >
            {resourceTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Semester
          <input
            maxLength={60}
            onChange={(event) => updateDetails('semester', event.target.value)}
            placeholder="e.g. Fall 2026"
            required
            value={details.semester}
          />
        </label>
        <label className="field">
          Exam year <span className="field-hint">(optional)</span>
          <input
            max={maxExamYear}
            min="1900"
            onChange={(event) => updateDetails('examYear', event.target.value)}
            type="number"
            value={details.examYear}
          />
        </label>
        <label className="field resource-description-field">
          Description
          <textarea
            maxLength={2000}
            onChange={(event) => updateDetails('description', event.target.value)}
            required
            rows={3}
            value={details.description}
          />
        </label>
        <label className="field resource-file-field">
          File <span className="field-hint">PDF, DOCX, PPTX, XLSX, JPEG, PNG, GIF or WEBP · max 15 MB</span>
          <input
            accept=".pdf,.docx,.pptx,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            required
            type="file"
          />
        </label>
        {uploading && (
          <div className="resource-progress" role="status">
            <span>Uploading… {uploadProgress}%</span>
            <progress max="100" value={uploadProgress} />
          </div>
        )}
        <p className="resource-sharing-note">
          By choosing <strong>Upload and share</strong>, this file and its details
          will be visible to authenticated students.
        </p>
        <button className="button resource-upload-button" disabled={uploading} type="submit">
          {uploading ? 'Uploading…' : 'Upload and share'}
        </button>
      </form>

      <section aria-labelledby="resource-results-heading" className="resource-results">
        <div className="resource-results-heading">
          <div>
            <h3 id="resource-results-heading">Browse shared resources</h3>
            <p>Search title, description, or semester and narrow the results.</p>
          </div>
        </div>
        <div className="resource-filters">
          <label className="field">
            Search keywords
            <input
              maxLength={100}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Search resources"
              type="search"
              value={filters.search}
            />
          </label>
          <label className="field">
            Subject
            <select
              onChange={(event) => updateFilter('subject', event.target.value)}
              value={filters.subject}
            >
              <option value="">All subjects</option>
              {courses.map((course) => (
                <option key={course.id} value={course.name}>{course.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Resource type
            <select
              onChange={(event) => updateFilter('resourceType', event.target.value)}
              value={filters.resourceType}
            >
              <option value="">All types</option>
              {resourceTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Semester
            <input
              maxLength={60}
              onChange={(event) => updateFilter('semester', event.target.value)}
              placeholder="Any semester"
              value={filters.semester}
            />
          </label>
          <label className="field">
            Exam year
            <select
              onChange={(event) => updateFilter('examYear', event.target.value)}
              value={filters.examYear}
            >
              <option value="">All years</option>
              {[...new Set(resources.map((resource) => resource.examYear).filter(Boolean))]
                .sort((a, b) => b - a)
                .map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
            </select>
          </label>
        </div>

        {loading ? (
          <p className="empty" role="status">Loading shared resources…</p>
        ) : resources.length === 0 ? (
          <p className="dashboard-empty">
            {Object.values(filters).some(Boolean)
              ? 'No resources match these filters.'
              : 'No resources have been shared yet. Be the first to contribute.'}
          </p>
        ) : (
          <ul className="resource-list">
            {resources.map((resource) => (
              <li className="resource-card" key={resource.id}>
                <div className="resource-card-heading">
                  <div className="resource-card-title">
                    <span className="resource-subject">{resource.subject}</span>
                    <h4>{resource.title}</h4>
                  </div>
                  <span className="resource-type-badge">{resource.resourceType}</span>
                </div>
                <p className="resource-description">{resource.description}</p>
                <div className="resource-meta">
                  <span>{resource.semester}</span>
                  {resource.examYear && <span>Exam year {resource.examYear}</span>}
                  <span>{resource.originalName} · {formatFileSize(resource.fileSize)}</span>
                  <span>Shared by {resource.uploader} · {formatUploadDate(resource.uploadedAt)}</span>
                </div>
                {resource.previewable && (
                  <details className="resource-preview">
                    <summary>Preview file</summary>
                    {resource.mimeType.startsWith('image/') ? (
                      <img
                        alt={`Preview of ${resource.title}`}
                        loading="lazy"
                        src={`/api/resources/${resource.id}/file`}
                      />
                    ) : (
                      <iframe
                        loading="lazy"
                        src={`/api/resources/${resource.id}/file`}
                        title={`Preview of ${resource.title}`}
                      />
                    )}
                  </details>
                )}
                <div className="resource-card-actions">
                  <a
                    className="button button-secondary resource-download"
                    href={`/api/resources/${resource.id}/file?download=1`}
                  >
                    Download
                  </a>
                  {resource.uploaderId === userId ? (
                    <>
                      <button
                        className="button button-secondary"
                        disabled={busy}
                        onClick={() => beginEdit(resource)}
                        type="button"
                      >
                        Edit details
                      </button>
                      <button
                        className="button button-danger"
                        disabled={busy}
                        onClick={() => deleteResource(resource)}
                        type="button"
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => {
                        setReporting(
                          reporting === resource.id ? '' : resource.id,
                        )
                        setReportReason('inappropriate')
                      }}
                      type="button"
                    >
                      Report resource
                    </button>
                  )}
                </div>
                {editing === resource.id && (
                  <form className="resource-edit-form" onSubmit={saveEdit}>
                    <h5>Edit resource details</h5>
                    <label className="field">
                      Title
                      <input
                        maxLength={120}
                        onChange={(event) =>
                          setEditDetails((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        required
                        value={editDetails.title}
                      />
                    </label>
                    <label className="field">
                      Description
                      <textarea
                        maxLength={2000}
                        onChange={(event) =>
                          setEditDetails((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        required
                        rows={3}
                        value={editDetails.description}
                      />
                    </label>
                    <div className="resource-edit-grid">
                      <label className="field">
                        Subject
                        <select
                          onChange={(event) =>
                            setEditDetails((current) => ({
                              ...current,
                              subject: event.target.value,
                            }))
                          }
                          value={editDetails.subject}
                        >
                          {courses.map((course) => (
                            <option key={course.id} value={course.name}>{course.name}</option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        Type
                        <select
                          onChange={(event) =>
                            setEditDetails((current) => ({
                              ...current,
                              resourceType: event.target.value,
                            }))
                          }
                          value={editDetails.resourceType}
                        >
                          {resourceTypes.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        Semester
                        <input
                          maxLength={60}
                          onChange={(event) =>
                            setEditDetails((current) => ({
                              ...current,
                              semester: event.target.value,
                            }))
                          }
                          required
                          value={editDetails.semester}
                        />
                      </label>
                      <label className="field">
                        Exam year
                        <input
                          max={maxExamYear}
                          min="1900"
                          onChange={(event) =>
                            setEditDetails((current) => ({
                              ...current,
                              examYear: event.target.value,
                            }))
                          }
                          type="number"
                          value={editDetails.examYear}
                        />
                      </label>
                    </div>
                    <div className="resource-card-actions">
                      <button className="button" disabled={busy} type="submit">
                        {busy ? 'Saving…' : 'Save details'}
                      </button>
                      <button
                        className="button button-secondary"
                        onClick={() => setEditing('')}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
                {reporting === resource.id && (
                  <form
                    className="resource-report-form"
                    onSubmit={(event) => submitReport(event, resource)}
                  >
                    <label className="field">
                      Why are you reporting this resource?
                      <select
                        onChange={(event) => setReportReason(event.target.value)}
                        value={reportReason}
                      >
                        {reportOptions.map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <div className="resource-card-actions">
                      <button className="button" disabled={busy} type="submit">
                        Submit report
                      </button>
                      <button
                        className="button button-secondary"
                        onClick={() => setReporting('')}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="resource-library-footnote">
          Share only materials you have permission to distribute. Uploaded files
          are served to signed-in students through the Study Buddy API.
        </p>
      </section>
    </section>
  )
}

export default ResourceLibrary
