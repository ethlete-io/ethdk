# moon as the Nx replacement

## Why

Our self-hosted Nx Cloud is unstable, so every workflow sets `NX_NO_CLOUD: 'true'`. moon
gives us a remote cache we host ourselves.

## Where the trial config lives

On the branch `chore/moon-trial` (commit `cc3b17151`). The branch is pushed to origin. Read
it with `git show chore/moon-trial:<path>` or `git diff next...chore/moon-trial --stat`.

The trial commit also changes `bugs.md`, `plans/component-improvements.md` and
`plans/component-improvements-triage.md`. Those edits are unrelated. Drop them when you
rebase the branch.

## Live work

1. **Remote cache on the homelab.** The host is the homelab, behind the Cloudflare tunnel.
   - Run bazel-remote there.
   - Check that the tunnel carries gRPC. If it does not, check whether moon can use the
     bazel-remote HTTP API.
   - Set `MOON_REMOTE_HOST` in CI. Keep the host out of the repo.
   - Add auth before the endpoint is public.
   - `tools/remote-cache/README.md` on the branch says Hetzner. Rewrite it for the homelab.
2. **Repeat the build test.** Point the trial config at the homelab and compare a cold
   build with one restored from the remote cache.
3. **Rebase the branch onto `next`.** Add a `moon.yml` for every project added since
   2026-08-11: `bracket`, `query-devtools`, `apps/storybook-e2e`, the Tauri apps
   `timetrack` and `ethlete-studio`, the Rust hosts, and the design tool in `libs/cli`.
4. **Port the remaining Nx calls.** `yarn agents:check` and `agents:sync` run
   `nx build agent-rules`. `nx format:check` becomes `prettier --check .`.
5. **Port `.github/workflows/*.yml` to `moon ci`** with affected detection.
6. **Make e2e cached tasks,** one per domain, with declared inputs. Only then does the
   remote cache speed up the behavior tests.
7. **Cutover.** Fold `tsconfig.dist-paths.json` into each `tsconfig.lib.prod.json`. Delete
   the `tsconfig.lib.moon.json` files. Update `AGENTS.md` (the Nx Cloud section) through
   `libs/agent-rules/content/`.

## Known traps

- `.moon/toolchains.yml` must declare `yarn: version 4.17.1`, or every task fails.
- Raw ng-packagr with source paths fails with `TS6059 … not under rootDir`. Nx rewrote the
  paths to `dist/libs/*`. The trial fix: `tsconfig.lib.moon.json` extends
  `tsconfig.lib.prod.json` and `tsconfig.dist-paths.json`.
- Global Storybook CSS stays in the `styles` array of the `build-storybook` target in
  `angular.json`.
- moon turns off a `localhost` remote cache in CI. Use a real host.
- `lint: null` in a `moon.yml` does not remove the inherited task.
- Do not declare coverage folders as `outputs`. moon fails with `missing_outputs`.
- `.d.ts` union order differs from Nx. It is deterministic and harmless.

## Settled - do not re-open

- Turborepo is out.
- `nx` and the `project.json` files stay as a devDependency until `@nx/dependency-checks`
  and `@nx/enforce-module-boundaries` are replaced. Both read the Nx project graph.
- Storybook builds through `ng run playground:build-storybook`, not the `storybook` CLI.
