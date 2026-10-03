# form-inputs — DX scan 2026-10-02

Scope: `libs/components/src/lib/forms/{form-field,form,input,textarea,checkbox,switch,slider,rating,otp-input,masked-input,phone-input,color-input,dropzone,description,testing,stories}`, with
`apps/docs/components/{forms,text-inputs,choice-inputs,slider,dropzone,mixed-state}.md`.

| ID    | Sev    | Kind | Decision | Title                                                                                      |
| ----- | ------ | ---- | -------- | ------------------------------------------------------------------------------------------ |
| FI-01 | High   | dx   | yes      | A validator without `message` renders an empty error row, with no dev warning              |
| FI-02 | Medium | bug  | no       | `et-phone-input` lacks `pending`, `warnings`, `hidden` and `maxLength`                     |
| FI-03 | Medium | bug  | no       | `et-slider` cannot be named without an `<et-label>`; `aria-label` triggers ET2201          |
| FI-04 | Medium | dx   | no       | `<et-description>` in `et-form-field` is silently dropped from `aria-describedby`          |
| FI-05 | Medium | dx   | no       | `[warnings]` and the schema-`hidden` fallback exist only on the text-field controls        |
| FI-06 | Medium | dx   | yes      | No app-wide defaults for `et-form-field` `appearance` / `labelMode` / `size` / `fill`      |
| FI-07 | Low    | bug  | no       | `et-otp-input` and `et-phone-input` throw on a `null` value; the sibling controls guard it |
| FI-08 | Low    | dx   | no       | Numeric inputs disagree on attribute transforms (`min="0"` fails on some controls)         |
| FI-09 | Low    | dx   | yes      | `et-dropzone` loses its value type: outputs emit `DropzoneEntry<unknown>` / `unknown`      |
| FI-10 | Low    | dx   | yes      | `et-dropzone` file constraints only work through a `[formField]` binding, with no warning  |

## FI-01 A validator without `message` renders an empty error row, with no dev warning

- Status: fixed (dev-mode warning only); open: default texts need a decision
- Review: fixed (scenarios for RTE, phone input and rating now pass a `message`; the warning was correct)

- Where: `libs/components/src/lib/forms/form-field/form-error.component.ts:31`,
  `libs/components/src/lib/forms/form-field/headless/form-field.directive.ts:165`
- Problem: `form(model, (s) => required(s.email))` is the first thing anyone writes. On a blur the
  field turns red, `aria-invalid="true"` is set, and `aria-describedby` points at the error region.
  The region holds `<et-form-error></et-form-error>`, though, because
  `this.messageResolver?.(error) ?? error.message ?? ''` resolves to `''`. The user sees a red box
  with no reason, and a screen reader announces nothing. The spec pins this behavior
  (`form-error.component.spec.ts`, "should render an empty string for a message-less error"), and
  `forms.md` mentions it only in a side note under "Custom error messages". No dev-mode signal
  points at the fix (`provideFormErrorMessageResolver` or `{ message }`).
- Fix: in dev mode, `console.warn` once per `kind` when the resolved message is empty. Name the
  error `kind` and the two fixes. Then decide whether to ship default texts for the built-in
  signal-forms kinds (`required`, `min`, `max`, `minLength`, `maxLength`, `pattern`, `email`)
  through `FORM_FIELD_LABELS`, so that the localization path already used for `mixed`/`ratingValue`
  covers errors too, and a resolver becomes an override.
- Breaking: no (the warning). The default texts change what renders, so they are a decision.
  Decision: yes, for the default texts.

## FI-02 `et-phone-input` lacks `pending`, `warnings`, `hidden` and `maxLength`

- Status: fixed
- Review: ok (golden phone-input 47571 -> 48562: FI-02 measured +407 B on its own, the rest predates this slice); test audit: phone input added to the wrapper-inputs spec

- Where: `libs/components/src/lib/forms/phone-input/headless/phone-input.directive.ts:36` (extends
  `TextShellControlDirective`, not `TextFieldControlDirective`);
  `libs/components/src/lib/forms/form-field/headless/text-field-control.directive.ts:41-63` (where
  those four inputs live); `phone-input.component.ts:46-62` (no `TEXT_FIELD_CONTROL_INPUTS` spread)
