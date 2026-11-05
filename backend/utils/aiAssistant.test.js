import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAssistantInput,
  extractResponseText,
  makeConversationTitle,
  validateAssistantPrompt,
} from './aiAssistant.js'

test('assistant prompt requires a valid subject and non-empty bounded text', () => {
  assert.deepEqual(
    validateAssistantPrompt({
      subject: 'Artificial Intelligence',
      message: 'Explain search algorithms.',
    }),
    {},
  )
  assert.ok(validateAssistantPrompt({ subject: 'Biology', message: 'Question' }).subject)
  assert.ok(validateAssistantPrompt({ subject: 'HQ', message: ' ' }).message)
  assert.ok(
    validateAssistantPrompt({ subject: 'HQ', message: 'x'.repeat(4001) }).message,
  )
})

test('conversation titles are readable and bounded', () => {
  assert.equal(makeConversationTitle('  Explain   recursion  '), 'Explain recursion')
  assert.equal(makeConversationTitle('x'.repeat(100)).length, 78)
})

test('response text is extracted from Ollama chat responses', () => {
  assert.equal(extractResponseText({ message: { content: ' Answer ' } }), 'Answer')
  assert.equal(extractResponseText({ message: { content: '  ' } }), null)
  assert.equal(extractResponseText({ message: {} }), null)
})

test('assistant context includes only the latest twenty history messages', () => {
  const history = Array.from({ length: 25 }, (_, index) => ({
    role: index % 2 ? 'assistant' : 'user',
    content: `message-${index}`,
  }))
  const input = buildAssistantInput('HQ', history, 'final prompt')
  assert.equal(input[0].role, 'system')
  assert.equal(input.length, 22)
  assert.equal(input[1].content, 'message-5')
  assert.equal(input.at(-1).content, 'final prompt')
})
