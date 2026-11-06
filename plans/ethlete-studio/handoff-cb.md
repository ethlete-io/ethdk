# Handoff: SDK builder cb, 2026-11-06

cb stopped on Tom's call to run one builder and one doc session (ADR 0207). Every cb slice is committed, cb holds
no claims, and no uncommitted file in the tree belongs to cb.

## Done

- B401 / ADR 0201, `d2c0425e6`: per-rule baseline (`system/rule-baseline.ts`, shared `system/baseline-history.ts`),
  the draw rules CONTROL-STATE, DROPPED-PROP and ACTION-LOST moved into `--slow` with the per-part input-hash cache,
  and `.ethlete/design/studio/rule-baseline.json` with 2 CONTROL-STATE and 21 DROPPED-PROP entries. The as-built note
  follows finding 489 in `design-to-code.md`.
  - Not verified: `design check --product studio --slow` (the run timed out in VISIBLE-CHANGE after 15 min and was
    stopped because it starved other sessions), and the pre-push gate end to end.
  - The commit swept c0's uncommitted finding-498 note in `design-to-code.md` along with B401.
  - `commit-hunks.spec.ts`: `implementation-baseline.json` is now classified SPLIT and `rule-baseline.json` REFUSED,
    because it is keyed by rule and cannot be split per part.

## Open queue (from c4, not started)

1. Follow-up to B401: a `design check --rules --baseline <finding>` writer flag in `design-command.ts`, to build once
   the resident block there has settled. Until then, write a baseline by calling `writeRuleBaseline` from the dist
   (see the as-built note).
2. Findings 501/502/503 for the DROPPED-PROP entries (c4 files them). Then set `finding`/`sketch` per entry in
   `rule-baseline.json`: canvas-frames -> 501, pages/sketches -> 502, pages/system -> 503. The two CONTROL-STATE
   entries keep 489 and the sketch `components/rail-bubble`.
3. Finding 490: a `check --rules` rule that fails when a part with an `os` prop draws a content prop on one OS layout
   but not on all of them. It goes through the B401 baseline.
4. B406 / ADR 0206: `sketch merge` checks in a clean copy of HEAD plus the merged sketch, and refuses only on a dirty
   result file. Specs with bite are listed in c4's brief: foreign dirty file, foreign type error, dirty result file.
5. S6 + S7 of finding 492 / ADR 0204. S6 runs sketch check/ready through the resident process with one shared
   shooter, aiming for `sketch ready` <= 10 s warm. S7 runs the full `design check` through the process with a
   per-part render cache, aiming for <= 60 s warm.

## Known state of others

- `check-system.spec.ts` fails 5 tests in the main tree (an extra `READY acme: ...` line). They pass with only B401
  applied on HEAD, so the cause is c0's uncommitted `part-build-ready.ts` / `actions-command.ts` (finding 498).
- `render-check.ts` (c0, uncommitted) has one lint error (max-params).
