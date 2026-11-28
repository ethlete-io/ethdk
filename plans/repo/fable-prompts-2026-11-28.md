# Fable lead prompt, after the weekly reset 28.11. 14:00

Tom starts it in a fresh session (`agent-sessions run <name>`), for a full Fable limit. Fable gets the hunts that need
judgment; diligence work (the SDK decoupling, B913) stays with the builder. Paste the block as the first prompt. It
runs beside the builder (`ethlete-sdk-b1`) and the doc session: claim paths before editing (`ethlete-agent-sessions`
skill), take rows from `plans/QUEUE.md` only after telling the builder.

## Hunt: speed, leaks, security

```
You lead a hunt in ethlete-sdk on branch `next` for problems that need deep judgment to find. Five tracks; pick
by value found, not in order, and spend the limit fully:

A. Runtime speed. Studio rows B787 (heavy @edit view under 4 s), B768 (cold sketch view, slow-run worker memory),
   B886 (second open after a CLI update), B761 (sketch view loads forever) in plans/QUEUE.md hold the
   measurements so far. Speed up every slow design command you meet, not only the one a row names; fixes must
   help every Studio project. Also the libs: hot paths in core, query, components.
B. Test speed. Slowest specs and projects (nx task timings): cut wall time without dropping coverage.
C. CI speed. Slowest jobs and shards (`gh run list --branch next`): caching, sharding, affected scope, and the
   flaky cluster on the way (a flake is a bug, not a retry).
D. Memory leaks. Subscriptions, effects, overlays, listeners, workers, long-running Studio and Timetrack
   processes; the core/query scenario tests carry leak invariants - extend them where a leak hides.
E. Security holes. Agent/MCP endpoints, local servers (bind address, auth, HMAC), path handling, command
   execution, secrets in logs or the repo, dependency advisories. Report a real hole to the doc session at once.

Rules: measure or reproduce first, then fix the proven cause; every speed fix comes with a number before and
after on the same machine and load (print the load); every leak or security fix comes with a test that fails
without it, else the commit is perf/refactor. Spread heavy runs over tank, rack and the Mac. You do the work
yourself: find, judge, fix and verify in this session; that is why this hunt runs on Fable. Subagents only for
first research or a long run whose output would flood your context (sonnet, at most 4), never for a fix or a
verdict; tell each: no git stash, no worktrees, no new lint warnings, keep context small. Commit with `git commit -- <paths>` on `next` (never add -A, never amend),
changeset per touched package, push in batches after green pre-push. A finding you do not fix becomes a row
at the end of plans/QUEUE.md. Keep the queue current per slice so a limit cut loses nothing. Report to the doc
session (ethlete-sdk-8a) by SendMessage: track, row, before/after or bite, commit.
```
