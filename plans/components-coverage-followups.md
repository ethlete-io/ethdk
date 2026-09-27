# Components consumer coverage - follow-ups

## Goal

The open items left after the components consumer-coverage work (tasks 1-8) finished on 2026-09-27: the bugs
and user calls the scenarios and E2E suites found but did not fix, and the E2E gaps no suite covers.

## Decided: not now

The approved calls shipped on 2026-09-27. These items were decided against or deferred; reopen one only when a
consumer needs it.

- Deferred until a consumer needs it: a stream slot playback control; a scheduler register/filter/sort helper for a
  custom feature or edit-surface host.
- Kept as is: phone input groups by 3 for every country (no per-country format data); cascader leaf mode counts a
  node without `isLeaf` as a branch (documented); `cascaderFromQuery` infers `TValue` as `{}` when an unannotated
  `args` comes before `toNodes` (examples put `toNodes` first); table state saved before 53497453e loses numeric row
  keys once; the password reveal needs `et-form-field`; `et-icon-button` projects only `[etIcon]`; a slider tap with
  no move commits the press value; the filter overlay shows "Show results" without `totalHits` (documented).

## E2E gaps not covered

- Nested toolbar: needs a story first.
- Picture: `<source>` choice by type and DPR needs a story with those sources.
- The 11 E2E-only entries in `tools/export-coverage/components.allowlist.json`.
- Command palette: colour context (the story has no colour provider).
- Calendar: month and header transitions. Select: the leave animation. Grid: auto-scroll while dragging.
- Rating: fill animation timing. Badge: icon sizing. Phone input: clear animation.
- Masked input: dead keys and soft keyboards on a real device.

## Rules kept

- Never run `check.mjs --update` on the allowlist.
- A new public export is a `minor` changeset.
