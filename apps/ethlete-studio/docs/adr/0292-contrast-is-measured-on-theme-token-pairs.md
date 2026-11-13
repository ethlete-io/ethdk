---
status: accepted
built: 9ebd61bc0
decided: 2026-11-13
source: doc agent chat 2026-11-13, morning round after the night shift
---

# Contrast is measured on theme token pairs, not per picture

The per-picture CONTRAST rule was removed with the B500 rule cut, because it gave false alarms; nothing checks contrast
now. The doc agent offered three ways: a new per-picture rule with a fixed background measurement, a measurement of the
theme token pairs, or no check. The human answered "q1ok" to the recommendation:

- Every text and background colour comes from a pair of theme tokens. Studio measures these pairs once per theme, in
  the colour foundation (`foundations/colors`), and shows a weak pair at once.
- There is no contrast check per part or per picture.
- A weak pair is fixed in the token, where the colour lives (ADR 0094).
