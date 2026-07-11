# Component guide schema

Every component-domain guide in `apps/docs/components/` follows this skeleton.
`index.md` and `error-codes.md` are exempt. When updating a guide, bring it
closer to this schema; when adding one, follow it exactly. Deviate only where a
section genuinely doesn't apply — never reorder.

## Section order

1. **`# <Domain>` + intro** — 1–3 sentences: what it is and when to use it.
   Name the import (`Import BUTTON_IMPORTS`) and any required provider
   (`provideX()`) here or in an immediately following `## Setup` section.
   Cross-link related guides inline (`[toggletip](/components/toggletip)`).
2. **Canonical usage snippet** — lifted from the domain's maintained stories
   (`stories/components/*.ts`), minimal but runnable.
3. **`## Live demo`** — the primary `<StoryEmbed>`, directly after the first
   snippet (after `## Anatomy` where structure must be explained first).
   Multi-control domains (forms, loader, tabs) may instead embed one story per
   flavor section and skip the standalone heading.
4. **Body sections** — anatomy, options, flavors, feature showcases. Domain
   order is free, but:
   - Options/config go in tables with **source-verified defaults** (read the
     `input()` declarations — never guess).
   - A feature section gets its own `<StoryEmbed>` when a story showcases it
     (search `curl -s http://localhost:4400/index.json` for the id).
   - Showcase the "special" variants a consumer wouldn't discover from the
     options table alone (e.g. context menus, transforming overlay strategies,
     PiP hand-off, drag-to-dismiss).
5. **`## Accessibility`** — required for every interactive domain. Cover:
   roles and aria wiring the component emits, keyboard interaction (use a
   key/action table when more than ~3 keys), focus behavior, and any dev-mode
   a11y enforcement (missing labels/descriptions throwing). Purely decorative
   or non-interactive domains may fold this into another section, but say
   *something* about a11y (e.g. `aria-hidden` on icons). A merged title like
   forms' `## Validation & accessibility` is fine when a11y is inseparable
   from another concern.
6. **`## Theming`** — required when the domain exposes public design tokens
   (`--et-<component>-*` declared via `@property`). List every public token.
   Reiterate that colors come from the app-registered surface/color theme
   systems — never present theme names as an SDK union. If Storybook has a
   design-spec `.docs.mdx` for the domain, link it instead of duplicating the
   full token/spec tables.
7. **`## Error codes`** — required when the domain throws `ETxxxx` codes:
   one sentence naming the domain's range with a link to the matching anchor
   on [/components/error-codes](/components/error-codes) (e.g.
   `/components/error-codes#menu-et13xx`). Keep the per-code tables only on
   the central page. Domains whose allocated range is never thrown skip this.

## Cross-cutting rules

- Verified facts only: every default, selector, input name and behavior claim
  must be checked against `libs/components` source at writing time.
- Keep `{{ }}` inside code fences (Vue interpolation is live in body text).
- Cross-link sibling guides instead of re-explaining their concepts.
- New guide ⇒ sidebar entry in `.vitepress/config.mts` **and** a bullet on
  `components/index.md` (same grouping in both).
- After editing: `npx nx build docs` must pass (dead links fail the build).

## Checklist (run against a guide)

- [ ] Intro states what + when, names imports/providers
- [ ] Canonical snippet before any deep-dive prose
- [ ] Primary story embedded early (or per-flavor embeds)
- [ ] All option tables have source-verified defaults
- [ ] Special variants showcased with embeds where stories exist
- [ ] Accessibility section (roles, keyboard, focus, dev-mode enforcement)
- [ ] Theming section listing all public `--et-*` tokens (or design-spec link)
- [ ] Error codes section linking the domain's range (if it throws)
- [ ] Sibling guides cross-linked
