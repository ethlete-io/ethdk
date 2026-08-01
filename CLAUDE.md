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
story files** (`*.stories.ts` and `stories/`), for demo layout — and the playground's
Tailwind theme is trimmed (no default color palette, no `text-sm`-style scale), so
read the **`storybook-styling`** skill (`.claude/skills/storybook-styling/`) before
styling a story. An unknown utility emits nothing and fails silently.

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

#### Splitting a large stylesheet: styles-only components

A component's CSS is injected when that component is **first instantiated**, and a
`@Component` with an empty template exists only to carry a stylesheet. Together those
two facts are how a big sheet stops being a tax on every consumer:

- **CSS that belongs to a stamped child** goes on that child (e.g. the table's expander
  chrome lives on `table-expander-cell.component.css`) — a table without expansion never
  creates the cell, so the rules never reach the document.
- **CSS that belongs to an opt-in feature** goes in a styles-only component the _feature_
  references, mounted with `injectStyleManager().mount(TheStylesComponent)` — see
  `ButtonStylesDirective` / `ButtonPropertiesStylesComponent`, and
  `etTableVirtualScroll` → `TableVirtualScrollStylesComponent`. Because only the feature
  references it, an app that doesn't import the feature doesn't bundle its CSS either.
- **CSS for a base capability that most tables don't use** (the table's detail-row
  animation) can be mounted on demand from an `effect` when the capability turns on. That
  saves injection and style recalculation, not bundle size — the reference is still static.

The style manager de-duplicates per component type, so mounting from many instances
injects one `<style>`. Reach for this when a sheet grows past a few hundred lines and an
identifiable slice of it serves a minority of consumers — `form-field` is the next
candidate.

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

### Comments: write for the next reader of this file, not for the reviewer of your change

A comment earns its place by telling someone **using or editing this code** something the
code cannot. Explaining _why the change was made_ is not that — it belongs in the commit
message, the changeset, or `apps/docs`.

Do **not** leave behind:

- **Rationale for a mechanical choice.** `Record<Size, X>` with literal keys, a `@__PURE__`
  annotation, a factory instead of a literal, a helper moved to another file — the type,
  the annotation and the import already say what happens. Nobody reading `button.component.ts`
  needs a paragraph on bundler purity.
- **Migration narration.** "moved here from X", "used to be a tuple", "so Y no longer pulls Z".
  Git knows. A reader six months from now does not care.
- **The same explanation repeated per call site.** If a pattern needs explaining, explain it
  once where the pattern is defined (the helper's JSDoc, the lint rule's message, the guide)
  and let every use site stay silent.
- **Restating the code.** `// increment the counter` above `counter++`.

Do keep: non-obvious behaviour and ordering constraints, a real invariant a future edit could
break, a workaround with the reason it exists, and public API JSDoc (what it does and how to
use it — not why it is shaped that way).

When you catch yourself writing "because", check whether the sentence is aimed at the reviewer
of your diff. If it is, cut it.

## Verifying UI changes

Storybook is the ground truth and usually runs on `:4400`. Use the
**`verify-in-storybook`** skill to drive real stories headlessly before
considering a component change done.
