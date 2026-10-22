export const DROPZONE_EXAMPLES = {
  'dropzone/dropzone-default': () =>
    import('./dropzone-default.example').then((m) => m.DropzoneDefaultExampleComponent),
  'dropzone/dropzone-legacy-v-2-query': () =>
    import('./dropzone-legacy-v-2-query.example').then((m) => m.DropzoneLegacyV2QueryExampleComponent),
  'dropzone/dropzone-multiple': () =>
    import('./dropzone-multiple.example').then((m) => m.DropzoneMultipleExampleComponent),
  'dropzone/dropzone-existing-media': () =>
    import('./dropzone-existing-media.example').then((m) => m.DropzoneExistingMediaExampleComponent),
  'dropzone/dropzone-failing-uploads': () =>
    import('./dropzone-failing-uploads.example').then((m) => m.DropzoneFailingUploadsExampleComponent),
};
