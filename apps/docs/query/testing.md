# Testing

Queries run on Angular's `HttpClient`, so a spec answers them with Angular's own HTTP testing
backend. The `@ethlete/query/testing` entry point adds helpers on top of that, plus in-memory fakes
for the browser APIs jsdom lacks.

```ts
import { expectFlushAndWait, setupQueryTest } from '@ethlete/query/testing';
```

## Testing a view that fetches

A client made with [`createQueryClient`](/query/queries#the-query-client) is provided in root, so
the spec only provides the HTTP backend:

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

A GET query [auto-executes](/query/queries#auto-execution) once its args resolve, which happens on
change detection: `TestBed.tick()` before `expectOne`, and again after `flush` before reading
`response()`, `loading()` or `error()`. The request's `url` includes the query string. Mutations
never auto-execute - call `.execute({ args })` first.

A view whose [`withArgs`](/query/features#withargs) reads `injectQueryParam` from `@ethlete/core`
also needs `provideRouter([])`. Change the param by navigating
(`TestBed.inject(Router).navigateByUrl('/?search=mul')`), then `TestBed.tick()` and expect the next
request.

## Helpers

| Export                                                                          | What it does                                                                                 |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `expectAndFlush(httpTesting, url, response, status?)`                           | `httpTesting.expectOne(url).flush(response)`, with `status` as `{ status, statusText }`.     |
| `expectFlushAndWait(httpTesting, url, response, status?)`                       | The same, followed by `TestBed.tick()`.                                                      |
| `setupQueryTest(config?)`                                                       | Configures `TestBed` and creates a scratch client. Returns a `QueryTestSetup`.               |
| `setupAuthTest(config)`                                                         | A bearer auth provider over a `QueryTestSetup`. Returns an `AuthTestSetup`.                  |
| `createFakeQueryPersistenceStore()`                                             | An in-memory persistence adapter - see [Persisted responses](/query/persistence#testing-it). |
| `installFakeBroadcastChannel()`, `installFakeWebLocks()`, `flushMultiTabSync()` | Two clients in one spec as two tabs - see [Multi-tab sync](/query/multi-tab#testing-it).     |
| `createWebSocketTestDouble()`                                                   | A scripted socket.io `io` factory - see [WebSockets](/query/ws#testing-it).                  |

### setupQueryTest

For code that takes a client or a creator as input - a custom [query feature](/query/features), a
helper that wraps a creator - rather than a view bound to the app's own client:

```ts
import { QueryTestSetup, setupQueryTest } from '@ethlete/query/testing';

let query: QueryTestSetup;

beforeEach(() => {
  query = setupQueryTest();
});

it('reads the count', () => {
  const count = TestBed.runInInjectionContext(() => query.createGet<{ response: number }>('/count')());
  TestBed.tick();

  query.httpTesting.expectOne('https://api.test.com/count').flush(3);
  TestBed.tick();

  expect(count.response()).toBe(3);
});
```

It calls `TestBed.configureTestingModule` with `provideHttpClient()`, `provideHttpClientTesting()`
and `provideRouter([])`, and returns:

| Field                                                                 | Value                                                    |
| --------------------------------------------------------------------- | -------------------------------------------------------- |
| `queryClient`, `queryClientRef`                                       | The injected client and the definition it was made from. |
| `httpTesting`, `httpClient`, `injector`                               | From `TestBed`.                                          |
| `baseUrl`                                                             | The client's base URL.                                   |
| `createGet`, `createPost`, `createPut`, `createPatch`, `createDelete` | Creators bound to the client.                            |
| `restoreConsole()`                                                    | Removes the console filter described below.              |

| Option             | Default                  | Description                                                                             |
| ------------------ | ------------------------ | --------------------------------------------------------------------------------------- |
| `baseUrl`          | `'https://api.test.com'` | The scratch client's base URL.                                                          |
| `name`             | `'test'`                 | The scratch client's name.                                                              |
| `mockErrorHandler` | `true`                   | Replace Angular's `ErrorHandler` with a no-op, so failed requests do not fail the spec. |

Every call also filters `console.error` for `HttpErrorResponse` objects and bearer-token decode
failures, and `console.warn` for auto-refresh warnings. Call `restoreConsole()` in `afterEach` when
the file spies on `console` itself.

### setupAuthTest

Builds a [bearer auth provider](/query/auth) named `test-auth` over a `QueryTestSetup`, with a
`login` and a `refresh` query:

```ts
const query = setupQueryTest();
const { auth, login } = setupAuthTest({ querySetup: query });

login({ username: 'max' }, { accessToken: 'a', refreshToken: 'r' });

expect(auth.accessToken()).toBe('a');
```

`login(body, response)` and `refresh(token, response)` execute the query and answer its request.
`makeSecureRequest(route)` sends a secure `GET` through the client. The config takes `loginPath`
(default `'/auth/login'`), `refreshPath` (default `'/auth/refresh'`), `autoRetryOn401` (default
`false`), `features`, and the refresh options of [`withRefreshQuery`](/query/auth).
