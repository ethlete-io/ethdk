# cli + agent-rules scan - open findings

Scan of `libs/cli/src/` and `libs/agent-rules/src/` from 2026-09-28. 0 High, 1 Medium, 19 Low, 5 Spec (second pass included; verified 2026-09-28: 15 confirmed, 3 re-rated, 0 refuted). Skipped: nothing from the first-pass skip list; the second pass read `timetrack-command.ts`, `git-flow/parse.ts`, `frontmatter.ts`, `load-content.ts`, `plan.ts` warnings, `doctor/`, `config/diagnose.ts`, `api/help.ts`, `api/suggest.ts` and `api/state.ts`. Tree-shaking does not apply. Paths are relative to `libs/cli/src/lib/` or `libs/agent-rules/src/lib/`.

## cli: api (`et api`)

- Low: `clear` counts only branch commits as unpushed (`api/git.ts:43`). Stashes and detached-HEAD commits are deleted with no warning. Add `git stash list` to the blockers. S
- Low: `checkoutApiBranch` passes the configured branch to `git checkout` with no separator (`api/git.ts:58`). A value that starts with `-` becomes a flag, and a value that also names a path checks out a file instead. Use `git switch <branch>`. S
- Low: an API name such as `constructor` or `toString` passes the `apis[candidate] === undefined` check (`api/run.ts:411`, `api/clear.ts:47`). `et api up constructor` then throws a TypeError from `join(repoPath, undefined)`. Use `Object.hasOwn`. S
- Low: `-h` is not filtered out of the positionals (`api/run.ts:380`), so `et api up -h` reports `Unknown API "-h"` instead of help. S
- Low: an empty container id matches every id, because the match is `startsWith` in both directions (`api/run.ts:291`). S
- Low: `isPortFree` binds `0.0.0.0` only (`api/ports.ts:103-110`). On macOS a holder on `127.0.0.1` or `::` still reads as free, so `up` fails later with the engine's error. S

## cli: update (`et update`)

- Low: the `--ai` command runs through a shell, and `quoted` wraps a path in double quotes only when it holds whitespace (`update/ai.ts:23,34,60`). A repo path with `$`, a backtick, `"`, `'`, `(` or `&` expands or breaks the command, and on Windows `cmd` expands `%VAR%`. Quote with single quotes (POSIX) or pass the prompt through an env var. S Re-rated from Medium: only a repo path that holds shell metacharacters triggers it, and that path is the user's own.
- Low: a migration `name` from a package's `migrations.json` goes into a file path unchecked (`update/tasks.ts:39-40,312`, `update/migration-manifest.ts:72`). A name such as `x/../../../src/main` makes `writeUpdateTasks` write outside `.ethlete/update`. `instructions` also accepts an absolute path (`update/migration-manifest.ts:189`), so any readable file is copied into the task file. Reject names outside `[\w.-]+` and instructions that leave the package. S Re-rated from Medium: the manifest comes from a first-party `@ethlete/*` package that already runs its own generator code, so the path gives it nothing new.
- Low: the registry lookup sends no auth header and reads only the repo's `.npmrc` (`update/registry.ts:141`). A private registry or a mirror that needs a token answers 401, and `~/.npmrc` or `${ENV}` values in `.npmrc` are ignored. M
- Low: `writeRanges` writes LF line endings into a CRLF `package.json` (`update/packages.ts:181-186`). The whole file shows as changed on Windows checkouts. S
- Low: `findManifests` walks the whole tree and ignores `.gitignore` (`update/packages.ts:61-92`). It enters `vendor/`, `build/` and fixture folders, and rewrites `@ethlete/*` ranges in fixture manifests. Use `git ls-files '*package.json'` when the root is a checkout. S

## cli: design, auth, release

- Low: the GitLab token checks use `fetch` with its default redirect mode (`auth/gitlab-token.ts:9`). `PRIVATE-TOKEN` is a custom header, so fetch keeps it across a cross-origin redirect. Pass `redirect: 'error'`, as `timetrack.ts` does. S
- Low: `writeGitlabToken` writes the token, then runs `chmod` (`auth/composer-auth.ts:58-63`). An existing `0644` file is readable with the new token until the `chmod`. Run `chmod` first. The CLI also takes the token as a positional argument, so it lands in shell history and `ps`. S
- Low: `release` matches flags by substring (`release.ts:27-28`). Any argument that contains `-f` forces the release. With `--force`, `git add .` puts every unrelated uncommitted change into the "Release versions" commit (`release.ts:56`). S
- Low: `workspaceAliases` builds a RegExp from each tsconfig path key without escaping (`design/serve.ts:41`). A key with `.` or `+` matches more than it should. S

## Spec gaps

- Spec: `replaceMarkedBlock` has no test for a missing end marker, a reversed pair, or two blocks. S
- Spec: `migrate.ts` has no spec. The merge of two files with marker blocks and the symlink rollback are untested. M
- Spec: `runApiSetup`, `resolveApiCheckout` and the git fail-open path of `planApiClear` have no spec. M
- Spec: `design/check.ts` and `design/serve.ts` have no spec. The Windows path handling and the browser cleanup are untested. M

## second pass

### agent-rules: git-flow parse

- Medium: with the default empty `keyPrefixes`, a subject that starts with `<word>-<number>` reads as an issue key (`git-flow/parse.ts:50-54`, default pattern at `git-flow/config.ts:71`). `feat/step-2-rework` gives `issueKey: STEP-2`, and timetrack attributes time to an issue that does not exist. Only a `key-case` finding marks it. Do not set `issueKey` for a lowercase match when `keyPrefixes` is empty. S Verified. Timetrack passes the favourite project keys as `keyPrefixes`, so this hits only while that list is empty, where `attribute.ts` trusts `parseBranch` on purpose.

### cli: doctor, config

- Low: when the primary config is not valid JSON, the runtime falls back to the legacy file (`config/local-config.ts:70-76`), but `diagnoseLocalConfig` reports only the parse error (`config/diagnose.ts:115`). The user does not learn that the legacy values are in force. S
- Low: a legacy file that does not parse gives no problem (`config/diagnose.ts:138`), but `doctor` counts it as present (`doctor/doctor-command.ts:51-53`). The result is "No problems found." for a broken file. S

### cli: api help, state

- Low: an `exec` entry named after a built-in command (`up`, `clear`) or `help` is shadowed with no warning (`api/definition.ts:57-60`, `api/run.ts:353`). `apiHelp` then lists the name twice (`api/help.ts:35-36`). Reject such names when the definitions load. S
- Low: `serviceStates` reads only the first container of each service (`api/state.ts:26`). For a scaled service with one exited replica, the running state depends on container order. S

### Spec gaps

- Spec: `timetrack-command.ts` has no test for `--at` or `--from`/`--to` date parsing, or for `project` with a relative path. S
