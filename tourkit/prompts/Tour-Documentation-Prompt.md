GENERATE HIGH-LEVEL DOCUMENTATION PACK (complete understanding + extension guide)

You are generating the complete documentation pack for TourKit so it’s reusable across projects and understandable at a glance.

You MUST read:
- /tourkit/docs/ANCHOR_EVENT_PLAN.md
- /tourkit/docs/NAMING.md
- /tourkit/config/routes.json
- /tourkit/config/events.json
- /tourkit/maps/tour.map.json
- /tourkit/maps/TOUR_MAP.md
- /tourkit/schema/tour.schema.json
- /tourkit/runner/runTour.ts
- /tourkit/scripts/generate-tour-map.ts
- /tourkit/scripts/generate-tour-from-guide.ts
- /tourkit/scripts/doctor.ts

Goal:
Write docs that explain:
- What TourKit is and why it exists
- The TourKit contract (anchors + events) and how to apply it in any app
- What files exist in /tourkit/ and what each one does
- How to add anchors/events to new pages
- How to regenerate maps
- How to create a guide and generate a tour
- How to run tours and where artifacts go
- How to debug failures (screenshots/video/trace/doctor)
- How to extend TourKit (new step types, new event waits)
- How to reuse it in another project (copy /tourkit or publish internal package)

You MUST write these files (exact paths):
1) /tourkit/docs/README.md
   Include:
   - 60-second Quickstart (commands and what they do)
   - Folder structure overview
   - “Create a new tour” short checklist

2) /tourkit/docs/CONTRACT.md
   Include:
   - Anchor naming grammar with examples
   - Event naming grammar with examples
   - Required prefixes and why
   - Do/Don’t rules

3) /tourkit/docs/WORKFLOWS.md
   Include:
   - Setup workflow (prompts 1→2)
   - Tour creation workflow (prompt 3 repeated)
   - Docs workflow (prompt 4)
   - Common failure modes and fixes

4) /tourkit/docs/REFERENCE.md
   Include:
   - Full JSON schema reference with examples
   - List of npm commands available (read from package.json)
   - Artifact directory layout
   - Map file formats (routes.json, events.json, tour.map.json)

5) /tourkit/docs/EXTENDING.md
   Include:
   - How to add a new step type (what code to touch, example)
   - How to add a new event and wire it end-to-end
   - How to add CI checks (optional)
   - How to port TourKit to another repo

Also create:
6) /tourkit/docs/ARCHITECTURE.md
   - High-level diagram in ASCII showing:
     guide → generator → tour.json → runner → playwright → artifacts
     and config/routes/events → map generator → tour.map.json
   - Explain where the contract lives and how everything connects.

Constraints:
- Everything saved under /tourkit/docs/
- Use real file paths and commands as implemented in this repo
- If a referenced file is missing, create it or note it explicitly in docs
- Keep docs practical and example-heavy
