---
'@ethlete/components': minor
---

Forms: new `et-phone-input` control (`PHONE_INPUT_IMPORTS`) — tel entry with a searchable country picker built from the select's headless core. Value is normalized `+<dial><national>`; typing/pasting `+…` re-derives the country by longest dial-code match (manual picks survive shared codes like `+1`), switching countries keeps the national number, and the display groups digits while unfocused (cosmetic only). Zero-dependency country data: ISO+dial codes shipped, names via `Intl.DisplayNames`, emoji flags. The select gains a `mirrorPanelWidth` input (off for compact triggers) and its panel caps at `min(400px, 100vw - 24px)`.
