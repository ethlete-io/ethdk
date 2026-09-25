# Compare the workspace with the Nx layout rule

`@ethlete/agent-rules` now ships an `nx-layout` rule for Nx workspaces: thin apps, feature code in
`libs/domain/<app>/<feature>`, shared `queries`, `types`, `uikit`, `theme` and `env` libs, aliases that
mirror the path, and one `scope:*` tag per project. New code follows it.

This is a recommendation, not a rewrite. Moving projects changes import paths, project names, tags
and CI caches across the whole repo, and the rule itself says not to restructure an existing
workspace unless the team asks for it.

## What to decide

1. Read the rule (in `AGENTS.md`, or under `.claude/rules/ethlete/`). If it is missing, run
   `ethlete-agents sync` with this repo's package manager (`yarn`, `pnpm exec` or `npx`).
2. List where the workspace deviates: feature code inside `apps/`, queries or themes inside an app,
   `feature/ui/data-access/util` folders, aliases that do not mirror the path, missing `scope:*` tags.
3. Decide per deviation: move it now, move it when that area is next touched, or keep it.
4. Keep what you decided in the repo's own `AGENTS.md`, so an agent stops flagging it.

An agent may prepare the list in step 2. It must not move a project without that decision.
