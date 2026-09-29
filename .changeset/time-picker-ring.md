---
'@ethlete/components': major
---

Time picker: the column overlay is now a 24h ring; removed `TimePickerColumnDirective`, `TimePickerOptionDirective`, `columns()`, `sides()`, `selectPart` and friends (use `activeSide.set`, drag or type instead), the `hoursLabel`/`minutesLabel`/`secondsLabel`/`periodLabel` inputs and the `--et-time-picker-option-size`/`-column-size` tokens (use `--et-time-picker-ring-size`).
