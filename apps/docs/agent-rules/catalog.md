# Content catalog

These are the rules, skills and integrations shipped by `@ethlete/agent-rules`. The
identifiers in the first column are the exact names accepted by the relevant config
option or CLI command.

## How content is selected

Rules and skills pass through four filters before `sync` emits them:

1. `profile` selects `consumer` plus `both`, or only `both` for the SDK profile.
2. Content with `requires` is kept only when that package is installed.
3. Every declared template variable must have a configured, derived or default value.
4. Names in `exclude` are removed for every agent and developer in the repository.

The gitignored local config never changes emitted rules or skills. It holds runtime,
machine-specific values only, keeping generated output identical locally and in CI.

## Always-loaded rules

| Name              | Guidance                                                                                                                 | Availability                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| `comments`        | Allows comments only for timing constraints, type-inexpressible invariants, documented workarounds and public API JSDoc. | All profiles                           |
| `lint-and-format` | Runs lint with auto-fixes first and formats every edited file before completion.                                         | All profiles                           |
| `reactive-state`  | Uses signals for synchronous state, RxJS for asynchronous work and bridges rather than copied state.                     | All profiles                           |
| `styling`         | Keeps component styling in plain layered CSS and resolves every color through theme tokens.                              | All profiles; requires `@ethlete/core` |

Rules are always loaded by the configured agents. Use `exclude` when a repository has
its own replacement for one of them.

## On-demand skills

| Name                  | Use it for                                                                                                    | Availability                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `angular-patterns`    | Choosing and structuring Angular components, directives, services, pipes, templates and lifecycle behavior.   | All profiles; requires `@ethlete/core`              |
| `api-source`          | Reading a configured backend checkout to verify API behavior without editing that checkout.                   | Consumer profile                                    |
| `figma-export`        | Reconciling rendered components with SVG and CSS exports from Figma.                                          | All profiles                                        |
| `git-commit`          | Writing commitlint-compatible, scoped, lean commit messages.                                                  | All profiles                                        |
| `git-flow`            | Naming, basing and targeting feature, sub-feature, release and hotfix branches.                               | All profiles                                        |
| `handoff`             | Saving work state for a fresh agent session or resuming a saved handoff.                                      | All profiles                                        |
| `query`               | Building with the signals-first query client, reactive arguments, auth, polling, pagination and RxJS bridges. | Consumer profile; requires `@ethlete/query`         |
| `rxjs-signals`        | Choosing between signals and RxJS, managing subscriptions and avoiding streams inside effects or computeds.   | All profiles; requires `@ethlete/core`              |
| `sdk-docs`            | Finding the authoritative SDK guide or Storybook documentation before using an unfamiliar API.                | Consumer profile                                    |
| `sdk-local-build`     | Building an unreleased SDK checkout and temporarily installing it through a `file:` dependency.               | Consumer profile                                    |
| `sdk-source`          | Reading a configured SDK checkout when published docs and installed types are insufficient.                   | Consumer profile                                    |
| `story-styling`       | Styling Storybook stories with the repository's trimmed Tailwind theme.                                       | Consumer profile; requires `@ethlete/core`          |
| `styleguide`          | Applying the TypeScript and Angular judgment calls that lint cannot enforce.                                  | Consumer profile; requires `@ethlete/eslint-plugin` |
| `theming`             | Using surface and semantic color theming, including across overlays and portals.                              | Consumer profile; requires `@ethlete/core`          |
| `timetrack`           | Reading and writing Jira data through the running Timetrack app without repository credentials.               | All profiles                                        |
| `verify-in-storybook` | Driving a Storybook story with Playwright to verify DOM, styles, animations and interactions.                 | Consumer profile                                    |

Skills are emitted in the Agent Skills `SKILL.md` format and load on demand. Their
frontmatter descriptions tell each agent when the guide applies.

## Agent hooks

Agent hooks are not emitted by default. Add their names to `hooks`; a local
`disableHooks` setting can then turn all or selected generated hooks off on one machine.

| Name              | Targets               | Event              | Behavior                                                                                                                                                          |
| ----------------- | --------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context-warning` | Claude Code and Codex | `UserPromptSubmit` | Warns at 70% and 85% of the effective context or long-context pricing budget and recommends or saves a handoff before quality degrades or premium pricing starts. |

For Codex, [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol),
[Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra),
[Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna),
[GPT-5.5](https://developers.openai.com/api/docs/models/gpt-5.5) and
[GPT-5.4](https://developers.openai.com/api/docs/models/gpt-5.4) use their documented
272k long-context pricing boundary. Other models use the context window reported in
the rollout. The runtime window takes precedence when it is smaller than a pricing
boundary.

## Git hooks

Git hooks are also opt-in. Add their names to `gitHooks`; `sync` appends a generated
block to the corresponding Husky file without replacing existing hook logic.

| Name            | Behavior                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `pre-push`      | Runs `git-flow check --push` for the current branch. Advisory mode only blocks direct pushes to protected base branches. |
| `post-checkout` | Reports a non-conforming local branch before it reaches a remote and becomes expensive to rename.                        |

`ETHLETE_GIT_FLOW_SKIP=1` silences both generated git hooks on one machine.

## Output styles

Output styles are installed explicitly and are not part of `sync` or `check`.

| Name          | Target      | Behavior                                                                                                           |
| ------------- | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| `ste-clarity` | Claude Code | Writes prose in ASD-STE100 Simplified Technical English while preserving code, identifiers, paths and quoted text. |

Install and activate the shipped style with:

```bash
yarn ethlete-agents output-style
```
