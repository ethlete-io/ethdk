---
'@ethlete/components': minor
---

Forms: new `et-otp-input` control (`OTP_INPUT_IMPORTS`) - segmented one-time-code/PIN entry backed by a single invisible native input for reliable SMS autofill (`autocomplete="one-time-code"`) and native paste. `length`/`charset` (numeric, alphanumeric or RegExp)/`masked` inputs, a `completed` output per full entry, separator-stripping paste handling, and tokens `--et-otp-input-segment-size/-gap/-radius`. Typed characters pop in and the active segment shows a blinking synthetic caret (both respect `prefers-reduced-motion`).
