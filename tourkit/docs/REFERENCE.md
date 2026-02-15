# TourKit Reference

## Tour JSON schema reference

Location:

- `tourkit/schema/tour.schema.json`

Top-level:

- `id: string`
- `title?: string`
- `steps: Step[]`

Supported step variants:

- `say`
  - `{ "type": "say", "text": "..." }`
- `goto`
  - `{ "type": "goto", "routeKey": "auth" }`
- `click`
  - `{ "type": "click", "anchor": "tour.auth.form.btn.submit" }`
- `fill`
  - `{ "type": "fill", "anchor": "tour.auth.form.input.email", "valueEnv": "E2E_EMAIL" }`
  - `{ "type": "fill", "anchor": "tour.studio.create.input.title", "value": "My title" }`
- `expectVisible`
  - `{ "type": "expectVisible", "anchor": "tour.results.main.grid.thumbnails" }`
- `waitForEvent`
  - `{ "type": "waitForEvent", "name": "tour.event.auth.success", "timeoutMs": 30000 }`
- `waitMs`
  - `{ "type": "waitMs", "durationMs": 1000 }`
- `snapshot`
  - `{ "type": "snapshot", "name": "after-login" }`

Prefix constraints:

- anchor fields must start with `tour.`
- event names must start with `tour.event.`

## NPM command reference

From current `package.json`:

- `tourkit:map` -> `tsx tourkit/scripts/generate-tour-map.ts`
- `tourkit:doctor` -> `tsx tourkit/scripts/doctor.ts`
- `tourkit:gen` -> `tsx tourkit/scripts/generate-tour-from-guide.ts`
- `tour:all` -> `playwright test tests/e2e/tourkit.spec.ts --grep @tourkit`
- `tour:first-thumbnail` -> headed run with `TOUR_FILE=tourkit/tours/first-thumbnail.tour.json`
- `tour:first-thumbnail:ci` -> headless run with same tour file
- `pw:ui` -> Playwright UI mode

## Artifact directory layout

```text
tourkit/artifacts/
  <tourId>/
    <YYYYMMDD-HHmmss>/
      screens/
        001_<snapshot-name>.png
        002_<snapshot-name>.png
      runlog.txt
      video.webm        # copied if produced
      trace.zip         # copied if produced
```

## Map and config file formats

### `tourkit/config/routes.json`

```json
{
  "routes": [
    { "routeKey": "home", "path": "/" },
    { "routeKey": "auth", "path": "/auth" }
  ],
  "primaryFlow": "first-thumbnail"
}
```

### `tourkit/config/events.json`

```json
{
  "events": [
    { "name": "tour.event.route.ready", "payloadExample": { "routeKey": "auth" } }
  ]
}
```

### `tourkit/maps/tour.map.json`

```json
{
  "generatedAt": "ISO",
  "routes": {
    "auth": { "path": "/auth", "anchors": ["tour.auth.form.input.email"] }
  },
  "events": ["tour.event.route.ready"]
}
```
