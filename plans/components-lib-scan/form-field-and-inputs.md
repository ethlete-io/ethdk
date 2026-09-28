# Form field and inputs scan - open findings

Scan of `libs/components/src/lib/forms/{form-field,input,textarea,checkbox,switch,choice-field,otp-input,tag-input,description,form}`, the `selection-card*` files and `forms/index.ts` from 2026-09-28. 0 High, 0 Medium, 1 Low, 4 Spec. Skipped: stories, most specs, and a line-by-line read of the large CSS files (`form-field.component.css`, `form-field-text-shell-styles.component.css`, `checkbox`/`switch`/`otp-input` CSS). Those files were checked only by grep for layer wrap, colours and positioning.

Paths are relative to `libs/components/src/lib/forms/`.

## form-field

- Low: the dev check throws `MISSING_CONTROL` after the first render (`form-field/headless/form-field.directive.ts:199-213`). A field whose control sits in an `@if` that is false at first render (data still loading) throws in dev mode, although the markup is valid. Re-check when the control registers, or check only when a label or hint exists without a control. S

## Spec

- Spec: no spec for `createAnchoredPanelController` (outside-pointer and focus-leave close, Tab past the pane edge, reopen during the leave animation, destroy while open). It is shared by select and cascader. M
- Spec: no spec for `et-counter` (explicit `max` vs schema `maxLength`, over-limit, announcements). S
- Spec: no spec for headless `<input etOtpInput>`. The directive spec mounts only `et-otp-input`. S
- Spec: no number-input spec for a scrub with a fine or coarse multiplier across several steps. S
