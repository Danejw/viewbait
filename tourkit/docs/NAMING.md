# TourKit Naming Contract

## Anchor grammar

Format:

`tour.<route>.<area>.<type>.<name>[.<variant>]`

Examples from this app:
- `tour.home.hero.cta.startCreating`
- `tour.auth.form.input.email`
- `tour.auth.form.btn.submit`
- `tour.studio.form.input.thumbnailTitle`
- `tour.studio.form.select.aspectRatio`
- `tour.studio.results.grid.thumbnails`
- `tour.onboarding.flow.btn.generate`

## Allowed `<type>` values

- `cta`: primary call-to-action entry points
- `btn`: regular buttons
- `input`: text/password/email inputs
- `select`: select/dropdown trigger controls
- `tab`: tab triggers
- `card`: card container with semantic item content
- `grid`: collection container displaying repeated items
- `item`: repeated entry inside lists/grids
- `modal`: modal root/container
- `chip`: compact selectable pill/chip
- `toggle`: boolean switch controls
- `text`: stable text node targeted for verification
- `link`: anchor navigation links
- `label`: explicit form labels
- `container`: structural container used as route-ready boundary
- `image`: meaningful images used by tour verification
- `badge`: status marker badge
- `progress`: progress indicator components

## Event grammar

Format:

`tour.event.<domain>.<name>`

Examples:
- `tour.event.route.ready`
- `tour.event.auth.success`
- `tour.event.studio.generate.started`
- `tour.event.studio.generate.complete`
- `tour.event.modal.opened`

## Do/Don't rules

### DO
- DO anchor the interactive element itself (not a wrapper).
- DO emit `tour.event.route.ready` after anchors are present and page is interactive.
- DO use `tour.event.*` waits instead of DOM polling for async operations.

### DON'T
- DON'T use text selectors in tours.
- DON'T poll DOM for generation completion if you can emit an event.
- DON'T use duplicate anchors on the same page (each anchor must be unique per route).
- DON'T anchor elements that are only sometimes rendered without noting the condition.
