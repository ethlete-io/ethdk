export const CDK_ACCORDION_EXAMPLES = {
  'cdk-accordion/cdk-accordion-default': () =>
    import('./cdk-accordion-default.example').then((m) => m.CdkAccordionDefaultExampleComponent),
  'cdk-accordion/cdk-accordion-group': () =>
    import('./cdk-accordion-group.example').then((m) => m.CdkAccordionGroupExampleComponent),
};
