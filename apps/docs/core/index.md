# Core

`@ethlete/core` provides shared primitives used across the Ethlete SDK.

## Installation

```sh
yarn add @ethlete/core
```

## Contents

- [RuntimeError](./runtime-error) — structured errors with numeric codes
- `isObject` — type guard for plain objects
- `createRootProvider` — helper for creating Angular root-level providers with typed injection tokens

See [RuntimeError](./runtime-error) for the foundational error system powering all `ET*` error codes in the SDK.
