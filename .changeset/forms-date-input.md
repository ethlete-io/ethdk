---
'@ethlete/components': minor
---

Forms: new `et-date-input` control (import `DATE_INPUT_IMPORTS`) — a `string`-valued date field (format via `valueFormat`, ISO by default) combining strict typed entry against a locale-aware `displayFormat` with an anchored `et-calendar` picker overlay. Unparseable text stays visible and raises a `parseError` signal while the value stays `null`; `minDate`/`maxDate`/`dateFilter` forward to the picker.
