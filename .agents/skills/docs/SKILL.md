---
name: docs
description: Update or add pages on the VitePress documentation site (apps/docs) when library code changes. Use whenever a public API, component behavior, option, or default in libs/components (or another documented lib) is added, changed, or removed - and when shipping a new component domain that needs a new guide page.
---

# Documentation site (`apps/docs`)

The written docs are a VitePress site in `apps/docs`, deployed per branch
(`main` → https://ethlete-sdk-docs.web.app, `next` → https://ethlete-sdk-docs-next.web.app).
Storybook stays the interactive ground truth for development; the docs site holds
the prose guides and live examples a consumer can copy.

## When docs must change

Treat docs like the changeset: part of finishing the change, not a follow-up.

**This page is where the depth goes.** The mechanism, the trade-offs, the reason a
default is what it is, the gotcha a consumer will hit - all of it belongs here,
and *only* here. The changeset gets a TL;DR (see the **`changeset`** skill); if
you catch yourself explaining how something works in a changeset note, it means
this page is missing a paragraph.

- **Public API added/renamed/removed** (component, directive, input, exported
  function, provider) → update the matching guide in `apps/docs/components/`.
- **Behavior or default changed** → fix every guide statement that's now wrong
  (grep `apps/docs` for the old name/value).
- **New component domain** → new guide page + sidebar entry + overview listing
  (see below).
- Internal-only refactors need no docs change.

## Structure

| Path | Purpose |
| --- | --- |
| `apps/docs/components/<domain>.md` | One guide per domain (`button.md`, `forms.md`, `overlays.md`, …) |
| `apps/docs/components/index.md` | Components overview - grouped guide list; keep in sync with the sidebar |
| `apps/docs/.vitepress/config.mts` | Nav + grouped sidebar (`Floating & overlays`, `Elements`, `Forms`, `Layout & structure`, `Feedback & media`, `Utilities`) |
| `apps/docs/.vitepress/examples-plugin.ts` | Expands `@example <domain>/<name>` lines (see below) |
| `apps/docs/.vitepress/theme/Example.vue` | The example iframe (registered globally as `<Example>`) |
| `apps/docs/.vitepress/theme/StoryEmbed.vue` | The legacy story-embed component (`<StoryEmbed>`) |
| `apps/docs-examples/src/examples/<domain>/` | The example files, one standalone component each |

## Guide schema

Every component guide follows the section skeleton in **`SCHEMA.md`** (same
directory as this file) - intro/import → snippet → live demo → body sections
with verified-default tables → Accessibility → Theming → Error codes link.
Read it before writing or restructuring a guide, and run its checklist when
reviewing one.

## Writing style

- Code-first: lead with a canonical usage snippet (lift it from the domain's
  examples in `apps/docs-examples`, or its stories when it has none yet).
- **Yarn, never npm/npx** in install and run snippets (docs pages *and* package
  READMEs): `yarn add [--dev] @ethlete/<name>`, `yarn nx …`, `yarn eslint …` -
  the team uses yarn everywhere (root `yarn.lock`).
- Options as tables with **verified defaults** - read the source, don't guess.
- Short sections; cross-link sibling guides (`/components/overlays`).
- Don't duplicate Storybook design-spec `.docs.mdx` pages (buttons have these) -
  link to them instead.
- Color/surface **theme names are app-registered, not SDK built-ins** - never
  present names like `brand` or `danger` as an SDK-defined union. Frame them as
  examples ("the themes this repo's Storybook registers") and describe semantic
  behavior via theme `type` (e.g. `type: 'error'`). See the components overview
  page's warning box and the `theming` skill.
- Vue interpolation is live in markdown body text - keep `{{ }}` inside code
  fences only.

## Examples

New and migrated guides show live demos with `@example`, not `<StoryEmbed>`. A line of its own:

```md
@example select/select-country
@example select/select-option-group 360px
```

expands at build time into an `<Example>` iframe (default height `420px`) and a `::: code-group`
with `apps/docs-examples/src/examples/select/select-country.example.ts` and its
`select-country.data.ts` if one exists. The code lands in the page and in `llms.txt`. A missing
file fails the build. Example iframes share no Storybook channel, so the story-embed limit
below does not apply.

Add an example:

1. Write `apps/docs-examples/src/examples/<domain>/<name>.example.ts` - one standalone component,
   selector `app-<name>-example`. Long demo data goes in `<name>.data.ts`.
2. Register it in `src/examples/<domain>/index.ts` (`'<domain>/<name>': () => import(...)`); a new
   domain map is spread into `src/examples/index.ts`.
3. The file is what a consumer copies, so: public `@ethlete/*` imports only, no Tailwind, no
   `et-sb-` selectors, no Storybook wrapper markup, no static `style` attributes (CSP lint). The app
   lays out the example's host as a column; themes come from the app config
   (`src/app/app.config.ts`), so `brand` is the default and needs no `etProvideColor`.
4. Run `npx nx lint docs-examples` and `npx nx typecheck docs-examples`.

`nx serve docs` starts the examples dev server on `:4403` with it; the iframe uses it in dev and
the same-origin `/examples/` (the copied `docs-examples` build) in a built site.

## Story embeds (legacy)

Pages not yet migrated still embed Storybook stories. Don't add new ones.

```md
<StoryEmbed id="components-overlays-menu--default" height="420px" />
```

- `id` is the Storybook story id. List them from a running Storybook (`:4400`):
  `curl -s http://localhost:4400/index.json` → `entries[*].id` (type `story`).
- The iframe is lazy-loaded and the Storybook base URL is auto-detected from the
  docs host (localhost → `:4400`, `-next` host → next Storybook, else main) -
  don't hardcode a base unless you have a reason (`base` prop exists).
- Renaming a story title changes its id - grep `apps/docs` for the old id when
  retitling stories.
- **Max ~4 embeds per page.** All embedded `iframe.html` instances are
  same-origin with each other and join Storybook's shared `storybook-channel`
  BroadcastChannel; with ~6–7 live iframes on one page, later stories hang at
  `sb-show-preparing-story` (or hit `sb-show-errordisplay`) and never render
  (verified 2026-07 by reproducing with 7 plain iframes vs 2). Pick the most
  visually distinctive stories, describe the rest in prose - or split the page.

## Build & verify

```bash
npx nx build docs        # strict build; fails on dead links
```

For behavioral verification, serve the build (`npx vitepress preview apps/docs --port 4873`,
background, **run from the repo root** - it resolves paths against cwd) and run the
ready-made checker over the pages you touched:

```bash
node .claude/skills/docs/scripts/verify-pages.mjs /cdk/ /cdk/table /components/menu
```

It checks per page that the `h1` renders, that every `.story-embed` iframe
(after `scrollIntoView()` - they're lazy) reaches `body.sb-show-main` and that every
`.docs-example` iframe renders its component, and exits non-zero on failure. Story
embeds need Storybook on `:4400`. Notes: `vitepress preview`
serves a stale snapshot after a rebuild - restart it before verifying; a first
run may need a retry for stories the Storybook dev server compiles on demand.
If you script it yourself instead, the `verify-in-storybook` gotchas apply
(repo-local `playwright`, `domcontentloaded`, never `networkidle`).

## Storybook side

For API-heavy topics, a lean `.docs.mdx` next to the stories (with
`<Meta title="…" />` matching the stories title) can summarize the essentials
and link to the full VitePress guide - see
`libs/components/src/lib/overlay/stories/overlay-opener.docs.mdx` for the
pattern. Optional for most domains; prefer it when the Storybook autodocs page
alone would mislead.
