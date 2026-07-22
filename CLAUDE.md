# ethlete-sdk

Nx monorepo of publishable `@ethlete/*` libraries under `libs/`.

## Libraries

All under `libs/<name>`, published as `@ethlete/<name>`:

| Lib             | What it is                                                                                                                                 | Depends on (`@ethlete/*`) |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| `types`         | Shared TS types (API, pagination, violations). Framework-agnostic base.                                                                    | —                         |
| `core`          | Framework primitives: directives, signals utils, overlay runtime, animations, theming, scrolling, drag/resize. Angular but component-less. | `types`                   |
| `query`         | Data fetching / query client: http, gql, ws, auth, query-form.                                                                             | `core`, `types`           |
| `components`    | **Active** Angular UI library: overlay, menu, button, forms, grid, tabs, tooltip, etc.                                                     | `core`, `query`           |
| `cdk`           | **Maintenance mode** — older UI toolkit. Predecessor of `components`.                                                                      | `core`, `query`, `types`  |
| `contentful`    | Contentful integration (rich-text components, gql, types).                                                                                 | `cdk`, `core`, `query`    |
| `cli`           | CLI tooling (release helpers).                                                                                                             | —                         |
| `eslint-plugin` | Custom ESLint rules + shareable flat configs for the styleguide.                                                                           | —                         |

Rough layering: `types` → `core` → (`query`, `components`) ; `cdk` → `contentful`.

### UI work: components vs cdk

- **`components` is the active UI library.** All new UI features go here.
- **`cdk` is in maintenance mode.** Bug fixes are fine, but do **not** add new
  features there. When a fix also applies to `components`, apply it there too; the
  equivalent code almost always lives there (often more evolved).
- Many things exist in both libs with near-identical paths (e.g.
  `libs/cdk/.../overlay` vs `libs/components/src/lib/overlay`). Confirm which lib
  you're in before editing — new feature work goes in `libs/components`.

### Styling

Component styles are plain CSS (global `et-`-prefixed classes,
`ViewEncapsulation.None`) — see the `.css` files next to each component. **Do not
use Tailwind in component source.** Tailwind utility classes are allowed **only in
story files** (`*.stories.ts` and `stories/`), for demo layout.

#### Cascade layers: every component CSS file is wrapped in `@layer components`

**All component CSS in `libs/components` is wrapped in `@layer components { … }`,
and new/edited files must keep doing so** (put the entire file inside one such
block). This is what lets consumers override component styles with a Tailwind
utility — `flex`, `p-4`, etc. — without `!important`.

Why: component CSS is injected via `ViewEncapsulation.None` as global `<style>`
tags. If it were **unlayered**, it would beat Tailwind v4 utilities (which live in
`@layer utilities`) **regardless of specificity** — layer precedence is resolved
before specificity, so a consumer was forced to escalate to `flex!`. `:where()`
does **not** fix this: lowering specificity is irrelevant across layers (an
unlayered `:where(.et-button)` still beats a layered `.flex`). Wrapping in
`@layer components` does fix it, because Tailwind v4 pre-declares
`@layer theme, base, components, utilities`, so `components` sorts before
`utilities` and utilities win. (Consequence: any consumer rule that is unlayered
or in a later layer now wins over component styles by default — that is the
intended, well-behaved-library direction.)

`:where()` has a **separate** job: **flattening internal specificity** so a
component's own config modifiers (`[data-size]`, `[data-variant]`, `[disabled]`)
stay at the same single-class weight as the base rule, resolved by source order —
see the `&:where([data-size='…'])` / `&:where([disabled])` pattern in
`libs/components/src/lib/button/*.component.css`. Interaction states (`:hover`,
`:focus-visible`, `:active`) are deliberately left bare so they escalate and win.
`:where()` is orthogonal to the layer wrap, not a substitute for it.

All colors in component CSS must come from the **surface theming** and **color
theming** token systems (`--et-surface-*-solid`, `--et-theme-color-*`) — never
hardcode colors. Read the **`theming`** skill (`.claude/skills/theming/`) before
touching any color, background, border, or interaction-state styling.

Theme **names** (`brand`, `danger`, `dark-elevated`, …) are registered by the
consuming app — the SDK defines none. Don't hardcode name unions in types, docs,
or examples; semantic colors resolve via theme `type` (e.g. `injectErrorTheme()`).

## Dependencies

This is a **Yarn 4 workspaces** monorepo (`packageManager: yarn@4.17.1`). After
any dependency change — adding/removing a package, or when an `nx` task
auto-syncs a lib's `package.json` `dependencies` (it prunes deps you stop
importing) — you **must**:

1. Run `yarn install` to update `yarn.lock`, then commit the lockfile alongside
   the `package.json` change. A stale lockfile breaks CI.
2. Re-run lint on the affected libs. The `@nx/dependency-checks` ESLint rule
   (in each lib's `eslint.config.mjs`) validates that a lib's declared
   `dependencies` match what its source actually imports — a mismatch is a lint
   error, not just a warning.

## Releasing

Every change to a published package needs a changeset. Use the **`changeset`**
skill (`.claude/skills/changeset/`) — write the file directly; don't run the
interactive `npx changeset` CLI.

## Documentation

Written docs live in the VitePress site at `apps/docs` (deployed per branch),
with one guide per component domain under `apps/docs/components/`. Any change to
a public API, behavior, or default in `libs/components` must update the matching
guide (or add a new page for a new domain) — treat it like the changeset: part
of the change, not a follow-up. Use the **`docs`** skill
(`.claude/skills/docs/`) for structure, story embeds (`<StoryEmbed>`), and
verification. Docs embeds reference Storybook story ids — when renaming a story
title, grep `apps/docs` for the old id.

## Linting & style

Run lint with `--fix` — most styleguide rules have auto-fixers, so let them do the
work before fixing anything by hand:

```bash
npx nx lint <project> --fix
```

The rules live in `@ethlete/eslint-plugin`. For the judgment calls lint can't
enforce (signals vs RxJS, templates, lifecycle/DI patterns, etc.), see the
**`styleguide`** skill.

After editing any file, format it with Prettier before wrapping up (config is
`.prettierrc.js`):

```bash
npx prettier --write <files>
```

## Verifying UI changes

Storybook is the ground truth and usually runs on `:4400`. Use the
**`verify-in-storybook`** skill to drive real stories headlessly before
considering a component change done.
