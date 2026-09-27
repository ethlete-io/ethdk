# Components consumer coverage - follow-ups

## Goal

The open items left after the components consumer-coverage work (tasks 1-8) finished on 2026-09-27: the bugs
and user calls the scenarios and E2E suites found but did not fix, and the E2E gaps no suite covers.

## Decided: not now

The approved calls and the deferred stream slot controls and scheduler registry shipped on 2026-09-27. These items
were decided against; reopen one only when a consumer needs it.

- Kept as is: phone input groups by 3 for every country (no per-country format data); cascader leaf mode counts a
  node without `isLeaf` as a branch (documented); `cascaderFromQuery` infers `TValue` as `{}` when an unannotated
  `args` comes before `toNodes` (examples put `toNodes` first); table state saved before 53497453e loses numeric row
  keys once; the password reveal needs `et-form-field`; `et-icon-button` projects only `[etIcon]`; a slider tap with
  no move commits the press value; the filter overlay shows "Show results" without `totalHits` (documented).

## E2E gaps not covered

The headless gaps were covered on 2026-09-27. One is left:

- Masked input: soft keyboard, paste and backspace passed on the iOS Simulator (iPhone 16, iOS 18.6). Dead keys and
  IME composition need a hardware keyboard or a real device: the team Mac has no `ethlete-mac` SSH alias here, and
  `apple-remote.sh` uses Linux-only `ip route` and `grep -oP`.

## Rules kept

- Never run `check.mjs --update` on the allowlist.
- A new public export is a `minor` changeset.
