# RuntimeError

`RuntimeError<T extends number>` is the base error class for all structured errors in the Ethlete SDK. It extends the native `Error` with a numeric code, an `ET`-prefixed message, and an optional data payload.

## Usage

```ts
import { RuntimeError } from '@ethlete/core';

throw new RuntimeError(42, 'Something went wrong');
// Error message: "ET042: Something went wrong"
```

## Features

| Feature | Description |
|---|---|
| **`code`** | The numeric error code, typed as a literal. |
| **`ET` prefix** | The message is automatically prefixed as `ET{code}:` for log searchability. Zero-padded for codes < 100. |
| **`devOnly`** | Pass `true` as the third argument to add a `[DEV ONLY]` prefix — useful for catching misconfiguration in development without affecting production. |
| **`data`** | Pass any extra payload as the fourth argument. It is deep-cloned and `console.error`'d asynchronously for debugging. |

## API

```ts
new RuntimeError(code: number, message: string, devOnly?: boolean, data?: unknown)
```

## Example — defining a domain error set

```ts
const MyErrorCode = {
  INVALID_STATE: 0,
  MISSING_CONFIG: 1,
} as const;

export const invalidState = () =>
  new RuntimeError(MyErrorCode.INVALID_STATE, 'Component is in an invalid state.');

export const missingConfig = (name: string) =>
  new RuntimeError(MyErrorCode.MISSING_CONFIG, `Config "${name}" is missing.`, true);
```
