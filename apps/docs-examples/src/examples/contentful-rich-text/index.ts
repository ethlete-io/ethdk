export const CONTENTFUL_RICH_TEXT_EXAMPLES = {
  'contentful-rich-text/embedded-entries': () =>
    import('./embedded-entries.example').then((m) => m.EmbeddedEntriesExampleComponent),
  'contentful-rich-text/lists': () => import('./lists.example').then((m) => m.RichTextListsExampleComponent),
  'contentful-rich-text/tables': () => import('./tables.example').then((m) => m.RichTextTablesExampleComponent),
};
