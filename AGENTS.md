# ethlete-sdk

Nx monorepo of publishable `@ethlete/*` libraries under `libs/`.

## Agent file layout

`AGENTS.md` is canonical; `CLAUDE.md` only imports it. Edit and create skills under `.agents/skills/<name>/`
(`.claude/skills/` holds symlinks to them; add one for a new skill). The marker block at the end of this file
is generated - never edit it by hand. Rules and skills for other repos live in `libs/agent-rules/content/`:
format, then `yarn agents:sync` (`libs/agent-rules/AGENTS.md` has the pitfalls).

## Libraries

All under `libs/<name>`, published as `@ethlete/<name>`:

| Lib              | What it is                                                                                                                                 | Depends on (`@ethlete/*`)           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| `types`          | Shared TS types (API, pagination, violations). Framework-agnostic base.                                                                    | -                                   |
| `bracket`        | Framework-free bracket data model, relation graph, prediction resolver, and layout geometry.                                               | -                                   |
| `core`           | Framework primitives: directives, signals utils, overlay runtime, animations, theming, scrolling, drag/resize. Angular but component-less. | `types`                             |
| `query`          | Data fetching / query client: http, gql, ws, auth, query-form.                                                                             | `core`, `types`                     |
| `components`     | **Active** Angular UI library: overlay, menu, button, forms, grid, tabs, tooltip, etc.                                                     | `bracket`, `core`, `query`, `types` |
| `query-devtools` | The `<et-query-devtools>` panel, in three entry points (`.`, `/lazy`, `/toggle`). See below.                                               | `components`, `core`, `query`       |
| `cdk`            | **Maintenance mode** - older UI toolkit. Predecessor of `components`.                                                                      | `core`, `query`, `types`            |
| `contentful`     | Contentful integration (rich-text components, gql, types).                                                                                 | `components`, `core`, `query`       |
| `cli`            | CLI tooling (release helpers).                                                                                                             | -                                   |
| `eslint-plugin`  | Custom ESLint rules + shareable flat configs for the styleguide.                                                                           | -                                   |
| `agent-rules`    | Portable agent rules + skills, compiled for Claude Code / Codex / Cursor / Copilot. See below.                                             | -                                   |

Layering: `types` → `core` → `query` → `components` → `contentful` / `query-devtools`; `bracket` is a
framework-free sibling of `core`. Nothing depends on `cdk` any more.

### query-devtools: why three entry points

`/toggle` must **never** import the other two entry points, so the `@defer` in `/lazy` emits a real
`import(...)`. `libs/query-devtools/AGENTS.md` has the reason and the bundle-size goldens.

### UI work: components vs cdk

- **`components` is the active UI library.** All new UI features go here.
- **`cdk` is in maintenance mode.** Bug fixes only, no new features. When a fix also applies to
  `components`, apply it there too (the code almost always lives there, often more evolved).
- Both libs have near-identical paths (`libs/cdk/.../overlay` vs `libs/components/src/lib/overlay`):
  confirm which lib you are in before editing.

### Styling

The generated **Component styling** block below has the lib CSS rules. Repo specifics:

- **The apps differ:** `apps/ethlete-studio` and `apps/timetrack` style with Tailwind utilities in their
  templates, add no per-component `.css` files, and use SDK components for controls (every button is an `et-button`).
- Tailwind in the libs is allowed **only in story files** (`*.stories.ts`, `stories/`). Storybook's Tailwind theme
  is trimmed and an unknown utility fails silently: read the **`storybook-styling`** skill before styling a story.
- The canonical CSS pattern is `libs/components/src/lib/button/*.component.css`. A sheet past a few hundred
  lines can be split into styles-only components (`libs/components/AGENTS.md`).
- Read the **`theming`** skill before touching any color, background, border, or interaction-state styling.

## Dependencies

This is a **Yarn 4 workspaces** monorepo. After any dependency change - adding/removing a package, or an `nx`
task auto-syncing a lib's `package.json` `dependencies` (it prunes deps you stop importing) - you **must**:

1. Run `yarn install` and commit `yarn.lock` with the `package.json` change. A stale lockfile breaks CI.
2. Re-run lint on the affected libs: the `@nx/dependency-checks` rule fails when declared `dependencies`
   differ from what the source imports.

### Nx Cloud is temporarily off

Every workflow sets `NX_NO_CLOUD: 'true'`; run `export NX_NO_CLOUD=true` locally too. To re-enable, delete
the `env:` block from `.github/workflows/*.yml` (`neverConnectToCloud` does **not** work here).

## Releasing

