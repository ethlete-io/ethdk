export const DESCRIPTION_LIST_EXAMPLES = {
  'description-list/description-list-inline': () =>
    import('./description-list-inline.example').then((m) => m.DescriptionListInlineExampleComponent),
  'description-list/description-list-stacked': () =>
    import('./description-list-stacked.example').then((m) => m.DescriptionListStackedExampleComponent),
};
