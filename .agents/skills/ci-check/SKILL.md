---
name: ci-check
description: Run the same checks CI runs, locally, before pushing - format, agent-rules sync, changesets, lint, test, build, bundle-size goldens, the Storybook build, the component behavior tests, the timetrack e2e suite and the Rust host. Use when the user says "run CI", "ci check", "lint format test build", or before pushing a change to a published lib.
---

# Local CI check

CI (`.github/workflows/ci-{next,main,pr}.yml`) runs a fixed sequence. Run the same
sequence locally in the same order and a push should not come back red. **That workflow
file is the source of truth** - if a step here disagrees with it, the workflow wins;
re-read it and fix this skill.

## Before anything

```bash
export NX_NO_CLOUD=true
```

Nx Cloud is intentionally off in this workspace (every workflow sets the same env var).
Without it, `nx` spends time on a run-link lookup against an unstable self-hosted instance.

## The sequence

Run in this order and **stop at the first failure** - a later step's output is noise once
an earlier one is broken.

```bash
yarn install --immutable                  # 1. deps + lockfile is up to date
yarn nx format:check                      # 2. Prettier across the workspace
yarn agents:check                         # 3. generated agent files vs libs/agent-rules/content
yarn versions:check                       # 4. libs/*/src/lib/version.ts vs each package.json
yarn lint:changesets                      # 5. unreleased changeset notes: ≤40 words, 1 paragraph, ≤3 bullets
yarn nx run-many -t typecheck             # 6. spec-file types (nothing else checks them)
yarn nx run-many -t lint                  # 7. ESLint, incl. @nx/dependency-checks
yarn nx run-many -t test                  # 8. all unit tests
yarn nx run-many -t build                 # 9. all libs + apps (docs build fails on dead links)
yarn nx run treeshake:bundle-goldens      # 10. bundle-size goldens
yarn nx run storybook:build-storybook:ci  # 11. Storybook production build
yarn playwright test -c apps/storybook-e2e/playwright.config.ts  # 12. component behavior tests on that build
yarn nx run timetrack-app:format-rust     # 13. cargo fmt --check on the Tauri host
yarn nx run timetrack-app:lint-rust       # 14. cargo clippy -D warnings
yarn nx run timetrack-app:test-rust       # 15. cargo test
yarn nx e2e timetrack-e2e                 # 16. timetrack app e2e, against the host fakes
```

Step 11 is the slowest by far. Skip steps 11 and 12 only when the change touches no component
source and no story - and say so rather than reporting a clean run you didn't do. Step 12 serves
`dist/storybook` itself; to run it against the dev server instead, set
`STORYBOOK_URL=http://localhost:4400` (see the **`component-behavior-tests`** skill).

Steps 13 to 15 are the workflow's `rust` job. Skip all three when the change touches nothing
under `apps/timetrack/src-tauri`. Step 16 is the `timetrack-e2e` job. Skip it when the change
touches neither `libs/timetrack` nor `apps/timetrack`.

## Reading the results

- **`install --immutable`** - this is the Yarn 4 name for a frozen lockfile: it fails
  instead of writing `yarn.lock`. A failure means the lockfile does not match the
  `package.json` files. Fix with a plain `yarn install` and commit `yarn.lock` with the
  change. An `nx` task that prunes a lib's `dependencies` causes this too.
- **`format:check`** - fix with `yarn nx format:write`, or `npx prettier --write <files>`
  for just your diff. Do not hand-fix formatting.
- **`agents:check`** - drift means a `libs/agent-rules/content/**` edit was never compiled.
  Fix with `npx prettier --write libs/agent-rules/content/<file>` **then** `yarn agents:sync`,
  in that order - the generated copies are Prettier-ignored, so formatting after syncing
  leaves them stale and the check still fails.
- **`versions:check`** - a lib's `src/lib/version.ts` no longer matches its `package.json`
  version. Fix with `yarn versions:sync` and commit the result. This normally only drifts
  right after a release bump; because `build` regenerates these files as a target dependency,
  running build first silently fixes the drift instead of reporting it - which is why the
  check runs before build.
- **`typecheck`** - every lib's build tsconfig excludes the spec files, so this is the only
  step that type-checks them. Read the current list with
  `npx nx show projects --with-target typecheck`; `run-many` skips a project that does not
  declare the target. To add a project, make its spec types clean first. Then add the target.
- **`lint`** - re-run with `--fix` **scoped to the files you changed**:
  `npx eslint libs/components/src/lib/<domain> --fix`. Never
  `npx nx lint <project> --fix` - a project-wide fix races the user's editor autosave.
- **Pre-existing failures are not yours.** This repo takes concurrent commits from other
  sessions. Before chasing a failure, check `git diff`/`git log` on the failing file; if
  it is untouched by your change, report it and move on rather than fixing it silently.
- **`bundle-goldens`** - a `✔` row with a byte delta is *within* budget and CI passes. A
  `✖` is a real regression: something in `core`/`query`/`components` stopped tree-shaking.
  When the growth is a deliberate, understood consequence of your change, accept it:

  ```bash
  yarn nx run treeshake:bundle-goldens:update
  git diff tools/treeshake/goldens.json   # confirm only entries you can explain moved
  ```

  Commit `goldens.json` with the change. Never update goldens to silence a `✖` you cannot
  explain - that is the regression the check exists to catch.

- **`timetrack-e2e`** - the config sets `fullyParallel: true` and caps nothing, so a fast
  machine gives Playwright far more workers than a CI runner has, and the one dev server
  behind them times specs out. Ten to twelve specs fail, and a different set each run. Run
  it the way CI does before you believe a failure:

  ```bash
  npx playwright test -c apps/timetrack-e2e/playwright.config.ts --workers=2 --retries=2
  ```

  A spec that fails alone at `--workers=1` is a real failure. One that only fails in a wide
  parallel run is not.

- **A single task that fails inside `run-many` and passes on its own is flaky.** `run-many`
  starts every project at once, and `components:test` and `timetrack-app:lint` both lose to
  the load on a busy machine. Re-run the one task; Nx prints `Nx detected a flaky task` when
  it agrees. Do not report it as a break.

## What this does not cover

CI also runs deploys and the version PR; none of that is reproducible locally, and none of
it is your job before a push.

Two things CI cannot check that are still part of finishing a change:

- A UI change verified in a real browser - the **`verify-in-storybook`** skill.
- The changeset and the `apps/docs` page a public API change owes - the **`changeset`**
  and **`docs`** skills. `lint:changesets` only checks the *shape* of a note that exists,
  never that one is missing.
