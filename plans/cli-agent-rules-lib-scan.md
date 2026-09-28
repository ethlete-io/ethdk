# cli + agent-rules scan - open findings

Scan of `libs/cli/src/` and `libs/agent-rules/src/` from 2026-09-28. 1 High, 14 Medium, 43 Low, 6 Spec (second pass included; verified 2026-09-28: 15 confirmed, 3 re-rated, 0 refuted). Skipped: nothing from the first-pass skip list; the second pass read `timetrack-command.ts`, `git-flow/parse.ts`, `frontmatter.ts`, `load-content.ts`, `plan.ts` warnings, `doctor/`, `config/diagnose.ts`, `api/help.ts`, `api/suggest.ts` and `api/state.ts`. Tree-shaking does not apply. Paths are relative to `libs/cli/src/lib/` or `libs/agent-rules/src/lib/`.

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

## agent-rules: sync, migrate, output-style

- Medium: `replaceMarkedBlock` appends a new block when the end marker is missing or comes before the start marker (`render.ts:112-118`), and leaves the old start marker in place. On the next sync, the old start and the new end pair up, and all hand-written text between them is deleted. Refuse to sync (or report) when the markers are unbalanced. S Verified for a missing end marker. A reversed pair only appends again on each sync and deletes nothing.
- Low: `migrateClaudeMd` concatenates `CLAUDE.md` and `AGENTS.md` (`migrate.ts:48-58`). When both hold a generated marker block, the result holds two. Sync then updates only the first, and the second stays stale. Strip the marker block from the `CLAUDE.md` part first. S Re-rated from Medium: no target ever writes a marker block into `CLAUDE.md`, so only a hand-copied block triggers it.
- Low: `output-style --remove` reads the shipped style before it removes (`output-style.ts:126-128`). A style that a newer package version dropped cannot be removed ("Unknown output style"). The name is also joined into paths unchecked, so `--name ../../README --force` resolves to a file above the config dir. Validate the name and skip the shipped read for `remove`. S
- Low: `collectOwnedPaths` uses `statSync` (`owned-paths.ts:42,67`), which throws on a dangling symlink. One broken link under `.claude/skills/ethlete-*` makes `sync` and `check` crash. Use `lstatSync` and skip links. S
- Low: `sync` rewrites every planned file, not only the changed ones (`sync.ts:98-102`). This touches mtimes and writes through any symlink in place of a generated file. Write `changes` only. S
- Low: `assertKnownHooks` and `assertKnownGitHooks` test with `in` (`targets/hooks-shared.ts`, `targets/git-hooks.ts:23`). `"hooks": ["constructor"]` passes, then `emitHookScripts` throws from `join(..., undefined)`. Use `Object.hasOwn`. S
- Low: `emitHookSettings` swallows a parse error in `.claude/settings.json` (`targets/hooks-shared.ts`, the `catch` at the end). An opted-in hook then is not registered, with no warning. Add a plan warning. S

## agent-rules: git-flow, gitlab, timetrack

- Medium: `remoteBranchExists` passes a bare name to `git ls-remote --heads` (`git.ts:72-73`), and git matches it as a tail. `feat/x` also matches `refs/heads/team/feat/x`. `repair` then pushes and runs `push --delete` for a branch that does not exist, and `start` fetches a base that is not there (`git-flow-repair.ts:64,149`, `git-flow-start.ts:142`). Pass `refs/heads/${branch}`. S Verified (repro): `git ls-remote --heads <bare> feat/x` returned `refs/heads/team/feat/x`.
- Low: `CI_JOB_TOKEN` is sent as `private-token` (`gitlab.ts:29`). GitLab takes a job token only as `JOB-TOKEN`, and a job token cannot list or edit merge requests anyway. Drop the fallback. S
- Low: `git()` uses the 1 MB default `maxBuffer` of `execFileSync` (`git.ts:5`). `commitPathsOnDays` runs `git log --name-only` over a span of days (`git.ts:111`), and a wide span in a large monorepo throws `ENOBUFS`. Raise `maxBuffer`. S
- Low: when the push after the local rename fails (`git-flow-repair.ts:183-191`), the raw `execFileSync` error is thrown and the local branch keeps its new name. No undo hint is printed, although the retarget failure path prints one. S
- Low: `writeExport` writes with a single `writeSync` call and ignores the returned byte count (`timetrack-command.ts:453-456`). A short write truncates the export with no error. Use `writeFileSync(handle, data)`. S

## Spec gaps

- Spec: `replaceMarkedBlock` has no test for a missing end marker, a reversed pair, or two blocks. S
- Spec: `migrate.ts` has no spec. The merge of two files with marker blocks and the symlink rollback are untested. M
- Spec: `runApiSetup`, `resolveApiCheckout` and the git fail-open path of `planApiClear` have no spec. M
- Spec: `design/check.ts` and `design/serve.ts` have no spec. The Windows path handling and the browser cleanup are untested. M

## second pass

### agent-rules: timetrack command

