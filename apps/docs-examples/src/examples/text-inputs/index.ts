export const TEXT_INPUTS_EXAMPLES = {
  'text-inputs/input-default': () => import('./input-default.example').then((m) => m.InputDefaultExampleComponent),
  'text-inputs/number-input-stepping': () =>
    import('./number-input-stepping.example').then((m) => m.NumberInputSteppingExampleComponent),
  'text-inputs/number-input-decimals': () =>
    import('./number-input-decimals.example').then((m) => m.NumberInputDecimalsExampleComponent),
  'text-inputs/color-input-swatches': () =>
    import('./color-input-swatches.example').then((m) => m.ColorInputSwatchesExampleComponent),
  'text-inputs/color-input-pinned-notation': () =>
    import('./color-input-pinned-notation.example').then((m) => m.ColorInputPinnedNotationExampleComponent),
  'text-inputs/masked-input-default': () =>
    import('./masked-input-default.example').then((m) => m.MaskedInputDefaultExampleComponent),
  'text-inputs/otp-input-default': () =>
    import('./otp-input-default.example').then((m) => m.OtpInputDefaultExampleComponent),
  'text-inputs/tag-input-default': () =>
    import('./tag-input-default.example').then((m) => m.TagInputDefaultExampleComponent),
  'text-inputs/phone-input-default': () =>
    import('./phone-input-default.example').then((m) => m.PhoneInputDefaultExampleComponent),
};
