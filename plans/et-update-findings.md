# `et update` findings from fifagg-frontend

Reported on 2026-10-30 by the session `fifagg-frontend-a5`, with `@ethlete/cli` 3.0.0-next.23 and
`@ethlete/core` 5.0.0-next.69. Tom: the Studio builder session does these, in its queue.

## 1. Codemods fail without `ts-morph` - done

- **Pain:** `yarn et update --tag next` failed in the codemod `@ethlete/core surface-interaction-swatch`:
  "Cannot find package 'ts-morph' imported from
  node_modules/@ethlete/core/generators/migrate-surface-interaction-swatch/interaction-swatch.js".
- **Cause:** `ts-morph` is only an optional peer of `@ethlete/core`, and `et update` does not install it. Five
  core generators import it: interaction-swatch, legacy-color-themes, tailwind-4-surface-theme,
  tailwind-4-color-theme, color-theme-variants.
- **Fix options:** `et update` installs `ts-morph` before it runs a codemod that needs it, or the generator fails
  with a clear "add ts-morph" message.
- **As built (2026-10-30):** a migration declares `requires: ["ts-morph"]` in `migrations.json` (only
  `surface-interaction-swatch` needs it). `et update` and `et migrations run` add a missing one as a dev dependency
  with the repo's package manager, in its own commit, before the codemods; the version comes from the package's
  peer range. A failed add fails the codemod with "the generator needs ts-morph: add it as a dev dependency".
  Reaches fifagg only with a new core release. Verified: specs that fail without the fix. Not verified: a real run.

## 2. `et update --continue` commits foreign changes - done

- **Pain:** the user ran `yarn add -D ts-morph` and did not commit it. `yarn et update --continue` then put the
  `package.json` and `yarn.lock` change into its own commit "chore(deps): Sync the ethlete agent rules", which
  had no agent-rules change.
- **Fix:** commit only the paths `et update` wrote itself, or refuse on a dirty tree.
- **As built (2026-10-30):** cause: `--continue` reused the snapshot of the stopped run, so the user's later edits
  counted as the next step's change. `resumeCommits` adds those paths to the user's baseline; they are never
  committed, and a step that touches one is reported as blocked. Verified: a spec that fails without the fix.

## 3. `@nx/devkit` peer range - done

- **Pain:** `@ethlete/core` 5.0.0-next.69 declares the peer `@nx/devkit ^24`, but the migration guide names
  Nx 23.3.1 as the floor.
- **Fix:** make the peer range and the guide agree.
- **As built (2026-10-30):** the guide (`apps/docs/migrating-from-v4.md`) says Nx `^23.0.0`; 23.3.1 is in no doc.
  The peer is `>=23.0.0` in core, query, components, contentful and cdk. The libs use only devkit APIs that exist
  in Nx 23 (by reading, not installed).

## 4. The cdk `to-v5` codemod renames `theme` on app components - open

- **Pain:** reported 2026-10-30 by `fifagg-frontend-a5`, `@ethlete/cdk` 5.0.0-next.44. The codemod `to-v5` renamed
  `[theme]` to `[color]` and `theme=` to `color=` on about 219 template sites. It matched only the attribute name,
  so it also renamed app components with their own `theme` input (selectors `fifa-gg-*`, `gg-*`, app button
  directives). About 150 bindings now go nowhere, and ngc does not flag most of them.
- **Expected:** rename only on elements that the SDK button and component selectors match.
- **Evidence:** commit `f920736122` in fifagg-frontend, branch `chore/ethlete-next`.
