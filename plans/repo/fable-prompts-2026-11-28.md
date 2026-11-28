# Fable lead prompt, after the weekly reset 28.11. 14:00

Tom starts each in a fresh session (`agent-sessions run <name>`), for a full Fable limit. The SDK decoupling is builder row B913 (Tom 28.11.), not Fable work. Paste the block as the
first prompt. Both run beside the builder (`ethlete-sdk-b1`) and the doc session: claim paths before editing
(`ethlete-agent-sessions` skill), take rows from `plans/QUEUE.md` only after telling the builder.

## 1. Perf hunt

```
You lead the perf hunt in ethlete-sdk on branch `next`. Goal: make slow things fast, measured before and after.
Two tracks, in this order of value:

A. Studio speed. Rows B787 (heavy @edit view under 4 s), B768 (cold sketch view, slow-run worker memory),
   B886 (second open after a CLI update), B761 (sketch view loads forever; restart loses Studio) in plans/QUEUE.md
   hold the measurements so far. The hunt is general: speed up every slow design command you meet, not only the one
   a row names. Fixes must help every Studio project, not Studio's own sketches.
B. Test and CI times. Find the slowest specs, projects and CI jobs (`gh run list --branch next`, nx task timings),
   cut wall time without dropping coverage, and fix the flaky CI cluster you find on the way (a flake is a bug,
   not a retry).

Rules: profile first, then fix the measured cause; every fix comes with a number before and after on the same
machine and load (print the load). A fix commit needs a test that fails without it, else it is perf/refactor.
Spread heavy runs over tank, rack and the Mac. Up to 4 subagents at once, sonnet by default, opus for an
unknown cause; tell each: no git stash, no worktrees, no new lint warnings, keep context small. Commit with
`git commit -- <paths>` on `next` (never add -A, never amend), changeset per touched package, push in batches
after green pre-push. Keep plans/QUEUE.md current per slice so a limit cut loses nothing. Report to the doc
session (ethlete-sdk-8a) by SendMessage: row, before/after, commit.
```
