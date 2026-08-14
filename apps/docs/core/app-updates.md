# App updates

Keeps a long-lived tab working across a deploy.

A tab opened before a deploy is still running the old `index.html`. Everything it already downloaded
keeps working, so nothing looks wrong - until the user clicks a route whose chunk was never imported.
That chunk's hashed filename is gone from the server, the dynamic import fails, and the click does
nothing. It reads to the user as "the tab is broken", and it survives a soft navigation, because the
only fix is a reload.

`provideAppUpdates()` watches for both halves of that: it polls for a new deploy while the tab is in
the foreground, and it listens for the import failure itself.

```ts
import { provideAppUpdates } from '@ethlete/core';

export const appConfig: ApplicationConfig = {
  providers: [provideAppUpdates({ entryUrl: '/index.html' })],
};
```

## Nothing to generate

The deployed build is identified by the **hashed script filenames in its own `index.html`** - the
same fingerprint read from the running document and from the freshly fetched one. Two documents match
exactly when reloading would run the same code, which is the question being asked, so there is no
version file to emit at build time, no git hash to bake into the bundle, and no CI step to keep in
sync. Any bundler that content-hashes its entry points works as-is.

Cross-origin scripts are excluded from the fingerprint, so an analytics tag with a cache-busting
query does not read as a new deploy.

## Options

| Option             | Default       | Description                                                                            |
| ------------------ | ------------- | -------------------------------------------------------------------------------------- |
| `entryUrl`         | `'/'`         | The document the deployed build is read from. Must always serve the current app shell. |
| `pollInterval`     | `300_000`     | How often to check while the tab is in the foreground. `0` leaves checking to the app. |
| `minCheckInterval` | `30_000`      | Floor between two checks, so alt-tabbing cannot fire a request per switch.             |
| `autoReload`       | `'when-safe'` | Whether a broken build may reload itself - see below.                                  |
| `reloadCooldown`   | `60_000`      | How soon after an automatic reload another may happen.                                 |

Polling pauses while the tab is hidden and runs again the moment it is looked at, so a tab left open
overnight asks once on return rather than thousands of times in the dark. Timers are throttled in a
background tab, not stopped, so this is a real difference rather than a micro-optimisation.

## Reading the state

```ts
const updates = injectAppUpdates();
```

| Member                | Type                  | Description                                                         |
| --------------------- | --------------------- | ------------------------------------------------------------------- |
| `isAvailable`         | `Signal<boolean>`     | A different build is deployed. This tab still works.                |
| `isRequired`          | `Signal<boolean>`     | A lazy chunk failed: part of the app is unreachable until a reload. |
| `wouldDiscardChanges` | `Signal<boolean>`     | Whether reloading now would throw away unsaved changes.             |
| `check`               | `() => Promise<void>` | Check for a new deploy now, off the poll schedule.                  |
| `reload`              | `() => void`          | Reload, releasing the unsaved-changes tab locks first.              |

## What happens when a chunk fails

With the default `autoReload: 'when-safe'`, a failed chunk reloads the page on its own **only when no
tracked form holds unsaved changes** - the user gets the route they clicked instead of a dead one, and
never loses typing to it. Dirtiness is read from the
[unsaved-changes coordinator](/core/utilities#unsaved-changes-coordinator), so any `createUnsavedChangesTracker`
in the app counts automatically.

When something _is_ dirty, the reload is left to the app. Offer it, and call `updates.reload()` when
the user accepts:

```ts
effect(() => {
  if (!updates.isRequired() || !updates.wouldDiscardChanges()) {
    return;
  }

  notifications.open({
    status: 'error',
    title: 'This tab is out of date',
    message: 'A new version was deployed. Reload to continue - unsaved changes will be lost.',
    duration: 0,
    action: { label: 'Reload', handler: () => updates.reload() },
  });
});
```

`reload()` releases the `beforeunload` locks before navigating, so the browser does not ask its own
"Leave site?" question on top of the one the app just asked.

### The reload cannot loop

An automatic reload records when it happened in `sessionStorage`. Inside `reloadCooldown` no second
automatic reload runs - `isRequired` is reported and the decision goes to the user instead. Without
that guard, a deploy that is broken for reasons of its own would reload the tab forever.

## Detecting the failure

There is no error code for a failed dynamic import - only a message, worded differently by every
engine. `isStaleBuildError()` holds that list and is exported for use in an app's own `ErrorHandler`:

```ts
import { isStaleBuildError } from '@ethlete/core';
```

It matches the 404 case and, just as importantly, the **MIME-type** case: an SPA that rewrites unknown
paths to `index.html` answers a request for a deleted chunk with HTML and a `200`, so the import
fails on the content type rather than on the status. A deployment that returns a real `404` for
missing assets is still worth configuring, but neither the detection nor the recovery depends on it.

Lazy **routes** are covered separately: the router awaits that import itself and turns the rejection
into a `NavigationError`, so it never reaches a global `unhandledrejection` listener. The provider
subscribes to router events for exactly this reason - no `withNavigationErrorHandler` wiring needed.

## What this does not fix

This recovers a tab that is already stale; it does not stop the staleness. That is a caching question,
and it is worth getting right at the same time:

- `index.html` should be served `Cache-Control: no-cache` - stored, but revalidated. An `ETag` makes
  that a cheap `304`.
- Hashed assets should be `public, max-age=31536000, immutable`.
- Assets copied verbatim (an `assets/` folder) are **not** hashed - they must not be `immutable`.

A CDN that receives no `Cache-Control` from the origin falls back to its own default TTL, which is
commonly 24 hours - long enough that a reload would hand back the same stale document. The polling
here inherits that same staleness on purpose: it reports what a reload would actually give you, not
what is on the origin.
