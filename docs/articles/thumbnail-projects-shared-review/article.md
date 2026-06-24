# Case Study: Organize Thumbnails and Review Before Publish

**Project:** ViewBait.app  
**Link:** https://viewbait.app

**Case study type:** Feature design  
**The task:** Let creators group thumbnails by video or campaign, share a gallery link, and collect comments before anything goes live.  
**What we learned:** Solo creators become teams the moment they need a second opinion. Sharing should not require accounts for viewers.  
**Last updated:** June 2026

## Case study at a glance

| | |
|---|---|
| **The task** | Projects for organizing work, shareable gallery links, and comment threads on thumbnails before publish |
| **Who it was for** | Creators, editors, and small teams who iterate on thumbnails before upload |
| **Main constraint** | Public share links must be view-only by default while collaborators need a safe way to comment |
| **What we built** | Review Gallery: projects, share modes, public gallery pages, and authenticated comments for owners and editors |
| **Outcome** | Feedback happens on the shortlist, not in scattered DMs |

## Background

Gallery view solved personal history. It did not solve **campaign memory**. A creator running a series, a client job, or a launch week needs one bucket per video, not one endless scroll.

We also saw a social pattern. Creators screenshot thumbnails and send them to friends, editors, or sponsors. Comments come back in iMessage, Slack, or email. Versions get mixed up. The wrong file uploads.

We needed organization plus lightweight review without building a full project management suite.

## The task

1. Let users create projects and assign thumbnails to them
2. Generate a shareable link to a read-only gallery
3. Support share modes (all thumbnails vs favorites only)
4. Allow comments on thumbnails for people with project access
5. Keep public viewers on a clean gallery page without studio chrome

## Constraints

- **Public vs authenticated:** Anyone with the link can view. Only owners and editors comment.
- **No accidental edits:** Share viewers cannot add or delete thumbnails unless they join as an editor through a separate flow.
- **Performance:** Shared galleries can hold hundreds of thumbnails. Paginate and cache appropriately.
- **Simple mental model:** Project equals one video or one campaign, not a nested folder tree.
- **Mobile-friendly review:** Stakeholders open links on phones. Grid must work at share URL `/p/[slug]`.

## Our approach

Review Gallery adds a Projects view in the studio. Each project has a name, assigned thumbnails, share slug, and share mode. Share dialog copies a public URL. Recipients see a focused gallery with zoom controls. Signed-in owners and editors see comment UI on each card. Click tracking on shared thumbnails gives a lightweight signal of which option gets attention.

## How we solved it

### Step 1: Projects as first-class entities

**What we did:** Added projects table with owner, name, share slug, share mode, and relations to thumbnails.

**Decision:** Flat project list, not nested folders.

**Why:** Creators think in uploads and campaigns, not directory trees. Flat scales for small teams.

### Step 2: Share slug and public page

**What we did:** Public route `/p/[slug]` loads project name, thumbnails, and count via service client. No auth required to view.

**Decision:** Separate minimal layout from the full studio chrome.

**Why:** Reviewers should not need a ViewBait account or navigation tutorial to say "pick number two."

### Step 3: Share modes

**What we did:** `share_mode` of `all` or `favorites`. Favorites mode shows only hearted thumbnails in the shared gallery.

**Decision:** Let creators curate the shortlist before sharing.

**Why:** Clients do not need to see twelve drafts. They need the final three.

### Step 4: Comments with access control

**What we did:** Comment API checks project access for authenticated users. Public GET on share route optionally returns `canComment` when a logged-in owner or editor opens the link.

**Decision:** Comments on thumbnail cards, not a separate forum.

**Why:** Feedback should attach to the exact image under debate.

### Step 5: Editor join flow

**What we did:** Separate editor slug lets signed-in collaborators join a project and add thumbnails with shared settings.

**Decision:** Opt-in collaboration, not open mutation on view links.

**Why:** View-only sharing is safe for clients. Editing stays intentional.

## What we built

- Projects view with create, rename, assign thumbnails
- Share dialog with link copy and share mode toggle
- Public gallery at `/p/[slug]` with zoom and full-size modal
- Thumbnail comments for owners and editors
- Click recording on shared gallery opens (approval signal, rate limited)

## Results

**Before:** Feedback lived in chats. Creators mislabeled files and uploaded the wrong version.

**After:** One link, one shortlist, comments on the cards. Teams pick a winner before YouTube sees anything.

**How we know it worked:** Shared links get reopened during the same day (multiple stakeholders reviewing). Comment volume spikes right before known publish days for active projects.

## What you can learn

1. **Share view-only by default.** Collaboration permissions should be harder to grant than viewing.
2. **Curate before sharing.** Favorites-only mode respects reviewer attention.
3. **Attach feedback to assets.** Comments on the thumbnail beat threads about "the blue one."
4. **Public pages deserve their own layout.** Do not dump reviewers into your full app shell.
5. **Lightweight signals help.** Click counts on shared options hint consensus without building a voting system.

## Next step

Create a project at [viewbait.app](https://viewbait.app), add your top three thumbnail variations, share favorites-only with someone whose opinion you trust, and comment on their pick before you upload.
