# Fable lead prompts, after the weekly reset 28.11. 14:00

Tom starts each in a fresh session (`agent-sessions run <name>`), one per full Fable limit. Paste the block as the
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

## 2. SDK decoupling

```
You lead the SDK decoupling in ethlete-sdk on branch `next`. The plan is plans/repo/decouple-sdk.md (decisions,
couplings 1-7, order 1-5, done-criterion); the inventory is .claude/handoffs/agent-results/decouple-inventory.md.
Do not re-open anything under "Decided" or "Hooks and CI scope". Step 1 (CI per project) is row B912 with the
builder; check its state first and start at the first step not done.

Work the order 2 -> 5: break the cli cycle and the design barrel, move design to private libs/design, Studio
bundles it and its host starts the bundled tool, `et design` becomes a forwarder, Timetrack MCP replaces
`ethlete-agents timetrack`, one-way cli/agent-rules edge, app skills and hooks move into per-app Claude plugins.
Each step lands green on its own (build, lint, test, `yarn release:smoke`) so a limit cut leaves a working repo.
Prove the done-criterion at the end: with Studio and Timetrack removed from a scratch copy of the workspace,
`@ethlete/cli` and `@ethlete/agent-rules` build and pack, and fifagg's `.mcp.json` still opens the design MCP.
A breaking public change gets an `et update` migration.

Rules: up to 4 subagents at once, one large slice each, sonnet by default, opus for cross-file moves; tell each:
no git stash, no worktrees, no new lint warnings, keep context small. Commit with `git commit -- <paths>` on
`next`, changeset per touched package, push in batches after green pre-push. Update the plan's Status line per
step. A product question goes to the doc session (ethlete-sdk-8a), never to Tom directly; take your
recommendation and continue meanwhile.
```
