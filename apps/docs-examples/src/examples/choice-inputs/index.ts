export const CHOICE_INPUTS_EXAMPLES = {
  'choice-inputs/checkbox-indeterminate': () =>
    import('./checkbox-indeterminate.example').then((m) => m.CheckboxIndeterminateExampleComponent),
  'choice-inputs/switch-default': () => import('./switch-default.example').then((m) => m.SwitchDefaultExampleComponent),
  'choice-inputs/segmented-button-group-default': () =>
    import('./segmented-button-group-default.example').then((m) => m.SegmentedButtonGroupDefaultExampleComponent),
  'choice-inputs/radio-group-async-validation': () =>
    import('./radio-group-async-validation.example').then((m) => m.RadioGroupAsyncValidationExampleComponent),
  'choice-inputs/checkbox-group-select-all': () =>
    import('./checkbox-group-select-all.example').then((m) => m.CheckboxGroupSelectAllExampleComponent),
  'choice-inputs/checkbox-group-horizontal': () =>
    import('./checkbox-group-horizontal.example').then((m) => m.CheckboxGroupHorizontalExampleComponent),
  'choice-inputs/radio-group-card': () =>
    import('./radio-group-card.example').then((m) => m.RadioGroupCardExampleComponent),
  'choice-inputs/checkbox-card-interactive': () =>
    import('./checkbox-card-interactive.example').then((m) => m.CheckboxCardInteractiveExampleComponent),
  'choice-inputs/segmented-button-group-tabs': () =>
    import('./segmented-button-group-tabs.example').then((m) => m.SegmentedButtonGroupTabsExampleComponent),
  'choice-inputs/rating-default': () => import('./rating-default.example').then((m) => m.RatingDefaultExampleComponent),
};
