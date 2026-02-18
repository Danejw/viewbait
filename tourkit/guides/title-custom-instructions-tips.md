# title-custom-instructions-tips — Subtitle and custom instruction tips

Narration: In this tour we'll compare title formatting with and without a subtitle, then show how custom instructions add video context for better thumbnail relevance.

Include fragment: login
Goto routeKey: studio.create
Wait for Studio Create Ready (tour.event.route.ready) timeout:60000
Click Create View (tour.studio.nav.sidebar.btn.create)

Narration: First, use a title without a colon. This creates only a main title line.
Fill Thumbnail Title (tour.studio.create.form.input.thumbnailTitle) value:Summer Camping Guide
Fill Custom Instructions (tour.studio.create.form.text.customInstructions) value:Outdoor campsite at golden hour, host demonstrating tent setup, hiking gear visible, warm natural light.
Click Aspect Ratio 16:9 (tour.studio.create.form.btn.aspectRatio.16_9)
Click Resolution 1K (tour.studio.create.form.btn.resolution.1k)
Click Variations 1 (tour.studio.create.form.btn.variations.1)
Screenshot No Subtitle Setup name:title-no-subtitle fullPage:true
Click Create Thumbnail (tour.studio.create.form.btn.generate)
Wait for First Generation Complete (tour.event.studio.generate.complete) timeout:120000
Wait for Studio Results Ready (tour.event.route.ready) timeout:60000
Expect visible Result Grid (tour.studio.results.results.grid.thumbnailGrid) timeout:60000
Screenshot No Subtitle Result name:result-no-subtitle fullPage:true
Annotate No Subtitle Result target:result-no-subtitle instructions:Highlight the thumbnail text area and label it Main title only.

Goto routeKey: studio.create
Wait for Studio Create Ready Again (tour.event.route.ready) timeout:60000
Click Create View Again (tour.studio.nav.sidebar.btn.create)

Narration: Now add a colon to split main title and subtitle. Text on the left is main title, and text on the right becomes subtitle.
Fill Thumbnail Title With Subtitle (tour.studio.create.form.input.thumbnailTitle) value:Summer Camping Guide: Beginner Essentials
Fill Custom Instructions With More Context (tour.studio.create.form.text.customInstructions) value:YouTube tutorial for first-time campers at Yosemite, host packing gear checklist, tent and campfire in frame, expressive face, high clarity.
Narration: Tip one: mention where the video happens. Tip two: explain what the person is doing. Tip three: include the exact topic so visuals match your video.
Screenshot Subtitle Setup name:title-with-subtitle fullPage:true
Annotate Subtitle Setup target:title-with-subtitle instructions:Add a callout showing main title on the left of colon and subtitle on the right.
Click Create Thumbnail With Subtitle (tour.studio.create.form.btn.generate)
Wait for Second Generation Complete (tour.event.studio.generate.complete) timeout:120000
Wait for Studio Results Ready After Second Run (tour.event.route.ready) timeout:60000
Expect visible Result Grid After Second Run (tour.studio.results.results.grid.thumbnailGrid) timeout:60000
Screenshot Subtitle Result name:result-with-subtitle fullPage:true
Annotate Subtitle Result target:result-with-subtitle instructions:Add a comparison note that subtitle version can communicate extra detail.

Narration: Great! You saw title-only versus title-plus-subtitle, plus custom instruction patterns you can reuse for highly relevant thumbnails.
