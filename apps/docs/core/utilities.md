# Utilities

Framework-agnostic helpers plus the Angular-specific foundations the rest of the SDK is built on.

## Dependency injection

`createProvider` and friends generate typed provider/inject pairs without token boilerplate — this is the `[provide, inject, token]` tuple pattern used all over the SDK (and referenced by the [query docs](/query/queries#the-query-client)):

```ts
import { createRootProvider } from '@ethlete/core';

export const [provideMyService, injectMyService, MY_SERVICE_TOKEN] = createRootProvider(() => {
  const state = signal(0);
  return { state };
});

// anywhere in an injection context:
const myService = injectMyService();
```

| Factory                                   | Value source     | Root-provided?                                            |
| ----------------------------------------- | ---------------- | --------------------------------------------------------- |
| `createProvider(factory)`                 | Factory function | No — an ancestor must call `provide…()`.                  |
| `createRootProvider(factory)`             | Factory function | Yes — injectable everywhere; `provide…()` only re-scopes. |
| `createStaticProvider(defaultValue?)`     | Static value     | No. `provide…(override)` shallow-merges the override.     |
| `createStaticRootProvider(defaultValue?)` | Static value     | Yes.                                                      |

The returned `inject…()` is typed: plain calls return `T`, `inject…({ optional: true })` returns `T | null`. Also here: `injectHostElement()` (the host's `HTMLElement`) and `injectTemplateRef()`.

## Runtime errors

`RuntimeError` is the SDK-wide error type — a native `Error` with a numeric `code`, formatted as `ET<code>` (`new RuntimeError(1301, 'trigger is missing')` → `"ET1301: trigger is missing"`). An optional third `data` argument is logged as a separate `console.error` right after the throw. Catch and match with `instanceof RuntimeError` and `error.code`.

The component libraries build their per-domain error codes on this — see [Error codes](/components/error-codes) for the code registry and conventions.

## Host listeners

Subscribe to host-element events from an injection context, cleaned up on destroy:

- `createRxHostListener('pointerdown')` → `Observable<PointerEvent>`
- `applyHostListener('click', handler)` / `applyHostListeners({ focus: …, blur: … })`

`createDestroy()` returns an observable that emits once on destroy — a ready-made `takeUntil` source.

## Forms

- `controlValueSignal` — see [Signal utilities](/core/signal-utils#form-control-values).
- `cloneFormGroup(group)` — deep-clones a `FormGroup` including validators, disabled state and nested groups/arrays.
- `getFormGroupValue(group)` — the group's value **including disabled controls**, empty values coalesced to `null`.
- Validators (also grouped under the `Validators` const): `MustMatch(controlName, matchingControlName)` for password-repeat patterns, `IsEmail`, `IsArrayNotEmpty`, and `ValidateAtLeastOneRequired({ keys, checkFalse? })` for "at least one of these fields" groups. Each has a matching error-key const (`MUST_MATCH`, `IS_EMAIL`, …).

## Storage

- **Cookies** — `getCookie`, `setCookie`, `hasCookie`, `deleteCookie`, `getDomain`. `setCookie` defaults: 30-day expiry (`null` → session cookie), `path: '/'`, `sameSite: 'lax'`, domain derived from the hostname. All SSR-safe (no-ops without `document`).
- **Session memory** — `createSessionMemory({ key, parse, serialize })` returns a typed `{ read, write, remove }` store over `sessionStorage`; every operation is guarded, so failures (SSR, quota, parse errors) return `null`/`false` instead of throwing. `createAutoSessionMemoryKey({ element, prefix })` derives a stable key from an element's DOM path — how components persist per-instance UI state across reloads.

## Text & data

- `markdownToHtml(markdown)` / `htmlToMarkdown(html)` — the dependency-free converters behind the [pipes](/core/directives-pipes#pipes), covering the common Markdown feature set including GFM tables and fenced code blocks.
- `clone(value)` — deep clone (objects, arrays, Map/Set, Date, RegExp, typed arrays).
- `equal(a, b)` — deep structural equality; used as the `equal` function for many of the SDK's computed signals.
- `getObjectProperty(obj, 'a.b[2].c')` — nested property access by path; `isObject` / `isArray` type guards.

## Gestures & input

- `createSwipeTracker(startEvent)` — track a touch/mouse swipe from a start event: `update(event)` returns per-move movement/axis-lock info (`isSwiping` vs `isScrolling`), `end()` returns final movement plus px/sec velocities, `cancel()` aborts.
- `KeyPressManager` — detects rapid repeat presses of a single key (`isPressed(event)` is `true` from the second press within 100 ms); used for type-to-repeat behaviors.

## Logging

`createLogger({ scope, feature })` returns `{ log, warn, error }` with a color-coded `[scope feature]` prefix. All loggers go quiet when the URL contains the `et-logger-quiet` query param (`DISABLE_LOGGER_PARAM`). Requires an injection context.

## Small helpers

| Helper                                           | Description                                                                                              |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `clamp(value, min?, max?)`                       | Constrain to a range — **defaults `min: 0`, `max: 100`**.                                                |
| `round(value, precision?)`                       | Round to N decimals (default `0`).                                                                       |
| `createComponentId('et-button')`                 | Process-unique ids per prefix (`et-button-1`, `et-button-2`, …).                                         |
| `Translatable`                                   | `{ i18n, text }` — translation key + fallback text.                                                      |
| `NgClassType`                                    | The value type `[ngClass]` accepts, for typing class inputs.                                             |
| `TypedQueryList<T>` / `switchQueryListChanges()` | A `QueryList` with typed `changes`, and an RxJS operator that switches to a list's changes stream.       |
| `setInputSignal(input, value)`                   | Imperatively write an `input()` signal. Relies on Angular signal internals — a last-resort escape hatch. |
