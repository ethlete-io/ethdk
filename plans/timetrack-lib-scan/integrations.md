# timetrack integrations scan - open findings

Scan of `libs/timetrack/src/lib/{agent-api,agent-session,forge,git,github,gitlab,google-auth,google-calendar,ingest,transport,reporter}` from 2026-09-28. 0 High, 1 Medium, 1 Low, 1 Spec (second pass included; 2 Low closed 2026-09-29: `collectAgentSessions$` isolates unreadable logs, stale cursor rows accepted). Skipped: all specs. The second pass covered `agent-api/model.ts`, the shell-word parser in `agent-session/claude-code.ts` (lines 47-345), the helpers of `agent-session/codex.ts` and `google-calendar/calendars.ts`. OAuth `state` and PKCE live in the Rust host, so this scan could not check them. Every process call passes an args array with no shell, so no command injection was found.

## second pass

Parser findings below were each checked by running the parser on the command shown.

### agent-session: codex

- Medium: `INJECTED_PREFIXES` lists only `<environment_context>` and `<user_instructions>` (`agent-session/codex.ts:135,178`). Current Codex rollout logs also open with user-role messages that start with `# AGENTS.md instructions for` and `<recommended_plugins>`, so each session reports prompts at the instant the CLI starts. Add these prefixes. Codex prompts also carry no `askedBy`, so set `askedBy: 'machine'` for an injected message and do not drop it. S Unverified: needs a current Codex rollout log, and reading `~/.codex` was out of bounds.

### google-calendar

- Low: Nothing outside the spec reads `primary`, `selected` or `readOnly` (`google-calendar/calendars.ts:7-13`), and the app picker does not use `selected` as its default. The `readOnly` JSDoc also describes the token, but `accessRole` is the user's role on the calendar. Remove the fields, or use them in the picker and fix the JSDoc. S

### Spec gaps

- Spec: `learn` replaces `sessionId` on each `session_meta` record (`agent-session/codex.ts:53-59`), and a forked rollout (with `forked_from_id`) holds more than one. No spec reads such a log, so nothing pins which session its turns and prompts go to. Add a fixture with a forked rollout. S
