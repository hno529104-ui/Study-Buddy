import { courses } from '../constants.js'

export function validateAssistantPrompt({ subject, message }) {
  const errors = {}
  if (!courses.includes(subject)) {
    errors.subject = 'Choose one of the seven subjects.'
  }
  if (typeof message !== 'string' || !message.trim()) {
    errors.message = 'Enter a study question or request.'
  } else if (message.trim().length > 4000) {
    errors.message = 'Messages must be 4,000 characters or fewer.'
  }
  return errors
}

export function makeConversationTitle(prompt) {
  const title = prompt.trim().replace(/\s+/g, ' ')
  return title.length > 77 ? `${title.slice(0, 77).trimEnd()}…` : title
}

export function extractResponseText(response) {
  const text = response?.message?.content
  return typeof text === 'string' && text.trim() ? text.trim() : null
}

export function buildAssistantInput(subject, history, message) {
  return [
    {
      role: 'system',
      content:
        `You are StudyBuddy, a patient study tutor. Help the learner with ${subject}. ` +
        'Give clear explanations, definitions, concise summaries, or practice questions as requested. ' +
        'For practice questions, let the learner try before revealing answers unless they ask otherwise. ' +
        'Be honest when uncertain and do not claim to have accessed their course materials.',
    },
    ...history.slice(-20).map(({ role, content }) => ({ role, content })),
    { role: 'user', content: message },
  ]
}
