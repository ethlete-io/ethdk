# Migration levels for `et update`

Started 2026-10-01. Status: decided, slice 1 in progress.

## Problem

`et update` runs every migration whose version lies in (installed, target] (`libs/cli/src/lib/update/plan.ts`,
`pendingMigrations`). Each entry in `libs/*/migrations.json` has a `kind` (`auto`, `assisted`, `manual`), but no
level. So an optional move runs like a breaking fix. Examples of optional moves that run today:

- `@ethlete/cdk` `from-cdk` (5.0.0-next.25, `auto`) and `from-cdk-decisions` (`assisted`): cdk → components. The cdk
  stays supported, and the migration can be huge.
- `@ethlete/query` `to-query-v3` (5.42.0, `auto`): legacy queries keep working through the interop layer.

The user decided (2026-10-01): the app decides when to do an optional move. The SDK supplies the scripts. The
`report-legacy-query-apis` generator is therefore a hand-run generator, not in `migrations.json` (`d8e620706`).

## Proposal

Add a `level` field next to `kind`. `kind` says how a migration runs; `level` says whether it must.

| Level         | Meaning                                                                 | `et update`                        |
| ------------- | ----------------------------------------------------------------------- | ---------------------------------- |
| `required`    | Without it the app does not build or run on the new version.            | Runs, as today.                    |
| `recommended` | The old API still works but is deprecated and will go in a later major. | Lists it after the update; no run. |
| `optional`    | A move to a newer system; the old one stays supported.                  | Lists it only on request.          |

- A new command, `et migrations`, lists the available `recommended` and `optional` migrations: package, name, level,
  kind, description, docs link, and if the generator can scan, the number of affected files.
- `et migrations run <package>:<name>` runs one, with the same commit, pending-state and task-report flow as
  `et update`.
- A non-required migration is available once the installed version is at or above its version, until it ran.
  Therefore the app must record what ran (for example in `.ethlete/`), because the version window no longer says it.
- `et update` ends with one line, for example: `2 recommended and 3 optional migrations are available - run et migrations`.

## Decisions (2026-10-01)

1. Field `level`. A missing `level` means `required`, so old manifests stay valid. Every entry sets it explicitly.
2. Three levels: `required`, `recommended`, `optional`. Add `critical` when a real case needs it.
3. The app records each run of a non-required migration in `.ethlete/migrations.json`, committed.
4. A generator may export a `scan` that returns the affected files without changes. Optional per generator.
5. Classification:
   - `optional`: cdk `from-cdk`, `from-cdk-decisions`; query `to-query-v3`; agent-rules `list-state-query-form`,
     `search-query-field`, `sdk-components-over-hand-built-ui`, `nx-layout`.
   - `recommended`: query `deprecate-legacy-queries`.
   - `required`: all other entries. This includes query `prep-for-query-v3`, cdk `to-v5`, all 5 core entries,
     agent-rules `app-styling-utilities` and eslint-plugin `module-augmentation-interfaces`.
6. `report-legacy-query-apis` goes back into `migrations.json` as `optional` once `et migrations` exists.

## Slices

1. `level` in the manifest validator and on every entry; `et update` runs only `required`, and ends with the line
   about the available non-required migrations.
2. `.ethlete/migrations.json`, `et migrations` (list) and `et migrations run <package>:<name>`.
3. `scan` support and the affected-file count; `report-legacy-query-apis` back in as `optional`; docs.

## Files

`libs/cli/src/lib/update/` (`migration-manifest.ts` validates `kind`, `plan.ts` picks entries, `run-migrations.ts`,
`pending.ts`), `libs/cli/src/index.ts` (subcommands), `libs/*/migrations.json`, the docs page for `et update`.
