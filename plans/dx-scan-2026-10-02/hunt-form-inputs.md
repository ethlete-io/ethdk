# hunt-form-inputs — bug hunt 2026-10-10

Scope: `libs/components/src/lib/forms/{form-field,form,input,textarea,checkbox,switch,slider,dropzone}` and
`provideFormFieldDefaults` (read-only hunt). Findings below are not in `form-inputs.md` (FI-01..10).

Read and found clean: slider engine (step snap, off-grid max, marks, mark snap), single slider keyboard model,
dropzone `isFileAccepted` / size checks / single-mode replace (documented), form-error message resolution and
dev warning, form-field `aria-describedby` assembly (description + one support id), `focusFirstInvalidField`,
`provideFormFieldDefaults` (non-inheriting nesting is documented), checkbox toggle/indeterminate, textarea
autosize.

| ID    | Sev  | Kind | Decision | Title                                                                                                        |
| ----- | ---- | ---- | -------- | ------------------------------------------------------------------------------------------------------------ |
| HF-01 | High | bug  | no       | `et-number-input` rewrites the typed text whenever the parsed number changes: Backspace eats the separator   |
| HF-02 | Low  | bug  | no       | `et-counter` shows the length of the hidden raw value while the control is `mixed`                           |
| HF-03 | Low  | bug  | no       | `et-range-slider` throws on a `null` value (`this.value().map`)                                              |
| HF-04 | Low  | bug  | no       | A number input's parse error and its `-` text survive a reset to `null`                                      |
| HF-05 | Low  | dx   | no       | Headless `input[etPasswordInput]` never mirrors `type` (reveal) or `autocomplete` onto its native host       |
| HF-06 | Low  | dx   | yes      | A bound dropzone with `accept`/size inputs but no `dropzoneFiles()` rule drops rejected files without a word |
| HF-07 | Low  | dx   | no       | `et-counter [max]` has no number transform: `<et-counter max="100" />` fails under `strictTemplates`         |

## HF-01 `et-number-input` rewrites the typed text whenever the parsed number changes: Backspace eats the separator

- Where: `libs/components/src/lib/forms/input/number-input.component.html:3` (`[value]="numberInputDir.displayValue()"`);
  `input/headless/number-input.directive.ts:85` (`displayValue`), `:252-265` (`syncFromNativeInput`); the native-host
  path `:129-130` through `form-field/headless/text-field-control.directive.ts:68-74` (writes when
  `element.value !== String(value)`).
- Problem: every keystroke sets `value` from `valueAsNumber`, and any change of `value` writes `String(value)` back into
  the native input, replacing the user's text. Chrome also puts the caret at the start after a script write to a
  `type="number"` input. Checked in headless Chromium against the running Storybook story
  `components-forms-number-input--default`:
  - type `2.05`, press Backspace: the text becomes `2`, not `2.0` (`2.0` parses to `2`, which differs from `2.05`, so
    `"2"` is written). A second Backspace empties the field. You cannot correct a fraction digit.
  - type `1.5`, press Backspace, type `7`: the text is `71`. The dot is gone and the caret jumped to the start.
  - type `-0.5`: the result is `0.5`. `-0` parses to a value different from `null`, `"0"` is written, and the minus
    sign is lost. No negative number between -1 and 0 can be typed.
- The e2e suite (`apps/storybook-e2e/src/text-inputs/number-password-input.e2e.ts`) only covers stepping, scrubbing and
  the password field. No test types into the number input, and the jsdom spec cannot see it.
- Fix: write to the native input only when its current text does not already parse to the model value, the way React
  compares number inputs loosely: skip the write when `el.valueAsNumber` equals `value` (`Object.is` with `-0` treated as
  `0`), or when `value === null` and the text is empty or `badInput`. In the component, replace the `[value]` binding with
  an effect that runs this check (the native-host `mirrorOntoNativeHost` call needs the same check through a new
  `shouldWrite` option). Add e2e cases for the three sequences above, plus one for a code write while focused (that one
  must still rewrite).
- Breaking: no. Decision: no.
- Status: fixed. A directive effect writes the native text only when it does not already read as the model value; blur rewrites it in the model form; e2e cases in `number-password-input.e2e.ts`.

## HF-02 `et-counter` shows the length of the hidden raw value while the control is `mixed`

- Where: `form-field/counter.component.ts:63` (`current` reads `formField.controlValue()`);
  `form-field/headless/form-field.directive.ts:138` (`controlValue` is the raw `value()`, mixed or not)
- Problem: `mixed-state.md` rule 1 says that while `mixed` is set, the raw value "is not displayed". The input and
  textarea render `''`, and the password strength meter reports `0`. The counter in the same field still renders
  `57 / 100` for a hidden 57-character value, next to an empty input showing the "Mixed" placeholder. The counter
  announcement (`counterRemaining`, at 90 % or more) reads that length aloud too.
- Fix: return `0` from `current` while `registeredControl().mixed?.()` is true (or have `controlValue` mask it), and make
  `isOverLimit` false while mixed. Validation still sees the raw value (rule 6), so leave the field errors alone. Add the
  counter to the mixed-state contract suite (`forms/testing/mixed-state-contract.ts`) or to a counter spec.
- Breaking: no. Decision: no.
- Status: fixed. The counter reads `mixed` off the registered control: `0`, never over limit, no announcement.

## HF-03 `et-range-slider` throws on a `null` value (`this.value().map`)

