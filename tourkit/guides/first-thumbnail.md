# first-thumbnail.md — Create your first thumbnail from home to studio

Say: Welcome! Let's create your first thumbnail.
Goto routeKey: home
Expect visible Sign In Nav Link (tour.home.nav.link.signIn)
Click Sign In Nav Link (tour.home.nav.link.signIn)

Fill Email (tour.auth.form.input.email) env:E2E_EMAIL
Fill Password (tour.auth.form.input.password) env:E2E_PASSWORD
Click Sign In Submit (tour.auth.form.btn.submit)
Wait for Auth Success (tour.event.auth.success) timeout:30000

Goto routeKey: studio.create
Wait for Studio Route Ready (tour.event.route.ready) timeout:30000
Expect visible Manual Tab (tour.studio.settings.tab.manual)
Click Manual Tab (tour.studio.settings.tab.manual)
Fill Thumbnail Title (tour.studio.form.input.thumbnailTitle) value:My First Thumbnail

# Defaults should already be 16:9, 1K, and 1 variation; verify controls are visible before generation.
Expect visible Aspect Ratio Control (tour.studio.form.select.aspectRatio)
Expect visible Resolution Control (tour.studio.form.select.resolution)
Expect visible Variations Control (tour.studio.form.select.variations)

Click Create Thumbnail (tour.studio.form.btn.generate)
Wait for Generation Complete (tour.event.studio.generate.complete) timeout:120000
Expect visible Generated Thumbnail Card (tour.studio.results.card.thumbnail) timeout:60000
Click Generated Thumbnail Card (tour.studio.results.card.thumbnail)
Wait for Thumbnail Modal Opened (tour.event.modal.opened) timeout:30000
Expect visible Thumbnail View Modal (tour.studio.modal.thumbnailView)
Snapshot First Thumbnail Open name:first-thumbnail-open
