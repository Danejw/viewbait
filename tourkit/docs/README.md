# TourKit README

TourKit is ViewBait's contract-driven Playwright tour system. It makes onboarding tours stable by using explicit anchors (`data-tour="tour...."`) and explicit app events (`tour.event....`) instead of text selectors and brittle DOM timing.

## 60-second Quickstart

1. Generate or refresh anchor/event map:

```bash
npm run tourkit:map
```

2. Run TourKit checks:

```bash
npm run tourkit:doctor
```

3. Create/update a tour from a guide:

```bash
npm run tourkit:gen tourkit/guides/first-thumbnail.md
```

4. Run one tour (headed):

```bash
npm run tour:first-thumbnail
```

5. Run one tour (CI/headless):

```bash
npm run tour:first-thumbnail:ci
```

6. Run all TourKit-tagged tours:

```bash
npm run tour:all
```

## Folder structure

```text
tourkit/
  app/                  # tour mode + event helpers + overlay
  artifacts/            # run outputs (screens, trace.zip, video.webm, runlog)
  config/               # routeKey and canonical event definitions
  docs/                 # documentation pack
  guides/               # guide DSL source files (*.md)
  maps/                 # generated anchor/event maps
  prompts/              # prompt snapshots used to build TourKit
  runner/               # reusable runtime executor (runTour)
  schema/               # tour JSON schema
  scripts/              # map generator, doctor, guide->tour generator
  tours/                # generated tour JSON files
```

## Create a new tour checklist

- [ ] Ensure the target flow has anchors/events in app code.
- [ ] Run `npm run tourkit:map`.
- [ ] Add a guide in `tourkit/guides/<tourId>.md` using strict DSL.
- [ ] Run `npm run tourkit:gen tourkit/guides/<tourId>.md`.
- [ ] Add scripts in `package.json`:
  - `tour:<tourId>`
  - `tour:<tourId>:ci`
- [ ] Run `npm run tour:<tourId>:ci`.
- [ ] Inspect artifacts under `tourkit/artifacts/<tourId>/<timestamp>/`.
