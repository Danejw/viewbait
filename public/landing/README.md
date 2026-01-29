# Landing page assets

Drop your images here so the landing page hero, face library, and style templates sections display them.

## Hero (`hero/`)

- **hero-thumbnail.jpg** (or .webp) — Main 16:9 thumbnail shown in the hero frame. Fallback: gradient + emoji + text if missing or load fails.

## Face Library (`faces/`)

One image per expression (1:1 aspect ratio recommended). Fallback: emoji for that slot if image fails.

- happy.jpg
- surprised.jpg
- thinking.jpg
- shocked.jpg
- fire.jpg
- cool.jpg
- mind-blown.jpg

## Style Templates (`styles/`)

One image per style (16:9 recommended). Fallback: colored gradient card if image fails.

- reaction.jpg
- tutorial.jpg
- vlog.jpg
- gaming.jpg
- education.jpg

Paths are defined in `app/page.tsx` (HERO_THUMBNAIL_SRC, FACE_EXPRESSIONS, STYLE_TEMPLATES). Change those constants if you use different filenames.
