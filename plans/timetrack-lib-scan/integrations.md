# timetrack integrations scan - open findings

Scan of `libs/timetrack/src/lib/{agent-api,agent-session,forge,git,github,gitlab,google-auth,google-calendar,ingest,transport,reporter}` from 2026-09-28. 1 High, 8 Medium, 27 Low, 3 Spec (second pass included). Skipped: all specs. The second pass covered `agent-api/model.ts`, the shell-word parser in `agent-session/claude-code.ts` (lines 47-345), the helpers of `agent-session/codex.ts` and `google-calendar/calendars.ts`. OAuth `state` and PKCE live in the Rust host, so this scan could not check them. Every process call passes an args array with no shell, so no command injection was found.

## agent-session

- High: The backfill parses each host read with no `resume`, so a Codex log longer than one read loses `sessionId`, `cwd` and `model` after the first chunk (`agent-session/backfill.ts:63`). `usageOf` and `promptOf` in `codex.ts:115,174` then drop every turn and prompt of the later chunks, and the spend of long Codex sessions stays missing. Carry `parsed.session` (and cwd) from chunk to chunk in `readToEnd$`, as `collect.ts` does. S Verified.
- Low: One failed `readLines$` fails the whole collection run (`agent-session/collect.ts:116-124`). A log that the agent deletes between `logs$` and the read blocks every other log and every cursor for that run, and again on each timer tick while the listing is stale. Catch per log and keep the old cursor. S Re-rated from Medium: the app collector catches the error and retries on the next tick, cursors are not advanced, and a deleted log drops out of the next listing, so the cost is one delayed run.
- Low: A log that needs more than `MAX_READS_PER_LOG` reads never reaches its end, so it gets no cursor and is read again from line 0 on every run (`agent-session/backfill.ts:59,118-119`). Because `pending.slice(0, perRun)` takes the same logs first each time, five such logs stall the pass for good and `remaining` never reaches 0. Store a partial cursor with `nextLine`, or move unfinished logs to the back. S Re-rated from Medium: the host caps a read at 20,000 lines (`logs.rs` `MAX_LINES`), so this needs a log of over 4 million lines.
- Medium: A custom title from an earlier batch is lost when a later batch holds an `ai-title` record, because `titles.generated` wins over `resume.title` (`agent-session/claude-code.ts:582-586`). A session the user renamed goes back to the generated name once the cursor passes the `custom-title` record. Store which kind the cursor title is, and let a stored custom title beat a new generated one. S Verified.
- Low: Cursors of logs that no longer exist are kept for ever, because `collect` returns every cursor it was given (`agent-session/collect.ts:130-136`). Drop cursors whose id is absent from the listing when `modifiedAfter` is unset. S
- Low: The `AgentLogPass` JSDoc tells the history of renamed passes (`agent-session/ports.ts:13-17`). That is migration narration under the AGENTS.md comment rules; keep the invariant that a new pass name reads from line 0 and delete the rest. S

## google-auth / google-calendar

- Medium: A 401 from the Calendar API never invalidates the held access token (`google-auth/token-source.ts:93`, `google-calendar/client.ts:64`). When Google revokes a token early (password change, admin action), every fetch fails with "needs refreshing" until the held expiry passes, up to an hour. Call `invalidate()` on a `GoogleCalendarRequestError` with status 401 and retry once. S Verified.
- Medium: `GoogleCalendarRequestError.rateLimited` is set but nothing reads it, and no client retries a 429 (`google-calendar/client.ts:32`, `forge/cli.ts:75`, `gitlab/client.ts:50`). One quota breach fails the whole source for that run. Add a bounded retry with backoff on rate-limit errors, honouring `Retry-After` where the transport exposes headers. M Verified.
- Low: `googleCalendarPaged$` stops at `maxPages` and returns what it has with no signal (`google-calendar/client.ts:146`). A wide window over a busy shared calendar loses its latest events without a failure line. Report the cap as `github/events.ts` does with `reachedBackTo`. S
- Low: The `GoogleCalendarCredentials` JSDoc says the host owns the refresh and the core never renews a token (`google-calendar/client.ts:4-8`). `google-auth/token-source.ts` renews it in the core now; fix the comment. S

## forge / github / gitlab