- Problem: the phone input renders in the text shell (`TEXT_FIELD_SHELL_CONTROL_TYPES` includes
  `PHONE_INPUT`) but misses four inputs that every other shell control has:
  - An async validator, such as a phone-number lookup and the most typical one for this control,
    gets no busy spinner and no `aria-busy`. `FormFieldDirective.isPending` reads
    `registeredControl()?.pending?.()`, and that is `undefined` here.
  - `<et-phone-input [warnings]="...">` fails to compile with NG0303, yet `forms.md` §Warnings
    presents `[warnings]` as the way any unbound control takes advisories.
  - A schema `hidden(...)` field stays visible, because `isHidden` reads the absent `hidden` input,
    although `forms.md:372-374` promises the `display: none` fallback.
  - `<et-counter />` gets no schema `maxLength()`.
- Fix: make `PhoneInputDirective` extend `TextFieldControlDirective`. It only needs
  `focusControl`, and the field directive already supplies `focusTarget`. Or add the four inputs to
  it. In `phone-input.component.ts`, replace the hand-written base list with
  `...TEXT_FIELD_CONTROL_INPUTS`. Add the phone input to `text-field-control-inputs.spec.ts`.
- Breaking: no. Decision: no.

## FI-03 `et-slider` cannot be named without an `<et-label>`; `aria-label` triggers ET2201

- Status: fixed
- Review: ok

- Where: `libs/components/src/lib/forms/slider/headless/slider.directive.ts:50,100,107`;
  `libs/components/src/lib/forms/slider/slider.component.html:25-30` (the internal thumb gets no
  `label`); `slider.component.ts` (no label input);
  `form-field/headless/form-field.directive.ts:223-241`
