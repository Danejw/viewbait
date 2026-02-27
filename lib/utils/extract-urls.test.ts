import { describe, expect, it } from 'vitest'
import { extractUrlsFromText } from '@/lib/utils/extract-urls'

describe('extractUrlsFromText', () => {
  it('should return unique urls in source order when text has duplicates', () => {
    const text = 'Find me at https://x.com/me and https://example.com/docs then https://x.com/me again.'
    expect(extractUrlsFromText(text)).toEqual([
      'https://x.com/me',
      'https://example.com/docs',
    ])
  })

  it('should trim trailing punctuation from urls', () => {
    const text = 'Links: https://example.com/docs, https://youtube.com/@creator.'
    expect(extractUrlsFromText(text)).toEqual([
      'https://example.com/docs',
      'https://youtube.com/@creator',
    ])
  })

  it('should return empty array when no urls exist', () => {
    expect(extractUrlsFromText('no links here')).toEqual([])
  })
})
