# ethlete-sdk

Nx monorepo of publishable `@ethlete/*` libraries under `libs/`.

## Libraries

All under `libs/<name>`, published as `@ethlete/<name>`:

| Lib             | What it is                                                                                                                                 | Depends on (`@ethlete/*`) |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| `types`         | Shared TS types (API, pagination, violations). Framework-agnostic base.                                                                    | -                         |
| `core`          | Framework primitives: directives, signals utils, overlay runtime, animations, theming, scrolling, drag/resize. Angular but component-less. | `types`                   |
| `query`         | Data fetching / query client: http, gql, ws, auth, query-form.                                                                             | `core`, `types`           |
| `components`    | **Active** Angular UI library: overlay, menu, button, forms, grid, tabs, tooltip, etc.                                                     | `core`, `query`           |
| `cdk`           | **Maintenance mode** - older UI toolkit. Predecessor of `components`.                                                                      | `core`, `query`, `types`  |
| `contentful`    | Contentful integration (rich-text components, gql, types).                                                                                 | `cdk`, `core`, `query`    |
| `cli`           | CLI tooling (release helpers).                                                                                                             | -                         |
| `eslint-plugin` | Custom ESLint rules + shareable flat configs for the styleguide.                                                                           | -                         |

Rough layering: `types` → `core` → (`query`, `components`) ; `cdk` → `contentful`.

### UI work: components vs cdk

- **`components` is the active UI library.** All new UI features go here.
- **`cdk` is in maintenance mode.** Bug fixes are fine, but do **not** add new
  features there. When a fix also applies to `components`, apply it there too; the
  equivalent code almost always lives there (often more evolved).
- Many things exist in both libs with near-identical paths (e.g.
  `libs/cdk/.../overlay` vs `libs/components/src/lib/overlay`). Confirm which lib
  you're in before editing - new feature work goes in `libs/components`.

### Styling

Component styles are plain CSS (global `et-`-prefixed classes,
`ViewEncapsulation.None`) - see the `.css` files next to each component. **Do not
use Tailwind in component source.** Tailwind utility classes are allowed **only in
story files** (`*.stories.ts` and `stories/`), for demo layout - and the playground's
Tailwind theme is trimmed (no default color palette, no `text-sm`-style scale), so
read the **`storybook-styling`** skill (`.claude/skills/storybook-styling/`) before
styling a story. An unknown utility emits nothing and fails silently.

The cascade-layer wrap (`@layer components { … }` around every component CSS file),
why it - and not `:where()` - is what lets a consumer override component styles, and
the separate job `:where()` does for internal modifiers are all in the
`.claude/rules/ethlete/styling.md` rule, which loads every session. The canonical
`&:where([data-size='…'])` / `&:where([disabled])` pattern lives in
`libs/components/src/lib/button/*.component.css`.

#### Splitting a large stylesheet: styles-only components

A component's CSS is injected when that component is **first instantiated**, and a
`@Component` with an empty template exists only to carry a stylesheet. Together those
two facts are how a big sheet stops being a tax on every consumer:

- **CSS that belongs to a stamped child** goes on that child (e.g. the table's expander
  chrome lives on `table-expander-cell.component.css`) - a table without expansion never
  creates the cell, so the rules never reach the document.
- **CSS that belongs to an opt-in feature** goes in a styles-only component the _feature_
  references, mounted with `injectStyleManager().mount(TheStylesComponent)` - see
  `ButtonStylesDirective` / `ButtonPropertiesStylesComponent`, and
  `etTableVirtualScroll` → `TableVirtualScrollStylesComponent`. Because only the feature
  references it, an app that doesn't import the feature doesn't bundle its CSS either.
- **CSS for a base capability that most tables don't use** (the table's detail-row
  animation) can be mounted on demand from an `effect` when the capability turns on. That
  saves injection and style recalculation, not bundle size - the reference is still static.

The style manager de-duplicates per component type, so mounting from many instances
injects one `<style>`. Reach for this when a sheet grows past a few hundred lines and an
identifiable slice of it serves a minority of consumers - `form-field` is the next
candidate.

Read the **`theming`** skill (`.claude/skills/theming/`) before touching any color,
background, border, or interaction-state styling - the token systems, the DI-based
semantic colors, and the "theme names are app-registered" rule are all there.

## Dependencies

This is a **Yarn 4 workspaces** monorepo (`packageManager: yarn@4.17.1`). After
any dependency change - adding/removing a package, or when an `nx` task
auto-syncs a lib's `package.json` `dependencies` (it prunes deps you stop
importing) - you **must**:

1. Run `yarn install` to update `yarn.lock`, then commit the lockfile alongside
   the `package.json` change. A stale lockfile breaks CI.
2. Re-run lint on the affected libs. The `@nx/dependency-checks` ESLint rule
   (in each lib's `eslint.config.mjs`) validates that a lib's declared
   `dependencies` match what its source actually imports - a mismatch is a lint
   error, not just a warning.

## Releasing

Every change to a published package needs a changeset. Use the **`changeset`**
skill (`.claude/skills/changeset/`) - write the file directly; don't run the
interactive `npx changeset` CLI.

## Documentation

Written docs live in the VitePress site at `apps/docs` (deployed per branch),
with one guide per component domain under `apps/docs/components/`. Any change to
a public API, behavior, or default in `libs/components` must update the matching
guide (or add a new page for a new domain) - treat it like the changeset: part
of the change, not a follow-up. Use the **`docs`** skill
(`.claude/skills/docs/`) for structure, story embeds (`<StoryEmbed>`), and
verification. Docs embeds reference Storybook story ids - when renaming a story
title, grep `apps/docs` for the old id.

## Linting & style

Lint (`npx nx lint <project> --fix` first), Prettier, and the comment rules live in
`.claude/rules/ethlete/`, generated from `@ethlete/agent-rules` and loaded every
session. For the judgment calls lint can't enforce (signals vs RxJS, templates,
lifecycle/DI patterns), see the **`styleguide`** skill.

## Agent rules & skills for other repos

`libs/agent-rules` publishes `@ethlete/agent-rules`: the portable slice of this repo's
guidance, compiled into Claude Code, Codex, Cursor and Copilot formats by
`npx ethlete-agents sync`. Content lives in `libs/agent-rules/content/`; what this repo
itself consumes is configured in `ethlete-agents.config.json` (`profile: sdk`, so only
`scope: both` content is emitted here). Never hand-edit anything under
`.claude/rules/ethlete/` - edit the content file and re-run sync.

## Verifying UI changes

Storybook is the ground truth and usually runs on `:4400`. Use the
**`verify-in-storybook`** skill to drive real stories headlessly before
considering a component change done.
