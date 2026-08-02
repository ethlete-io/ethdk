# @ethlete/agent-rules

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
