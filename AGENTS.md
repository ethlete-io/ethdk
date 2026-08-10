# ethlete-sdk

Nx monorepo of publishable `@ethlete/*` libraries under `libs/`.

## Agent file layout

`AGENTS.md` is canonical; `CLAUDE.md` is just an `@AGENTS.md` import. Skills live in
`.agents/skills/<name>/`; the entries in `.claude/skills/` are symlinks to them (Claude
Code only scans there) - same file, not a duplicate. Edit and create skills under
`.agents/skills/`, plus a symlink for new ones. The `ethlete:agent-rules` marker block
at the end of this file is generated - never edit it by hand.

## Libraries

All under `libs/<name>`, published as `@ethlete/<name>`:

| Lib              | What it is                                                                                                                                 | Depends on (`@ethlete/*`)     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| `types`          | Shared TS types (API, pagination, violations). Framework-agnostic base.                                                                    | -                             |
| `core`           | Framework primitives: directives, signals utils, overlay runtime, animations, theming, scrolling, drag/resize. Angular but component-less. | `types`                       |
| `query`          | Data fetching / query client: http, gql, ws, auth, query-form.                                                                             | `core`, `types`               |
| `components`     | **Active** Angular UI library: overlay, menu, button, forms, grid, tabs, tooltip, etc.                                                     | `core`, `query`, `types`      |
| `query-devtools` | The `<et-query-devtools>` panel, in three entry points (`.`, `/lazy`, `/toggle`). See below.                                               | `components`, `core`, `query` |
| `cdk`            | **Maintenance mode** - older UI toolkit. Predecessor of `components`.                                                                      | `core`, `query`, `types`      |
| `contentful`     | Contentful integration (rich-text components, gql, types).                                                                                 | `components`, `core`, `query` |
| `cli`            | CLI tooling (release helpers).                                                                                                             | -                             |
| `eslint-plugin`  | Custom ESLint rules + shareable flat configs for the styleguide.                                                                           | -                             |
| `agent-rules`    | Portable agent rules + skills, compiled for Claude Code / Codex / Cursor / Copilot. See below.                                             | -                             |

Rough layering: `types` → `core` → `query` → `components` → `contentful` /
`query-devtools`. No published lib depends on `cdk` any more - it is a leaf in the lib
graph (only the playground's `cdk/*` demo pages still import it).

### query-devtools: why three entry points

ng-packagr flattens a library into one FESM per entry point, which rewrites a `@defer`'s
dynamic import into `Promise.resolve().then(...)` - so a deferred component in the _same_
entry point can never be split out of a consumer's bundle. Only a cross-entry-point defer
emits a real `import(...)`. Hence:

- `@ethlete/query-devtools/toggle` - the floating button, the shortcut label and the
  view-state key. A leaf: it must **never** import the other two, or ng-packagr fails the
  build with a circular entry-point dependency.
- `@ethlete/query-devtools` - the panel. Imports the toggle entry.
- `@ethlete/query-devtools/lazy` - the shell an application mounts. Imports the toggle
  entry statically and the panel entry only through its `@defer`.

Measured: mounting the panel eagerly costs an app ~125 kB gz; through the shell, ~3 kB up
front and the rest on first open. `tools/treeshake` guards both numbers.

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
read the **`storybook-styling`** skill (`.agents/skills/storybook-styling/`) before
styling a story. An unknown utility emits nothing and fails silently.

The cascade-layer wrap (`@layer components { … }` around every component CSS file),
why it - and not `:where()` - is what lets a consumer override component styles, and
the separate job `:where()` does for internal modifiers are all in the **Component
styling** section of the generated block at the end of this file. The canonical
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

Read the **`theming`** skill (`.agents/skills/theming/`) before touching any color,
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

### Nx Cloud is temporarily off

The self-hosted instance (`nx-cloud.braune-digital.com`) is unstable, so every workflow
sets `NX_NO_CLOUD: 'true'`. Export the same locally - `export NX_NO_CLOUD=true` - to skip
remote caching and the run-link lookup. Nothing else about `nx` changes. Re-enable by
deleting the `env:` block from `.github/workflows/*.yml`; the token in `nx.json` was left
in place. (`neverConnectToCloud` does **not** work here - it only blocks _new_ connections,
and this workspace is already connected.)

## Releasing

Every change to a published package needs a changeset. Use the **`changeset`**
skill (`.agents/skills/changeset/`) - write the file directly; don't run the
interactive `npx changeset` CLI.

## Documentation

Written docs live in the VitePress site at `apps/docs` (deployed per branch),
with one guide per component domain under `apps/docs/components/`. Any change to
a public API, behavior, or default in `libs/components` must update the matching
guide (or add a new page for a new domain) - treat it like the changeset: part
of the change, not a follow-up. Use the **`docs`** skill
(`.agents/skills/docs/`) for structure, story embeds (`<StoryEmbed>`), and
verification. Docs embeds reference Storybook story ids - when renaming a story
title, grep `apps/docs` for the old id.

## Linting & style

Lint (`npx nx lint <project> --fix` first), Prettier, and the comment rules live in
the generated block at the end of this file (from `@ethlete/agent-rules`). For the
judgment calls lint can't enforce (signals vs RxJS, templates, lifecycle/DI
patterns), see the **`styleguide`** skill.

