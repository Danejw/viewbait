/**
 * Free-tier thumbnail retention rules.
 *
 * Privacy policy: free-tier thumbnails are deleted 30 days after creation;
 * paid-tier content is retained until the user or account deletes it.
 *
 * Cancellation nulls `user_subscriptions.product_id`, so current plan is not a
 * safe signal. Generation writes `has_watermark` from the active tier and edit
 * preserves that flag, so it is the durable marker of free-era vs paid-era
 * content.
 */

export const FREE_TIER_RETENTION_DAYS = 30

export function getFreeTierRetentionCutoff(now: Date = new Date()): Date {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - FREE_TIER_RETENTION_DAYS)
  return cutoff
}

/**
 * Return whether a thumbnail is eligible for automated free-tier deletion.
 *
 * Paid-era rows (`has_watermark === false`) must survive cancel/downgrade even
 * when the owner is later classified as free (`product_id IS NULL`).
 */
export function shouldDeleteThumbnailForFreeTierRetention(input: {
  hasWatermark: boolean | null
  createdAt: string
  now?: Date
}): boolean {
  if (input.hasWatermark !== true) {
    return false
  }

  return new Date(input.createdAt) < getFreeTierRetentionCutoff(input.now)
}
