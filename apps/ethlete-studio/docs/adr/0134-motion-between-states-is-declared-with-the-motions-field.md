---
status: accepted
built: 9c328f48a
decided: 2026-10-30
source: plans/studio/design-system-actions/render-checks.md, 4.54, amended
---

# Motion between states is declared with the motions field

The motion model of ADR 0363 (2026-10-27) applies: a still pair of states plus its `motions`
field, not a new `transitions` field, is enough evidence for now. This finding is that plan's slice 1 (`motions`, the
morph, `ctx`, the check rules); shots and the Studio timeline follow as later slices.
