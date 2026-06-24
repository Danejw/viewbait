#!/usr/bin/env node
/**
 * Schedules article linkedin.md posts to Buffer (LinkedIn + X).
 * Run after public/articles banners are pushed to GitHub for image URLs.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const ARTICLES = [
  'viewbait-image-gen-masterclass',
  'extract-channel-style-from-youtube',
  'ai-title-enhancement-for-thumbnails',
  'custom-palettes-from-images',
  'studio-assistant-guided-generation',
  'thumbnail-attention-heatmap',
  'channel-consistency-check',
  'youtube-connected-thumbnail-workflow',
  'thumbnail-projects-shared-review',
  'post-generation-thumbnail-edit',
]

const LINKEDIN_PATHS = {
  'extract-channel-style-from-youtube': 'docs/articles/Extract-Channel-Style-from-YouTube/linkedin.md',
}

const IMAGE_BASE =
  'https://raw.githubusercontent.com/Danejw/viewbait/main/public/articles'

function linkedinPath(slug) {
  if (LINKEDIN_PATHS[slug]) return path.join(ROOT, LINKEDIN_PATHS[slug])
  return path.join(ROOT, 'docs/articles', slug, 'linkedin.md')
}

function toLinkedInText(raw) {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\*\*Project:\*\*.*\n/g, '')
    .replace(/\*\*Link:\*\*.*\n/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$2')
    .trim()
}

function toXText(raw) {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const title = lines[0].trim()
  const bottom = lines.find((l) => l.startsWith('**Bottom line**'))
  const bottomIdx = lines.indexOf(bottom ?? '')
  let lesson = ''
  if (bottomIdx >= 0) {
    lesson = lines
      .slice(bottomIdx + 1)
      .join(' ')
      .replace(/\*\*/g, '')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$2')
      .trim()
  }
  const short =
    lesson.length > 120 ? `${lesson.slice(0, 117).trim()}...` : lesson
  let text = `${title}\n\n${short}\n\nhttps://viewbait.app`
  if (text.length > 280) {
    text = `${title}\n\nhttps://viewbait.app`
  }
  return text
}

function dueAt(dayOffset) {
  const d = new Date(Date.UTC(2026, 6, 7 + dayOffset, 1, 33, 0))
  // 15:33 HST = 01:33 UTC next calendar day... July 7 15:33 HST = July 8 01:33 UTC
  // HST is UTC-10, so 15:33 HST = 15:33 + 10 = 25:33 UTC = next day 01:33 UTC
  const month = 7
  const day = 7 + dayOffset
  return `${2026}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T15:33:00-10:00`
}

const plan = ARTICLES.map((slug, i) => {
  const raw = fs.readFileSync(linkedinPath(slug), 'utf8')
  const title = raw.split('\n')[0].trim()
  return {
    slug,
    title,
    day: i,
    dueAt: dueAt(i),
    linkedinText: toLinkedInText(raw),
    xText: toXText(raw),
    imageUrl: `${IMAGE_BASE}/${slug}/Ultra-Wide-Banner.png`,
    altText: `${title} - ViewBait.app`,
  }
})

console.log(JSON.stringify(plan, null, 2))
