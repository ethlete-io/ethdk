---
status: accepted
built: cbba0051d
decided: 2026-10-30
source: plans/ethlete-studio/design-system-actions/render-checks.md, 4.43, crop size
---

# A changed-area crop is enlarged at most 2x

Since each change cluster has its own crop (74f42edc1), enlarging each to the column width blurred small crops up to
33x. A crop is enlarged at most 2x (`CROP_MAX_SCALE`, `cbba0051d`) and keeps its own width; narrow crops leave empty
space at the right. This replaces "enlarged to the column width" of ADR 0125.
