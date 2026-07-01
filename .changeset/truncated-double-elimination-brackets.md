---
'@ethlete/cdk': patch
---

Fix rendering of truncated double elimination brackets

Brackets whose data ends before the grand final (e.g. only the currently available rounds are loaded) no longer crash and now draw their lower bracket connector lines correctly:

- The last lower bracket round is no longer left without a relation when there is no final round to feed into (it now terminates with a `one-to-nothing` relation), which previously caused a `Cannot destructure property 'nextRoundMatchPosition'` error.
- `generateMatchRelationsNew` skips matches whose round has no resolved relation instead of throwing, so incomplete brackets degrade gracefully.
- Lower bracket rounds are now separated by a gap column even when no finals section exists, so their connector lines are no longer collapsed to zero width and become invisible.

Brackets that are truncated at the front (missing the first winner bracket round) are covered by the same changes.
