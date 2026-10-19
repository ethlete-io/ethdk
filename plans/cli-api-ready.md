# `et api` ready state (FR-5, FR-6 of the fifagg e2e strategy)

Spec: fifagg specs repo, branch `spec/20261019_e2e-strategy`,
`context/tracks/20261019_e2e-strategy/spec.md`, FR-5 and FR-6. Approved by Tom on 2026-10-19.
Consumer: `/home/tom/dev/fifagg/fifagg-frontend` (`ethlete.apis.js`, `.ethlete/seeds/fifagg/`). The
fifagg side (checks, profile, e2e helpers) is the job of the fifagg session `e2e-baseline-08`, not
of this plan.

Code: `libs/cli/src/lib/api/`. Docs: `apps/docs/cli/api.md`. One changeset for `@ethlete/cli`
(`minor`), `.changeset/cli-api-ready.md`, created by slice 1 and extended by each later slice.

## Design

### New built-in commands

`exec`, `run`, `doctor`, `ready`, `snapshot`, `status` join `BUILT_IN_API_COMMANDS`. The loader
already rejects an `exec` map entry with a built-in name.

### Arguments

`argv` splits at the first `--`. Everything after it goes to the command unchanged. Before it,
value flags (`--profile <name>`, `--wait <s>`) take their value, so the value is not read as a
positional argument. Today `ready fifagg --profile e2e` would read `e2e` as the service.

### Schema additions in `ApiDefinition`

```ts
checks?: ApiCheck[];                    // ordered: a later check may need an earlier one
profiles?: Record<string, ApiProfile>;
migrationsDir?: string;                 // relative to the API checkout root, a fingerprint input

type ApiCheck = {
  name: string;
  check: string;      // one shell line, exit 0 = ok
  fix?: string;       // one shell line
  service?: string;   // default execService
  host?: boolean;     // run on the host in composeDir with api.env(), not in a container
};

type ApiProfile = {
  seeds: string[];    // names from seeds.json; 'fixtures' means the fixtures list
  health?: { url: string; expect?: number };   // default 200, retried up to 60 s
  snapshot?: { service: string; databases: string[]; save: string; restore: string };
};
```

`snapshot.save` writes the dump to stdout, `snapshot.restore` reads it from stdin. Both get
`$DATABASES` (space-separated). The CLI gzips and stores it.

### State, lock, snapshots

- State and lock are machine-wide, keyed by the compose project of the API, because several
  frontend checkouts and sessions share one API container set:
  `${XDG_STATE_HOME:-~/.local/state}/ethlete/api/<compose project>/{state.json,lock.json}`.
- `state.json`: `{ profile, fingerprint, dirty, updatedAt }`.
- `lock.json`: `{ pid, hostname, command, cwd, startedAt, token }`, created with `wx`. A lock whose
  pid is dead on this host is stale: it is taken over, and the state becomes dirty.
- Snapshots: `<repo root>/.ethlete/snapshots/<api>/<name>-<fingerprint>.sql.gz` (per spec). Warn if
  the path is not gitignored.

### Fingerprint

sha256, first 12 hex chars, over: `git rev-parse HEAD` of the API checkout, the file names and
contents under `migrationsDir`, the files under `.ethlete/seeds/<api>/`, the profile's seed list,
the contents of `ethlete.apis.js`, the CLI major version.

### Commands

- `exec <api> <service> -- <cmd...>`: non-interactive, stdin forwarded, no TTY, exit code
  unchanged, nothing of the CLI's own on stdout (diagnostics go to stderr).
- `run <api> --lock [--wait <s>] -- <cmd...>`: take the lock (wait up to `--wait` s, default: wait
  without end, print the holder once), spawn the command with `ETHLETE_API_LOCK=<token>` in its
  env, forward SIGINT/SIGTERM, release the lock and mark the state dirty when it ends. Exit code
  of the command. Timeout: exit code 75 and the holder on stderr.
- `doctor <api> [--fix]`: run the checks in order, one line per check. Without `--fix`, exit 1 if
  any fails. With `--fix`, run the fix of a failed check, check again, stop at the first fix that
  fails.
- `ready <api> --profile <p>`: take the lock unless `ETHLETE_API_LOCK` matches the held lock. Then
  up, doctor --fix, fingerprint, then:
  - state clean, same profile and fingerprint: nothing.
  - snapshot for the fingerprint exists: restore it.
  - otherwise: run the profile seeds in order, then save the snapshot.
    Then the health check, then write the state as clean.
- `snapshot save|restore <api> <name>`: uses the first profile with a `snapshot` block, or
  `--profile`. Restore of a missing file lists the files that exist.
- `status <api>`: profile, stored and current fingerprint, dirty, snapshot present, lock holder.
- `seed` and `fixtures` mark the state dirty.

## Slices

Each slice: specs next to the code, help text in `help.ts`, its section in `apps/docs/cli/api.md`,
the changeset, lint with no new warnings, `tsc -p libs/cli/tsconfig.spec.json`, then a commit.

1. [ ] Argument parser with `--` and value flags; new built-in names; `exec`.
2. [ ] Schema validation for `checks`, `profiles`, `migrationsDir`; `doctor [--fix]`.
3. [ ] State and lock module; `run --lock [--wait]`; `seed` and `fixtures` mark dirty.
4. [ ] Fingerprint; `snapshot save|restore`; `status`.
5. [ ] `ready --profile` with the health check.
6. [ ] Check against the real fifagg API, with the fifagg session's agreement first.
