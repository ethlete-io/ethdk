export const CDK_BRACKET_EXAMPLES = {
  'cdk-bracket/cdk-bracket-double-elimination': () =>
    import('./cdk-bracket-double-elimination.example').then((m) => m.CdkBracketDoubleEliminationExampleComponent),
  'cdk-bracket/cdk-bracket-swiss': () =>
    import('./cdk-bracket-swiss.example').then((m) => m.CdkBracketSwissExampleComponent),
};
