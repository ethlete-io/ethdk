export const SELECT_EXAMPLES = {
  'select/select-default': () => import('./select-default.example').then((m) => m.SelectDefaultExampleComponent),
  'select/select-object-values': () =>
    import('./select-object-values.example').then((m) => m.SelectObjectValuesExampleComponent),
  'select/select-multiple': () => import('./select-multiple.example').then((m) => m.SelectMultipleExampleComponent),
  'select/select-all': () => import('./select-all.example').then((m) => m.SelectAllExampleComponent),
  'select/select-searchable': () =>
    import('./select-searchable.example').then((m) => m.SelectSearchableExampleComponent),
  'select/select-custom-values': () =>
    import('./select-custom-values.example').then((m) => m.SelectCustomValuesExampleComponent),
  'select/select-pick-only': () => import('./select-pick-only.example').then((m) => m.SelectPickOnlyExampleComponent),
  'select/select-option-group': () =>
    import('./select-option-group.example').then((m) => m.SelectOptionGroupExampleComponent),
  'select/select-country': () => import('./select-country.example').then((m) => m.SelectCountryExampleComponent),
};
