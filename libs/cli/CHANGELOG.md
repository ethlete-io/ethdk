# @ethlete/cli

## 2.1.0-next.5

### Minor Changes

- [`612d735`](https://github.com/ethlete-io/ethdk/commit/612d73563e1689bbfcf948d26ebe7c59d2420781) Thanks [@TomTomB](https://github.com/TomTomB)! - `et api` now clones a missing API checkout from a `repoUrl` in `ethlete.apis.js`, making
  `apiRepoPaths` optional. `runApiCommand` is async as a result.

- [#3072](https://github.com/ethlete-io/ethdk/pull/3072) [`4bbbb51`](https://github.com/ethlete-io/ethdk/commit/4bbbb5167989a1c3ef2ffeba09fcfd18ba953fba) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `et doctor` to check this machine's config, container engine and API checkouts, `et api
checkout` and `et api pull` (with `--force`) to move an API checkout to the branch it should be on,
  and `et api --help`.

### Patch Changes

- [#3072](https://github.com/ethlete-io/ethdk/pull/3072) [`0fd8ba3`](https://github.com/ethlete-io/ethdk/commit/0fd8ba3dd61cc78409c397c8180f0a675282642f) Thanks [@github-actions](https://github.com/apps/github-actions)! - `et doctor` now says when a directory has neither config file rather than reporting no problems.

## 2.1.0-next.4

### Minor Changes

- [`b6fe4be`](https://github.com/ethlete-io/ethdk/commit/b6fe4beae010aaa2e0e367d636f6759442983395) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `et api` to run an app's backend from a local checkout, declared in `ethlete.apis.js`. The new
  `ethlete.config.local.json` says where the sibling checkouts on this machine live.

## 2.1.0-next.3

### Minor Changes

- [`edea44b`](https://github.com/ethlete-io/ethdk/commit/edea44bf1c494420f02b545202f4b24db9a6395c) Thanks [@TomTomB](https://github.com/TomTomB)! - Update to angular 22

## 2.0.1-next.2

### Patch Changes

- [`b73a127`](https://github.com/ethlete-io/ethdk/commit/b73a127002a06e3aa0c4e7e977b1ad1f3e04e7e6) Thanks [@TomTomB](https://github.com/TomTomB)! - Bump yet again, final one for sure, pinky promise

## 2.0.1-beta.1

### Patch Changes

- [`ddb5d09`](https://github.com/ethlete-io/ethdk/commit/ddb5d09e4bc56e18cc8c228aa78a200441e7a766) Thanks [@TomTomB](https://github.com/TomTomB)! - Bump to beta

## 2.0.1-next.0

### Patch Changes

- [`a690217`](https://github.com/ethlete-io/ethdk/commit/a6902172efd9bd1956a16237e79acbfbd816d946) Thanks [@TomTomB](https://github.com/TomTomB)! - Version bump only

## 2.0.0

### Minor Changes

- [`10802c0`](https://github.com/ethlete-io/ethdk/commit/10802c0ecef8907b2ab27f42680aa5b47db76f7d) Thanks [@TomTomB](https://github.com/TomTomB)! - Update to Angular v20

### Patch Changes

- Updated dependencies [[`10802c0`](https://github.com/ethlete-io/ethdk/commit/10802c0ecef8907b2ab27f42680aa5b47db76f7d)]:
  - @ethlete/dsp@0.3.0

## 1.0.0

### Minor Changes

- [`1dd18fb`](https://github.com/ethlete-io/ethdk/commit/1dd18fb077b9b377384daac8eacae5732d7e7a3a) Thanks [@TomTomB](https://github.com/TomTomB)! - Update angular 19

### Patch Changes

- Updated dependencies [[`1dd18fb`](https://github.com/ethlete-io/ethdk/commit/1dd18fb077b9b377384daac8eacae5732d7e7a3a)]:
  - @ethlete/dsp@0.2.0

## 0.2.2

### Patch Changes

- [`69ee325`](https://github.com/ethlete-io/ethdk/commit/69ee32561bf0df78569a1649053a37edf9741b9c) Thanks [@TomTomB](https://github.com/TomTomB)! - Bump only for updating peer deps

## 0.2.1

### Patch Changes

- [`0328fb76`](https://github.com/ethlete-io/ethdk/commit/0328fb769ca53042835826c1967b8d2f25072d63) Thanks [@TomTomB](https://github.com/TomTomB)! - Dependency sync only

- Updated dependencies [[`0328fb76`](https://github.com/ethlete-io/ethdk/commit/0328fb769ca53042835826c1967b8d2f25072d63)]:
  - @ethlete/dsp@0.1.2

## 0.2.0

### Minor Changes

- [`9605da51`](https://github.com/ethlete-io/ethdk/commit/9605da5186a036ee052668a8c390be8332178398) Thanks [@TomTomB](https://github.com/TomTomB)! - Add release script

## 0.1.1

### Patch Changes

- [`04e0db6`](https://github.com/ethlete-io/ethdk/commit/04e0db6c0007d58705f88605f3f8ed2d0ad05ce3) Thanks [@TomTomB](https://github.com/TomTomB)! - Update to Angular 16

## 0.1.0

### Minor Changes

- [#609](https://github.com/ethlete-io/ethdk/pull/609) [`39eda21`](https://github.com/ethlete-io/ethdk/commit/39eda21929f50b75071ad464c3331d85f3645fa1) Thanks [@nziermann](https://github.com/nziermann)! - Add a dsp function to generate css based on input file
