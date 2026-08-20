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

See the [content catalog](/agent-rules/catalog) for every rule, skill, agent hook, git
hook and output style shipped by the package, including the exact names used in config.

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
  "hooks": [],
  "gitHooks": []
}
```

| Option                    | Default      | What it does                                                                                                                                                                               |
| ------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `targets`                 | `"auto"`     | `"auto"` always emits `codex` (`AGENTS.md` + `.agents/skills/` is the cross-tool baseline) and adds `claude`, `cursor`, `copilot` when their directory exists; or list an explicit subset. |
| `profile`                 | `"consumer"` | `"consumer"` emits `scope: consumer` and `scope: both` content; `"sdk"` emits only `both` (used by the SDK repo itself).                                                                   |
| `vars`                    | -            | Values for the template tokens a guide declares. A guide whose variable has no default and no value is skipped with a warning.                                                             |
| `exclude`                 | `[]`         | Rule or skill names to skip for every configured agent and developer. `sync` removes previously generated copies and warns about unknown names.                                            |
| `claudeMdImportsAgentsMd` | `false`      | Set (usually by `migrate`) when `CLAUDE.md` imports `AGENTS.md`; skips `.claude/rules/ethlete/` so rules don't load twice. `sync` warns when the flag is set but the import is missing.    |
| `hooks`                   | `[]`         | Opt-in Claude Code and Codex hooks, see below.                                                                                                                                             |
| `gitHooks`                | `[]`         | Opt-in checks appended to existing Husky hooks, see below.                                                                                                                                 |

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

`sync` emits hooks for whichever `claude` and `codex` targets are enabled. It leaves
your own registrations untouched; removing a name from `hooks` unregisters and deletes
the generated script again.

| Target      | Script directory         | Registration file       |
| ----------- | ------------------------ | ----------------------- |
| Claude Code | `.claude/hooks/ethlete/` | `.claude/settings.json` |
| Codex       | `.codex/hooks/ethlete/`  | `.codex/hooks.json`     |

### `context-warning`

Warns once per tier, and instructs the agent, when the session context crosses 70% and
85% of its effective budget. Claude's budget is capped at its 200k long-context pricing
boundary. Codex uses the 272k pricing boundary for GPT-5.6, GPT-5.5 and GPT-5.4, and
the rollout's reported window for models without that pricing rule. A reported window
smaller than a pricing boundary always wins.

Claude additionally gets a separate user-facing warning and can save a handoff
automatically in auto mode at the critical tier. Codex receives the warning through
the hook's additional context; its permission-mode values are not documented, so the
hook never enables automatic saving there.

Hooks can be turned off per machine - see the local config below.

## Git hooks

Git hooks are separate from agent hooks and are also opt-in:

```json
{
  "gitHooks": ["pre-push", "post-checkout"]
}
```

`sync` appends a generated block to the matching `.husky/<name>` file and preserves
the rest of the hook. `pre-push` checks the current branch before a push;
`post-checkout` reports a non-conforming local branch while renaming it is still cheap.
Removing a name takes only the generated block back out. Without a `.husky/` directory,
`sync` warns and writes nothing. Set `ETHLETE_GIT_FLOW_SKIP=1` to silence both hooks on
one machine.

## Per-machine local config

A gitignored `ethlete-agents.config.local.json` at the repo root holds the agent behaviour
that differs per developer, without touching any committed file:

```json
{
  "disableHooks": true,
  "disableAutoHandoffSave": true
}
```

| Option                   | What it does                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `disableHooks`           | `true` disables every generated hook; an array (`["context-warning"]`) just the named ones.                                                                                    |
| `disableAutoHandoffSave` | Keeps the `context-warning` hook's tiered warnings but drops the auto-mode escalation: at the critical tier it recommends a handoff instead of saving the handoff file itself. |

Everything in this file is read at runtime - by the generated hook scripts and by the
agent while following a skill - never by `sync`: the generated files stay identical on
every machine and in CI, which is what lets `check` diff them. That is also why the file
takes nothing beyond these keys - `sync`/`check` warn about unknown keys. Add the
filename to your repo's `.gitignore`.

### Where the sibling checkouts live

`sdkSourcePath`, `apiRepoPaths` and `apiRepoBranches` used to live in the file above. They
moved to `ethlete.config.local.json`, which [`@ethlete/cli`](/cli/config) owns, because
`et api` needs the same values the skills do. The old file is still read as a fallback, and
`sync`/`check` report any of the three keys still found there so you can move them.

Validation of those paths now lives with the file: run [`et doctor`](/cli/config#et-doctor)
to check that `sdkSourcePath` is really an SDK checkout and that every `apiRepoPaths` entry
points at a directory that exists.

## Authoring content

The canonical content lives in the SDK repo under `libs/agent-rules/content/` -
`rules/<name>.md` for always-loaded rules, `skills/<name>/SKILL.md` (plus resource
files) for on-demand guides. Frontmatter controls the kind, scope, required packages
and template variables; see the package README for the authoring reference.

Package skill links use `{% skill:name %}` markers and are strict dependencies. After
profile, package requirement, variable, and explicit-exclusion filtering, `sync` and
`check` fail with the source skill and missing target instead of emitting a dangling
name. Optional guidance must remain self-contained when the other skill is absent.

Consumer repositories can contain three skill categories: package-generated
`ethlete-*` directories updated by `ethlete-agents sync`, third-party installed skills
tracked by `skills-lock.json`, and hand-written repository skills maintained directly.
The generated `AGENTS.md` block names this ownership so one update workflow is not
mistaken for another.

Inside the SDK the package is the source rather than a dependency, so `npx
ethlete-agents` has nothing to resolve. Format the content, then regenerate from the
local build:

```bash
yarn prettier --write libs/agent-rules/content/<file>
yarn agents:sync    # yarn agents:check is the same drift check CI runs
```

Formatting after the sync leaves the generated copies stale - they are Prettier-ignored,
so nothing rewrites them and only `agents:check` notices.
