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
