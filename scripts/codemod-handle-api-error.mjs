#!/usr/bin/env node
/**
 * Codemod: Replace API catch blocks with handleApiError().
 * Run from repo root: node viewbait/scripts/codemod-handle-api-error.mjs
 * Updates files in viewbait/app/api that still have the old pattern.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const apiDir = path.join(__dirname, '..', 'app', 'api')

// Flexible whitespace; allow trailing comma after userId in context object
const CATCH_PATTERN = /} catch \(error\) \{\s*(\/\/[^\n]*\n\s*)?if \(error instanceof NextResponse\) \{\s*return error\s*\}\s*(?:\n\s*)?return serverErrorResponse\(\s*error\s*,\s*'([^']+)'\s*,\s*\{\s*route:\s*'([^']+)'(?:\s*,\s*userId\s*,?)?\s*\}\s*\)\s*\}/g

const CATCH_PATTERN_ALT = /} catch \(error\) \{\s*if \(error instanceof NextResponse\) \{\s*return error\s*\}\s*return serverErrorResponse\(\s*error\s*,\s*'([^']+)'\s*(?:,\s*\{\s*route:\s*'([^']+)'(?:\s*,\s*userId\s*,?)?\s*\})?\)\s*\}/g

function slug (msg) {
  return msg
    .toLowerCase()
    .replace(/^(failed to|failed|to)\s+/i, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 30) || 'api-operation'
}

function processFile (filePath) {
  let content = fs.readFileSync(filePath, 'utf8')
  const needHandleImport = !content.includes("from '@/lib/server/utils/api-helpers'")
  const needRemoveServer = content.includes('serverErrorResponse') && content.match(CATCH_PATTERN)

  // Replace pattern with route and message in context object (group 1 = optional comment, 2 = message, 3 = route)
  content = content.replace(CATCH_PATTERN, (_, _comment, message, route) => {
    const op = slug(message)
    return `} catch (error) {\n    return handleApiError(error, '${route}', '${op}', undefined, '${message}')\n  }`
  })

  // Replace pattern with serverErrorResponse(error, message) or serverErrorResponse(error, message, { route })
  content = content.replace(CATCH_PATTERN_ALT, (_, message, route) => {
    const op = slug(message)
    const r = route || 'UNKNOWN'
    return `} catch (error) {\n    return handleApiError(error, '${r}', '${op}', undefined, '${message}')\n  }`
  })

  if (needHandleImport && content.includes('handleApiError')) {
    // Add handleApiError import after error-handler import
    const errorHandlerImport = content.match(/import \{[^}]+\} from '@\/lib\/server\/utils\/error-handler'/)
    if (errorHandlerImport) {
      const insert = "\nimport { handleApiError } from '@/lib/server/utils/api-helpers'"
      content = content.replace(
        /(import \{[^}]+\} from '@\/lib\/server\/utils\/error-handler')/,
        `$1${insert}`
      )
    }
  }

  if (needRemoveServer && !content.includes('serverErrorResponse(')) {
    content = content.replace(/,?\s*serverErrorResponse\s*/g, ' ')
    content = content.replace(/\{\s*,/g, '{ ')
  }

  fs.writeFileSync(filePath, content)
  return true
}

function walk (dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full)
    else if (e.name === 'route.ts' && full.includes('app' + path.sep + 'api')) {
      const text = fs.readFileSync(full, 'utf8')
      if (text.includes('if (error instanceof NextResponse)') && text.includes('serverErrorResponse(error,')) {
        console.log('Updating', path.relative(apiDir, full))
        processFile(full)
      }
    }
  }
}

walk(apiDir)
console.log('Done.')
