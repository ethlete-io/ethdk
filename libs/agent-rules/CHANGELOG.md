# @ethlete/agent-rules

## 0.1.0-next.15

### Patch Changes

- [`e7e4604`](https://github.com/ethlete-io/ethdk/commit/e7e4604629b3b0362996c228d581c915bbf795c0) Context warnings now distinguish sub-agent pressure from the main session and track each thread independently.

## 0.1.0-next.14

### Minor Changes

- [#3075](https://github.com/ethlete-io/ethdk/pull/3075) [`1d38e7e`](https://github.com/ethlete-io/ethdk/commit/1d38e7e0a025769f065d8ca7d506cb75ad89139a) Thanks [@github-actions](https://github.com/apps/github-actions)! - `et update` moves the `@ethlete/*` packages to a newer version, runs the codemods those versions
  declare in their own `migrations.json`, and reports what needs a decision or an agent.

## 0.1.0-next.13

### Minor Changes

- [`b6fe4be`](https://github.com/ethlete-io/ethdk/commit/b6fe4beae010aaa2e0e367d636f6759442983395) Thanks [@TomTomB](https://github.com/TomTomB)! - `sdkSourcePath`, `apiRepoPaths` and `apiRepoBranches` moved to `ethlete.config.local.json`, owned by
  `@ethlete/cli`. The old file is still read, and reports where they went.

## 0.1.0-next.12

### Patch Changes

- [#3069](https://github.com/ethlete-io/ethdk/pull/3069) [`a258308`](https://github.com/ethlete-io/ethdk/commit/a258308e0753eb65d08b3d7fb9a9f14507229047) Thanks [@github-actions](https://github.com/apps/github-actions)! - Agent rules: make generated guidance safer, reference-aware, example-validated, and cheaper to load.

- [#3069](https://github.com/ethlete-io/ethdk/pull/3069) [`973462e`](https://github.com/ethlete-io/ethdk/commit/973462ebb9ec7c2eef1aca3fc9f01615824d0074) Thanks [@github-actions](https://github.com/apps/github-actions)! - Agent rules: warn about unknown exclusions and apply Codex model-specific long-context pricing limits in the context warning hook.

## 0.1.0-next.11

### Patch Changes

- [`16ae17e`](https://github.com/ethlete-io/ethdk/commit/16ae17e30238ef4539f3e168ca8299a4546ac292) Thanks [@TomTomB](https://github.com/TomTomB)! - The theming skill now states that a component which tints with `--et-theme-color-primary-opacity`
  must compose the color itself, and that an `@property` `initial-value` cannot use a font-relative or
  container unit.

## 0.1.0-next.10

### Minor Changes

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`226fd3d`](https://github.com/ethlete-io/ethdk/commit/226fd3d0b52f1a131ccbaa417ffe96682752d3f8) Thanks [@github-actions](https://github.com/apps/github-actions)! - New `ethlete-agents output-style` command: it installs the `ste-clarity` ASD-STE100 output style into Claude Code's user config and switches to it. Claude Code only.

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`3657156`](https://github.com/ethlete-io/ethdk/commit/36571560c755468459a87da9d9ec5764d976ee96) Thanks [@github-actions](https://github.com/apps/github-actions)! - `ethlete-agents timetrack instance` reports the Jira instance's own levels and the custom fields a
  branch subject could go in, so a setup step reads the answer instead of guessing it.

## 0.1.0-next.9

### Minor Changes

- [`ae165cc`](https://github.com/ethlete-io/ethdk/commit/ae165cc4123e3f2abaa88c5cfd8262b13aac81d1) Thanks [@TomTomB](https://github.com/TomTomB)! - New `api-source` skill reads the API repo of the app you are in, from the local config's new `apiRepoPaths` map (`{ "hub": "../fut-hub-backend" }`).

- [`f132d0b`](https://github.com/ethlete-io/ethdk/commit/f132d0b64e322c5823c9f50adeedecf388c5aa65) Thanks [@TomTomB](https://github.com/TomTomB)! - `ethlete-agents timetrack` reaches Jira through the running Timetrack app, so no repository holds a
  token any more — the `jira` credentials in the local config and the `JIRA_*` variables are gone.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`fef4586`](https://github.com/ethlete-io/ethdk/commit/fef45868b10b0a0f01efff741958d65d9e405a31) Thanks [@github-actions](https://github.com/apps/github-actions)! - `git-flow`: add `conformingNameFor()`, which names what a non-conforming branch should be renamed to, and `git-flow repair` now handles a keyless branch it previously refused.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`fef4586`](https://github.com/ethlete-io/ethdk/commit/fef45868b10b0a0f01efff741958d65d9e405a31) Thanks [@github-actions](https://github.com/apps/github-actions)! - `git-flow`: export `featureBranchesFor()` and `nestedSpecFor()`, so a host can plan a nested branch without running the CLI.

## 0.1.0-next.8

### Patch Changes

- [#3058](https://github.com/ethlete-io/ethdk/pull/3058) [`7074ffc`](https://github.com/ethlete-io/ethdk/commit/7074ffcb99812faed82a4e32fa3f8a1a43fcaf9d) Thanks [@github-actions](https://github.com/apps/github-actions)! - The `sdk-docs` skill points agents at the docs site's `llms.txt` index and the `.md` suffix on any page URL, so a page can be found and read without guessing a URL from the hardcoded domain list.

- [#3058](https://github.com/ethlete-io/ethdk/pull/3058) [`86fce5b`](https://github.com/ethlete-io/ethdk/commit/86fce5b87770ef4d5b069e59fec745eae93fda7b) Thanks [@github-actions](https://github.com/apps/github-actions)! - The `sdk-source` skill points at `apps/storybook/`, the SDK repo's renamed Storybook host.

## 0.1.0-next.7

### Minor Changes

- [#3056](https://github.com/ethlete-io/ethdk/pull/3056) [`8aec5ff`](https://github.com/ethlete-io/ethdk/commit/8aec5ff1a3ea6dd459d0e00bc691468019dcaca6) Thanks [@github-actions](https://github.com/apps/github-actions)! - Generated files no longer stamp the package version into their banner, so a release bump alone no longer reports every repo as out of sync - only real content changes do.

### Patch Changes

- [#3056](https://github.com/ethlete-io/ethdk/pull/3056) [`b5f72d6`](https://github.com/ethlete-io/ethdk/commit/b5f72d6bf35dd0e49cf14588b651012fb5d6a7c5) Thanks [@github-actions](https://github.com/apps/github-actions)! - The git-commit guide now presents its format as the repo's own convention unless a commitlint config is actually there, instead of pointing every repo at a `commitlint.config.js` it may not have.

## 0.1.0-next.6

### Minor Changes

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`86cd6e9`](https://github.com/ethlete-io/ethdk/commit/86cd6e97072d38436650ddc94a15527da34fa946) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add the git-flow branch convention: a `git-flow` skill, `ethlete-agents git-flow start|check|repair|explain`, opt-in git hooks, and the parser at `@ethlete/agent-rules/git-flow`.

### Patch Changes

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`01b0797`](https://github.com/ethlete-io/ethdk/commit/01b0797d80df17e740419402034bc3eec739daaf) Thanks [@github-actions](https://github.com/apps/github-actions)! - The context-warning hook now points at `/ethlete-handoff`, the name the generated skill actually has, instead of a `/handoff` command that does not exist in a consumer repo.

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
