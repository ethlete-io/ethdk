# @ethlete/agent-rules

## 0.1.0-next.5

### Minor Changes

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`6e19999`](https://github.com/ethlete-io/ethdk/commit/6e199997f51b88aaa1860a56a6b96be057ba1205) Thanks [@github-actions](https://github.com/apps/github-actions)! - The `context-warning` hook now runs under Codex as well as Claude Code, registered in
  `.codex/hooks.json` whenever the `codex` target is on.

- [#3049](https://github.com/ethlete-io/ethdk/pull/3049) [`a606dda`](https://github.com/ethlete-io/ethdk/commit/a606dda0695ac8cc4370816bf3ff1c0814436091) Thanks [@TomTomB](https://github.com/TomTomB)! - Add the `figma-export` skill, guiding agents through reconciling a component against a Figma "copy as CSS" export.

### Patch Changes

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`fc56189`](https://github.com/ethlete-io/ethdk/commit/fc56189450a45f2b5819d40945a71205a6d67ba0) Thanks [@github-actions](https://github.com/apps/github-actions)! - The `query` skill now says to prefer `withArgs` over passing `args` to `execute()`, and when the imperative form is still right.

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`a16cc69`](https://github.com/ethlete-io/ethdk/commit/a16cc698a3cd3f14d0419d8f9710929fb41b4711) Thanks [@github-actions](https://github.com/apps/github-actions)! - Figma export skill: read an SVG frame as well as the CSS dump, with a `dump-figma-svg.py`
  that prints its box tree and measures the auto-layout gaps.

## 0.1.0-next.4

### Minor Changes

- [#3045](https://github.com/ethlete-io/ethdk/pull/3045) [`fcd14f0`](https://github.com/ethlete-io/ethdk/commit/fcd14f09b4b09f81b5bde9f128a0fac4b0e2245c) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `disableAutoHandoffSave` to `ethlete-agents.config.local.json`, to opt out of the context-warning hook's auto-mode auto-save at the critical tier while keeping its normal warnings.

### Patch Changes

- [#3045](https://github.com/ethlete-io/ethdk/pull/3045) [`eb1b0a9`](https://github.com/ethlete-io/ethdk/commit/eb1b0a9cfb4e868b13a2b8eb6fd13221a6e0a654) Thanks [@github-actions](https://github.com/apps/github-actions)! - `context-warning` hook: in auto mode, the critical-tier warning now saves a `/handoff` immediately instead of just recommending it.

## 0.1.0-next.3

### Patch Changes

- [`ca0bf2f`](https://github.com/ethlete-io/ethdk/commit/ca0bf2f09cd5bd925da52bdb17c93bb62bda8735) Thanks [@TomTomB](https://github.com/TomTomB)! - The `comments` rule is now an allowlist: four kinds of comment are allowed and everything else gets deleted.

## 0.1.0-next.2

### Minor Changes

- [#3043](https://github.com/ethlete-io/ethdk/pull/3043) [`a311f80`](https://github.com/ethlete-io/ethdk/commit/a311f80455bc9cc9a925fe8f72ac945a1b057315) Thanks [@github-actions](https://github.com/apps/github-actions)! - New `sdk-source` and `sdk-local-build` skills let an agent read the SDK's own sources and test an unreleased build via `file:`, from the checkout named by the local config's new `sdkSourcePath`.

### Patch Changes

- [#3043](https://github.com/ethlete-io/ethdk/pull/3043) [`9627646`](https://github.com/ethlete-io/ethdk/commit/96276462e1c2ecde5394b8b1eafcebbb9f56a973) Thanks [@github-actions](https://github.com/apps/github-actions)! - Styleguide: changeset notes are now capped at one to two sentences, with mechanism and API inventories
  explicitly sent to the docs instead.

## 0.1.0-next.1

### Minor Changes

- [#3042](https://github.com/ethlete-io/ethdk/pull/3042) [`28a58eb`](https://github.com/ethlete-io/ethdk/commit/28a58ebc56420b7e067d8c56108b39601d7b367e) Thanks [@github-actions](https://github.com/apps/github-actions)! - - Skills now compile to the cross-tool `.agents/skills/ethlete-*/SKILL.md` format, discovered natively by Codex, Cursor and Copilot; the `.agents/ethlete/` pointer tree is pruned on sync.
  - New `ethlete-agents migrate` converts a repo to the `AGENTS.md`-canonical layout: `CLAUDE.md` becomes an `@AGENTS.md` import and hand-written skills move to `.agents/skills` with symlinks.
  - New opt-in `hooks` config: `context-warning` warns (and instructs Claude) before the context crosses the 200k long-context pricing boundary, recommending `/handoff`.
  - A gitignored `ethlete-agents.config.local.json` (`"disableHooks": true` or a list of hook names) disables generated hooks per machine at runtime — committed files never change, and `sync`/`check` warn about unsupported keys or unknown hook names in it.

## 0.1.0-next.0

### Minor Changes

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`9808192`](https://github.com/ethlete-io/ethdk/commit/9808192d7af173712284ce3f65d968fc8214393c) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `@ethlete/agent-rules`: the portable Ethlete coding guidance - styleguide, Angular
  patterns, signals vs RxJS, theming, query, commits, Storybook verification - packaged
  for consumer repos and compiled into Claude Code, Codex (`AGENTS.md`), Cursor and
  Copilot formats from one canonical source. `npx ethlete-agents sync` writes the
  generated files, `check` fails CI on drift, and `init` scaffolds the config. Content is
  filtered per repo by installed packages (`requires`), profile (`scope`) and configured
  template variables.

- [`c6ebe63`](https://github.com/ethlete-io/ethdk/commit/c6ebe63aaa8d3a8fbf193baa6706258977adfff6) Thanks [@TomTomB](https://github.com/TomTomB)! - Add the `sdk-docs` guide: where the `@ethlete` docs site and Storybook live, how page URLs
  map to libraries and component domains, and the rule that an API is read rather than
  inferred from a component's name. Aimed at repos that consume the SDK without its source.

### Patch Changes

- [`c6ebe63`](https://github.com/ethlete-io/ethdk/commit/c6ebe63aaa8d3a8fbf193baa6706258977adfff6) Thanks [@TomTomB](https://github.com/TomTomB)! - Render a `{% skill:… %}` cross-reference as a bare name when the guide it points at was
  filtered out of the target repo, instead of emitting a path to a file that was never
  written. `sync` now reports each such reference.
