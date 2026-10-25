# Bug: `et migrations` recommends migrations a repo has already done

Status: fixed in source on 2026-10-25; pending release.

## The problem

In tomflix, after `yarn et update` to `@ethlete/cli` 3.0.0-next.20, `@ethlete/core` 5.0.0-next.68 and
`@ethlete/components` 1.0.0-next.74, `yarn et migrations` lists two migrations as `recommended`. The repo
has done both already:

```text
  recommended  @ethlete/core:legacy-color-themes (assisted) - affected files unknown (yarn exited with 1)
    Move the runtime color theming to Tailwind 4: provideColorThemes becomes provideColorThemesWithTailwind4, and the generated CSS and surface themes replace the runtime styles.

  recommended  @ethlete/query:deprecate-legacy-queries (auto)
    Mark the remaining createLegacyQueryCreator wrappers as deprecated, so their call sites surface as still on v2.
```

- `core:legacy-color-themes`: tomflix uses `provideColorThemesWithTailwind4` in
  `apps/tomflix/src/app/app.config.ts` and in five specs. No `provideColorThemes` call is left. The
  detection fails: it prints "affected files unknown (yarn exited with 1)" instead of 0 files.
- `query:deprecate-legacy-queries`: tomflix has no `createLegacyQueryCreator` call. The CLI does not
  show an affected-file count for this migration.

`et update` itself said "No migration is pending for those versions", so only the `et migrations` list
is wrong.

## Effect

The list asks a developer or an agent to act on work that is done. An agent that follows the
"recommended" label can run a codemod for nothing, or try an assisted task with no call sites.

## Ask

1. When the detection of a migration finds 0 affected files, do not list it as `recommended`. Show it
   as done, or hide it.
2. When the detection command fails, print its error. "yarn exited with 1" does not say what failed.
3. Show the affected-file count for every migration that has a detection, so a 0 is visible.

## Reproduce

In `/home/tom/dev/tomflix` at commit `1a5e194`, run `yarn et migrations`.

## Resolution

- A successful scan with zero affected files now shows `done` and `0 affected files`, contributes
  nothing to the available count, and offers no run command. Listing does not write a migration
  record, so a future scan can still detect newly introduced legacy code.
- Failed scans now retain stdout and stderr alongside the exit status.
- `query:deprecate-legacy-queries` now scans for wrappers that still need a deprecation tag without
  modifying the workspace. Repositories without wrappers, or with every wrapper already tagged,
  report zero affected files.
- The core scan failure was reproduced with tomflix's installed packages in a temporary workspace:
  Nx cannot load the generator because the optional `ts-morph` peer dependency is missing. The CLI
  now displays that error; the consuming repo needs `ts-morph` installed for this scan to run.

Regression coverage exercises zero-file recommendations, all-done listings, failed-command output,
and query scan results without tree changes.
