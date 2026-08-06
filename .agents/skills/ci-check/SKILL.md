---
name: ci-check
description: Run the same checks CI runs, locally, before pushing - format, agent-rules sync, changesets, lint, test, build, bundle-size goldens and the Storybook build. Use when the user says "run CI", "ci check", "lint format test build", or before pushing a change to a published lib.
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
yarn nx format:check                      # 1. Prettier across the workspace
yarn agents:check                         # 2. generated agent files vs libs/agent-rules/content
yarn lint:changesets                      # 3. unreleased changeset notes: ≤40 words, 1 paragraph, ≤3 bullets
yarn nx run-many -t lint                  # 4. ESLint, incl. @nx/dependency-checks
yarn nx run-many -t test                  # 5. all unit tests
yarn nx run-many -t build                 # 6. all libs + apps (docs build fails on dead links)
yarn nx run treeshake:bundle-goldens      # 7. bundle-size goldens
yarn nx run playground:build-storybook:ci # 8. Storybook production build
```

Step 8 is the slowest by far. Skip it only when the change touches no component source
and no story - and say so rather than reporting a clean run you didn't do.

## Reading the results

- **`format:check`** - fix with `yarn nx format:write`, or `npx prettier --write <files>`
  for just your diff. Do not hand-fix formatting.
- **`agents:check`** - drift means a `libs/agent-rules/content/**` edit was never compiled.
  Fix with `npx prettier --write libs/agent-rules/content/<file>` **then** `yarn agents:sync`,
  in that order - the generated copies are Prettier-ignored, so formatting after syncing
  leaves them stale and the check still fails.
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

## What this does not cover

CI also runs deploys and the version PR; none of that is reproducible locally, and none of
it is your job before a push.

Two things CI cannot check that are still part of finishing a change:

- A UI change verified in a real browser - the **`verify-in-storybook`** skill.
- The changeset and the `apps/docs` page a public API change owes - the **`changeset`**
  and **`docs`** skills. `lint:changesets` only checks the *shape* of a note that exists,
  never that one is missing.
