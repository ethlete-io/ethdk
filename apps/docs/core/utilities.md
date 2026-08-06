# Utilities

Framework-agnostic helpers plus the Angular-specific foundations the rest of the SDK is built on.

## Dependency injection

`defineProvider` and friends generate typed provider/inject pairs without token boilerplate. Each returns a **definition** - `{ provide, inject, token }` - and you name the halves with `toProvideFn`, `toInjectFn` and `toToken`:

```ts
import { defineRootProvider, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

const MY_SERVICE_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const state = signal(0);
  return { state };
});

export const provideMyService = /* @__PURE__ */ toProvideFn(MY_SERVICE_DEF);
export const injectMyService = /* @__PURE__ */ toInjectFn(MY_SERVICE_DEF);
export const MY_SERVICE_TOKEN = /* @__PURE__ */ toToken(MY_SERVICE_DEF);

// anywhere in an injection context:
const myService = injectMyService();
```

| Factory                                   | Value source     | Root-provided?                                            |
| ----------------------------------------- | ---------------- | --------------------------------------------------------- |
| `defineProvider(factory)`                 | Factory function | No - an ancestor must call `provide…()`.                  |
| `defineRootProvider(factory)`             | Factory function | Yes - injectable everywhere; `provide…()` only re-scopes. |
| `defineStaticProvider(defaultValue?)`     | Static value     | No. `provide…(override)` shallow-merges the override.     |
| `defineStaticRootProvider(defaultValue?)` | Static value     | Yes.                                                      |

