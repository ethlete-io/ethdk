# Form field and inputs scan - open findings

Scan of `libs/components/src/lib/forms/{form-field,input,textarea,checkbox,switch,choice-field,otp-input,tag-input,description,form}`, the `selection-card*` files and `forms/index.ts` from 2026-09-28. 0 High, 9 Medium, 13 Low, 4 Spec. Skipped: stories, most specs, and a line-by-line read of the large CSS files (`form-field.component.css`, `form-field-text-shell-styles.component.css`, `checkbox`/`switch`/`otp-input` CSS). Those files were checked only by grep for layer wrap, colours and positioning.

Paths are relative to `libs/components/src/lib/forms/`.

## input, textarea

- Medium: `PasswordInputDirective.hasValue` and `strength` call `this.value().length` without a null guard (`input/headless/password-input.directive.ts:40,45`, `internals/password-strength.ts:10`). A nullable string field bound with `[formField]` throws on first render. `InputDirective` guards against this on purpose (`input/headless/input.directive.ts:44-46`). Use `(this.value() ?? '')` in both places. S Verified.
- Medium: `TextareaDirective.hasValue` has the same unguarded `this.value().length` (`textarea/headless/textarea.directive.ts:55`). A nullable field throws. Guard it the same way. S Verified.
- Medium: an Alt-scrub on the number stepper writes float noise into the value (`input/number-input.component.ts:190-193`, `input/headless/number-input.directive.ts:126`). The scrub passes `Math.abs(steps) * 0.1` as the multiplier. For 3 steps that is `0.30000000000000004`, so `decimalPrecisionOf(multiplier)` returns 17 and `toFixed(17)` keeps the noise. Round the multiplier, or cap the precision at `decimalPrecisionOf(step) + 1` for a fine step. S Verified (repro).
- Low: `et-number-input` and `et-password-input` sync every keystroke twice. The directive's host `(input)` listener catches the bubbled event from the inner `<input>` (target equals `nativeControl()`), and the template also binds `(input)="syncNativeValue($event)"` (`input/number-input.component.html:18`, `input/password-input.component.html:14`). `et-input` relies on the host listener only. Remove the template binding. S
- Low: `TextareaDirective` mounts `FormFieldTextareaStylesComponent` for every textarea, also one outside a form field (`textarea/headless/textarea.directive.ts:92`). Mount it from the form field when `controlType()` is `textarea`. S
- Low: comments outside the allowlist: `input/headless/password-input.directive.ts:21-23` (explains an input that does not exist), `:121-124` ("used to leave the warning on" is migration narration), `input/headless/number-input.directive.ts:146-147`. S
- Low: roundabout import paths that resolve back into the same folder: `input/number-input.component.ts:19`, `input/password-input.component.ts:16`, `form-field/headless/text-shell-control.directive.ts:6`. S

## form-field

- Medium: `et-counter` announcements are hardcoded English (`form-field/counter.component.ts:92-99`). A localized app announces "characters remaining" in English, and a tag input announces tags as "characters". Move the three strings into `FormFieldLabels` as functions. S Verified.
- Medium: `et-counter` sets `aria-live` in the same change that inserts the first announcement text (`form-field/counter.component.ts:33`). Screen readers do not announce content that arrives together with the live region, so the first "N characters remaining" is usually lost. Keep `aria-live="polite"` on the span permanently. S Verified.
- Low: the error/hint/warning ids use the control `name` when it has one (`form-field/headless/form-field.directive.ts:61-80`). A hand-set `name` with a space produces an id that `aria-describedby` splits into two broken references. The same `name` in two field instances (two open dialogs, or a signal form created with the same `name` option) produces duplicate ids. Signal-forms names are unique per form, so only hand-set names are affected. Always use `FALLBACK_ID`. S
- Low: the dev check throws `MISSING_CONTROL` after the first render (`form-field/headless/form-field.directive.ts:212-226`). A field whose control sits in an `@if` that is false at first render (data still loading) throws in dev mode, although the markup is valid. Re-check when the control registers, or check only when a label or hint exists without a control. S
- Low: `usesTextFieldShell` is a 17-term `===` chain that each new control type must extend by hand (`form-field/headless/form-field.directive.ts:143-162`). Replace it with a `Set` next to `FORM_FIELD_CONTROL_TYPES`, or a `usesTextShell` flag on `FormFieldControl`. S
- Low: `et-label` and `et-description` ship inline `styles` without `@layer components` (`form-field/headless/label.directive.ts:23-43`, `description/description.component.ts:12-18`). Tailwind utilities cannot override them without `!`. Wrap both. S
- Low: `form-field/headless/index.ts` re-exports internals into the public API: `createAnchoredPanelController`, `injectOverlaySurfaceContext`, `registerSingleton`, `reduceSupportPresentation`, `provideFormSupport`/`wireFormSupport`, `hitsInteractiveElement`. Most of them have no `@internal` tag. Tag them `@internal`, or import them by file path and drop them from the barrel. S

