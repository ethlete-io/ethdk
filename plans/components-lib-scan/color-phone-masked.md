# color-input, phone-input, masked-input, forms/testing scan - open findings

Scan of `libs/components/src/lib/forms/{color-input,phone-input,masked-input,testing}` from 2026-09-28. 0 High, 0 Medium open (4 fixed 2026-09-28), 2 Low (6 fixed), 0 Spec. Skipped: stories, the CSS files apart from a check for layers and colours, and most `testing/` drivers. `testing/` is excluded from the build (`tsconfig.lib.json:9`), so it cannot ship.

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

- Low: a bound value whose dial code is not in the table (for example `+999123`) falls back to the default country, and `nationalNumber` keeps all the digits (`headless/phone-input.directive.ts:114-123`). The first keystroke then rewrites the value with the fallback dial code. S
- Low: the search-field CSS copies the menu search styles (`phone-input.component.css:100-133`). Share the select or menu search rule instead. S
