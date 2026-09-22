---
'@ethlete/components': minor
---

Time picker: `etTimePicker` / `et-time-picker` take `min`, `max` and `timeFilter`, matching the
calendar's bounds, and `et-time-input` / `et-date-time-input` forward them as `minTime` / `maxTime` /
`timeFilter`. Availability is per column - an hour is disabled only when no minute inside it is
selectable - unselectable options stay in place and the keyboard steps over them, and picking a part
moves the finer ones to the first value that works, including the hour behind an AM/PM pick.
