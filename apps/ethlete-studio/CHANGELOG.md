# ethlete-studio

## 0.2.0-next.3

### Patch Changes

- Studio reads a call file as an object literal, so prose that holds `key:` no longer adds a phantom variant and a double-quoted claim reads whole.
- A call opens on the variant picked in it, else on its open or winning variant, and the sidebar count says how many variants are ruled.
- The call title bar no longer covers the top of a drawing: the drawing starts below it, and it fades out while the drawing scrolls down and back in on scroll up.

## 0.2.0-next.2

### Minor Changes

- Timetrack and Studio now update themselves. At startup, a release build downloads a newer release, and a "Restart to update" button installs it. AppImage, deb, macOS and Windows installs can update. A deb install asks for the administrator password.

### Patch Changes

- Timetrack and Studio now ship a Windows installer, and the Timetrack build includes transcription.

## 0.2.0-next.1

### Patch Changes

- A design call now lists its drawings as `variants` in `variant-<key>.ts` files, and `et design check` takes `--variant`; the old `options` key and `--option` flag are gone.

## 0.2.0-next.0

### Minor Changes

- The app version now advances through a changeset, like the Timetrack app, so each release names its version.

### Patch Changes

- A failed agent run now names its error even when the CLI prints that error after its output ends. The summary was sometimes empty.
