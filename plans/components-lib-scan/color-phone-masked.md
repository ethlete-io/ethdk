# color-input, phone-input, masked-input, forms/testing scan - open findings

Scan of `libs/components/src/lib/forms/{color-input,phone-input,masked-input,testing}` from 2026-09-28. 0 High, 0 Medium open (4 fixed 2026-09-28), 8 Low, 2 Spec. Skipped: stories, the CSS files apart from a check for layers and colours, and most `testing/` drivers. `testing/` is excluded from the build (`tsconfig.lib.json:9`), so it cannot ship.

## Bundle size (measured)

I measured each entry with `tools/treeshake/measure-bundle.mjs --external` against the `dist` build from 2026-09-27. I grepped the unminified dumps for `iso2: "kz"`.

| entry                            | gz      | country table |
| -------------------------------- | ------- | ------------- |
| `ButtonComponent` (floor)        | 10.1 kB | absent        |
| `INPUT_IMPORTS`                  | 8.7 kB  | absent        |
| `MASKED_INPUT_IMPORTS`           | 5.7 kB  | absent        |
| `COLOR_INPUT_IMPORTS`            | 49.2 kB | absent        |
| `PhoneInputDirective` (headless) | 9.0 kB  | present       |
| `PHONE_INPUT_IMPORTS`            | 45.3 kB | present       |

The country table does not reach every consumer bundle. `PHONE_COUNTRIES` is a plain array literal and `TRUNK_ZERO_KEPT` is marked `@__PURE__`, so the bundler drops both when phone-input is not imported. The table has 207 entries and costs about 1-1.5 kB gz. Most of the 45 kB for the styled phone input comes from the select stack.

## phone-input

- Low: a bound value whose dial code is not in the table (for example `+999123`) falls back to the default country, and `nationalNumber` keeps all the digits (`headless/phone-input.directive.ts:83`). The first keystroke then rewrites the value with the fallback dial code. S
- Low: `countries` creates a new `Intl.DisplayNames` for each of the 207 countries. The sort then calls `localeCompare(…, locale)` about 1,600 times, and each call builds a collator (`phone-input.component.ts:104-114`, `headless/phone-countries.ts:256`). This is a noticeable delay on first open and on each locale change. Fix: create one `DisplayNames` and one `Intl.Collator` per locale. S
- Low: the search-field CSS copies the menu search styles, and a narration comment says so (`phone-input.component.css:109-133`). Share the select or menu search rule instead. The HTML comment at `phone-input.component.html:1` is a section header, which the comment rules forbid. S

## color-input

- Low: `RGB_PATTERN` accepts mixed separators (`rgb(1,2 3)`, `rgb(1 2 3, 50%)`), which CSS rejects (`headless/internals/color-convert.ts:42`). This matters for the `rgbColor` validator, whose message offers only the pure forms. S
- Low: a swatch button's accessible name is the raw hex string (`color-picker-panel.component.html:45`). A screen reader reads out "#ff0000". Consider a label from the labels set, for example "Swatch 3, #ff0000". S
- Low: the validator messages ("Enter a color as …", "Contrast is …") are hard-coded English and do not come from `injectColorInputLabels` (`color-input-validators.ts:140,163,207`). A consumer can only override them per call. S

## masked-input

- Low: `(compositionstart)` sets `composing` without the target check that `compositionend` has (`headless/input-mask.directive.ts:30`). A composition in another input inside the host leaves `composing` stuck at `true`, and the mask then stops repainting. S
- Low: when the mask changes to `null`, the element keeps the masked text while the model holds the raw value (`headless/input-mask.directive.ts:119-125`, spec `:274`). The next keystroke writes the formatted text and the literals into the model. The spec treats this as intended; document it or repaint the raw value on hand-back. S

## Spec gaps

- Spec: no case covers malformed HSL or RGB numbers (`1.2.3`, `.`) in `color-convert.spec.ts` or `color-parse-corpus.spec.ts`. S
- Spec: no spec runs `stripTrunkZero` or `matchCountryByDialCode` over the full table, and no spec checks for shared-code or 4-digit NANP collisions (`headless/phone-countries.ts`). S
