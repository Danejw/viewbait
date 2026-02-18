# first-thumbnail — Land, sign in, create first thumbnail, and open it

Include fragment: login

Say: Great, you're signed in. Let's create your first thumbnail.
Goto routeKey: studio.create
Wait for Studio Create Ready (tour.event.route.ready) timeout:20000
Expect visible Create Sidebar Button (tour.studio.nav.sidebar.btn.create) timeout:15000
Click Create Sidebar Button (tour.studio.nav.sidebar.btn.create)

Fill Thumbnail Title (tour.studio.create.form.input.thumbnailTitle) value:My First Thumbnail
Click Aspect Ratio 16:9 (tour.studio.create.form.btn.aspectRatio.16_9)
Click Resolution 1K (tour.studio.create.form.btn.resolution.1k)
Click Variations 1 (tour.studio.create.form.btn.variations.1)
Snapshot Studio Form Ready name:studio-form-ready

Click Create Thumbnail (tour.studio.create.form.btn.generate)
Wait for Generation Complete (tour.event.studio.generate.complete) timeout:120000
Expect visible Results Container (tour.studio.results.results.container.main) timeout:60000
Expect visible Thumbnail Grid (tour.studio.results.results.grid.thumbnailGrid) timeout:60000
Snapshot Generation Complete name:generation-complete

Click First Generated Thumbnail (tour.studio.results.results.item.thumbnail)
Snapshot Thumbnail Opened name:thumbnail-opened