## checkbox, switch

- Medium: checkbox and switch toggle on every `keydown.space`, auto-repeat included (`checkbox/headless/checkbox.directive.ts:39`, `switch/headless/switch.directive.ts:40`). If the user holds Space, the control flips on and off many times, and the final state is random. Ignore `$event.repeat`. S Verified.
- Low: `CheckboxDirective.activate` passes `{ focusVisible: false } as unknown as FocusOptions` (`checkbox/headless/checkbox.directive.ts:100`), and `SwitchDirective.activate` omits it (`switch/headless/switch.directive.ts:98`). A label click shows a focus ring on the switch but not on the checkbox. Pick one behaviour for both and drop the double cast. S

## choice-field, selection card

- Medium: in `variant="card"`, the control's stretched `::after` covers the whole panel. Nothing in the label area or the trailing slot is positioned above it (`choice-field/choice-field-card-styles.component.css:33-39`). A link in `et-label`/`et-description` (for example "accept the <a>terms</a>") or a button in `[etSelectionCardTrailing]` cannot be clicked, because the click toggles the control. Give interactive descendants of `.et-selection-card-content` and the trailing slot `position: relative; z-index: 1`. S Verified.
- Low: CSS comments far outside the allowlist, including migration narration ("cdk shipped this with a hardcoded #2e2e2e", `selection-card-styles.component.css:39-40`) and multi-paragraph rationale in `choice-field/choice-field-card-styles.component.css:2-4,6-7,23-32,41-45,48-51`. Cut them to the ordering and workaround facts. S

## otp-input

- Medium: `masked` hides only the visual segments. The invisible native input keeps `type="text"` and holds the PIN in plaintext (`otp-input/otp-input.component.html:21-40`), so a screen reader reads the PIN aloud. Use `type="password"` (or `-webkit-text-security`) while `masked`. S Verified.
- Medium: headless `<input etOtpInput>` never writes the model back to the element (`otp-input/headless/otp-input.directive.ts:153-158`). A programmatic reset, or the re-sanitize after a `length`/`charset` change (`:135-137`), leaves the old text in the input. `inputmode` and `autocomplete="one-time-code"` are also missing. Mirror `value`, `inputMode` and the ARIA state onto the host, the same way `TextFieldControlDirective.mirrorOntoNativeHost` does. M Verified.

## tag-input

- Low: a paste-split regex puts the separators into a character class and escapes everything except `-` (`tag-input/headless/tag-input-field.directive.ts:146-148`). With separators `[',', '-', ';']` the class becomes `[\n,-;]`, a range that includes the digits 0-9, so "a1b" pastes as two tags. Escape `-` too, or build an alternation. S
- Low: a single-character separator commits only when it is the last character (`tag-input/headless/tag-input-field.directive.ts:89-99`). A comma typed in the middle of pending text stays in the text, and the text later commits as one tag that contains the separator. Split on every separator in `handleInput`, the same way the paste handler does. S

## Spec

- Spec: no spec for `createAnchoredPanelController` (outside-pointer and focus-leave close, Tab past the pane edge, reopen during the leave animation, destroy while open). It is shared by select and cascader. M
- Spec: no spec for `et-counter` (explicit `max` vs schema `maxLength`, over-limit, announcements). S
- Spec: no spec for headless `<input etOtpInput>`. The directive spec mounts only `et-otp-input`. S
- Spec: no number-input spec for a scrub with a fine or coarse multiplier across several steps. S