To run what CI runs before pushing - format, changesets, lint, test, build, bundle-size
goldens, Storybook build - use the **`ci-check`** skill (`.agents/skills/ci-check/`).

## Agent rules & skills for other repos

`libs/agent-rules` publishes `@ethlete/agent-rules`: the portable slice of this repo's
guidance, compiled into Claude Code, Codex, Cursor and Copilot formats. Content lives in
`libs/agent-rules/content/`; what this repo itself consumes is configured in
`ethlete-agents.config.json` (`profile: sdk`, so only `scope: both` content is emitted
here). Never hand-edit the generated marker block at the end of this file or a generated
`ethlete-*` skill - edit the content file in `libs/agent-rules/content/`, then:

```bash
npx prettier --write libs/agent-rules/content/<file>   # format first
yarn agents:sync                                       # then regenerate
```

Format **before** syncing. The generated copies under `.claude/` and `.agents/` are
Prettier-ignored, so formatting the content afterwards silently leaves them stale, and
`yarn agents:check` (which CI runs) fails. The `npx ethlete-agents sync` in the published
README works in consumer repos only - here the package is the source, not a dependency,
so `npx` would look it up on the registry and 404.

## Verifying UI changes

Storybook is the ground truth and usually runs on `:4400`. Use the
**`verify-in-storybook`** skill to drive real stories headlessly before
considering a component change done.

<!-- ethlete:agent-rules:start -->
<!-- Generated by @ethlete/agent-rules v0.1.0-next.5 — DO NOT EDIT. Run `npx ethlete-agents sync`. -->

## Comments: almost none, and never for the reviewer of your change

**Write no comment unless it fits one of the four cases below.** This is an allowlist, not a
set of tips. Anything outside it gets **deleted** before you call the change done — not
softened, not shortened. Code that needs prose to be understood needs a better name, a
smaller function, or a type; fix that instead of narrating it.

### The only comments allowed

1. **An ordering or timing constraint** a reasonable edit would break. Say what breaks.
2. **An invariant the types cannot express**, that a caller or a future edit could violate.
3. **A workaround**, naming its concrete cause (browser bug, upstream issue, framework
   limitation) and linking it where a link exists, so the next reader can tell when it may go.
4. **Public API JSDoc** — what it does and how to call it, on something a lib actually
   exports. One or two sentences. Not internals, not history, not why it is shaped that way.

Nothing else qualifies. Not "this is subtle", not "worth noting", not a heading over a group
of members, not a summary of the function underneath it.

### The test each one still has to pass

Delete it unless **both** are true:

- a competent reader who never sees your diff would be **surprised** without it, and
- a future edit could **break something** that this sentence is the only warning about.

Unsure counts as no. A missing comment costs a minute of reading; a stale one misleads for
years.

### Always delete

