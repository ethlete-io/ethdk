---
'@ethlete/components': minor
---

Forms: new `et-phone-input` control (`PHONE_INPUT_IMPORTS`) - tel entry with a searchable country picker built on the select's headless core. Value is normalized `+<dial><national>`.

- Typing/pasting `+…` (or a `00…` international prefix) re-derives the country by longest dial-code match; manual picks survive shared codes like `+1`, switching countries keeps the national number, and a leading national trunk `0` is stripped (`0171…` → `+49171…`).
- Digits are grouped for display while unfocused (cosmetic only); the country picker searches names and dial codes, shows an empty state, keeps a fixed panel width, and takes custom flag art via `ng-template[etPhoneInputFlag]`.
- Zero runtime dependency: ISO + dial codes shipped, names via `Intl.DisplayNames`, emoji flags.
- The underlying select gained a `mirrorPanelWidth` input (off for compact triggers), with the panel capped at `min(400px, 100vw - 24px)`.
