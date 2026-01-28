/**
 * Citation Processor Utility
 * 
 * Processes grounding metadata from Gemini API to insert inline citations
 * into message text in the format [citation_number](URI)
 */

import type { GroundingMetadata } from '@/lib/services/ai-core'

/**
 * Process grounding metadata and insert citations into message text
 * 
 * @param groundingMetadata - Grounding metadata from Gemini API response
 * @param message - The original message text
 * @returns Message with inline citations inserted
 */
export function processGroundingCitations(
  groundingMetadata: GroundingMetadata | undefined,
  message: string
): string {
  // Edge cases: return original message if grounding metadata is missing
  if (!groundingMetadata) {
    return message
  }

  const { groundingChunks, groundingSupports } = groundingMetadata

  // Return original message if no grounding chunks or supports
  if (!groundingChunks || groundingChunks.length === 0) {
    return message
  }

  if (!groundingSupports || groundingSupports.length === 0) {
    return message
  }

  // Step 1: Build URI map from grounding chunks
  const uriMap = new Map<number, string>()
  const titleMap = new Map<number, string>()

  groundingChunks.forEach((chunk, index) => {
    if (chunk.web?.uri) {
      uriMap.set(index, chunk.web.uri)
      if (chunk.web.title) {
        titleMap.set(index, chunk.web.title)
      }
    }
  })

  if (uriMap.size === 0) {
    return message
  }

  // Step 2: Process grounding supports to build URI list
  const uriToCitationNumber = new Map<string, number>()
  let nextCitationNumber = 1

  // First pass: collect all unique URIs and assign citation numbers
  groundingSupports.forEach((support) => {
    const { groundingChunkIndices } = support
    if (!groundingChunkIndices || groundingChunkIndices.length === 0) {
      return
    }

    groundingChunkIndices.forEach((chunkIndex) => {
      const uri = uriMap.get(chunkIndex)
      if (uri && !uriToCitationNumber.has(uri)) {
        uriToCitationNumber.set(uri, nextCitationNumber)
        nextCitationNumber++
      }
    })
  })

  if (uriToCitationNumber.size === 0) {
    return message
  }

  // Step 3: Build list of citation insertions (segment endIndex -> citation string)
  interface CitationInsertion {
    position: number
    citations: string
  }

  const insertions: CitationInsertion[] = []

  groundingSupports.forEach((support) => {
    const { segment, groundingChunkIndices } = support
    if (!segment || !groundingChunkIndices || groundingChunkIndices.length === 0) {
      return
    }

    const { endIndex } = segment
    if (endIndex < 0 || endIndex > message.length) {
      return
    }

    // Get unique URIs for this segment
    const segmentUris = new Set<string>()
    groundingChunkIndices.forEach((chunkIndex) => {
      const uri = uriMap.get(chunkIndex)
      if (uri) {
        segmentUris.add(uri)
      }
    })

    if (segmentUris.size === 0) {
      return
    }

    // Build citation string: [1](uri1) [2](uri2) etc.
    const citationNumbers = Array.from(segmentUris)
      .map((uri) => uriToCitationNumber.get(uri)!)
      .sort((a, b) => a - b) // Sort by citation number

    const citationString = citationNumbers
      .map((num) => {
        const uri = Array.from(segmentUris).find(
          (u) => uriToCitationNumber.get(u) === num
        )!
        return `[${num}](${uri})`
      })
      .join(' ')

    insertions.push({
      position: endIndex,
      citations: ` ${citationString}`, // Add space before citations
    })
  })

  if (insertions.length === 0) {
    return message
  }

  // Step 4: Insert citations in reverse order (to avoid index shifting)
  insertions.sort((a, b) => b.position - a.position) // Sort descending by position

  let result = message
  for (const insertion of insertions) {
    // Insert citations at the specified position
    result =
      result.slice(0, insertion.position) +
      insertion.citations +
      result.slice(insertion.position)
  }

  return result
}