- Medium: GitLab activity is silently cut at `maxPages` x `pageSize` = 2000 events, and because the feed is newest-first the oldest days of the window go missing (`gitlab/events.ts:91-98`, `forge/cli.ts:138-141`). A first run over a long window reports success with a hole at its start. Return a `reachedBackTo` like `github/events.ts:140-149` and surface it in `collectGitLabEvents$`. S Verified.
- Low: GitHub answers a rate limit with HTTP 403 "API rate limit exceeded", which `messageFor` reports as a login that may not read the resource (`forge/cli.ts:73`). Match the stderr text before the status branch. S
- Low: `resolveMergeRequests$` skips events with a `branch`, but `collectGitLabEvents$` already dropped every event without `mergeRequestIid`, and only pushes carry a branch (`gitlab/collect.ts:51,129`). The check is dead and its comment describes behaviour that no longer exists. Remove both. S
- Low: `parseGitLabRemoteUrl` drops the port, while `normalizeGitLabHost` keeps it (`gitlab/project.ts:5`, `gitlab/client.ts:33`). A self-hosted GitLab on a non-default port never matches in the app callers, so merge request features stay off with no message. Compare hostnames without the port, or keep the port in both. S
- Low: `gitlabRequest$` throws away the error body, so a 400/422 from a create or update loses GitLab's own reason (`gitlab/client.ts:100-105`). Append `body.message` to the error text. S
- Low: `withQuery` is copied three times (`forge/cli.ts:47`, `gitlab/client.ts:36`, `google-calendar/client.ts:45`). Move one copy to `transport/`. S
- Low: The three paged helpers concatenate with `[...all, ...items]` in `reduce`, which copies the list on every page (`forge/cli.ts:156`, `gitlab/client.ts:156`, `google-calendar/client.ts:148`). Push into the accumulator instead. S

## git

- Low: A failed `git status` reads as a clean tree (`git/state.ts:49`). With `index.lock` present or a broken repository, `ticket/start.ts:335` and `ticket/repair.ts:217` do not refuse and go on to rename or create branches over an unknown state. The JSDoc promises the opposite. Treat a non-zero exit as dirty, or return an unreadable state that the planners refuse. S Re-rated from Medium (repro): `git status --porcelain` exits 0 with `index.lock` present, and a broken repository also fails `for-each-ref`, which trips `branch-missing` / `base-missing`. Only a corrupt index fails status alone; then `git checkout -b` still succeeds.
- Medium: `--until` filters on the commit date, so a commit authored inside the window but rebased or amended after it is never returned (`git/scan.ts:47-48`). A day scanned for the first time after a rebase loses those commits, although `parseGitLog` filters by author date on purpose. Drop `--until` (or widen it to now) and let the author-date window decide. S Verified.
- Low: `--author=` takes a regex, so `.` and `+` in an email address match more than the one author, and `[` makes git fail (`git/scan.ts:50`). Escape the value, or pass `--fixed-strings` together with it. S
- Low: `SELECTOR`, `OBJECT_NAME` and the checkout regex are copied between `git/head.ts:5-9` and `git/reflog.ts:4-11`, with two parsers for the same output. Share one reflog line parser. S

## agent-api / ingest / reporter

- Low: `agentApiClientOf` removes control characters but keeps Unicode format characters such as U+202E (`agent-api/approval-queue.ts:60-62`). A caller can make its name read as something else in the approval panel. Drop the `\p{Cf}` category as well. S
- Low: `heartbeatRecordOf` only strips a `/`-joined root, so on Windows the directory is reported as the full absolute path (`ingest/heartbeat.ts:45`). Normalise separators before the prefix check. S
- Low: `parseIngestedRecords` puts no length bound on posted strings (`ingest/parse.ts:35-38`). A broken reporter can write multi-megabyte `branch` or `directory` values to the store. Cap each field. S

## Spec gaps

- Spec: No backfill spec reads a Codex log in more than one host read (`agent-session/backfill.ts`). That is the case that hides the High finding above. S

## second pass

Parser findings below were each checked by running the parser on the command shown.

### agent-session: shell parser

