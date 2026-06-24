#!/usr/bin/env node
/**
 * Create Buffer draft posts from buffer-draft-payloads.json via GraphQL API.
 * Retries on 429 until all created or maxWaitMs elapsed.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API_URL = 'https://api.buffer.com/mcp/graphql'
const MAX_WAIT_MS = 30 * 60 * 1000
const MIN_RETRY_MS = 60 * 1000

const apiKey = process.env.BUFFER_API_KEY
if (!apiKey) {
  console.error('BUFFER_API_KEY is required')
  process.exit(1)
}

const payloads = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'buffer-draft-payloads.json'), 'utf8')
)

const CREATE_MUTATION = `
mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    ... on PostActionSuccess {
      post {
        id
        status
        text
        dueAt
        channelId
      }
    }
    ... on MutationError {
      message
      code
    }
  }
}
`

const LIST_DRAFTS_QUERY = `
query ListDrafts($organizationId: OrganizationId!, $channelIds: [ChannelId!], $first: Int, $after: String) {
  posts(organizationId: $organizationId, channelIds: $channelIds, status: [draft], first: $first, after: $after) {
    edges {
      node {
        id
        text
        channelId
        dueAt
        status
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
`

const ACCOUNT_QUERY = `
query Account {
  account {
    organizations {
      id
      name
    }
  }
}
`

async function gql(query, variables = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })

  const retryAfter = res.headers.get('retry-after')
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { errors: [{ message: text }] }
  }

  if (res.status === 429) {
    const waitSec = retryAfter ? parseInt(retryAfter, 10) : 60
    const err = new Error(`429 rate limited (retry-after: ${waitSec}s)`)
    err.status = 429
    err.retryAfterMs = Math.max(waitSec * 1000, MIN_RETRY_MS)
    throw err
  }

  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`)
    err.status = res.status
    throw err
  }

  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message).join('; ')
    if (msg.toLowerCase().includes('too many requests')) {
      const err = new Error(msg)
      err.status = 429
      err.retryAfterMs = MIN_RETRY_MS
      throw err
    }
    throw new Error(msg)
  }

  return json.data
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function withRetry(fn, deadline) {
  while (true) {
    try {
      return await fn()
    } catch (err) {
      if (err.status === 429 && Date.now() < deadline) {
        const wait = Math.min(err.retryAfterMs ?? MIN_RETRY_MS, deadline - Date.now())
        if (wait <= 0) throw err
        console.error(`Rate limited, waiting ${Math.ceil(wait / 1000)}s...`)
        await sleep(wait)
        continue
      }
      throw err
    }
  }
}

async function getOrganizationId(deadline) {
  const data = await withRetry(() => gql(ACCOUNT_QUERY), deadline)
  const orgs = data?.account?.organizations ?? []
  if (!orgs.length) throw new Error('No organizations found')
  return orgs[0].id
}

async function loadExistingDrafts(organizationId, deadline) {
  const channelIds = [...new Set(payloads.map((p) => p.channelId))]
  const map = new Map()
  let after = null

  while (true) {
    const data = await withRetry(
      () =>
        gql(LIST_DRAFTS_QUERY, {
          organizationId,
          channelIds,
          first: 100,
          after,
        }),
      deadline
    )

    const conn = data?.posts
    for (const edge of conn?.edges ?? []) {
      const node = edge.node
      const key = `${node.channelId}::${(node.text ?? '').trim()}`
      map.set(key, node.id)
    }

    if (!conn?.pageInfo?.hasNextPage) break
    after = conn.pageInfo.endCursor
  }

  return map
}

async function createDraft(payload, deadline) {
  const input = {
    channelId: payload.channelId,
    schedulingType: 'automatic',
    mode: 'customScheduled',
    dueAt: payload.dueAt,
    text: payload.text,
    assets: payload.assets,
    saveToDraft: true,
  }

  const data = await withRetry(
    () => gql(CREATE_MUTATION, { input }),
    deadline
  )

  const result = data?.createPost
  if (result?.post?.id) return { id: result.post.id, status: result.post.status }
  if (result?.message) throw new Error(`${result.code ?? 'ERROR'}: ${result.message}`)
  throw new Error('Unknown createPost response')
}

async function main() {
  const started = Date.now()
  const deadline = started + MAX_WAIT_MS
  const results = []

  console.error(`Starting ${payloads.length} draft creates (max wait ${MAX_WAIT_MS / 60000} min)`)

  let organizationId
  try {
    organizationId = await getOrganizationId(deadline)
    console.error(`Organization: ${organizationId}`)
  } catch (err) {
    for (const p of payloads) {
      results.push({
        slug: p.slug,
        channel: p.channel,
        dueAt: p.dueAt,
        postId: null,
        error: `get org: ${err.message}`,
      })
    }
    console.log(JSON.stringify(results, null, 2))
    return
  }

  let existingDrafts = new Map()
  try {
    existingDrafts = await loadExistingDrafts(organizationId, deadline)
    console.error(`Found ${existingDrafts.size} existing drafts`)
  } catch (err) {
    console.error(`Warning: could not list drafts: ${err.message}`)
  }

  for (const payload of payloads) {
    const key = `${payload.channelId}::${payload.text.trim()}`
    const existingId = existingDrafts.get(key)

    if (existingId) {
      results.push({
        slug: payload.slug,
        channel: payload.channel,
        dueAt: payload.dueAt,
        postId: existingId,
        error: null,
        skipped: 'duplicate',
      })
      console.error(`SKIP duplicate ${payload.slug}/${payload.channel} -> ${existingId}`)
      continue
    }

    if (Date.now() >= deadline) {
      results.push({
        slug: payload.slug,
        channel: payload.channel,
        dueAt: payload.dueAt,
        postId: null,
        error: 'deadline exceeded before create',
      })
      continue
    }

    try {
      const created = await createDraft(payload, deadline)
      results.push({
        slug: payload.slug,
        channel: payload.channel,
        dueAt: payload.dueAt,
        postId: created.id,
        error: null,
      })
      existingDrafts.set(key, created.id)
      console.error(`OK ${payload.slug}/${payload.channel} -> ${created.id}`)
      await sleep(1500)
    } catch (err) {
      results.push({
        slug: payload.slug,
        channel: payload.channel,
        dueAt: payload.dueAt,
        postId: null,
        error: err.message,
      })
      console.error(`FAIL ${payload.slug}/${payload.channel}: ${err.message}`)
      if (err.status === 429 && Date.now() < deadline) {
        const wait = Math.min(err.retryAfterMs ?? MIN_RETRY_MS, deadline - Date.now())
        await sleep(wait)
      }
    }
  }

  console.log(JSON.stringify(results, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
