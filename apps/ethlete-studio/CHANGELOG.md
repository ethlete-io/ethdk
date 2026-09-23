# ethlete-studio

## 0.2.0-next.1

### Patch Changes

- A design call now lists its drawings as `variants` in `variant-<key>.ts` files, and `et design check` takes `--variant`; the old `options` key and `--option` flag are gone.

## 0.2.0-next.0

### Minor Changes

- The app version now advances through a changeset, like the Timetrack app, so each release names its version.

### Patch Changes

- A failed agent run now names its error even when the CLI prints that error after its output ends. The summary was sometimes empty.