Every change to a workspace package needs a changeset: every `@ethlete/*` lib, and the private
`timetrack-app`, `ethlete-studio` and `@ethlete/timetrack`. A test or story change names the package with level
`none`; `yarn lint:changesets` fails the push otherwise. Studio ADRs and `plans/**` need none (ADR 0265). Use
the **`changeset`** skill and write the file directly, not via the interactive CLI.

Before a publish, run `yarn release:smoke`. `publish.yml`, the Tauri bundles, signing, the updater key and the
CEF runtime are in the **`app-releases`** skill: read it before touching any of them.

## Documentation

Written docs live in the VitePress site at `apps/docs`, one guide per component domain under
`apps/docs/components/`. Any change to a public API, behavior, or default in `libs/components` must update
the matching guide (or add a page for a new domain) - part of the change, like the changeset. Use the
**`docs`** skill for structure, examples, and verification.

Live demos are `@example <domain>/<name>` lines, each rendering a component from `apps/docs-examples`
(served on `:4403`). Remaining `<StoryEmbed>` pages reference Storybook story ids: when renaming a story title,
grep `apps/docs` for the old id.

## Linting & CI

Lint, Prettier and comment rules are in the generated block below; for judgment calls lint cannot enforce
see the **`styleguide`** skill. To run what CI runs before pushing, use the **`ci-check`** skill. The hooks
run checks on staged files (pre-commit) and on the pushed range (pre-push); fix what they report rather than
skipping them.

Before you change a file or ask a question about it, run `yarn adr:governs <files>` (or `--staged`, or `<a>..<b>`) and read the ADRs it lists.

## Testing beyond unit specs

jsdom specs catch value logic, not behavior regressions. Further layers:

- Storybook (usually `:4400`) is the ground truth: drive real stories headlessly with the
  **`verify-in-storybook`** skill before calling a component change done.

- `libs/query/src/scenarios` (**`query-scenario-tests`**) and `libs/core/src/scenarios`
  (**`core-scenario-tests`**): real app/client against fakes with leak invariants. Every bug fix in
  `libs/query` or `libs/core` adds one.
- `timetrack snapshot` - before a change in `libs/timetrack` or `apps/timetrack` that can change rows, run
  `node dist/libs/agent-rules/src/index.js timetrack snapshot` (build agent-rules first if `dist` is stale);
  after it, run `... snapshot --compare <file>` and explain every changed row in the report. An unexplained
  change is a regression. The file holds client names, so it stays outside the repo.
- `apps/storybook-e2e` - Playwright against real stories (**`component-behavior-tests`**).
- `nx run storybook:test-storybook` - renders every story in Chromium, fails on a thrown or logged error, and
  reports axe violations without failing: check the a11y panel after a UI change.

A spec for a parser of tool output takes its fixture from a captured real run, not hand-written input.

## Slice paths

A slice brief names its allowed paths: at each slice start run `yarn slice:paths "<slice name>" <path>...`
(directories or globs; an exported `ETHLETE_SLICE_PATHS` does not reach a later `git commit` call, and a file
older than 2 h is reported stale). The pre-commit hook then warns, without blocking, about staged paths outside
them; `.changeset/` and `plans/` are always allowed.

<!-- ethlete:agent-rules:start -->
<!-- Generated by @ethlete/agent-rules — DO NOT EDIT. Run `npx ethlete-agents sync`. -->

## Agent sessions

