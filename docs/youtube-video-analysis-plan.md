# YouTube Video Analysis – Plan & Attributes

## Purpose

Enable “Video analysis” from the YouTube tab: for a selected video, produce a **summary** and a set of **consistent, measurable attributes** that we can show in an analytics-style UI (e.g. scores, tags, categories). This doc defines what to analyze so results stay consistent and meaningful.

---

## 1. Summary (required)

- **What**: Short, user-facing summary of what the video is about (2–4 sentences).
- **Source**: Transcript (preferred) or description + title + thumbnail metadata. If no transcript, fall back to description/title and note “Summary from title and description only.”
- **Consistency**: Always one summary per analysis; same prompt and model so tone/length are consistent.

---

## 2. Proposed attributes (for analytics)

Attributes should be **definable, repeatable, and useful** for creators (e.g. thumbnail strategy, content type, tone).

### 2.1 Content & format

| Attribute        | Type    | Description / options |
|-----------------|--------|------------------------|
| **Content type**| enum   | e.g. Tutorial, Vlog, Review, Gaming, Short-form, Livestream, Other |
| **Primary topic**| string | 1–3 main topics (e.g. “cooking”, “React hooks”) |
| **Pacing**      | enum   | Slow / Medium / Fast (from transcript + duration) |
| **Structure**   | enum   | Scripted / Semi-scripted / Unscripted (heuristic from transcript) |

### 2.2 Thumbnail & title (clickability / CTR-style)

| Attribute           | Type   | Description |
|--------------------|--------|-------------|
| **Title length**   | number | Character count (we have this; no AI needed) |
| **Title style**    | enum   | e.g. Question, Number, How-to, List, Direct statement, Other |
| **Thumbnail hook** | enum   | Face / Text overlay / Product / Scene / Minimal / Other (from image + optional vision) |
| **Thumbnail–title alignment** | enum | Strong / Partial / Weak (how well title and thumbnail match) |

### 2.3 Engagement & tone

| Attribute      | Type   | Description |
|----------------|--------|-------------|
| **Tone**       | enum   | Professional / Casual / Educational / Entertainment / Mixed |
| **Call to action** | bool | Whether video explicitly asks for like/subscribe/comment |
| **Hook strength** | enum | Strong / Medium / Weak (first 30–60s: clarity and pull) |

### 2.4 Technical / metadata (from YouTube or our pipeline)

| Attribute       | Type   | Description |
|-----------------|--------|-------------|
| **Duration**    | number | Minutes (we can fetch; no AI) |
| **Has chapters**| bool   | From YouTube metadata if available |
| **Has captions**| bool   | From availability of transcript |
| **Language**    | string | Primary language (from transcript or metadata) |

---

## 3. Consistency and implementation notes

- **Enums**: Use fixed allowed values; map model output to the closest enum (with “Other” fallback) so every run uses the same schema.
- **Prompts**: One prompt per attribute (or one structured prompt that returns all attributes). Version prompts and keep them in code/config so we can reproduce and improve.
- **Sources**: Prefer transcript > description > title/thumbnail. Document “confidence” or “source” (e.g. “from transcript”) where it affects interpretation.
- **Caching**: Store analysis result per `videoId` (and optionally version by analysis schema version) to avoid re-running unnecessarily.
- **Rate limits**: Respect YouTube/transcript and any external API limits; queue or background jobs for analysis.

---

## 4. UX (future)

- **Where**: Trigger from YouTube card “Video analysis” button → open a side panel or modal with summary + attributes.
- **Display**: Summary at top; attributes as labeled chips, badges, or a small table; optional “confidence” or “based on transcript” where relevant.
- **Re-run**: Allow “Analyze again” when transcript or schema changes; show “Last analyzed at” and schema version if needed.

---

## 5. Phased rollout

1. **Phase 1**: Summary only (transcript or description); no attributes. Validates pipeline and UX.
2. **Phase 2**: Add a small set of attributes (e.g. content type, primary topic, tone) with enums and single structured prompt.
3. **Phase 3**: Add thumbnail/title and engagement attributes; optional vision pass for thumbnail hook.
4. **Phase 4**: Refine enums and prompts from feedback; add caching and “last analyzed” UX.

---

## 6. Open decisions

- **Transcript source**: YouTube Data API v3 (captions) vs third-party (e.g. YouTube Transcript API). Decide and document in implementation.
- **Model**: Which LLM (and vision model if we analyze thumbnail image) for summary + attributes; cost and latency vs quality.
- **Schema storage**: DB table for `video_analyses (video_id, user_id?, summary, attributes_json, analyzed_at, schema_version)` vs storing in existing entities.

This plan keeps attributes consistent and meaningful so analytics are comparable across videos and over time.
