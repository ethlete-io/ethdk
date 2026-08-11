# @ethlete/agent-rules

The portable slice of the Ethlete coding guidance - styleguide, Angular patterns,
signals vs RxJS, theming, query, commits - compiled into whichever coding agent your
repo uses.

One canonical source, four outputs: **Claude Code**, **Codex** (`AGENTS.md`),
**Cursor** and **GitHub Copilot**.

## Installation

```bash
yarn add --dev @ethlete/agent-rules
npx ethlete-agents init   # writes ethlete-agents.config.json
npx ethlete-agents sync   # writes the generated rules and skills
```

Commit the generated files, and add a drift check to CI:

```bash
npx ethlete-agents check  # exits non-zero when the generated files are stale
```

## What gets written

Skills are compiled once into `.agents/skills/ethlete-*/SKILL.md` - the cross-tool
[Agent Skills](https://agentskills.io) format that Codex, Cursor, Copilot and VS Code
discover natively (each skill's body loads on demand from its `description`
frontmatter). Claude Code only scans `.claude/skills/`, so the claude target writes its
own copies there. Rules are always-loaded and go into each tool's native mechanism:

|                     | Claude Code                         | Cursor                                              | Copilot                                        | Codex                               |
| ------------------- | ----------------------------------- | --------------------------------------------------- | ---------------------------------------------- | ----------------------------------- |
| Always-loaded rules | `.claude/rules/ethlete/*.md`        | `.cursor/rules/ethlete-*.mdc` (`alwaysApply: true`) | inlined into `.github/copilot-instructions.md` | inlined into `AGENTS.md`            |
| On-demand skills    | `.claude/skills/ethlete-*/SKILL.md` | `.agents/skills/ethlete-*/SKILL.md`                 | `.agents/skills/ethlete-*/SKILL.md`            | `.agents/skills/ethlete-*/SKILL.md` |

Marker-block files (`AGENTS.md`, `.github/copilot-instructions.md`) are only rewritten
between `<!-- ethlete:agent-rules:start -->` and `:end` - everything you wrote around
them survives.

## Migrating a repo to the AGENTS.md layout

`AGENTS.md` is the cross-tool standard, and Claude Code officially supports reading it
through a one-line `CLAUDE.md` import. To restructure a whole repo around that:

```bash
npx ethlete-agents migrate --dry-run   # prints the plan
npx ethlete-agents migrate
```

- `CLAUDE.md` content moves to the top of `AGENTS.md`; `CLAUDE.md` becomes `@AGENTS.md`.
- Hand-written `.claude/skills/<name>` directories move to `.agents/skills/<name>`, with
  a symlink left behind so Claude Code still finds them. (Symlinks need Developer Mode
  on Windows checkouts.)
- A short layout note is added to `AGENTS.md` so agents know the symlinked skills are
  the same files, not duplicates - skipped if your `AGENTS.md` already explains it.
- The config gains the `codex` target and `claudeMdImportsAgentsMd: true`, which stops
  the claude target from writing `.claude/rules/ethlete/` - the rules already reach
  Claude through the `AGENTS.md` marker block, and a second copy would load twice.
- A `sync` runs, which also prunes output from older layouts (`.agents/ethlete/`,
  `.github/instructions/ethlete-*`).

The command is idempotent - every step detects the migrated state and skips itself.

Every generated file carries a `DO NOT EDIT` banner. Files that disappear from the
package are pruned on the next `sync`; nothing outside an `ethlete` directory or an
`ethlete-` prefix is ever touched.

If your repo runs Prettier over everything, exclude the generated paths - otherwise
Prettier rewrites them and `check` then reports drift on every run:

```gitignore
# .prettierignore
/.claude
/.agents
/.cursor/rules/ethlete-*
```

## Configuration

`ethlete-agents.config.json` at the repo root:

```json
{
  "targets": "auto",
  "profile": "consumer",
  "vars": {
    "lintCommand": "npx nx lint my-app",
    "lintFixCommand": "npx nx lint my-app --fix",
    "storybookUrl": "http://localhost:6006",
    "themeStylesheet": "apps/web/src/styles/tailwind.css",
    "commitScopes": ["app", "shared", "deps"]
  },
  "exclude": ["git-commit"]
}
```

- **`targets`** - `"auto"` (default) always emits `codex` (`AGENTS.md` plus
  `.agents/skills/` is the cross-tool baseline) and adds `claude`, `cursor` or `copilot`
  when their directory exists; or list an explicit subset.
- **`profile`** - `"consumer"` (default) emits `scope: consumer` and `scope: both`
  content. `"sdk"` emits only `both`; the SDK repo uses it so its own hand-written,
  authoring-side guides are not overwritten by the consumer-side versions.
- **`vars`** - values for the template tokens a guide declares. Defaults live in
  `content/defaults.json`; a guide whose variable has no default and no value is
  skipped with a warning rather than emitted with a dangling placeholder.
- **`exclude`** - content names to skip entirely.
- **`claudeMdImportsAgentsMd`** - set (usually by `migrate`) when `CLAUDE.md` is an
  `@AGENTS.md` import or symlink; the claude target then skips `.claude/rules/ethlete/`
  so the rules don't load twice. `sync` warns when the flag is set but the import is
  missing.

Content that declares `requires` is only emitted when those packages are installed, so
a repo without `@ethlete/query` never sees the query guide.

## Git flow

The branch convention lives in the same config, as one machine-readable grammar that the
CLI, a git hook, a CI job and `@ethlete/timetrack` all read:

```json
{
  "gitFlow": {
    "keyPrefixes": ["FIP"],
    "baseBranches": { "development": "next", "production": "main" }
  }
}
```

```bash
npx ethlete-agents git-flow start FIP-2177          # name it and branch off the right base
npx ethlete-agents git-flow check                   # the current branch
npx ethlete-agents git-flow check "$SOURCE" --target "$TARGET"
npx ethlete-agents git-flow check --all             # adoption report
npx ethlete-agents git-flow repair dev-game-codes --key FIP-2900
npx ethlete-agents git-flow explain feat/FIP-2177-user-management
```

The shapes:

| Shape                                      | Branch from             | Merges into                    |
| ------------------------------------------ | ----------------------- | ------------------------------ |
| `feat/<KEY>-<subject>`                     | development             | development                    |
| `sub/feat/<KEY>-<subject>/<KEY>-<subject>` | the main feature branch | the main feature branch        |
| `release/<YYYY.MM.DD>`                     | development             | development **and** production |
| `sub/release/<YYYY.MM.DD>/<KEY>-<subject>` | the release branch      | the release branch             |
| `hotfix/<KEY>-<subject>`                   | production              | production                     |

**Why nested branches carry a `sub/` prefix.** Git refuses a ref that is both a branch and
a directory of branches, so `feat/FIP-2177-user-management/FIP-2178-reset` cannot exist
while `feat/FIP-2177-user-management` does - the push is rejected with `refname conflict`.
The prefix moves the nested tree out of the way while keeping the parent's full path inside
the child's name, so the merge request target is still derivable from the name alone. The
unprefixed spelling still parses, reports why it cannot exist, and `repair` moves it.
Configurable as `subPrefix`.

- **`enforcement`** - `"advisory"` (default) reports everything and blocks nothing, so a
  repo can adopt the convention before it gates on it. `"gated"` applies each rule's
  `severity`. A direct push to a base branch is blocked in both modes, and
  `wrong-mr-target` can be raised to `"error"` on its own without ending the naming
  grace period.
- **`keyPrefixes`** - the project's issue prefixes. Leave it empty and anything shaped
  like `keyPattern` counts, which reads `chore/angular-22` as issue `ANGULAR-22`.
- **`severity`** - per rule: `unknown-type`, `missing-key`, `key-case`,
  `missing-subject`, `type-alias`, `deprecated-prefix`, `release-date`,
  `wrong-mr-target`, `protected-push`.
- **`deprecatedShapes`** - legacy spellings that still classify correctly and only earn a
  rename suggestion. `dev-*` ships as the old spelling of a main feature branch.

The grammar is also importable on its own - `@ethlete/agent-rules/git-flow` has no
dependencies and touches no Node built-ins, so it runs in a browser:

```ts
import { parseBranch, planStart, resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';

const { storyKey, taskKey, findings } = parseBranch({ branch, config: resolveGitFlowConfig() });
```

### `start` - the prospective flow

`git-flow start <KEY>` reads the issue from Jira, computes the name from the grammar and
creates the branch off the correct base. It prints the plan first and asks before writing;
`--dry-run` stops after the plan and `--yes` skips the question. It refuses on a dirty
working tree, when the branch already exists, and when the base branch is nowhere to be
found.

A Task with a parent Story nests under that Story's feature branch, which therefore has to
exist already - `start` says so rather than inventing a parent. `--of <branch>` picks the
parent explicitly, `--hotfix` branches off production, `--release <date>` makes a release
branch, and `--subject <text>` skips Jira entirely.

Jira needs a host, an email and an API token. Only the host belongs in the committed
config; the two secrets come from `JIRA_EMAIL` / `JIRA_API_TOKEN` or from the gitignored
local config.

```json
{
  "jira": {
    "host": "https://your-team.atlassian.net",
    "subjectField": "customfield_10050",
    "typeByIssueType": { "Bug": "fix" }
  }
}
```

- **`subjectField`** - the field holding a Story's branch subject. Without it the summary
  is slugified, which is a paraphrase rather than the agreed subject.
- **`typeByIssueType`** - the branch type per Jira issue type; anything unlisted becomes
  `feat`. `--type` overrides it per call.

### `repair` - renaming a branch that does not conform

`git-flow repair [ref]` derives the conforming name (`--key FIP-2900` when the old name
carries no issue key, `--to <branch>` to override), renames the branch locally and on the
remote, and retargets the open merge requests aimed at it through the GitLab API.
`GITLAB_TOKEN` needs the `api` scope.

Everything is checked before the first mutation, and it refuses rather than half-finishing:

- An open merge request whose **source** is the branch blocks the repair. GitLab cannot
  move a merge request to another source branch, and closing it would lose its discussion -
  merge or close it first.
- A branch that is pushed but whose merge requests cannot be listed (no token, or a remote
  that is not GitLab) blocks too. `--no-mr-check` asserts that none point at it.
- If a retarget fails halfway, the old branch is still there and the recovery commands are
  printed.

## Hooks (opt-in)

Hooks run commands on the developer's machine, so none are emitted by default - opt in
per hook in the config:

```json
{
  "hooks": ["context-warning"]
}
```

They are emitted for whichever of the `claude` and `codex` targets is enabled:

| Target   | Script                   | Registered in           |
| -------- | ------------------------ | ----------------------- |
| `claude` | `.claude/hooks/ethlete/` | `.claude/settings.json` |
| `codex`  | `.codex/hooks/ethlete/`  | `.codex/hooks.json`     |

Your own entries in those files are left untouched; removing the name from `hooks`
unregisters and deletes the script again. Codex only loads project-local hooks once the
`.codex/` layer is trusted, and honours `[features] hooks = false`.

Available hooks:

- **`context-warning`** - warns once per tier (and instructs the agent) when the session
  context crosses 70% / 85% of the token budget, recommending a handoff. Under Claude the
  budget is capped at the 200k long-context pricing boundary: on 1M-window models every
  request past 200k input tokens bills the whole context at a premium rate, so the
  warnings fire at ~140k/~170k instead of deep into the expensive range. Codex has no
  such boundary, so its budget is the model's own reported context window and the
  warnings are pure occupancy.

  Two things are Claude-only: the separate user-facing line (Codex documents only
  `additionalContext`, so there the warning is folded into the text the model is told to
  relay), and the auto-mode escalation that writes the handoff file unprompted - Codex's
  `permission_mode` values are undocumented, so no value enables it.

Hooks can be turned off per machine - see the local config below.

## Git hooks (opt-in)

Separate from the agent hooks above, and opt-in for the same reason - a generated block
that can reject a push is a higher-stakes artifact than a markdown one:

```json
{
  "gitHooks": ["pre-push", "post-checkout"]
}
```

Each one is written as an `# ethlete:git-flow:start` … `end` block **appended** to your
`.husky/<name>`, so an existing hook there (a git-lfs hook, typically) keeps working and
keeps reading stdin first - which is why the block never reads stdin itself. Removing the
name from `gitHooks` takes the block back out and leaves the rest of the file alone.

- **`pre-push`** - runs `git-flow check --push` on the current branch. In `advisory` mode
  only a direct push to a base branch can actually stop it.
- **`post-checkout`** - reports a non-conforming name on a branch that is on no remote yet,
  which is the whole window in which renaming it is free.

Only `.husky/` is written, never `.git/hooks/`: the generated files are committed and CI's
`check` diffs them, so a hook outside the working tree could never be in sync. Without a
`.husky/` directory `sync` warns and writes nothing. The block calls
`node_modules/.bin/ethlete-agents` directly rather than through `npx`, so a repo where the
package is missing gets silence instead of a registry lookup that would fail the push.
`ETHLETE_GIT_FLOW_SKIP=1` silences both hooks on one machine.

## CI job

On GitLab, the merge request target is the half no local hook can see. The job needs no
configuration beyond the predefined variables:

```yaml
Git Flow:
  stage: Checks
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  allow_failure: true
  script:
    - >
      npx ethlete-agents git-flow check "$CI_MERGE_REQUEST_SOURCE_BRANCH_NAME"
      --target "$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"
```

`allow_failure: true` on top of `advisory` mode is deliberate belt and braces: the job
reports for a whole grace period before it can ever be the reason a merge request is red.

## Per-machine local config

A gitignored `ethlete-agents.config.local.json` at the repo root holds the values that
differ per developer, without touching any committed file:

```json
{
  "disableHooks": true,
  "sdkSourcePath": "/absolute/path/to/ethlete-sdk",
  "jira": { "email": "you@example.com", "token": "…" }
}
```

- **`disableHooks`** - `true` disables every generated hook; an array
  (`["context-warning"]`) just the named ones. The hook scripts read the file at
  runtime, so toggling takes effect on the next prompt - no `sync` needed.
- **`disableAutoHandoffSave`** - keeps the `context-warning` hook's tiered warnings but
  drops the auto-mode escalation: at the critical tier it recommends `/ethlete-handoff`
  instead of saving the handoff file itself.
- **`jira`** - the credentials `git-flow start` needs (`host`, `email`, `token`). This is
  the one place in a repo a secret may sit, and only because the file is gitignored;
  `JIRA_EMAIL` / `JIRA_API_TOKEN` in the environment are the alternative and win over it.
- **`sdkSourcePath`** - a local `ethlete-sdk` checkout. The `sdk-source` and
  `sdk-local-build` skills read it when the agent needs the SDK's own sources, or has to
  build the SDK and install it here through a `file:` dependency. A relative path is
  resolved from the repo root.

Everything in this file is read at runtime, never by `sync`: the generated files stay
identical on every machine and in CI, which is what lets `check` diff them. That is also
why the file takes nothing beyond these keys - `sync`/`check` warn about unknown keys,
and about an `sdkSourcePath` that is missing or is not an SDK checkout. Add the filename
to your repo's `.gitignore`.

## Authoring content

`content/rules/<name>.md` for short, always-loaded rules; `content/skills/<name>/SKILL.md`
for on-demand guides, with any resource files as siblings.

```yaml
---
name: theming
description: Read before writing any color, background or border CSS.
kind: skill # rule | skill
scope: consumer # consumer | sdk | both
requires: ['@ethlete/core'] # optional
paths: ['**/*.css'] # optional; becomes Claude `paths` and Cursor `globs` on rules
vars: [docsBaseUrl] # optional
---
```

In a body, `{% varName %}` substitutes a variable, `{% skill:other-name %}` links to
another guide the way the current target expects, and `{% resource:file.mjs %}` links to
a bundled file. The delimiter is `{% … %}`, not `{{ … }}`, so Angular templates in
examples pass through untouched. Resource files get variable substitution too, but no
links.
