# timetrack integrations scan - open findings

Scan of `libs/timetrack/src/lib/{agent-api,agent-session,forge,git,github,gitlab,google-auth,google-calendar,ingest,transport,reporter}` from 2026-09-28. 0 High, 1 Medium, 4 Low, 3 Spec (second pass included). Skipped: all specs. The second pass covered `agent-api/model.ts`, the shell-word parser in `agent-session/claude-code.ts` (lines 47-345), the helpers of `agent-session/codex.ts` and `google-calendar/calendars.ts`. OAuth `state` and PKCE live in the Rust host, so this scan could not check them. Every process call passes an args array with no shell, so no command injection was found.

## agent-session

- Low: One failed `readLines$` fails the whole collection run (`agent-session/collect.ts:116-124`). A log that the agent deletes between `logs$` and the read blocks every other log and every cursor for that run, and again on each timer tick while the listing is stale. Catch per log and keep the old cursor. S Re-rated from Medium: the app collector catches the error and retries on the next tick, cursors are not advanced, and a deleted log drops out of the next listing, so the cost is one delayed run. Decision (2026-09-28 Low pass): a per-log catch alone loses data, because the app collector sets `modifiedAfter = startedAt` after a successful run and a finished session log is never listed again. Options: report the unread logs in the collection and hold `modifiedAfter` back, or keep failing the run.
- Low: Cursors of logs that no longer exist are kept for ever, because `collect` returns every cursor it was given (`agent-session/collect.ts:130-136`). Drop cursors whose id is absent from the listing when `modifiedAfter` is unset. S Decision (2026-09-28 Low pass): the host store upserts cursors (`events_append`), so leaving one out of the result deletes nothing. Options: add a cursor delete to the host store and its port, or accept the stale rows.

## google-auth / google-calendar

## forge / github / gitlab

## git

## agent-api / ingest / reporter

- Low: `agentApiClientOf` removes control characters but keeps Unicode format characters such as U+202E (`agent-api/approval-queue.ts:60-62`). A caller can make its name read as something else in the approval panel. Drop the `\p{Cf}` category as well. S

## Spec gaps

- Spec: No backfill spec reads a Codex log in more than one host read (`agent-session/backfill.ts`). That is the case that hides the High finding above. S

## second pass

Parser findings below were each checked by running the parser on the command shown.

### agent-session: shell parser

### agent-session: codex

- Medium: `INJECTED_PREFIXES` lists only `<environment_context>` and `<user_instructions>` (`agent-session/codex.ts:135`). Current Codex rollout logs also open with user-role messages that start with `# AGENTS.md instructions for` and `<recommended_plugins>`, so each session reports prompts at the instant the CLI starts. Add these prefixes. Codex prompts also carry no `askedBy`, so set `askedBy: 'machine'` for an injected message and do not drop it. S Unverified: needs a current Codex rollout log, and reading `~/.codex` was out of bounds.

### google-calendar

- Low: Nothing outside the spec reads `primary`, `selected` or `readOnly` (`google-calendar/calendars.ts:9-13`), and the app picker does not use `selected` as its default. The `readOnly` JSDoc also describes the token, but `accessRole` is the user's role on the calendar. Remove the fields, or use them in the picker and fix the JSDoc. S

### agent-api/model.ts

### Spec gaps

- Spec: `learn` replaces `sessionId` on each `session_meta` record (`agent-session/codex.ts:53-58`), and a forked rollout (with `forked_from_id`) holds more than one. No spec reads such a log, so nothing pins which session its turns and prompts go to. Add a fixture with a forked rollout. S
- Spec: `claude-code.spec.ts` has no case for comments, `$(...)` with nested quotes, or prefix-word options. These are the inputs behind the two Medium parser findings above. S
