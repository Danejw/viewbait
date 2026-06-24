---
name: linkedin-case-study-posts
description: >-
  Writes human, first-person LinkedIn posts from UFIQ case studies or product
  builds using a fixed six-section format (app background, problem, solution,
  implementation, result, conclusion). Use when the user asks for linkedin.md,
  a LinkedIn version of an article, a social post from a case study, or
  distributable copy for docs/articles. Integrates writing-case-study-articles
  and writing-top-performing-articles. Never uses em dashes.
---

# LinkedIn Case Study Posts

Turn a case study or product build into a paste-ready LinkedIn post. Default output: `docs/articles/<slug>/linkedin.md`.

## Companion skills (read before writing)

1. **writing-case-study-articles** — source facts, task, constraints, decisions, results. If `article.md` exists, read that skill and the article first; extract only verified claims.
2. **writing-top-performing-articles** — style pass: front-load meaning, scannable sections, no em dashes, honest packaging, plain language.

Do not duplicate long case-study rules here. Apply them through those skills, then shape output with this LinkedIn format.

## When to use

| Use | Skip |
|-----|------|
| User wants `linkedin.md` beside a case study | Full long-form article (use writing-case-study-articles only) |
| Social distribution of a build story | Changelog or release notes |
| Problem → solution post for a technical feature | Generic opinion with no product context |

## Workflow

```
Task Progress:
- [ ] Phase 1: Read source (article.md, notes, or user brief)
- [ ] Phase 2: Lock audience, named solution, and one lesson
- [ ] Phase 3: Draft using six-section template
- [ ] Phase 4: Human voice pass (less AI-like, more founder voice)
- [ ] Phase 5: Top-performing style pass (scanability, no em dashes, char count)
- [ ] Phase 6: Write linkedin.md and verify checklist
```

### Phase 1: Gather source material

From `article.md` or the user, confirm:

| Input | Use in post |
|-------|-------------|
| Product name | Header + **The app** |
| Product URL | **Link:** line under title |
| What the feature/system is | **The app** (1 short paragraph) |
| The task / pain | **The problem** |
| Named solution (brand the system) | **The solution** |
| How it works (concrete, minimal jargon) | **How it works** |
| Before/after outcomes | **The result** |
| Portable lesson | **Bottom line** |

If no named solution exists yet, coin one from the case study (e.g. "Database Driven Social Content Engine", "UFIQ League Agent", "AI Picks Skill Optimization").

### Phase 2: Audience and voice

- **Reader:** builders, product people, technical founders on LinkedIn
- **Voice:** first person ("I" / "we"), conversational, specific. Sound like a founder explaining what they built, not a framework brochure.
- **Complexity:** default to non-technical unless the user asks otherwise. Prefer outcomes over stack names.
- **Length:** target **≤ 2,500 characters** (LinkedIn paste limit for this format). Verify with a character count before delivery.

### Phase 3: Six-section template

Use these section labels exactly (bold labels, blank line after each label):

```markdown
[Title line: outcome or lesson, not product name alone]

**Project:** [Name]
**Link:** [URL]

**The app**
[What the product is and what the specific feature/system does. Reader must understand context before the problem.]

**The problem**
[One tight paragraph. Real friction, not abstract "we needed scale".]

**The solution**
[Name the system. One paragraph on the creative approach.]

**How it works**
[Implementation in plain language: what happens step by step or in one flowing paragraph. No bullet manifestos unless the user asks.]

**The result**
[What changed for you/the team/product. Observable, honest.]

**Bottom line**
[One portable lesson for the reader. Optional soft CTA only if user wants it.]
```

Full blank template: [template.md](template.md). Repo examples: [examples.md](examples.md).

### Phase 4: Human voice pass

Remove AI tells:

- Numbered 8-step manifestos unless requested
- Triads ("X beats Y beats Z")
- Punchy closers ("Not magic. Discovery.")
- Over-parallel sentences and hedge stacks
- Generic startup verbs: "leverage", "utilize", "robust", "delve", "game-changer"

Prefer:

- One concrete habit or moment ("my reflex was to tweak the prompt")
- Plain time/place cues ("bad Saturday night", "midnight prompt edits")
- Short paragraphs (2–4 sentences)
- Named solution repeated once in solution, once near the end if natural

### Phase 5: Style pass (writing-top-performing-articles)

- **Never use em dashes (—).** Search and replace before save.
- Front-load the title and **The app** so scanners know what they are reading.
- Section labels carry meaning; first sentence under each label delivers the point.
- One dominant intent: teach how you solved a real problem.
- Meta descriptions / hashtags: only if user asks.

### Phase 6: Checklist before save

- [ ] Title + **Project** + **Link** at top
- [ ] All six sections present and in order
- [ ] Named solution appears in **The solution**
- [ ] **The app** explains the product and the feature
- [ ] **How it works** describes actual implementation, not vibes
- [ ] **The result** has honest before/after or observable outcomes
- [ ] ≤ 2,500 characters
- [ ] No em dashes
- [ ] Reads human on aloud read
- [ ] File written to `docs/articles/<slug>/linkedin.md` (or path user gave)

## Output path convention

| Source | Output |
|--------|--------|
| `docs/articles/<slug>/article.md` | `docs/articles/<slug>/linkedin.md` |
| User names slug only | `docs/articles/<slug>/linkedin.md` |
| User names explicit path | Use that path |

## Variants (only when user asks)

| Variant | Change |
|---------|--------|
| Technical audience | Allow stack names in **How it works**; keep other sections plain |
| Shorter teaser | Compress to **The app** + **The problem** + **The solution** + **Bottom line** (~1,200 chars) |
| Pinker-style narrative | Merge sections into flowing prose but keep the same informational arc |
| Bullet outcomes | Add 3–4 bullets under **The result** only |

## Examples in this repo

See [examples.md](examples.md) for canonical posts:

- `docs/articles/database-driven-social-content/linkedin.md`
- `docs/articles/how-ufiq-league-agent-works/linkedin.md`
- `docs/articles/how-ufiq-cron-jobs-work/linkedin.md`
- `docs/articles/how-ai-picks-skill-optimization-works/linkedin.md`
