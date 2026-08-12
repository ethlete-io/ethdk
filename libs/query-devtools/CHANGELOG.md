# Changelog

## 1.0.0-next.1

### Minor Changes

- [#3057](https://github.com/ethlete-io/ethdk/pull/3057) [`bb78b37`](https://github.com/ethlete-io/ethdk/commit/bb78b3725ec66ff98bcbd9e2e8d90e190173ecca) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: a **Locks** tab listing every Web Lock held across the origin - the auth and polling elections decoded, how many tabs are in each, and where this tab stands.

## 1.0.0-next.0

### Major Changes

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`7245dc7`](https://github.com/ethlete-io/ethdk/commit/7245dc788ddab057e39b8ac8aeb1e7c019baa2dc) Thanks [@github-actions](https://github.com/apps/github-actions)! - The devtools panel moved out of `@ethlete/components` into its own package, `@ethlete/query-devtools`, where `<et-query-devtools-lazy>` loads it on first open instead of shipping it - 125 kB gz an application no longer pays.

### Patch Changes

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`bbb294f`](https://github.com/ethlete-io/ethdk/commit/bbb294fd9d99d8f7d0ab0036af819fb734d0e136) Thanks [@github-actions](https://github.com/apps/github-actions)! - Mark `@analogjs/vitest-angular` an optional peer dependency, so installing the devtools no longer
  asks consumers for a test runner the package only needs to run its own specs.
