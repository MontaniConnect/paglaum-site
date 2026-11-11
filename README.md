# PAGLAUM Site

Public site for PAGLAUM — Philanthropic Development Office of the Missionaries
of the Assumption — plus a content editor the client can use without touching
code or markdown directly.

- **Live site:** https://montaniconnect.github.io/paglaum-site/
- **Editor:** https://montaniconnect.github.io/paglaum-site/edit.html
- **Repo:** https://github.com/MontaniConnect/paglaum-site

## How it's built

A plain static site (HTML/CSS/JS, no build step, no framework) hosted on
**GitHub Pages**, with its text content separated out into one file,
`content.md`, so it can be edited without touching HTML. A small **Vercel**
function handles saving those edits back to GitHub, since GitHub Pages itself
can't run any server code.

```
index.html          the live page's markup/structure (fixed)
style.css            all styling
script.js             fetches content.md, fills index.html's fields, and
                      reorders sections to match content.md's section_order
content-parser.js    shared parser/serializer for content.md (used by
                      script.js AND edit.js — see "The content.md format")
content.md           every piece of editable text/data on the site
images/              photos, logo, favicon

edit.html / edit.js   the client-facing content editor (see below)
api/save-content.js   Vercel function: checks the password, commits the
                      edited content.md to this repo via GitHub's API
package.json          exists only so Vercel recognizes this as a project

artifact.html         a self-contained copy used only to preview the design
                      as a Claude Artifact — NOT wired to content.md's live
                      editing flow, and not auto-synced with the files above
```

### The content.md format

`content.md` isn't rendered as markdown — it's a small structured format
`content-parser.js` reads, built around three ideas:

- A `---`-fenced **frontmatter** block at the top for site-wide settings
  (org name, phone, email, social links, footer text).
- `## Section Name` blocks, one per page section. Each can have `key: value`
  metadata lines right after the heading, then a blank line, then body
  paragraph(s).
- `### Item Name` sub-blocks inside a section, for repeating things
  (programs, stories, advocacy items, stat numbers) — same `key: value` +
  body-paragraph shape.

`content.md` has its own `HOW TO EDIT THIS FILE` comment at the top with the
same notes. `content-parser.js` exports `parseContentMD()` (text → structured
data) and `serializeContent()` (structured data → text again, used when
saving from the editor).

### How the live site uses it

On every page load, `script.js`:

1. Fetches `content.md` and parses it.
2. Fills in every field in `index.html` by element `id` (e.g. `#hero-headline`,
   `#programs-list`, `#give-gcash`) and rebuilds repeating lists (programs,
   stories, advocacy items, stats) from the parsed `items` arrays.
3. Reads `section_order` from the frontmatter and physically reorders the
   page's top-level `<section data-section-key="...">` elements to match —
   this is how reordering sections in the editor changes the live page's
   layout, not just its text.

If `content.md` can't be fetched (e.g. opened as a local `file://` page),
`index.html`'s original hardcoded text is shown instead as a fallback — the
site never breaks, it just stops reflecting edits.

### The editor (`edit.html`)

A section-based CMS-style interface:

- **Sidebar** — "Site settings" (frontmatter fields) pinned at top, then every
  content section, in order, then **+ Add Section**.
- **Main panel** — shows only the active section's fields. Switching sections
  doesn't reload the page or lose edits made elsewhere.
- **Drag-and-drop** reordering of sections (native HTML5 drag events).
- Each section's **title is editable** (renames it), and has a **Delete
  section** button (with a confirmation prompt).
- **Save changes** re-serializes everything via `serializeContent()` and
  POSTs it to the Vercel function.

**Access control:** entering the shared password calls the Vercel function
with `{ verifyOnly: true }` immediately, before showing the editor at all —
so a wrong password is rejected right away instead of only failing later on
save. A correct password is remembered in that browser's `localStorage` (so
the client doesn't retype it every visit); on later visits it's silently
re-verified against the server, so if the password is ever changed, a
stale remembered one is dropped rather than causing a confusing failure.

### The Vercel function (`api/save-content.js`)

The only server-side piece. One endpoint, `POST /api/save-content`, two
modes:

- `{ password, verifyOnly: true }` → checks the password only, touches
  nothing else.
- `{ password, content }` → checks the password, then commits `content` as
  the new `content.md` via GitHub's Contents API (GET current file for its
  `sha`, then `PUT` the update). GitHub Pages rebuilds automatically from
  that commit, usually within a minute.

Deployed at **https://giving-landing-page-mu.vercel.app** (Vercel project:
`montani-s-projects/giving-landing-page`). Required environment variables
(set in the Vercel dashboard, never committed):

| Variable | Value |
|---|---|
| `EDIT_PASSWORD` | the shared password the editor checks |
| `GITHUB_TOKEN` | a fine-grained PAT scoped to just this repo, **Contents: Read and write** |
| `GITHUB_OWNER` | `MontaniConnect` |
| `GITHUB_REPO` | `paglaum-site` |

Optional, both default sensibly: `GITHUB_BRANCH` (`main`), `GITHUB_FILE_PATH`
(`content.md`).

**Redeploying the function** (needed after changing env vars, or after
editing `api/save-content.js`):

```
vercel --prod --yes
```

## Making changes later

- **Edit text/content:** use `/edit.html` — no code changes needed.
- **Edit layout/design:** edit `index.html` / `style.css` directly, same as
  any static site. Keep each top-level section's `id` and
  `data-section-key` if you want it to stay reorderable from the editor.
- **Add a brand-new kind of section:** add it to `content.md`, give its
  `<section>` in `index.html` a matching `data-section-key`, and add the
  handful of `id`-based bindings in `script.js`'s `renderSite()` for its
  fields (follow the pattern of an existing section like Advocacy).
- **Change the editor's own look:** it's self-contained in `edit.html`
  (styles) and `edit.js` (behavior) — doesn't affect the live site.

## History

Originally built as a generic NCF-style nonprofit landing page template,
then re-skinned with PAGLAUM's real branding, photos, and copy (sourced from
an existing Facebook page and a prior site build). The content was then
pulled out into `content.md` so it could be edited independently of the
HTML, which led to building the section-based editor and, to make saves
from that editor actually persist on a static GitHub Pages site, the small
Vercel backend described above.
