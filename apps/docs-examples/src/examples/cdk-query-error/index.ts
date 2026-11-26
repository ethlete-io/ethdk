export const CDK_QUERY_ERROR_EXAMPLES = {
  'cdk-query-error/cdk-query-error': () =>
    import('./cdk-query-error.example').then((m) => m.CdkQueryErrorExampleComponent),
  'cdk-query-error/cdk-query-button': () =>
    import('./cdk-query-button.example').then((m) => m.CdkQueryButtonExampleComponent),
};
