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
npx ethlete-agents git-flow check                   # the current branch
npx ethlete-agents git-flow check "$SOURCE" --target "$TARGET"
npx ethlete-agents git-flow check --all             # adoption report
npx ethlete-agents git-flow explain feat/FIP-2177-user-management
```

The shapes are `feat/<KEY>-<subject>`, a sub-feature nested under it
(`feat/<KEY>-<subject>/<KEY>-<subject>`), `release/<YYYY.MM.DD>`, a fix nested under a
release, and `hotfix/<KEY>-<subject>`.

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
import { parseBranch, resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';

const { storyKey, taskKey, findings } = parseBranch({ branch, config: resolveGitFlowConfig() });
```

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

## Per-machine local config

A gitignored `ethlete-agents.config.local.json` at the repo root holds the values that
differ per developer, without touching any committed file:

```json
{
  "disableHooks": true,
  "sdkSourcePath": "/absolute/path/to/ethlete-sdk"
}
```

- **`disableHooks`** - `true` disables every generated hook; an array
  (`["context-warning"]`) just the named ones. The hook scripts read the file at
  runtime, so toggling takes effect on the next prompt - no `sync` needed.
- **`disableAutoHandoffSave`** - keeps the `context-warning` hook's tiered warnings but
  drops the auto-mode escalation: at the critical tier it recommends `/ethlete-handoff`
  instead of saving the handoff file itself.
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
