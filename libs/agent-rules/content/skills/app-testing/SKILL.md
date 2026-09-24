---
name: app-testing
description: How to unit-test an app built on the Ethlete SDK - views that fetch through @ethlete/query (HttpTestingController and the @ethlete/query/testing helpers), components that open overlays, and views that read the URL with injectQueryParam under provideRouter. Read before writing or fixing a spec for a component, view or service that uses @ethlete/query, @ethlete/core router signals or @ethlete/components overlays.
kind: skill
scope: consumer
requires: ['@ethlete/core']
vars: [docsBaseUrl]
---

# Testing an Ethlete app

Specs run in jsdom under `TestBed`. Test through the public API the view uses - mount the
component, answer its requests, move the URL - and assert on what it renders or exposes. The full
reference for the query helpers is {%docsBaseUrl%}/query/testing.

## Views that fetch

A client made with `createQueryClient` is provided in root, so a spec provides nothing for it. It
needs Angular's HTTP testing backend, and answers each request by hand:

```ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

beforeEach(() => {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
});

afterEach(() => TestBed.inject(HttpTestingController).verify());

it('renders the players', async () => {
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(PlayersComponent);
  fixture.detectChanges();
  TestBed.tick();

  http.expectOne((req) => req.url.includes('/players')).flush({ items: ['Müller'] });
  await fixture.whenStable();

  expect(fixture.nativeElement.textContent).toContain('Müller');
});
```

- A GET query executes once its args resolve, which happens on change detection -
  `TestBed.tick()` before `expectOne`, and again after `flush` before reading the query's
  `response()`, `loading()` or `error()`.
- `req.url` carries the query string, so `expectOne('https://api.example.com/players?search=mul')`
  matches the full URL. Match with a predicate, as above, when the params are not the point.
- Fail a request with `flush(body, { status: 422, statusText: 'Unprocessable Entity' })`.
- Mutations (`POST`, `PUT`, `PATCH`, `DELETE`) never auto-execute - call `.execute({ args })`,
  then expect the request.

From `@ethlete/query/testing`:

| Export                                                                        | Use                                                                                                                                 |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `expectAndFlush(http, url, body, status?)`                                    | `expectOne(url).flush(body)` in one call.                                                                                           |
| `expectFlushAndWait(http, url, body, status?)`                                | The same, then `TestBed.tick()`.                                                                                                    |
| `setupQueryTest(config?)`                                                     | A scratch client, `HttpTestingController`, `createGet` … `createDelete` creators - for testing code that takes a creator or client. |
| `setupAuthTest({ querySetup })`                                               | A bearer auth provider on that scratch client, with `login()` / `refresh()` helpers that answer the requests.                       |
| `createFakeQueryPersistenceStore()`                                           | In-memory persistence adapter - jsdom has no IndexedDB.                                                                             |
| `installFakeBroadcastChannel()`, `installFakeWebLocks()`, `flushMultiTabSync` | Two clients in one spec behave as two tabs.                                                                                         |
| `createWebSocketTestDouble()`                                                 | A scripted socket.io `io` for `createWebSocketClient({ io })`.                                                                      |

`setupQueryTest` calls `TestBed.configureTestingModule` itself and replaces `ErrorHandler` with a
no-op (`mockErrorHandler: false` keeps the real one). Call it inside `beforeEach`, and call
`restoreConsole()` in `afterEach` if the file spies on `console`.

## Views that read the URL

`injectQueryParam`, `injectQueryParams`, `injectPathParam` and the other router signals from
`@ethlete/core` read the router, so the spec provides one and navigates it:

```ts
import { provideRouter, Router } from '@angular/router';

TestBed.configureTestingModule({
  providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
});

await TestBed.inject(Router).navigateByUrl('/?search=mul');
const fixture = TestBed.createComponent(PlayersComponent);
fixture.detectChanges();
TestBed.tick();

http.expectOne((req) => req.urlWithParams.includes('search=mul')).flush({ items: [] });

await TestBed.inject(Router).navigateByUrl('/?search=x');
TestBed.tick();
http.expectOne((req) => req.urlWithParams.includes('search=x')).flush({ items: [] });
```

Navigate to change a param - never set the signal or mock the inject function. A view that also
reads path params needs the real route in the config (`provideRouter([{ path: 'players/:id',
component: PlayersComponent }])`) and `RouterTestingHarness` from `@angular/router/testing` to
render it.

## Components that open overlays

An overlay mounts at the end of `document.body`, not in the fixture, and it opens and closes over
animation frames. Query the document, wait two frames, and close what is left after each test:

```ts
import { injectOverlayManager } from '@ethlete/components';

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

afterEach(async () => {
  TestBed.runInInjectionContext(() => injectOverlayManager())
    .openOverlays()
    .forEach((ref) => ref.forceClose());
  await flushFrames();
});

it('opens the edit dialog', async () => {
  const fixture = TestBed.createComponent(PlayerListComponent);
  fixture.detectChanges();

  fixture.nativeElement.querySelector('button.edit').click();
  await flushFrames();

  expect(document.querySelector('.player-edit-dialog')).not.toBeNull();
});
```

- Count open overlays with `injectOverlayManager().openOverlays().length` (inside
  `TestBed.runInInjectionContext`).
- The `OverlayRef` that `createOverlayOpener(...).open()` returns has `componentInstance()`,
  `close(result)` and `afterClosed()` - enough to test what the opener does with the result.
- A query-param overlay (`defineQueryParamOverlay`) opens from the URL: provide the router and
  navigate with the param set, as above.
- jsdom has no `ResizeObserver`, `IntersectionObserver`, `matchMedia` or `Element.animate`. If a
  spec throws on one of them, stub it once in the test setup file with an inert class or function,
  not per spec.

## Before you call it done

A spec for a bug fix must fail without the fix - revert it, run the spec, see it fail, restore it.
To check the same change in the running app, read {%skill:verify-in-app%}.
