export const FORMS_EXAMPLES = {
  'forms/form-field-affixes': () =>
    import('./form-field-affixes.example').then((m) => m.FormFieldAffixesExampleComponent),
  'forms/form-field-counter': () =>
    import('./form-field-counter.example').then((m) => m.FormFieldCounterExampleComponent),
  'forms/form-field-warning': () =>
    import('./form-field-warning.example').then((m) => m.FormFieldWarningExampleComponent),
  'forms/color-input-contrast': () =>
    import('./color-input-contrast.example').then((m) => m.ColorInputContrastExampleComponent),
};
