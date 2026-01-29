/**
 * Face Options Constants
 * 
 * Defines all available facial expressions and poses for thumbnail generation.
 * This is the single source of truth for face options used throughout the application.
 */

export interface FaceOption {
  value: string
  label: string
}

/**
 * Available facial expressions
 */
export const EXPRESSIONS: FaceOption[] = [
  { value: "none", label: "None" },
  { value: "excited", label: "Excited" },
  { value: "happy", label: "Happy" },
  { value: "thinking", label: "Thinking" },
  { value: "shocked", label: "Shocked" },
  { value: "fire", label: "Fire" },
  { value: "cool", label: "Cool" },
  { value: "mind-blown", label: "Mind blown" },
  { value: "surprised", label: "Surprised" },
  { value: "confident", label: "Confident" },
  { value: "serious", label: "Serious" },
  { value: "angry", label: "Angry" },
  { value: "curious", label: "Curious" },
  { value: "confused", label: "Confused" },
  { value: "determined", label: "Determined" },
  { value: "playful", label: "Playful" },
  { value: "skeptical", label: "Skeptical" },
  { value: "worried", label: "Worried" },
  { value: "relieved", label: "Relieved" },
  { value: "intense", label: "Intense" },
  { value: "friendly", label: "Friendly" },
  { value: "dramatic", label: "Dramatic" },
  { value: "calm", label: "Calm" },
  { value: "sad", label: "Sad" },
  { value: "neutral", label: "Neutral" },
  { value: "smirk", label: "Smirk" },
]

/**
 * Available poses
 */
export const POSES: FaceOption[] = [
  { value: "none", label: "None" },
  { value: "pointing", label: "Pointing" },
  { value: "hands-up", label: "Hands Up" },
  { value: "thumbs-up", label: "Thumbs Up" },
  { value: "thoughtful", label: "Thoughtful" },
  { value: "arms-crossed", label: "Arms Crossed" },
  { value: "hands-on-hips", label: "Hands on Hips" },
  { value: "celebration", label: "Celebration" },
  { value: "peace-sign", label: "Peace Sign" },
  { value: "waving", label: "Waving" },
  { value: "clapping", label: "Clapping" },
  { value: "heart-hands", label: "Heart Hands" },
  { value: "fist-pump", label: "Fist Pump" },
  { value: "open-arms", label: "Open Arms" },
  { value: "flexing", label: "Flexing" },
  { value: "shrugging", label: "Shrugging" },
  { value: "facepalm", label: "Facepalm" },
  { value: "praying", label: "Praying" },
  { value: "rock-on", label: "Rock On" },
  { value: "leaning-in", label: "Leaning In" },
  { value: "looking-away", label: "Looking Away" },
  { value: "hands-behind-head", label: "Hands Behind Head" },
  { value: "leaning-back", label: "Leaning Back" },
  { value: "forward-lean", label: "Forward Lean" },
  { value: "side-profile", label: "Side Profile" },
  { value: "over-shoulder", label: "Over Shoulder" },
]

/**
 * Get array of expression values (for enum constraints)
 */
export function getExpressionValues(): string[] {
  return EXPRESSIONS.map((expr) => expr.value)
}

/**
 * Get array of pose values (for enum constraints)
 */
export function getPoseValues(): string[] {
  return POSES.map((pose) => pose.value)
}

/**
 * Format expressions for display in system prompts
 * Returns: "excited (Excited), happy (Happy), ..."
 */
export function formatExpressionsForPrompt(): string {
  return EXPRESSIONS.map((expr) => `${expr.value} (${expr.label})`).join(', ')
}

/**
 * Format poses for display in system prompts
 * Returns: "none (None), pointing (Pointing), ..."
 */
export function formatPosesForPrompt(): string {
  return POSES.map((pose) => `${pose.value} (${pose.label})`).join(', ')
}