- **Restating the code** — `// increment the counter` over `counter++`; a JSDoc on `size` that
  says nothing beyond "the size of the button".
- **Section headers and dividers** — `// --- Inputs ---`, `// Helpers`, `// Public API`.
- **Rationale for a mechanical choice** — `Record<Size, X>` with literal keys, a `@__PURE__`
  annotation, a factory instead of a literal, a helper moved into its own file. The type, the
  annotation and the import already say what happens.
- **Migration narration** — "moved here from X", "used to be a tuple", "so Y no longer pulls
  Z", "renamed for clarity". Git knows; the next reader does not care.
- **The same explanation at every call site.** Explain a pattern once where it is defined (the
  helper's JSDoc, the lint rule's message, the guide) and let every use site stay silent.
- **Commented-out code.**
- **`TODO`/`FIXME` without an issue link.** Fix it now or leave nothing.
- **Hedging and meta** — "note that", "for clarity", "just in case", "this is cleaner", "we
  could also…".

### Before you call the change done

Re-read every comment in your diff and cut the ones that are not one of the four. Then fix or
delete any existing comment your change made wrong — one describing behaviour that no longer
exists is worse than none.

Two signals you have already over-commented: you wrote the word "because", or the diff adds
more than a handful of comments. Both mean go back and cut.

## Linting & formatting

Run lint with `--fix` — most styleguide rules in `@ethlete/eslint-plugin` ship auto-fixers,
so let them do the work before correcting anything by hand:

```bash
npx nx lint <project> --fix   # auto-fixes first (case, ordering, $ suffix, metadata, …)
npx nx lint <project>      # then re-run to see what needs a manual fix
```

For the judgment calls lint cannot enforce — signals vs RxJS, templates, lifecycle and DI
patterns — see `styleguide`.

After editing any file, format it before wrapping up:

```bash
npx prettier --write <files>
```

## Reactive state

- **Synchronous state → signals.** Never model it with a `BehaviorSubject`/`Subject`.
- **Asynchronous work → RxJS.** HTTP, websockets, debounced streams, event sequences.
- **Bridge, don't copy.** Cross the boundary with `toSignal()` / `toObservable()`, never by
  `.subscribe()`-ing and assigning the value somewhere.

Subscriptions, effects, and the traps in each direction: `rxjs-signals`.

## Component styling

Component styles are **plain CSS** — global `et-`-prefixed classes with
`ViewEncapsulation.None`, in a `.css` file next to the component. **Do not use Tailwind
in component source.** Utilities belong in application templates and story files, not in
the stylesheet a component ships.

**Wrap every component CSS file in `@layer components { … }`** — the whole file inside one
block. Component CSS is injected as a global `<style>` tag; unlayered, it beats Tailwind v4
utilities (which live in `@layer utilities`) regardless of specificity, because layer
precedence is resolved before specificity — so overriding `.et-button` would need
`flex!` instead of `flex`. `:where()` does not help across layers. Tailwind v4 pre-declares
`@layer theme, base, components, utilities`, so the wrap puts component styles where a
utility can win.

`:where()` has a separate job: keeping a component's own config modifiers
(`[data-size]`, `[data-variant]`, `[disabled]`) at the same single-class weight as its base
rule, so source order decides. Leave interaction states (`:hover`, `:focus-visible`,
`:active`) bare so they escalate and win.

**Never hardcode a colour.** Backgrounds, text, borders and interaction states all resolve
from the surface and colour theming tokens (`--et-surface-*-solid`, `--et-theme-color-*`) —
see `theming`.

Theme **names** (`brand`, `danger`, `dark-elevated`, …) are registered by the application;
the SDK ships none. Never hardcode a theme-name union in a type, a doc or an example —
semantic colours resolve by theme `type` (e.g. `injectErrorTheme()`).

## Ethlete skills

On-demand guides live in `.agents/skills/ethlete-*/SKILL.md`; each one's frontmatter says when to read it. If your agent does not discover skills on its own, list that directory and read the matching guide before starting that kind of work — do not work from memory.
<!-- ethlete:agent-rules:end -->
