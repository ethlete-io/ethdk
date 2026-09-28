# lib scan 2026-09-28 — open decisions and queue

The High findings are fixed. The Medium pass is done. Each domain plan file keeps its
own open lines; this file lists what needs a user decision and what is still queued.

## Decisions for the user

- timetrack: the picker Lucene escaping finding is unverified; it needs a live Jira Cloud call.
- timetrack: the codex reasoning command. A per-command spec, or drop `codex`.
- timetrack: Codex `INJECTED_PREFIXES` needs a real Codex log, and `askedBy: 'machine'` is a
  design call.







- bracket: swiss `MODE_UNSUPPORTED` is unverified. Does the API leave out undrawn rounds?





- bundle goldens: rich-text-editor (3 entries) and dropzone are each about 1.6 kB over. The rich
  text growth comes from new features (862468765, b645e827e, 267f7bdb1); the dropzone growth is
  not checked. Accept with `nx run treeshake:bundle-goldens:update` on a fresh build?
- table persistence: a change in the same tick as a switch to a new store is not saved there
  (from 2b62c6e3e). Left alone.
- dropzone: the readonly file list focus (766bb1f52) is not checked in Storybook (focus ring, axe).

## Low pass (in progress)

Each domain plan file keeps its open Low lines; the decisions are listed there. Flags to check:

- cli: `CI_JOB_TOKEN` is no longer a GitLab token; `et update --ai` passes the prompt in env vars;
  registry lookups read `~/.npmrc`. The `isPortFree` fix is not proven (the bug is macOS-only).
- timetrack: `googleCalendarPaged$` now fails at the page cap, because a capped read deleted real
  meetings. `isNudgeDue`/`dayNudge` now need a `DayBoundary`.
- skeleton: the `aria-busy` e2e checks were changed but not run.
- A stream agent ran prettier over other agents' uncommitted files (whitespace only).

## Queue

- timetrack `stillFocused` tail order: real, but no failing test was found.
