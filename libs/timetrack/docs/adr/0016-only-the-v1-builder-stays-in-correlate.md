# Only the v1 builder stays in correlate/

ADR 0014 gives `streamDay` the proposal builder and deletes `correlate/`. ADR 0007 forbids
extracting a shared layer between the two pipelines, which read as an instruction to duplicate the
whole of `correlate/` into `stream/` for the length of M2.

The dependency graph says otherwise. Every file in `correlate/` except `sessionize.ts` and
`correlate-day.ts` roots at `attribute.ts` or `merge.ts`, and neither of those imports anything from
`correlate/` at all. There is one implementation of the ladder, of the merge, of the rounding and of
the description, and `correlateDay` is merely its first caller. That is not a shared layer extracted
from two drifting builders — it is neutral code in the wrong folder, the same misplacement
`AttributionRule` and `RecurringPattern` were in until `settings/`, `reason/` and `ticket/` had to
reach into `correlate/` to import them.

So the correlate-free stages move to `rows/`, `pauseWindows` moves to `stream/`, and `correlate/`
keeps the two files that are genuinely the v1 builder. Tom's decision, on 2026-09-10, over the
alternative of about 1400 duplicated lines.

The test for whether a file is v1 code is its dependencies, not its folder: a file that imports from
`correlate/` is entangled with the pipeline being replaced and gets rebuilt, and a file that does not
never was v1 code.

## Consequences

- `correlate/` holds `sessionize.ts` and `correlate-day.ts`. Step two of M2 deletes both, and with
  them the module. Nothing else has to be unpicked first.
- `correlate/correlate-day.ts` imports `rows/` and `stream/pauses`. The module with the delete date
  depends on the modules that outlive it, which is the direction that lets it be deleted alone.
- The ladder has one implementation, so M3 changes it once and both screens see the change. The drift
  ADR 0007 measured is still real, and it is in `sessionize.ts` — which is exactly what stays behind.
- `stream/` still imports nothing from `correlate/`, so ADR 0004 holds unchanged.