- Problem: `SliderDirective` does not extend `AccessibleNameControlDirective`, and `et-slider` does
  not forward `ACCESSIBLE_NAME_INPUTS`. The only naming hook is `[etSliderThumb] label`, and the
  component's own thumb never binds it. So in a dense filter row,
  `<et-slider [formField]="f.volume" aria-label="Volume" />` puts the attribute on the host, leaves
  the `role="slider"` thumb unnamed, and `hasCustomAccessibleName` (thumbs' labels) stays `false`.
  The dev-mode guard then throws ET2201 and tells the developer to "set aria-label /
  aria-labelledby on the control", which is exactly what they did. `forms.md:360-363` says
  "Every control forwards both onto the element that carries its role". `et-range-slider` is fine
  because `startLabel`/`endLabel` always resolve.
- Fix: make `SliderDirective` extend `AccessibleNameControlDirective` and use its `labelId()` /
  `hasCustomAccessibleName()`. That means the consumer `aria-labelledby` wins, and a thumb `label`
  still counts. Bind `[attr.aria-label]` on the thumb to `label() || slider.ariaLabel()`, and spread
  `...ACCESSIBLE_NAME_INPUTS` into `et-slider`'s host-directive inputs. Add a case to
  `forms/form-field/accessible-name.spec.ts` (it already uses `testing/accessible-name.ts`).
- Breaking: no. Decision: no.

## FI-04 `<et-description>` in `et-form-field` is silently dropped from `aria-describedby`

- Status: fixed (slot + aria-describedby)
- Review: ok

- Where: `libs/components/src/lib/forms/form-field/form-field.component.html:16-18` (no
  `et-description` slot); `form-field/headless/form-field.directive.ts:172-196` (`descriptionId` is
  set only by `choice-field.component.ts:77`)
- Problem: `DESCRIPTION_IMPORTS` sits in the shared import table of `forms.md:60`, and
  `choice-inputs.md` documents that an `et-description` joins the control's `aria-describedby`.
  If you write the same thing in a text field
  (`<et-form-field><et-label>IBAN</et-label><et-input …/><et-description>…</et-description></et-form-field>`),
  the description lands in the default `<ng-content />` inside `.et-form-field-control-slot`. It
  renders next to the native input, inside the control frame, and is never referenced by
  `aria-describedby`. Nothing in dev mode flags it.
- Fix: either add `<ng-content select="et-description" />` to `et-form-field` (under the label
  area, or above the support row) and set `formFieldDir.descriptionId` the way `et-choice-field`
  does, or throw a dev error with a code when an `et-description` is projected into
  `et-form-field`. The first option is the consistent one, because the directive already carries
  `descriptionId`. Document it in `forms.md`.
- Breaking: no. Decision: no. Take the slot unless the designer objects to a description in the
  text shell.

## FI-05 `[warnings]` and the schema-`hidden` fallback exist only on the text-field controls

- Status: fixed except `et-choice-field` (outside this slice: its host needs the `display: none` binding)
- Review: fixed `et-choice-field` now binds `display: none` while hidden, with a spec; test audit: unbound checkbox warnings and switch hidden covered

- Where: `form-field/headless/text-field-control.directive.ts:41,48` (the only declarations);
  `checkbox/headless/checkbox.directive.ts:48-58`, `switch/headless/switch.directive.ts:49-64`,
  `slider/headless/slider.directive.ts:57-68`, `rating/headless/rating.directive.ts:67-86`,
  `otp-input/headless/otp-input.directive.ts:52-67`, `dropzone/headless/dropzone.directive.ts:91-109`
- Problem: `FormFieldControl` declares `warnings?` and `hidden?` for every control, and the field
  directive reads both (`form-field.directive.ts:111,158`). Only the `TextFieldControlDirective`
  subclasses declare them, so:
  - `forms.md:426-437` says the self-hosted controls (`et-slider`, `et-rating`, `et-otp-input`,
    `et-dropzone`, …) show warnings "from the same rule". That holds for a schema `warn()`. But the
    next paragraph's `[warnings]` input, for a control that is not bound to signal forms, fails to
    compile on all of them, and on `et-checkbox`/`et-switch`.
  - A schema-`hidden` slider, rating, OTP or dropzone stays visible, and so does a checkbox/switch
    inside `et-choice-field`. The `display: none` fallback promised in `forms.md:372-374` only
    reaches text controls.
- Fix: move `hidden` and `warnings` to a small shared base, or into `AccessibleNameControlDirective`'s
  sibling, so that every `FormFieldControl` gets them. Bind `display: none` on
  `isHidden()` in the self-hosting components (`et-slider`, `et-range-slider`, `et-rating`,
  `et-otp-input`, `et-dropzone`, `et-choice-field`) the way `et-form-field` does at
  `form-field.component.ts:75`, and forward both inputs. If that is not wanted, narrow the two
  `forms.md` paragraphs to the controls that actually support it.
- Breaking: no. Decision: no.

## FI-06 No app-wide defaults for `et-form-field` `appearance` / `labelMode` / `size` / `fill`

- Status: fixed
- Review: ok

- Where: `libs/components/src/lib/forms/form-field/form-field.component.ts:108-111`
- Problem: every input is a literal default (`box`, `transparent`, `static`, `md`). An app whose
  design uses `labelMode="floating-inside"` has to repeat it on every `<et-form-field>`, or wrap
  the component. Other domains ship a `toProvideFn` config (`provideGridConfig`,
  `providePictureConfig`, `provide*StrategyDefaults`). Forms has `provideFormErrorMessageResolver`
  and label providers, but nothing for the field look. `et-choice-field` and the selection groups
  take `size` the same way.
- Fix: add `provideFormFieldDefaults({ appearance?, fill?, labelMode?, size? })` via `toProvideFn`,
  read as each input's default (`input(defaults.appearance)`), and also have the selection groups
  and `et-choice-field` read `size` from it. Document it in `forms.md` §Appearance.
- Breaking: no. Decision: yes (new public API, name and scope).

## FI-07 `et-otp-input` and `et-phone-input` throw on a `null` value; the sibling controls guard it

- Status: fixed
- Review: ok

- Where: `otp-input/headless/otp-input.directive.ts:72` (`this.value().length`), `:173`
  (`Array.from(raw)` in `sanitize`); `phone-input/headless/phone-input.directive.ts:16,46,71`
  (`raw.replace`, `this.value().length`)
- Problem: `InputDirective` (`input.directive.ts:44-46,58`), `TextareaDirective` (`:54,58`) and
  `ColorInputDirective` all treat a `null` value as empty, and the input directive documents why: a
  bound field may hold `null` at runtime. The OTP and phone directives do not. A model loaded from
  an API with `code: null`, or a `form().reset()` to a `null`-initialised model, crashes the
  control's computeds with `Cannot read properties of null (reading 'length')` (OTP) or `(reading
'replace')` (phone), instead of rendering empty. The `FormValueControl<string>` type stops the
  plain compile-time case. This is about values that escape the type.
- Fix: read `this.value() ?? ''` in both directives (one private `text` computed each), and add a
  spec per control that sets `value` to `null as unknown as string` and expects an empty render.
- Breaking: no. Decision: no.

## FI-08 Numeric inputs disagree on attribute transforms (`min="0"` fails on some controls)

- Status: fixed
- Review: ok

- Where: `input/headless/number-input.directive.ts:46-48` (`min`/`max`/`step`, no transform);
  `textarea/headless/textarea.directive.ts:47-50` (`rows` has `numberAttribute`, `minRows`/`maxRows`
  do not); compare `slider/headless/slider.directive.ts:72-74` (`optionalNumberAttribute` /
  `positiveNumberAttribute`) and `otp-input.directive.ts:62`
- Problem: `<et-slider min="0" max="10">` and `<et-textarea rows="4">` compile, but
  `<et-number-input min="0" step="0.5">` and `<et-textarea minRows="2" maxRows="8">` fail under
  `strictTemplates` (`string` is not assignable to `number | undefined`). Sibling controls teach
  the static-attribute form and then reject it.
- Fix: apply the slider's `optionalNumberAttribute` to the number input's `min`/`max`/`step` and
  the textarea's `minRows`/`maxRows`. Signal forms still binds numbers, which the transforms pass
  through.
- Breaking: no. Decision: no.

## FI-09 `et-dropzone` loses its value type: outputs emit `DropzoneEntry<unknown>` / `unknown`

- Status: fixed (generic component, outputs typed; `value` stays `TValue | TValue[] | null`)
- Review: fixed dropzone test hosts set `upload` before the first render (ET2400); `retryLabel`/`removeLabel`/`replaceLabel`/`uploadErrorLabel` replaced by one `labels` input

- Where: `dropzone/headless/dropzone.directive.ts:79-127` (`DropzoneDirective<TValue = unknown>`);
  `dropzone/dropzone.component.ts:70-92` (non-generic component, hosting the directive)
- Problem: `dropzone.md:181-185` documents `uploadSucceed: DropzoneEntry<TValue>`,
  `deleteSucceed: TValue`, and `deleteFail: { value: TValue; … }`. On `<et-dropzone>`, `TValue`
  is always `unknown`, because a host directive cannot take the component's generic. So
  `(deleteSucceed)="forget($event)"` with `forget(uuid: string)` fails to compile, and the consumer
  casts. The value is also `TValue | TValue[] | null` regardless of `multiple`.
- Fix: make `DropzoneComponent` generic (`DropzoneComponent<TValue>`) and re-expose the outputs off
  `upload`'s inferred type, or document the `unknown` and the cast in `dropzone.md`'s outputs
  table. A `multiple`-aware value type is a bigger API change.
- Breaking: no for the generic. Decision: yes (how far to type it).

## FI-10 `et-dropzone` file constraints only work through a `[formField]` binding, with no warning

- Status: fixed (inputs; schema rule overrides them)
- Review: ok

- Where: `dropzone/headless/dropzone.directive.ts:84,146-152`;
  `dropzone/headless/dropzone-validation.ts:60-64`
- Problem: `accept`, `maxFileSize` and `minFileSize` come only from the bound field's
  `dropzoneFiles()` metadata. A dropzone used with `[(value)]`, for example inside a custom
  composite control or outside a form, has no way to restrict file types. The native picker
  accepts everything, and nothing warns. `dropzone.md` §Validation states that this is by design,
  but it does not mention the unbound case.
- Fix: either add plain `accept` / `maxFileSize` / `minFileSize` inputs that the schema metadata
  overrides, or add one sentence to `dropzone.md` that an unbound dropzone accepts every file.
- Breaking: no. Decision: yes (inputs vs schema-only).
