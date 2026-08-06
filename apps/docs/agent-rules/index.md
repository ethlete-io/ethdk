# @ethlete/agent-rules

Portable coding guidance for repos built on the Ethlete SDK - the styleguide, Angular
patterns, signals vs RxJS, theming, query usage and commit conventions - compiled into
whichever coding agent your repo uses: **Claude Code**, **Codex**, **Cursor** and
**GitHub Copilot**.

One canonical content source lives in the SDK; `ethlete-agents sync` renders it into
each tool's native format, so the guidance an agent follows in your app repo is the
same guidance the SDK itself is built with.

## Install & quick start

```bash
yarn add --dev @ethlete/agent-rules
yarn ethlete-agents init   # writes ethlete-agents.config.json
yarn ethlete-agents sync   # writes the generated rules and skills
```

Commit the generated files, and add a drift check to CI:

```bash
yarn ethlete-agents check  # exits non-zero when the generated files are stale
```

## What gets written

Content comes in two kinds. **Rules** are short and always loaded; **skills** are
on-demand guides in the cross-tool [Agent Skills](https://agentskills.io) `SKILL.md`
format, compiled once into `.agents/skills/ethlete-*/` where Codex, Cursor, Copilot and
VS Code discover them natively - each skill's body loads only when its `description`
matches the task, so the always-on context cost stays at a few lines per skill. Claude
Code only scans `.claude/skills/`, so the claude target writes its own copies there.

|                     | Claude Code                         | Cursor                        | Copilot                                        | Codex                       |
| ------------------- | ----------------------------------- | ----------------------------- | ---------------------------------------------- | --------------------------- |
| Always-loaded rules | `.claude/rules/ethlete/*.md`        | `.cursor/rules/ethlete-*.mdc` | inlined into `.github/copilot-instructions.md` | inlined into `AGENTS.md`    |
| On-demand skills    | `.claude/skills/ethlete-*/SKILL.md` | `.agents/skills/ethlete-*/`   | `.agents/skills/ethlete-*/`                    | `.agents/skills/ethlete-*/` |

Marker-block files (`AGENTS.md`, `.github/copilot-instructions.md`) are only rewritten
between `<!-- ethlete:agent-rules:start -->` and `:end` - everything you wrote around
them survives. Every generated file carries a `DO NOT EDIT` banner, and files that
disappear from the package are pruned on the next `sync`; nothing outside an `ethlete`
directory or `ethlete-` prefix is ever touched.

Content that declares `requires` is only emitted when those packages are installed, so
a repo without `@ethlete/query` never sees the query guide.

## Migrating to the AGENTS.md layout

`AGENTS.md` is the cross-tool instruction standard, and Claude Code officially supports
reading it through a one-line `CLAUDE.md` import. `migrate` restructures a repo around
that so every agent reads the same file:

```bash
yarn ethlete-agents migrate --dry-run   # prints the plan
yarn ethlete-agents migrate
```

- `CLAUDE.md` content moves to the top of `AGENTS.md`; `CLAUDE.md` becomes `@AGENTS.md`.
- Hand-written `.claude/skills/<name>` directories move to `.agents/skills/<name>`, with
  a symlink left behind so Claude Code still finds them. (Symlinks need Developer Mode
  on Windows checkouts.)
- A short layout note is added to `AGENTS.md` so agents know the symlinked skills are
  the same files, not duplicates - skipped if yours already explains it.
- The config gains `claudeMdImportsAgentsMd: true`, which stops the claude target from
  writing `.claude/rules/ethlete/` - the rules already reach Claude through the
  `AGENTS.md` marker block, and a second copy would load twice.
- A `sync` runs, which also prunes output from older layouts.

The command is idempotent - every step detects the migrated state and skips itself.

## Configuration

`ethlete-agents.config.json` at the repo root:

```json
{
  "targets": "auto",
  "profile": "consumer",
  "vars": {
    "lintCommand": "yarn nx lint my-app",
    "lintFixCommand": "yarn nx lint my-app --fix",
    "storybookUrl": "http://localhost:6006",
    "themeStylesheet": "apps/web/src/styles/tailwind.css",
    "commitScopes": ["app", "shared", "deps"]
  },
  "exclude": ["git-commit"],
  "hooks": []
}
```

| Option                    | Default      | What it does                                                                                                                                                                               |
| ------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `targets`                 | `"auto"`     | `"auto"` always emits `codex` (`AGENTS.md` + `.agents/skills/` is the cross-tool baseline) and adds `claude`, `cursor`, `copilot` when their directory exists; or list an explicit subset. |
| `profile`                 | `"consumer"` | `"consumer"` emits `scope: consumer` and `scope: both` content; `"sdk"` emits only `both` (used by the SDK repo itself).                                                                   |
| `vars`                    | -            | Values for the template tokens a guide declares. A guide whose variable has no default and no value is skipped with a warning.                                                             |
| `exclude`                 | `[]`         | Content names to skip entirely.                                                                                                                                                            |
| `claudeMdImportsAgentsMd` | `false`      | Set (usually by `migrate`) when `CLAUDE.md` imports `AGENTS.md`; skips `.claude/rules/ethlete/` so rules don't load twice. `sync` warns when the flag is set but the import is missing.    |
| `hooks`                   | `[]`         | Opt-in Claude Code hooks, see below.                                                                                                                                                       |

If your repo runs Prettier over everything, exclude the generated paths - otherwise
Prettier rewrites them and `check` reports drift on every run:

```gitignore
# .prettierignore
/.claude
/.agents
/.cursor/rules/ethlete-*
```

## Hooks

Hooks run commands on the developer's machine, so none are emitted by default - opt in
per hook:

```json
{
  "hooks": ["context-warning"]
}
```

`sync` writes the script to `.claude/hooks/ethlete/` and registers it in
`.claude/settings.json`, leaving your own entries untouched; removing the name from
`hooks` unregisters and deletes it again.

### `context-warning`

Warns you (and instructs Claude) once per tier when the session context grows large,
recommending the handoff skill so work continues in a fresh session instead of a
degraded, expensive one. It fires at 70% / 85% of a token budget that is **capped at
the 200k long-context pricing boundary**: on 1M-window models, every request past 200k
input tokens bills the entire context at a premium rate, so the warnings land at ~140k
and ~170k tokens - before the expensive range - rather than at 70% of the raw window.
On 200k-window models the same fractions apply to the window itself, where the concern
is the imminent auto-compact rather than pricing.

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

| Option                   | What it does                                                                                                                                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `disableHooks`           | `true` disables every generated hook; an array (`["context-warning"]`) just the named ones.                                                                                                                                                                      |
| `disableAutoHandoffSave` | Keeps the `context-warning` hook's tiered warnings but drops the auto-mode escalation: at the critical tier it recommends `/handoff` instead of saving the handoff file itself.                                                                                  |
| `sdkSourcePath`          | Path to a local `ethlete-sdk` checkout, read by the `sdk-source` and `sdk-local-build` skills when the agent needs the SDK's own sources, or has to build the SDK and install it here through a `file:` dependency. A relative path resolves from the repo root. |

Everything in this file is read at runtime - by the generated hook scripts and by the
agent while following a skill - never by `sync`: the generated files stay identical on
every machine and in CI, which is what lets `check` diff them. That is also why the file
takes nothing beyond these keys - `sync`/`check` warn about unknown keys, and about an
`sdkSourcePath` that is missing or is not an SDK checkout. Add the filename to your
repo's `.gitignore`.

## Authoring content

The canonical content lives in the SDK repo under `libs/agent-rules/content/` -
`rules/<name>.md` for always-loaded rules, `skills/<name>/SKILL.md` (plus resource
files) for on-demand guides. Frontmatter controls the kind, scope, required packages
and template variables; see the package README for the authoring reference.

Inside the SDK the package is the source rather than a dependency, so `npx
ethlete-agents` has nothing to resolve. Format the content, then regenerate from the
local build:

```bash
npx prettier --write libs/agent-rules/content/<file>
yarn agents:sync    # yarn agents:check is the same drift check CI runs
```

Formatting after the sync leaves the generated copies stale - they are Prettier-ignored,
so nothing rewrites them and only `agents:check` notices.
