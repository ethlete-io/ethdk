---
'@ethlete/components': minor
---

Date, time, date-time and date range inputs: new opt-in `mask` input. With a fixed-width numeric `displayFormat` (`dd.MM.yyyy`, `HH:mm`, …) typing gets guide placeholders (`__.__.____`), auto-inserted separators, paste filtering and a numeric soft keyboard; the lenient blur/Enter commit parsers stay authoritative. Formats a mask can't represent (locale formats like the default `P`/`p`, variable-width or text tokens) are refused with a dev-mode warning and typing stays unmasked. On the date range input each side is its own mask host, so the guide follows the focused field. The duration input deliberately gets no mask (unbounded first segment, right-anchored lenient entry). Supporting API: `[etInputMask]` now accepts `null` to disable the mask conditionally, and `InputMaskHost` grew an optional `resumeNativeSync()` for hosts whose mask can toggle off again.
