export const RICH_TEXT_EDITOR_EXAMPLES = {
  'rich-text-editor/rich-text-editor-default': () =>
    import('./rich-text-editor-default.example').then((m) => m.RichTextEditorDefaultExampleComponent),
  'rich-text-editor/rich-text-editor-minimal': () =>
    import('./rich-text-editor-minimal.example').then((m) => m.RichTextEditorMinimalExampleComponent),
  'rich-text-editor/rich-text-editor-with-table-and-alignment': () =>
    import('./rich-text-editor-with-table-and-alignment.example').then(
      (m) => m.RichTextEditorWithTableAndAlignmentExampleComponent,
    ),
  'rich-text-editor/rich-text-editor-images': () =>
    import('./rich-text-editor-images.example').then((m) => m.RichTextEditorImagesExampleComponent),
  'rich-text-editor/rich-text-editor-triggers': () =>
    import('./rich-text-editor-triggers.example').then((m) => m.RichTextEditorTriggersExampleComponent),
  'rich-text-editor/rich-text-viewer-beside-editor': () =>
    import('./rich-text-viewer-beside-editor.example').then((m) => m.RichTextViewerBesideEditorExampleComponent),
  'rich-text-editor/rich-text-editor-multi-language-with-existing-translations': () =>
    import('./rich-text-editor-multi-language-with-existing-translations.example').then(
      (m) => m.RichTextEditorMultiLanguageWithExistingTranslationsExampleComponent,
    ),
  'rich-text-editor/rich-text-editor-multi-language-with-triggers': () =>
    import('./rich-text-editor-multi-language-with-triggers.example').then(
      (m) => m.RichTextEditorMultiLanguageWithTriggersExampleComponent,
    ),
};
