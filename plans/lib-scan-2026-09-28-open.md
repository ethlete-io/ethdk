# lib scan 2026-09-28 — open decisions and queue

The High findings are fixed. The Medium pass is done. Each domain plan file keeps its
own open lines; this file lists what needs a user decision and what is still queued.

## Decisions for the user

- timetrack: the picker Lucene escaping finding is unverified; it needs a live Jira Cloud call.
- timetrack: Codex `INJECTED_PREFIXES` and `askedBy: 'machine'` are parked until a real Codex log
  exists.

- bracket: swiss `MODE_UNSUPPORTED` is parked until a swiss event gives real API data.

## Low pass (done)

Each domain plan file keeps its open Low lines; the decisions are listed there. Flags to check:

- cli: `CI_JOB_TOKEN` is no longer a GitLab token; `et update --ai` passes the prompt in env vars;
  registry lookups read `~/.npmrc`. The `isPortFree` fix is not proven (the bug is macOS-only).
- timetrack: `googleCalendarPaged$` now fails at the page cap, because a capped read deleted real
  meetings. `isNudgeDue`/`dayNudge` now need a `DayBoundary`.
- A stream agent ran prettier over other agents' uncommitted files (whitespace only).

## Queue

Nothing is queued from the 2026-09-28 scans. The older `core-lib-scan.md` (5 Medium) and
`eslint-plugin-lib-scan.md` (23 Medium) plans still hold open Medium lines.