A prompt that starts with `Mailbox message from <sender>:` is a mailbox message from another agent: act
on it. Before you edit a file that another agent may edit, read `.agents/skills/ethlete-agent-sessions/SKILL.md`.

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
   In an application nothing is public API unless it lives in a shared lib other projects
   import, so this case rarely applies to app code.

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
  Z", "renamed for clarity", "see ADR-0012". Git and the ADR index know; the next reader does
  not care.
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
npx nx lint <project> --fix   # auto-fixes first (case, ordering, metadata, …); rename to the $ suffix by hand
npx nx lint <project>      # then re-run to see what needs a manual fix
```

For judgment calls lint cannot enforce, load the repository's focused guidance for the
code you are changing.

Format every edited Prettier-supported source file before wrapping up, in one call over all of
them, not one call per file. Do not send binary,
generated, or unsupported files to this command:

```bash
npx prettier --write <files>
```

## Reactive state

- **Synchronous state → signals.** Never model it with a `BehaviorSubject`/`Subject`.
- **Asynchronous work → RxJS.** HTTP, websockets, debounced streams, event sequences.
- **Bridge, don't copy.** Cross the boundary with `toSignal()` / `toObservable()`, never by
  `.subscribe()`-ing and assigning the value somewhere.

For subscriptions and effects, load the repository's focused reactive-state guidance.

## Component styling

Component styles are **plain CSS** — global `et-`-prefixed classes with
`ViewEncapsulation.None`, in a `.css` file next to the component. **Do not use Tailwind
in component source.** Utilities belong in application templates and story files, not in
the stylesheet a component ships.

**Wrap every component CSS file in `@layer components.sdk { … }`** — the whole file inside
one block. Component CSS is injected as a global `<style>` tag; unlayered, it beats Tailwind v4
utilities (which live in `@layer utilities`) regardless of specificity, because layer
precedence is resolved before specificity — so overriding `.et-button` would need
`flex!` instead of `flex`. `:where()` does not help across layers. Tailwind v4 pre-declares
`@layer theme, base, components, utilities`, so the wrap puts component styles where a
utility can win. `components.sdk` is nested in `components`, and a layer's own rules beat its
nested layers, so an app rule in `@layer components` also wins. Never wrap SDK CSS in plain
`@layer components`: it would tie with the app's rules again.

`:where()` has a separate job: keeping a component's own config modifiers
(`[data-size]`, `[data-variant]`, `[disabled]`) at the same single-class weight as its base
rule, so source order decides. Leave interaction states (`:hover`, `:focus-visible`,
`:active`) bare so they escalate and win.

**Never use a hardcoded colour as the primary value.** Backgrounds, text, borders and
interaction states resolve from the surface and colour theming tokens
(`--et-surface-*-solid`, `--et-theme-color-*`). A static fallback inside
`var(--token, <fallback>)` is permitted, but not required.

Theme **names** (`brand`, `danger`, `dark-elevated`, …) are registered by the application;
the SDK ships none. Never hardcode them as an SDK-defined union or reusable API contract.
If an app-specific example names one, label it as belonging to that app. Semantic colours
resolve by theme `type` (e.g. `injectSemanticColorTheme('error')`).

**Style an SDK component's state through its inputs.** A pressed, active, selected or loading
look comes from the component's state inputs (`pressed`, `pressedColor`, `variant`, `color`),
never from a `!`-utility or an override of an `--et-*` custom property in an app template. If
no input fits, ask the doc session for one instead of building the override.

## Delegating: sonnet by default

A subagent spawned without a `model` would run on the model leading the session, so an expensive
model would do every small job it delegates. The `subagent-model-policy` hook fills in **`sonnet`**
for such a call. Name another model only when the task matches its row below - `opus` only for the
work its row lists:

| Model    | The work it fits                                                                                                                                                                  |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `haiku`  | Lookups and small, fully specified jobs: grep, find, read and summarize files or a CI log, run a command and report, a mechanical edit in named files. Haiku 5.5 does these well. |
| `sonnet` | Scoped work with a clear target: a fix in a named file, a spec, a docs page, a lint cleanup, research that needs reasoning. Sonnet 5.5 is close to opus here and costs less.      |
| `opus`   | Hard work: a bug with no known cause, a change across many files, a review of a diff, and any task sonnet did not finish.                                                         |
| `fable`  | Judgment-heavy work: planning, design, cross-cutting review, leading other subagents. The most expensive of the four, so ask the user before picking it.                          |

Effort follows the prompt, not a parameter: scope the prompt to one question, name what "done"
means, and say "keep it brief" for a lookup. Two calls need no `model` of their own - a named
agent type carries the model and reasoning effort its own definition sets, and a fork always
inherits the parent's model.

A subagent starts cold: it loads the full start context (about 50k tokens) before its first step,
and measured subagents cost as much as the sessions that spawn them. A lookup or job of under about 10 tool
calls stays in the session. Give each subagent one large slice, not several small ones, and name the files and line ranges
in its prompt so it does not search for them. Stop each
background subagent with `TaskStop` once its result is in, so finished ones do not pile up.

A subagent has the same context budget as the session, measured on its own transcript, and the
context-warning hook tells it to hand back at the critical tier. Size each prompt to fit: one
slice of work, the files it needs named, and "keep your context small - no whole big files".
Work that will not fit goes to several subagents in sequence, a fresh one per slice; a subagent
that hands back early names its remaining steps, which become the next one's prompt.

A subagent does not have to be a Claude one. Delegate to a Codex agent where another model
family would answer better - a second opinion, a review of your own diff, a bug hunt your own
reading failed - and whenever the Claude usage limit is close, because a Codex run does not draw
on it. Read `.agents/skills/ethlete-codex-subagent/SKILL.md` first.

## Ethlete skills

On-demand package guides live in `.agents/skills/ethlete-*/SKILL.md`; `ethlete-agents sync` owns and updates them. Third-party skills may be tracked separately in `skills-lock.json`, while repository-authored skills are maintained by the repository. Each skill's frontmatter says when to read it. If your agent does not discover skills on its own, list the directory and read the matching guide before starting that kind of work — do not work from memory.
<!-- ethlete:agent-rules:end -->
