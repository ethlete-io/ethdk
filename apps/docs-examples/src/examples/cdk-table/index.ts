export const CDK_TABLE_EXAMPLES = {
  'cdk-table/cdk-table': () => import('./cdk-table.example').then((m) => m.CdkTableExampleComponent),
  'cdk-table/cdk-sort': () => import('./cdk-sort.example').then((m) => m.CdkSortExampleComponent),
};
