# moon as the Nx replacement

Status: trial done 2026-08-11, paused. Resume 2026-09-24.

## Why

Nx deprecated its self-hosted cache packages in May 2026 (CVE-2025-36852) and points
to Nx Cloud. Our self-hosted Nx Cloud is unstable, so every workflow sets
`NX_NO_CLOUD: 'true'`. The custom OpenAPI cache route (`NX_SELF_HOSTED_REMOTE_CACHE_SERVER`)
still works, but the user prefers moon. Turborepo is out ("not a fan of vercel").

## What the trial proved (moon 2.4.6)

- 13 projects configured. `moon run :build :lint :test` passes (34 tasks).
- Parity with Nx: `fesm2022` bundles of types, core, query, components, cdk and contentful
  are byte-identical. Lint output, test counts (5042), Storybook ids (694) and
  `treeshake:bundle-goldens` match.
- `@nx/dependency-checks` still fires under `moon run <p>:lint`.
- bazel-remote in podman: a cold build of 23 s restored from remote in 0.9 s.

The config is in `git stash list` as `stash@{0}` "moon". Never drop it. Read it with
`git stash show -p --include-untracked stash@{0}`. It also holds unrelated edits to
`plans/component-improvements*.md` and `bugs.md`; do not apply those.

## Known traps

- `.moon/toolchains.yml` must declare `yarn: version 4.17.1`, or every task fails.
- Raw ng-packagr with source paths fails with `TS6059 … not under rootDir`. Nx rewrote the
  paths to `dist/libs/*`. The trial fix: `tsconfig.lib.moon.json` extends
  `tsconfig.lib.prod.json` and `tsconfig.dist-paths.json`.
- Storybook must build through `ng run playground:build-storybook` (`angular.json`), not
  the `storybook` CLI. Global CSS stays in the `styles` array of that target.
- moon turns off a `localhost` remote cache in CI. Use a real host.
- `lint: null` in a `moon.yml` does not remove the inherited task.
- Do not declare coverage folders as `outputs`; moon fails with `missing_outputs`.
- `.d.ts` union order differs from Nx. It is deterministic and harmless.
- `@nx/dependency-checks` and `@nx/enforce-module-boundaries` read the Nx project graph.
  Until we replace them, `nx` and the `project.json` files stay as a devDependency.

## Next steps

1. Remote cache on the homelab: run bazel-remote there, behind the Cloudflare tunnel.
   Find out if the tunnel carries gRPC, or if moon can use the bazel-remote HTTP API.
   Keep the host out of the repo (`MOON_REMOTE_HOST`), and add auth before it is public.
2. Point the stash config at that host and repeat the cold-versus-restored build test.
3. If that works: bring the stash up to date. Projects added after 2026-08-11 have no
   `moon.yml`, for example `bracket`, `query-devtools`, `apps/storybook-e2e`, the Tauri
   apps, the design tool and the Rust host.
4. Port `yarn agents:check` and `agents:sync` from `nx build agent-rules`, and
   `nx format:check` to `prettier --check .`.
5. Port `.github/workflows/*.yml` to `moon ci` with affected detection.
6. Make e2e a cached task: one task per domain with declared inputs. Only then does a
   remote cache speed up the behavior tests.
7. Cutover: fold `tsconfig.dist-paths.json` into each `tsconfig.lib.prod.json`, delete the
   `tsconfig.lib.moon.json` files, then update `AGENTS.md` (the Nx Cloud section) through
   `libs/agent-rules/content/`.