The returned `inject…()` is typed: plain calls return `T`, `inject…({ optional: true })` returns `T | null`. Also here: `injectHostElement()` (the host's `HTMLElement`) and `injectTemplateRef()`.

### Why four statements instead of one

The old shape was one line - `export const [provideMyService, injectMyService] = createRootProvider(…)`. It is gone, and the split is not cosmetic: **array destructuring invokes the iterator protocol, so no bundler will ever drop the statement.** Everything the factory's closure named was therefore retained in every app that imported anything at all from the package - which is how a `paginate` import came to ship the notification stack, the overlay container and the rich-text editor. A single binding initialized by a `/* @__PURE__ */`-annotated call is the only shape esbuild can prove side-effect-free and remove, so each exported name gets its own statement. Keep the annotations: without them the declarations are retained again.

Existing code migrates mechanically - `yarn nx g @ethlete/core:migrate-provider-shape` rewrites every call site. `ethlete/no-impure-top-level-provider` keeps the old shape from coming back.

A **runtime** factory the consumer calls with arguments (`createQueryClient`, `createBearerAuthProvider`, `createWebSocketClient`) returns a definition too, so the same three extractors name its halves - one shape everywhere, and your own `provideX` / `injectX` exports stay droppable and lint-clean.

## Runtime errors

`RuntimeError` is the SDK-wide error type - a native `Error` with a numeric `code`, formatted as `ET<code>` (`new RuntimeError(1301, 'trigger is missing')` → `"ET1301: trigger is missing"`). An optional third `data` argument is logged as a separate `console.error` right after the throw. Catch and match with `instanceof RuntimeError` and `error.code`.

The component libraries build their per-domain error codes on this - see [Error codes](/components/error-codes) for the code registry and conventions.

## Host listeners

Subscribe to host-element events from an injection context, cleaned up on destroy:

- `createRxHostListener('pointerdown')` → `Observable<PointerEvent>`
- `applyHostListener('click', handler)` / `applyHostListeners({ focus: …, blur: … })`

`createDestroy()` returns an observable that emits once on destroy - a ready-made `takeUntil` source.

## Forms

- `controlValueSignal` - see [Signal utilities](/core/signal-utils#form-control-values).
- `cloneFormGroup(group)` - deep-clones a `FormGroup` including validators, disabled state and nested groups/arrays.
- `getFormGroupValue(group)` - the group's value **including disabled controls**, empty values coalesced to `null`.
- Validators (also grouped under the `Validators` const): `MustMatch(controlName, matchingControlName)` for password-repeat patterns, `IsEmail`, `IsArrayNotEmpty`, and `ValidateAtLeastOneRequired({ keys, checkFalse? })` for "at least one of these fields" groups. Each has a matching error-key const (`MUST_MATCH`, `IS_EMAIL`, …).

## Unsaved changes {#unsaved-changes}

Guard a form against accidentally discarding edits. Call these from an injection context.

- **`createUnsavedChangesTracker({ source, confirm, defaultValue?, compareFn?, tab? })`** - the framework-agnostic core. It snapshots a baseline and exposes `hasChanges` (a `Signal<boolean>`), `runCheck()` (resolves `true` when clean or the user confirmed the discard), plus `refreshDefaultValue()` / `restoreDefaultValue()` and the `defaultValue` signal.
  - `source` accepts a signal-forms **`FieldTree`** (first-class), a **`Signal<FieldTree | null>`** for late/async forms (the first non-null value auto-baselines), an **`AbstractControl`** (migration path, bridged via `controlValueSignal`), or a plain **`WritableSignal`**.
  - Changes are a **deep-equal snapshot** against the baseline - editing then reverting a field is clean again, deliberately unlike signal-forms' `dirty()` ("was edited").
  - `confirm` is **required per call site** and runs only when there are changes; return a boolean, `Promise`, or `Observable` (normalized to `Promise<boolean>`). It typically opens a confirm dialog. Its second argument carries an `AbortSignal` - see [Sessions ending underneath a guard](#unsaved-changes-coordinator).
  - `refreshDefaultValue()` re-baselines to the current value - call it after a save that keeps the view open.
  - `isAbandoned` reads `true` once the guard was switched off because the session ended (see below).
- **`createUnsavedChangesGuard(config)`** - the router / manual flavor: the tracker above plus a **`canDeactivate()`** method (`CanDeactivateFn`-compatible) for Angular route guards.
- For overlays, use **`createOverlayUnsavedChangesGuard`** from `@ethlete/components`, which wires the tracker to the overlay's close events automatically - see [Overlays › Guarding against accidental dismissal](/components/overlays#guarding-against-accidental-dismissal).

### Guarding the browser tab {#unsaved-changes-tab}

An in-app guard is only half the protection: <kbd>Ctrl</kbd>+<kbd>W</kbd>, <kbd>F5</kbd> and the tab's × bypass both the router and the overlay runtime. So **every tracker also locks the tab** while `hasChanges()` is `true` - the browser shows its own "Leave site?" confirmation. Configure it with the `tab` option:

```ts
guard = createUnsavedChangesGuard({
  source: this.form,
  confirm: () => this.confirmDiscard(),
  tab: {
    lock: true, // default - `beforeunload` confirmation
    titleMarker: true, // '● Editor | My App' while dirty
    flash: true, // blink that marker while the tab is in the background
    favicon: true, // dot on the favicon
    badge: true, // app badge for installed PWAs
  },
});
```

| `tab` option  | Default | Description                                                                                                                                                                                                                             |
| ------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lock`        | `true`  | The `beforeunload` confirmation before the tab is closed, reloaded, or navigated away from.                                                                                                                                             |
| `titleMarker` | `false` | Prefix the tab title with a marker while dirty - `true` uses `'●'` (`UNSAVED_CHANGES_TITLE_MARKER`), a string is used as-is. Goes through the [title store](/core/seo#title-markers), so the app's title must be owned by it.           |
| `flash`       | `false` | Blink the marker (and the favicon dot) - `true`, or `{ interval?, whenHidden? }`. Implies `titleMarker`. Only blinks while the tab is **backgrounded** unless `whenHidden: false`; `interval` defaults to `1000` ms.                    |
| `favicon`     | `false` | Draw a dot on the favicon - `true` or `{ color }`. See [Favicon overlays](/core/seo#favicon).                                                                                                                                           |
| `badge`       | `false` | Set an app badge while dirty (`navigator.setAppBadge`) - `true` shows a dot, a number shows that count. Only visible for **installed** apps (PWA / desktop shortcut) and a silent no-op elsewhere. Counts from several trackers add up. |

Pass `tab: false` to leave the tab alone entirely. `tracker.tab` exposes the guard (`null` when disabled) so you can `tab.destroy()` it early - e.g. right before a deliberate `location.reload()`.

Notes on the lock:

- The wording of the prompt **cannot be customized** - browsers ignore any returned string. Your `confirm` dialog still handles in-app dismissals; this is the last-resort net.
- Browsers only show it once the user has interacted with the page (sticky activation), so a programmatic `window.close()` on an untouched page goes through.
- The listener is registered **only while there are changes**, so a clean page stays eligible for the back/forward cache.

Notes on flashing: there is **no browser API for demanding attention** on a tab (no "flash the taskbar", no `requestAttention()`), so blinking the title/favicon is the whole toolbox. Browsers clamp timers in hidden tabs to about a second, which is why the interval floor is effectively 1000 ms. The lock itself never blinks, only the marker.

**`createUnsavedChangesTabLock({ hasChanges, lock?, titleMarker?, flash?, favicon?, badge? })`** is the same guard standalone, for "unsaved" state that isn't a form at all - pending uploads, a queued draft, an in-flight mutation:

```ts
createUnsavedChangesTabLock({
  hasChanges: computed(() => this.uploads().some((upload) => upload.pending)),
  titleMarker: true,
  flash: true,
});
```

For **tab progress** - an upload's percentage rather than a yes/no marker - there is likewise no taskbar API. Draw it on the favicon with [`applyFaviconOverlay`](/core/seo#favicon), or put it in the title (`applyHeadTitleMarker(computed(() => `${percent()}%`))`).

### Sessions ending underneath a guard {#unsaved-changes-coordinator}

Every tracker registers with a root-provided coordinator, `injectUnsavedChangesCoordinator()`, which solves the two problems that only show up once several guards exist in one app:

- **One confirm at a time.** A page form, an overlay form and a route guard can all want a decision in the same tick. A check that starts while another confirm is on screen **adopts that decision** instead of stacking a second "discard your changes?" dialog. `isCheckPending` reads whether one is up.
- **The session ending mid-confirm.** `abandonAll(reason?)` resolves the pending check as "discard allowed", aborts its `AbortSignal`, and switches every live guard off: further `runCheck()`s pass and the tab locks release. `@ethlete/query`'s auth provider calls it on `logout()`, which fixes the classic mess - pressing logout with a dirty form used to leave a dead confirm dialog floating over the login page, plus a tab that still refused to close. Trackers created afterwards (post re-login) guard normally again.

Because the confirm dialog belongs to your app, closing it is your call - wire the abort signal:

```ts
confirm: (value, { signal }) => {
  const ref = this.overlays.open(ConfirmDiscardComponent);

  signal.addEventListener('abort', () => ref.close(false));

  return ref.afterClosed();
};
```

Call `abandonAll()` yourself for anything else that ends a session: an inactivity timeout, a hard workspace switch, a forced re-auth.

## Storage

- **Cookies** - `getCookie`, `setCookie`, `hasCookie`, `deleteCookie`, `getDomain`. `setCookie` defaults: 30-day expiry (`null` → session cookie), `path: '/'`, `sameSite: 'lax'`, domain derived from the hostname. All SSR-safe (no-ops without `document`).
- **Session memory** - `createSessionMemory({ key, parse, serialize })` returns a typed `{ read, write, remove }` store over `sessionStorage`; every operation is guarded, so failures (SSR, quota, parse errors) return `null`/`false` instead of throwing. `createAutoSessionMemoryKey({ element, prefix })` derives a stable key from an element's DOM path - how components persist per-instance UI state across reloads.

## Clipboard

- `copyToClipboard(text)` - write text to the clipboard, returning a cold `Observable<boolean>` that emits `true` or `false` once and completes instead of erroring. The copy runs on subscribe. Uses the async Clipboard API and falls back to a hidden-textarea `execCommand('copy')` when that is blocked (missing permission, insecure context). Focus is restored to the previously focused element after the fallback. SSR-safe.
- `readFromClipboard()` - read text from the clipboard, returning a cold `Observable<string | null>` that emits the text - or `null` when the Clipboard API is unavailable or reading is blocked - once and completes. The read runs on subscribe.

## Files

- `injectFileDownload()` - hands the user a file the browser downloads. Call it once from an injection context; the function it returns takes `{ content, filename, type? }` and can be called from anywhere, including a click handler. `content` is a string, a `Blob`, or the `BlobPart[]` to build one from. It creates the object URL through the injected document's window, appends the anchor before clicking it (Firefox does not follow the click of a detached anchor), removes it again and revokes the URL immediately. A no-op without a browser, so a toolbar button needs no SSR check of its own.
- `createObjectUrlHandle(blob)` - an object URL that outlives the call, as a `{ url, revoke }` handle rather than a bare string, so the URL and the call that frees it cannot drift apart. `url` is `null` where there is no browser; `revoke()` is idempotent. Use it for a preview that stays on screen (an image dropped into a [dropzone](/components/dropzone)); use `injectFileDownload()` when the URL only has to survive a single click.

```ts
private download = injectFileDownload();

protected save() {
  this.download({ content: json, filename: 'session.json', type: 'application/json' });
}
```

## Text & data

- `markdownToHtml(markdown)` / `htmlToMarkdown(html)` - the dependency-free converters behind the [pipes](/core/directives-pipes#pipes), covering the common Markdown feature set including GFM tables and fenced code blocks. `markdownToHtml` escapes raw HTML in the Markdown text (so its output is safe to bind as HTML) and refuses script-running URL schemes in links and images.
- `clone(value)` - deep clone (objects, arrays, Map/Set, Date, RegExp, typed arrays).
- `equal(a, b)` - deep structural equality; used as the `equal` function for many of the SDK's computed signals.
- `getObjectProperty(obj, 'a.b[2].c')` - nested property access by path; `isObject` / `isArray` type guards.
- `initials(value, maxLength?)` - uppercased initials of each whitespace-separated word (`'John Doe'` → `'JD'`), capped at `maxLength` (default `2`); the function behind the [`initials` pipe](/core/directives-pipes#pipes).
- `slugify(value)` - URL-friendly slug (`'Crème brûlée!'` → `'creme-brulee'`): diacritics stripped, lowercased, non-alphanumeric runs collapsed to single hyphens; the function behind the [`slugify` pipe](/core/directives-pipes#pipes).

## Gestures & input

- `createSwipeTracker(startEvent)` - track a touch/mouse swipe from a start event: `update(event)` returns per-move movement/axis-lock info (`isSwiping` vs `isScrolling`), `end()` returns final movement plus px/sec velocities, `cancel()` aborts.
- `KeyPressManager` - detects rapid repeat presses of a single key (`isPressed(event)` is `true` from the second press within 100 ms); used for type-to-repeat behaviors.

## Logging

`createLogger({ scope, feature })` returns `{ log, warn, error }` with a color-coded `[scope feature]` prefix. All loggers go quiet when the URL contains the `et-logger-quiet` query param (`DISABLE_LOGGER_PARAM`). Requires an injection context.

## Small helpers

| Helper                                           | Description                                                                                              |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `clamp(value, min?, max?)`                       | Constrain to a range - **defaults `min: 0`, `max: 100`**.                                                |
| `round(value, precision?)`                       | Round to N decimals (default `0`).                                                                       |
| `createComponentId('et-button')`                 | Process-unique ids per prefix (`et-button-1`, `et-button-2`, …).                                         |
| `Translatable`                                   | `{ i18n, text }` - translation key + fallback text.                                                      |
| `NgClassType`                                    | The value type `[ngClass]` accepts, for typing class inputs.                                             |
| `TypedQueryList<T>` / `switchQueryListChanges()` | A `QueryList` with typed `changes`, and an RxJS operator that switches to a list's changes stream.       |
| `setInputSignal(input, value)`                   | Imperatively write an `input()` signal. Relies on Angular signal internals - a last-resort escape hatch. |
