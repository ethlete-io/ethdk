---
name: sdk-local-build
description: Build the @ethlete SDK from a local ethlete-sdk checkout and install it into this repo through a `file:` dependency, so an unreleased SDK change can be tested against this app before it is published - and reverted cleanly afterwards. Read whenever an SDK-side fix needs verifying here, or when package.json already points at a local build.
kind: skill
scope: consumer
---

# Testing an unreleased SDK build in this repo

Swapping an `@ethlete/*` dependency for a locally built one lets you verify an SDK
change against this app before it ships. It is a **temporary, local-only** state: the
`file:` specifier and the lockfile entry it produces must never be committed.

Prefer a published prerelease when one exists - installing `@ethlete/components@next`
is faster and reproducible for the whole team. Use a local build when the change is not
published yet, or when you are iterating on it.

## 1. Prerequisites

- The checkout path comes from `sdkSourcePath` in `ethlete-agents.config.local.json`;
  {%skill:sdk-source%} covers resolving it and what to check before trusting it.
- The checkout has its dependencies installed (`yarn install` in the checkout root - the
  SDK repo is a Yarn 4 workspace).
- Check which branch it is on before building - unless the user said otherwise, that
  should be `next`, up to date with `origin/next`. Building `main` when your app runs
  `-next` prereleases swaps in a completely different API surface, and building a stale
  `next` rebuilds a bug that is already fixed upstream. Ask before changing its branch.

## 2. Build the libraries you changed

From the **checkout root**, one build per `@ethlete/*` package whose source you touched:

```bash
npx nx build components   # writes dist/libs/components
npx nx build query        # writes dist/libs/query
```

Each build also builds the libs it depends on (`types` → `core` → `query` →
`components`), so a single command is enough to produce a consistent set. Only the
packages you actually changed need to be installed here; leave the rest on their
published versions.

If a build stalls trying to reach Nx Cloud, re-run it with `NX_NO_CLOUD=true`.

## 3. Point this repo at the build

Preflight the manifest and lockfile before changing either:

Use {%resource:sdk-local-baseline.mjs%} to capture their exact bytes:

```bash
git status --short -- <manifest> yarn.lock
sdk_local_baseline_dir=$(mktemp -d)
node <path-to-sdk-local-baseline.mjs> capture <manifest> yarn.lock "$sdk_local_baseline_dir"
```

If either file already differs and you cannot tell who owns the edit, stop and ask. If
the user authorizes the experiment, keep the exact baseline above; pre-existing edits
are part of it and must survive byte-for-byte. If either file changes for another reason
during the experiment, stop and take a new agreed baseline before cleanup.

Edit the version specifiers in `package.json` (the one declaring the dependency - in a
workspace that is the workspace package, not necessarily the root):

```json
{
  "dependencies": {
    "@ethlete/components": "file:../ethlete-sdk/dist/libs/components"
  }
}
```

The path is resolved relative to that `package.json`; an absolute path works too. Then
install:

```bash
yarn install
```

Expect peer-dependency warnings - the built package pins peers to the SDK's own Angular
version. They are warnings, not failures; a real version conflict shows up as a build
error, and means the checkout is on the wrong branch.

## 4. Confirm the local build is really what got installed

`yarn install` is the only thing that copies the build into `node_modules`, so verifying
is not optional - a stale package looks exactly like a change that did not work:

```bash
grep -m1 '"version"' node_modules/@ethlete/components/package.json
rg -n "<a symbol from your change>" node_modules/@ethlete/components/fesm2022/
```

Then **restart the dev server**. Bundlers pre-bundle dependencies and will keep serving
the old copy; if the change still does not show up, delete `.angular/cache` (and
`node_modules/.vite` if present) and start it again.

## 5. Iterating

Every SDK edit needs the full loop - there is no watch mode across the boundary:

1. rebuild in the checkout (`npx nx build <lib>`)
2. `yarn install` here
3. restart the dev server

Yarn 4 re-copies a `file:` dependency whenever its contents change, so step 2 does pick
up the rebuild. It also rewrites that package's `resolution` hash in `yarn.lock` on
every rebuild - which is one more reason the lockfile must not be committed in this
state. (With npm, `file:` symlinks instead of copying, so a rebuild is picked up without
reinstalling; the restart in step 3 is still required.)

## 6. Clean up when you are done

Leaving a `file:` dependency behind breaks every other checkout and CI, because the path
does not exist there. Restore the exact recorded baseline as part of the same task:

```bash
node <path-to-sdk-local-baseline.mjs> restore <manifest> yarn.lock "$sdk_local_baseline_dir"
yarn install --immutable
node <path-to-sdk-local-baseline.mjs> verify <manifest> yarn.lock "$sdk_local_baseline_dir"
```

The verification proves that the local-build delta is gone while preserving any edits
that existed before it. Do not require either file to be globally clean, and do
not run whole-file `git checkout` or `git restore`. Report the temporary baseline path;
it can be removed after verification because this workflow created it. Never commit a
`file:` specifier or the lockfile it produced. If the verified fix is still unreleased,
say what has to be published instead of shipping a local path.

## Related

- Finding and reading the checkout: {%skill:sdk-source%}
- What the published packages document: {%skill:sdk-docs%}
