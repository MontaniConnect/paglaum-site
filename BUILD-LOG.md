# Build Log

Step-by-step record of how this site and its editor were built, in order.
For how the finished system works, see `README.md`.

## 1. Cloned a reference design as a generic template

Started from a screenshot/URL of an existing nonprofit site (ncfgiving.com)
as a layout reference only. Built a single responsive HTML/CSS/JS page
matching its section order (navbar, hero, "giving solutions" card, feature
rows, impact stats, testimonials, contact, footer), but with **placeholder**
branding, copy, and stock photos — generic org name "Meridian Giving," no
real content yet.

Files created: `index.html`, `style.css`, `script.js`.

## 2. Replaced the placeholder content with PAGLAUM's real material

Pointed at a local `Portfolio/images` folder expecting just a logo and cover
photo. Investigation turned up more: the images were from the real
Missionaries of the Assumption / PAGLAUM Philanthropic Development Office,
and a sibling project folder (`paglaum-v2`) already had a clean, properly
cropped image library and a `content.md` reference with real copy (mission
statement, the "Pamaskong Handog sa Glan" appeal, four programs — DUYOG,
Pegtanggew, Lumad Education, WALIS — real impact numbers, advocacy
statements, Facebook post history, bank/GCash donation details).

Rebuilt every section with that real material:
- Hero, About, and a new "Urgent Appeal" card (replacing the generic
  "giving solutions" copy).
- Four program feature rows with real photos.
- Impact stats section with real numbers.
- A new Advocacy section (not in the original template).
- A Stories/updates carousel built from real Facebook post history.
- A combined Contact + "Ways to Give" section with real bank/GCash details.
- Footer with the real org's social/contact links.

Cropped and copied the needed photos into `images/`. Kept all "Donate"
buttons pointed at real ways-to-give info instead of a payment flow that
doesn't exist.

## 3. Published a Claude Artifact preview, then tuned the layout

Built `artifact.html` — a self-contained copy with inlined CSS/JS, following
the Artifact platform's page contract (no `<!doctype>`/`<html>`/`<body>`
wrapper, light/dark theme tokens, safe-area padding) — and published it so
the design could be reviewed without a local server.

Over several rounds of feedback, adjusted (mirroring each change into both
`style.css` and `artifact.html`):
- Widened the navbar (`.nav-wrap` max-width).
- Enlarged and widened the Appeal card (heading size, padding, the three
  stat-circle sizes, paragraph width).
- Enlarged the impact-section map/globe graphic (`max-width: 760px` → `100%`).
- Root-caused a "everything looks small on a big monitor" report: the
  sitewide `--container` token was still `1180px`, which left large empty
  margins at 1920px-wide viewports. Raised it to `1440px` (and the Appeal
  section's override to `1600px`) so every section scales consistently,
  not just the ones tweaked individually before.
- Centered the navbar's menu links between the logo and the Donate button.

## 4. Fixed an artifact-vs-local background mismatch

The artifact had dark-mode color tokens (required by the Artifact platform's
design rules) that the real deployed site's `style.css` never had. On a
dark-mode system, the artifact would flip to a dark palette while
`localhost` stayed fixed-light — a confusing mismatch. Removed the
artifact's dark-mode block entirely so it always matches the real site's
fixed light design.

## 5. Made the site's content editable via a single file

Extracted every piece of text/data on the page into `content.md`, using a
small custom format (not rendered as markdown — a `---` frontmatter block,
`## Section` blocks with `key: value` metadata and body text, `### Item`
sub-blocks for repeating things like programs/stories/stats).

Built `content-parser.js` (`parseContentMD` / `serializeContent`) and
rewrote `script.js` to fetch and parse `content.md` on load, fill in every
field in `index.html` by element `id`, and rebuild repeating lists
(programs, stories, advocacy, stats) from it — falling back to the
hardcoded text already in `index.html` if the fetch fails, so the site
never breaks. Validated this with headless DOM tests (Node + `jsdom`)
rather than guessing, since there was no way to preview a live local server
through the available browser tooling.

## 6. Took the site live on GitHub Pages

- Initialized git, created the public repo `MontaniConnect/paglaum-site`
  (via the already-authenticated `gh` CLI), and pushed.
- Enabled GitHub Pages (serving from `main`, root).
- Hit and fixed a classic gotcha: GitHub Pages runs Jekyll by default, which
  processes `.md` files instead of serving them raw — so `content.md` 404'd
  at its expected URL. Fixed by adding an empty `.nojekyll` file, which
  tells Pages to serve every file as-is.

## 7. Built a first content editor

Added `edit.html`/`edit.js`: a password-gated page that loads `content.md`,
renders an editable form for every field, and (originally) was meant to
save back to GitHub automatically via a planned backend.

## 8. Redesigned the editor into a section-based CMS

Given a reference screenshot and a detailed spec, rebuilt the editor as a
proper section-based interface:
- Left sidebar listing every content section (plus a pinned "Site settings"
  entry for the frontmatter), with **+ Add Section** at the bottom.
- Main panel shows only the active section's fields; switching sections
  doesn't lose edits made elsewhere.
- **Drag-and-drop reordering** of sections in the sidebar.
- Per-section **rename** (editable title) and **delete** (with
  confirmation).
- "View Live" link and a single Save button.

To make reordering actually affect the live page (not just the editor),
added a `section_order` field to `content.md`'s frontmatter, gave every
top-level section in `index.html` a `data-section-key`, and had `script.js`
physically reposition those `<section>` elements to match on load. This
required splitting "Ways to Give" out of the Contact section into its own
standalone section, since every content.md section needed to map to
exactly one reorderable page section. Re-tested everything with `jsdom`,
including real simulated drag events, section add/rename/delete, and a full
save payload.

## 9. Worked out how saving should actually persist

GitHub Pages can't run any server code, so "click Save and the site
updates" needs something else to hold write credentials safely:

- First attempt: no backend at all — the editor calls GitHub's API
  **directly from the browser**, authenticated with a personal access token
  the user pastes in once (remembered in that browser's storage). Built and
  tested this fully.
- Turned out the actual client doesn't have a GitHub account, which this
  approach requires. Reverted to a small **Vercel** serverless function
  (`api/save-content.js`) that checks a **shared password** server-side and
  makes the GitHub API calls itself, so the client only ever needs a plain
  password.

## 10. Deployed the backend and fixed the password gate

- Deployed `api/save-content.js` to Vercel (CLI was already installed and
  authenticated) and set the required environment variables
  (`EDIT_PASSWORD`, `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`).
- Fixed the editor's gate, which originally accepted any non-empty input
  and only discovered a wrong password when Save was clicked. Added a
  `verifyOnly` mode to the Vercel function, and had the gate (and the
  "remembered password" auto-unlock) check against it immediately, so a
  wrong — or since-changed — password is rejected right away instead of
  silently letting the user into the editor.
- Verified the whole chain live with direct `curl` checks against the
  deployed function in addition to the local test suite.

## 11. Documented the system

Wrote `README.md` covering the architecture, the `content.md` format, how
the editor and Vercel function work, the required environment variables,
and notes for making future changes — plus this file.
