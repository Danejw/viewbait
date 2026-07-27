import { describe, expect, it } from 'vitest'
import {
  buildThumbnailComparisonPrompt,
  normalizeThumbnailComparison,
} from '@/lib/mcp/thumbnail-comparison'

const IDS = [
  'd4a104cb-c7b4-4416-98cf-4ceda544a42e',
  '95c7c143-1524-42e1-a98a-57e06dc93277',
]

describe('thumbnail comparison', () => {
  it('labels images by their immutable thumbnail ids', () => {
    expect(
      buildThumbnailComparisonPrompt([
        { id: IDS[0], title: 'First' },
        { id: IDS[1], title: 'Second' },
      ]),
    ).toContain(`Image 1 = thumbnail ${IDS[0]} ("First")`)
  })

  it('rejects model output that names an unknown winner', () => {
    expect(() =>
      normalizeThumbnailComparison(IDS, {
        winner_thumbnail_id: 'bd9698c6-8f22-4018-82cf-d9c1e68b5794',
        winner_rationale: 'Unknown candidate',
        candidates: [],
        recommended_next_steps: [],
      }),
    ).toThrow('unknown thumbnail')
  })

  it('returns candidates in requested order and clamps scores', () => {
    const result = normalizeThumbnailComparison(IDS, {
      winner_thumbnail_id: IDS[1],
      winner_rationale: 'Clearer focal hierarchy',
      candidates: [
        {
          thumbnail_id: IDS[1],
          predicted_click_appeal: 130,
          clarity: 88,
          visual_hierarchy: 91,
          emotional_impact: 76,
          mobile_readability: 84,
          strengths: ['Clear focal point'],
          risks: [],
        },
        {
          thumbnail_id: IDS[0],
          predicted_click_appeal: -2,
          clarity: 70,
          visual_hierarchy: 68,
          emotional_impact: 65,
          mobile_readability: 60,
          strengths: [],
          risks: ['Small text'],
        },
      ],
      recommended_next_steps: ['Increase contrast'],
    })

    expect(result.candidates.map((candidate) => candidate.thumbnail_id)).toEqual(IDS)
    expect(result.candidates[0].predicted_click_appeal).toBe(0)
    expect(result.candidates[1].predicted_click_appeal).toBe(100)
  })
})
