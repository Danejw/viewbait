/**
 * Unit tests for server logger PII and prompt redaction.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logError, logInfo } from '@/lib/server/utils/logger'

describe('logger', () => {
  const originalEnv = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = originalEnv
    vi.restoreAllMocks()
  })

  describe('prompt-key redaction', () => {
    it('redacts context.prompt to [REDACTED:PROMPT] and does not log original text', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      logInfo('msg', {
        prompt: 'A long instruction that would otherwise be logged...',
        route: '/api/foo',
        operation: 'bar',
      })

      expect(logSpy).toHaveBeenCalled()
      const args = logSpy.mock.calls[0] ?? []
      const entry =
        args.length === 2 && typeof args[1] === 'object' && args[1] !== null
          ? (args[1] as Record<string, unknown>)
          : (JSON.parse(String(args[0])) as Record<string, unknown>)

      expect(entry.prompt).toBe('[REDACTED:PROMPT]')
      expect(JSON.stringify(entry)).not.toContain('A long instruction that would otherwise be logged')
      expect(JSON.stringify(entry)).toContain('[REDACTED:PROMPT]')
      expect(entry.route).toBe('/api/foo')
      expect(entry.operation).toBe('bar')
    })

    it('redacts systemPrompt, userPrompt, system_instruction to placeholder', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      logInfo('msg', {
        systemPrompt: 'You are a helpful assistant.',
        userPrompt: 'Tell me a secret.',
        system_instruction: 'Be concise.',
        route: '/api/chat',
      })

      const args = logSpy.mock.calls[0] ?? []
      const entry =
        args.length === 2 && typeof args[1] === 'object' && args[1] !== null
          ? (args[1] as Record<string, unknown>)
          : (JSON.parse(String(args[0])) as Record<string, unknown>)

      expect(entry.systemPrompt).toBe('[REDACTED:PROMPT]')
      expect(entry.userPrompt).toBe('[REDACTED:PROMPT]')
      expect(entry.system_instruction).toBe('[REDACTED:PROMPT]')
      expect(entry.route).toBe('/api/chat')
      expect(JSON.stringify(entry)).not.toContain('You are a helpful assistant')
      expect(JSON.stringify(entry)).not.toContain('Tell me a secret')
      expect(JSON.stringify(entry)).not.toContain('Be concise')
    })

    it('logError redacts prompt in context and does not leak prompt text', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      logError(new Error('Something failed'), {
        prompt: 'Sensitive prompt content here',
        operation: 'generate',
      })

      expect(errorSpy).toHaveBeenCalled()
      const args = errorSpy.mock.calls[0] ?? []
      const entry =
        args.length === 2 && typeof args[1] === 'object' && args[1] !== null
          ? (args[1] as Record<string, unknown>)
          : (JSON.parse(String(args[0])) as Record<string, unknown>)

      expect(entry.prompt).toBe('[REDACTED:PROMPT]')
      expect(JSON.stringify(entry)).not.toContain('Sensitive prompt content here')
      expect(entry.operation).toBe('generate')
    })
  })
})
