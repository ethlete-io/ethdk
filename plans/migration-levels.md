# Migration levels for `et update`

Started 2026-10-01. Status: design, nothing built.

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

## Questions (with recommendations)

1. Field name and default: `level`, and a missing `level` means `required`, so existing manifests stay valid.
   Recommended: yes, then set `level` on every entry explicitly.
2. More levels? A `critical` level above `required` (security fix, data loss) only changes the wording of the output.
   Recommended: start with three; add one when a real case needs it.
3. Where to record a run of a non-required migration: `.ethlete/migrations.json` in the app, committed.
   Recommended: yes; the update flow already writes under `UPDATE_DIR`.
4. Size estimate: a generator may export a `scan` that returns the affected files without changes.
   Recommended: optional per generator; `report-legacy-query-apis` already is such a scan.
5. Classify every existing entry (agent-rules 5, cdk 3, components 15, contentful 2, core 5, eslint-plugin 1,
   query 7). Recommended: `from-cdk`, `from-cdk-decisions`, `to-query-v3` and `prep-for-query-v3` become `optional`;
   `deprecate-legacy-queries` becomes `recommended`; check the rest one by one with the user.
6. Should `report-legacy-query-apis` then go back into `migrations.json` as `optional`? Recommended: yes, once
   `et migrations` exists.

## Files

`libs/cli/src/lib/update/` (`migration-manifest.ts` validates `kind`, `plan.ts` picks entries, `run-migrations.ts`,
`pending.ts`), `libs/cli/src/index.ts` (subcommands), `libs/*/migrations.json`, the docs page for `et update`.