- Medium: `closingOf` for `(` reads an apostrophe inside a nested double-quoted string as the start of a single-quoted string (`agent-session/claude-code.ts:64`). `x=$(echo "it's"); rm build.log` swallows the rest of the command, so the `rm` step is lost and the write reads as a read. Skip nested `"` strings with `closingOf` too, the same way as `'`. S Verified (repro).
- Medium: The parser has no `#` comment rule (`agent-session/claude-code.ts:96-163`). `# don't touch` followed by `rm build.log` on the next line opens a quote at the apostrophe and drops the `rm`; `echo hi # > out.txt` counts as a write to `out.txt`. When `#` starts a word, skip to the end of the line. S Verified (repro).
- Low: A redirect target stays set across a step boundary when no word followed it, because `endWord` returns before it resets `target` (`agent-session/claude-code.ts:78-85`). `cmd 2> >(grep x >&2)` records `grep` as a written file. Reset `target` in `endStep`. S
- Low: `mv notes.txt /tmp/` reads as no write, because `mv` checks only its last operand (`agent-session/claude-code.ts:296-299`). `mv` removes its sources from the tree; check every operand for `mv`. S
- Low: `programOf` drops prefix words but not their options (`agent-session/claude-code.ts:199-200`). `sudo -u me rm file`, `nice -n 5 rm f`, `env -u X rm f` and `timeout -s KILL 10 rm f` all resolve to a program such as `-u`, and `sh -ec 'rm f'` misses `-c` inside a combined flag (`:295`). Skip each prefix's options with their values, and match `c` inside a short-flag group. S
- Low: The `perl` in-place check `/^-[a-zA-Z]*i/` also matches `-Ilib` and `-MList::Util` (`agent-session/claude-code.ts:282`). Such a read counts as a write. Match `i` only in a group of single-letter switches that has no `I` or `M` before it. S
- Low: Two quoting forms parse wrong (`agent-session/claude-code.ts:103-111`). `$'a\'b'; rm out.txt` ends the ANSI-C string at `\'` and swallows the `rm`, and inside double quotes every backslash is removed, although bash keeps one before a character other than `$`, backtick, `"`, `\` and newline. Treat `$'` as its own quote with escapes, and unescape only the five characters. S
- Low: The heredoc end regex starts with `^\s*` under the `m` flag (`agent-session/claude-code.ts:149`). A plain `<<` body line with an indented delimiter ends the body early, and a blank line before the delimiter makes the match start there, so the parser reads the delimiter line as a command. Allow leading tabs only for `<<-`, and use `[ \t]*` in place of `\s*`. S
- Low: `workedInOfTool` takes the directory only from a leading `cd` step (`agent-session/claude-code.ts:332-335`). `git -C /other commit`, `bash -c "cd /other && rm x"` and `ls; cd /other && rm x` all credit the write to the session directory. Take the directory from the `cd` or `-C` in force at the writing step. M

### agent-session: codex

- Medium: `INJECTED_PREFIXES` lists only `<environment_context>` and `<user_instructions>` (`agent-session/codex.ts:135`). Current Codex rollout logs also open with user-role messages that start with `# AGENTS.md instructions for` and `<recommended_plugins>`, so each session reports prompts at the instant the CLI starts. Add these prefixes. Codex prompts also carry no `askedBy`, so set `askedBy: 'machine'` for an injected message and do not drop it. S Unverified: needs a current Codex rollout log, and reading `~/.codex` was out of bounds.

### google-calendar

- Low: Nothing outside the spec reads `primary`, `selected` or `readOnly` (`google-calendar/calendars.ts:9-13`), and the app picker does not use `selected` as its default. The `readOnly` JSDoc also describes the token, but `accessRole` is the user's role on the calendar. Remove the fields, or use them in the picker and fix the JSDoc. S

### agent-api/model.ts

- Low: Three JSDoc blocks break the AGENTS.md comment allowlist with rationale and history (`agent-api/model.ts:168-171` "here on purpose ... see ADR 0013", `:121-122` "opened before the grain was the branch", `:523-524` "collected before Timetrack recorded file paths"). Keep the contract sentence in each and delete the rest. S

### Spec gaps

- Spec: `learn` replaces `sessionId` on each `session_meta` record (`agent-session/codex.ts:53-58`), and a forked rollout (with `forked_from_id`) holds more than one. No spec reads such a log, so nothing pins which session its turns and prompts go to. Add a fixture with a forked rollout. S
- Spec: `claude-code.spec.ts` has no case for comments, `$(...)` with nested quotes, or prefix-word options. These are the inputs behind the two Medium parser findings above. S