- Where: `slider/headless/range-slider.directive.ts:140` (`thumbValues`)
- Problem: FI-07 made OTP and phone tolerate a `null` that escapes the type, and HS-02 reports the same for the tag
  input. The range slider is next in line: a model loaded from an API with `priceRange: null`, or a `reset()` to a
  `null`-initialised model, crashes `thumbValues` with `Cannot read properties of null (reading 'map')`. Every thumb, the
  marks and the ARIA bounds read it. The single `et-slider` survives `null`, because `Math.max(min, null)` coerces it to
  `0`.
- Fix: read `this.value() ?? [min, max]` (the default track bounds) in `thumbValues`. `commitThumbValue` already goes
  through `thumbValues`. Add a spec that binds `null as unknown as RangeSliderValue` and expects both thumbs at the
  bounds.
- Breaking: no. Decision: no.
- Status: fixed. `thumbValues` falls back to `[min, max]`.

## HF-04 A number input's parse error and its `-` text survive a reset to `null`

- Where: `input/headless/number-input.directive.ts:69` (`parseError` is a `linkedSignal` on `value`), `:85`
  (`displayValue`), `:261-264`
- Problem: on an empty field, type `-`. Then `value` stays `null` (`null` → `null`), and `parseError` is `true`. A
  "Clear filters" button that does `form.amount().value.set(null)`, or `form().reset()` to a `null` model, writes the
  same `null`. That does not change the source of the `linkedSignal`, so `parseError` stays `true`, and `displayValue`
  stays `''`, so neither the `[value]` binding nor the native-host mirror rewrites the input. The `-` stays visible, and
  the "Please enter a valid number" error comes back on the next touch of a field the app just cleared.
- Fix: clear the native text and `parseError` on an external write. For example, track a write counter: bump it in
  `syncFromNativeInput`, and treat a `value` write that did not come through it as external. That write resets
  `parseError` and forces the native text to `displayValue()`. Add a spec: type `-`, set the value to `null` from the
  host, and expect empty text and no parse error.
- Breaking: no. Decision: no.
- Status: fixed for `reset()` (touched → false clears the text and `parseError`). A `value.set(null)` on an already-`null` value is not observable (Angular drops equal writes); documented in `text-inputs.md`.

## HF-05 Headless `input[etPasswordInput]` never mirrors `type` (reveal) or `autocomplete` onto its native host

- Where: `input/headless/password-input.directive.ts:39,50-53` (the `mirrorOntoNativeHost` call passes neither `type`
  nor `attributes`); compare `input/headless/number-input.directive.ts:129-138`, which mirrors
  `min`/`max`/`step`/`inputmode`
- Problem: on the native host, `toggleRevealed()` flips `revealed` and `inputType()`, but the element stays
  `type="password"`, so the reveal button does nothing. The default `autocomplete` (`current-password`), or a bound
  `[autocomplete]`, never reaches the DOM either. Only a static `autocomplete="..."` attribute survives, as a plain
  attribute. The scenario spec works around this by hand (`[type]="pw.inputType()"`,
  `scenarios/forms-input.scenario.spec.ts:63`). `text-inputs.md` does not mention it. The headless `input[etInput]` has
  the same `autocomplete` gap.
- Fix: pass `type: this.inputType` and `attributes: () => ({ autocomplete: this.autocomplete() || null })` in the
  password directive, and the `autocomplete` attribute in `InputDirective`'s and `NumberInputDirective`'s mirror. Then
  drop the manual `[type]` from the scenario.
- Breaking: no. Decision: no.
- Status: fixed. Password mirrors `type` and `autocomplete`; input and number input mirror `autocomplete`; manual `[type]` dropped from the scenario.

## HF-06 A bound dropzone with `accept`/size inputs but no `dropzoneFiles()` rule drops rejected files without a word

- Where: `dropzone/headless/dropzone.directive.ts:158-172` (the channel exists only when the field has a
  `dropzoneFiles()` rule), `:279`, `:457-460`; `dropzone/dropzone.component.html` (renders no rejection)
- Problem: the FI-10 fix added the `accept` / `maxFileSize` / `minFileSize` inputs. `dropzone.md:220` describes them for
  the case "without a form binding", where `filesReject` is the only signal. With `[formField]="f.avatar"` plus
  `accept="image/*"` (an easy combination: a schema with `required()` only), a dropped PDF is rejected and never uploaded.
  The field shows no error, because there is no channel, and `et-dropzone` renders nothing for `lastRejections`. Unless
  the app listens to `filesReject`, the drop looks like it did nothing.
- Fix (pick one): render `lastRejections()` in `et-dropzone`'s error region when no `dropzoneFiles()` channel carries
  them (labels from `DROPZONE_LABELS`). Or throw a dev-mode warning when a bound field without the rule meets a constraint
  input. Or document that a bound field needs `dropzoneFiles()` for visible rejections.
- Breaking: no. Decision: yes (render vs warn vs document).
- Status: fixed (user decision 2026-10-10: render). `et-dropzone` renders `unhandledRejections()` in its internal error region with `DROPZONE_LABELS` wording.

## HF-07 `et-counter [max]` has no number transform: `<et-counter max="100" />` fails under `strictTemplates`

- Where: `form-field/counter.component.ts:54`
- Problem: this is the FI-08 pattern on a control FI-08 missed. `min="0" step="0.5"` now compiles on the number input,
  but the counter in the same field rejects the static attribute (`string` is not assignable to `number | undefined`),
  although a static limit is the most common way to write it.
- Fix: `input(undefined, { transform: optionalNumberAttribute })` from `internals/number-attributes`.
- Breaking: no. Decision: no.
- Status: fixed. `optionalNumberAttribute` transform on `max`.
