export const CDK_FORMS_EXAMPLES = {
  'cdk-forms/cdk-input-text': () => import('./cdk-input-text.example').then((m) => m.CdkInputTextExampleComponent),
  'cdk-forms/cdk-slider': () => import('./cdk-slider.example').then((m) => m.CdkSliderExampleComponent),
  'cdk-forms/cdk-select': () => import('./cdk-select.example').then((m) => m.CdkSelectExampleComponent),
  'cdk-forms/cdk-combobox': () => import('./cdk-combobox.example').then((m) => m.CdkComboboxExampleComponent),
};
