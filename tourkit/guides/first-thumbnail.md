# first-thumbnail

Say: Start first-thumbnail onboarding tour.
Goto routeKey: home
Expect visible Home CTA (tour.home.hero.cta.openStudio)
Click Open Studio (tour.home.hero.cta.openStudio)
Wait for Home Route Ready (tour.event.route.ready) timeout:30000
Goto routeKey: auth
Wait for Auth Route Ready (tour.event.route.ready) timeout:30000
Click Signin Tab (tour.auth.form.tab.signin)
Fill Email (tour.auth.form.input.email) env:E2E_EMAIL
Fill Password (tour.auth.form.input.password) env:E2E_PASSWORD
Click Login (tour.auth.form.btn.submit)
Wait for Auth Success (tour.event.auth.success) timeout:30000
Goto routeKey: studio.create
Wait for Studio Manual Ready (tour.event.studio.manual.ready) timeout:60000
Click Manual Tab (tour.studio.create.tab.manual)
Fill Thumbnail Title (tour.studio.create.input.title) value:My First Thumbnail
Fill Custom Instructions (tour.studio.create.input.customInstructions) value:Cinematic YouTube thumbnail with dramatic lighting and high contrast.
Click Aspect 16:9 (tour.studio.create.btn.aspectRatio.16_9)
Click Resolution 1K (tour.studio.create.btn.resolution.1k)
Click Variations 1 (tour.studio.create.btn.variations.1)
Snapshot Settings Ready name:settings-ready
Click Create Thumbnail (tour.studio.create.btn.generate)
Wait for Generation Started (tour.event.thumbnail.generation.started) timeout:30000
Wait for Generation Complete (tour.event.thumbnail.generation.complete) timeout:120000
Expect visible Results Grid (tour.results.main.grid.thumbnails)
Click First Generated Thumbnail (tour.results.main.card.thumbnail.first)
Snapshot Thumbnail Opened name:thumbnail-opened
