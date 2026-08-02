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

|                     | Claude Code                         | Cursor                                              | Copilot                                                | Codex                          |
| ------------------- | ----------------------------------- | --------------------------------------------------- | ------------------------------------------------------ | ------------------------------ |
| Always-loaded rules | `.claude/rules/ethlete/*.md`        | `.cursor/rules/ethlete-*.mdc` (`alwaysApply: true`) | inlined into `.github/copilot-instructions.md`         | inlined into `AGENTS.md`       |
| On-demand guides    | `.claude/skills/ethlete-*/SKILL.md` | `.cursor/rules/ethlete-*.mdc`                       | `.github/instructions/*.instructions.md`, or a pointer | a pointer table in `AGENTS.md` |

`AGENTS.md` supports neither frontmatter nor includes, so anything a target cannot
express on-demand falls back to plain markdown under `.agents/ethlete/` plus a pointer
from the always-loaded file. Marker-block files (`AGENTS.md`,
`.github/copilot-instructions.md`) are only rewritten between
`<!-- ethlete:agent-rules:start -->` and `:end` - everything you wrote around them
survives.

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
/.github/instructions/ethlete-*
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

- **`targets`** - `"auto"` (default) emits for every agent whose directory already
  exists, or list a subset of `claude`, `codex`, `cursor`, `copilot`.
- **`profile`** - `"consumer"` (default) emits `scope: consumer` and `scope: both`
  content. `"sdk"` emits only `both`; the SDK repo uses it so its own hand-written,
  authoring-side guides are not overwritten by the consumer-side versions.
- **`vars`** - values for the template tokens a guide declares. Defaults live in
  `content/defaults.json`; a guide whose variable has no default and no value is
  skipped with a warning rather than emitted with a dangling placeholder.
- **`exclude`** - content names to skip entirely.

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
paths: ['**/*.css'] # optional; becomes Claude `paths`, Cursor `globs`, Copilot `applyTo`
vars: [docsBaseUrl] # optional
---
```

In a body, `{% varName %}` substitutes a variable, `{% skill:other-name %}` links to
another guide the way the current target expects, and `{% resource:file.mjs %}` links to
a bundled file. The delimiter is `{% … %}`, not `{{ … }}`, so Angular templates in
examples pass through untouched. Resource files get variable substitution too, but no
links.
