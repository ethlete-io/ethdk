---
'@ethlete/components': minor
---

Duration input: new `et-duration-input` / `[etDurationInput]` (`DURATION_INPUT_IMPORTS`) - a duration control whose value is total elapsed **milliseconds** (`number | null`), kept out of the `Date` system. Configurable segment layout (`durationFormat`, e.g. `mm:ss`, `hh:mm:ss`, `hh:mm:ss.SSS`) with a lenient typed parse (`130` → `1:30`) committing on blur/Enter. Error code `ET3050` inside the shared date-time block.