- Medium: `project [path]` sends the path to the app unresolved (`timetrack-command.ts:751`). The app matches it against absolute project links (`apps/timetrack/src/app/agent/agent-endpoint.ts:218`), so `timetrack project .` or `timetrack project ../api` reports "linked to no project". Resolve it against `root`, as `resync` does at `:873`. S Verified. `timetrackRepoProject` forwards the path as it is.
- Medium: `--at`, `--from` and `--to` go to `new Date(raw)` as they are (`timetrack-command.ts:101,376`). A date-only value such as `2026-09-28` parses as UTC midnight, so `log --at 2026-09-28` starts at 02:00 in CEST and on the previous day west of UTC. The JSDoc at `:374` promises "a clock", but `new Date('10:30')` is `NaN`, so a clock throws. Parse date-only and `HH:MM` values as local time. S Verified (repro): `new Date('2026-09-28')` gave 02:00 CEST and `new Date('10:30')` gave `NaN`.
- Low: `naming` uses today when the day argument is malformed (`timetrack-command.ts:979`). `timetrack naming 2026-9-1` answers for today with no error. Throw, as `rows` and `day` do. S
- Low: `FLAGS_WITH_VALUE` does not list `--repo`, `--name` or `--rename` (`timetrack-command.ts:44-69`). Their values count as positionals, so `timetrack --name x standins` reads `x` as the subcommand. S
- Low: `flagValue` takes the next argument also when it is another flag (`timetrack-command.ts:77-81`). `create --summary --project FIP` queues an issue with the title `--project`. Reject a value that starts with `--`. S
- Low: `numberFlag` accepts `''` (as 0), negative numbers and fractions (`timetrack-command.ts:83-93`). `search --limit -1` goes to the app unchecked. Require a positive integer where the flag is a count. S
- Low: `day --out` ignores `--json` and prints text lines (`timetrack-command.ts:810-816`). It also resolves `--out` against the process cwd, not `--root`. S

### agent-rules: git-flow parse

- Medium: with the default empty `keyPrefixes`, a subject that starts with `<word>-<number>` reads as an issue key (`git-flow/parse.ts:50-54`, default pattern at `git-flow/config.ts:71`). `feat/step-2-rework` gives `issueKey: STEP-2`, and timetrack attributes time to an issue that does not exist. Only a `key-case` finding marks it. Do not set `issueKey` for a lowercase match when `keyPrefixes` is empty. S Verified. Timetrack passes the favourite project keys as `keyPrefixes`, so this hits only while that list is empty, where `attribute.ts` trusts `parseBranch` on purpose.
- Low: the prefix check uses `startsWith(prefix)` (`git-flow/parse.ts:54`). Prefix `FI` accepts `FIX-1`, and `EA` accepts `EAX-1`. Compare against `${prefix}-`. S
- Low: a capture group in a configured `keyPattern` shifts `match[2]` (`git-flow/parse.ts:50,64`). With `(FIP|EA)-\d+`, the subject becomes `FIP`. Use a named group for the subject. S
- Low: `renameSuggestion` passes branch text as a replacement string (`git-flow/parse.ts:95`). A subject with `$&` or `$'` expands (git allows `$` in branch names), so the suggestion is wrong. Use a replacer function. S
- Low: `config.typeAliases[prefix]` reads through the prototype (`git-flow/parse.ts:373`). `constructor/FIP-1-x` resolves `type` to a function and parses as a known type. Use `Object.hasOwn`. S

### agent-rules: frontmatter, plan warnings

- Low: a duplicate frontmatter key overwrites the first one with no error (`frontmatter.ts:113`). The parser JSDoc says that anything outside the subset throws. S
- Low: `parseInlineList` splits on every comma, also inside quotes (`frontmatter.ts:43`), so `["a, b"]` gives two entries. `modelInvocation` accepts only the exact text `false` (`frontmatter.ts:156`), so `False` or `no` keep model invocation on. S
- Low: the `disableHooks` warning tests with `in` (`plan.ts:146`), so `"constructor"` or `"toString"` is not reported as unknown. Use `Object.hasOwn`. S
- Low: `collectPathVarWarnings` joins an absolute `themeStylesheet` under the root (`plan.ts:193`), so an absolute path that exists always warns. Use `resolve`. S
- Low: `claudeMdImportsAgentsMd` accepts any symlink target that ends with `AGENTS.md` (`plan.ts:102`), for example `../other/AGENTS.md` or `OLD-AGENTS.md`. The text check also matches `@AGENTS.md` inside a code fence (`plan.ts:104`). S

### cli: doctor, config

- Low: when the primary config is not valid JSON, the runtime falls back to the legacy file (`config/local-config.ts:70-76`), but `diagnoseLocalConfig` reports only the parse error (`config/diagnose.ts:115`). The user does not learn that the legacy values are in force. S
- Low: a legacy file that does not parse gives no problem (`config/diagnose.ts:138`), but `doctor` counts it as present (`doctor/doctor-command.ts:51-53`). The result is "No problems found." for a broken file. S

### cli: api help, state

- Low: an `exec` entry named after a built-in command (`up`, `clear`) or `help` is shadowed with no warning (`api/definition.ts:57-60`, `api/run.ts:353`). `apiHelp` then lists the name twice (`api/help.ts:35-36`). Reject such names when the definitions load. S
- Low: `serviceStates` reads only the first container of each service (`api/state.ts:26`). For a scaled service with one exited replica, the running state depends on container order. S

### Spec gaps

- Spec: `frontmatter.ts` has no spec. Duplicate keys, quoted commas and a list item with no key are untested. S
- Spec: `timetrack-command.ts` has no test for `--at` or `--from`/`--to` date parsing, or for `project` with a relative path. S
