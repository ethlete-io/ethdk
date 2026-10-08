# ethlete-studio

## 0.2.0-next.3

### Patch Changes

- The checkout picker shows the checkout Studio actually opened, not the first kept one.
- Switching checkouts no longer leaves the calls of the checkout before on screen when the new one fails to read or a slower read lands late.
- A composed verb now hands the agent's tools the variant the compose card names, not whichever variant is on screen when Send is pressed.
- A draft composed while an agent run is going no longer disappears when the run ends.
- The top bar of a call no longer stays hidden because a variant with the same key was scrolled down in the call before.
- The call explorer no longer rounds a call's age up into the next unit, and stored conversations drop turns with missing text.
- The checkout picker names a Windows checkout by its folder instead of its whole path.
- Studio reads a call file as an object literal, so prose that holds `key:` no longer adds a phantom variant and a double-quoted claim reads whole.
- A call opens on the variant picked in it, else on its open or winning variant, and the sidebar count says how many variants are ruled.
- Fix the Rust host: added variant stubs are removed when the call cannot be written, a root folder can be named for a search, a failed re-watch stops the watch before, and PATH entries are split by platform.
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
