/* eslint-disable @typescript-eslint/naming-convention -- mock API mirrors an external snake_case token contract */
import {
  HttpDownloadProgressEvent,
  HttpErrorResponse,
  HttpEventType,
  HttpHeaders,
  HttpInterceptorFn,
  HttpResponse,
} from '@angular/common/http';
import {
  createBearerAuthProvider,
  createGetQuery,
  createGqlQueryViaPost,
  createPostQuery,
  createQueryClient,
  createSecureGetQuery,
  createWebSocketClient,
  gql,
  withAuthenticationQuery,
  withBearerAuthMultiTabSync,
  withEthleteApiErrors,
  withMultiTabSync,
  withPersistentAuth,
  withRefreshQuery,
  withTokenExpirationWarning,
} from '@ethlete/query';
import { Paginated } from '@ethlete/types';
import { concat, concatMap, delay, mergeMap, of, throwError } from 'rxjs';
import { io } from 'socket.io-client';

export const DEVTOOLS_DEMO_API_URL = 'https://query-devtools-demo.ethlete.local';

const LATENCY_MS = 600;

export type PostView = {
  id: number;
  title: string;
  publishedAt: string | null;
};

const publishedAtFor = (id: number) => (id % 2 === 0 ? new Date(Date.UTC(2024, 0, id)).toISOString() : null);

export type ServerTimeView = {
  requestNumber: number;
  serverTime: string;
};

export type FlakyView = {
  ok: boolean;
};

export type DownloadView = {
  bytes: number;
};

let requestNumber = 0;

/** How many more `/flaky` requests answer 503, so the client's retry policy has something to retry. */
let flakyFailuresLeft = 0;

/** Makes the next `n` requests to `/flaky` fail with a retryable 503. */
export const armFlakyEndpoint = (n: number) => {
  flakyFailuresLeft = n;
};

/** How many chunks a `/download` response is streamed in, and how far apart. */
const DOWNLOAD_CHUNKS = 8;
const DOWNLOAD_CHUNK_MS = 220;
const DOWNLOAD_CHUNK_BYTES = 40_000;

const base64Url = (value: object) =>
  btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

/** A structurally-valid (unsigned) JWT so the devtools auth tab can decode a real payload. */
const fakeJwt = () =>
  `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url({
    sub: 'demo-user',
    name: 'Query Devtools',
    iat: 1_700_000_000,
    exp: 9_999_999_999,
  })}.signature`;

/** Fakes the demo API in-browser: ~600ms latency, a cacheable freshness window and a forced 500 on `?fail`. */
export const queryDevtoolsDemoInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(DEVTOOLS_DEMO_API_URL)) return next(req);

  const url = new URL(req.url);

  if (url.searchParams.has('fail')) {
    return of(null).pipe(
      delay(LATENCY_MS),
      mergeMap(() =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 500,
              statusText: 'Internal Server Error',
              url: req.url,
              error: { message: 'Something went wrong (on purpose)' },
            }),
        ),
      ),
    );
  }

  const respond = (body: unknown) =>
    of(
      new HttpResponse({
        status: 200,
        url: req.url,
        body,
        headers: new HttpHeaders({ 'cache-control': 'max-age=20' }),
      }),
    ).pipe(delay(LATENCY_MS));

  const path = url.pathname;

  // A 503 is retryable under the client's `withEthleteApiErrors()` policy, so an armed `/flaky` shows the
  // devtools an attempt count and a backoff countdown rather than a plain failure.
  if (path === '/flaky' && flakyFailuresLeft > 0) {
    flakyFailuresLeft--;

    return of(null).pipe(
      delay(LATENCY_MS),
      mergeMap(() =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 503,
              statusText: 'Service Unavailable',
              url: req.url,
              error: { message: 'Temporarily unavailable (on purpose)' },
            }),
        ),
      ),
    );
  }

  // Streamed in chunks so `reportProgress` has real progress events to report. Angular only emits them
  // for a request that asked for them, which the `/download` creator does.
  if (path === '/download') {
    const total = DOWNLOAD_CHUNKS * DOWNLOAD_CHUNK_BYTES;
    const chunks = Array.from({ length: DOWNLOAD_CHUNKS }, (_, index) => {
      const event: HttpDownloadProgressEvent = {
        type: HttpEventType.DownloadProgress,
        loaded: (index + 1) * DOWNLOAD_CHUNK_BYTES,
        total,
      };

      return event;
    });

    return concat(
      of(...chunks).pipe(concatMap((event) => of(event).pipe(delay(DOWNLOAD_CHUNK_MS)))),
      of(
        new HttpResponse({
          status: 200,
          url: req.url,
          body: { bytes: total },
          headers: new HttpHeaders({ 'content-length': String(total) }),
        }),
      ),
    );
  }

  if (path === '/flaky') return respond({ ok: true } satisfies FlakyView);

  if (path === '/server-time') {
    const body: ServerTimeView = { requestNumber: ++requestNumber, serverTime: new Date().toLocaleTimeString() };

    return respond(body);
  }

  if (path === '/posts' && req.method === 'POST') {
    return respond({ id: 99, title: 'Freshly created post', publishedAt: null } satisfies PostView);
  }

  if (path === '/posts') {
    const currentPage = Number(url.searchParams.get('page') ?? 1);
    const itemsPerPage = Number(url.searchParams.get('limit') ?? 5);
    const totalHits = 40;
    const totalPageCount = Math.ceil(totalHits / itemsPerPage);
    const body: Paginated<PostView> = {
      items: Array.from({ length: itemsPerPage }, (_, i) => {
        const id = (currentPage - 1) * itemsPerPage + i + 1;
        return { id, title: `Post #${id}`, publishedAt: publishedAtFor(id) };
      }),
      currentPage,
      nextPage: currentPage < totalPageCount ? currentPage + 1 : null,
      itemsPerPage,
      totalPageCount,
      totalHits,
    };

    return respond(body);
  }

  const postMatch = path.match(/^\/post\/(\d+)$/);
  if (postMatch) {
    const id = Number(postMatch[1]);

    return respond({ id, title: `Post #${id}`, publishedAt: publishedAtFor(id) } satisfies PostView);
  }

  if (path === '/auth/login' || path === '/auth/refresh') {
    return respond({ token: fakeJwt(), refresh_token: 'demo-refresh-token' });
  }

  if (path === '/me') return respond({ id: 'user-1', name: 'Demo User' });

  if (path === '/orders') return respond({ id: 'order-1' });
  if (path === '/payments') return respond({ id: 'payment-1' });
  if (path === '/orders/confirm') return respond({ confirmed: true });
  if (path === '/graphql') {
    return respond({
      data: {
        posts: [
          { id: 1, title: 'Post #1' },
          { id: 2, title: 'Post #2' },
        ],
      },
    });
  }

  return next(req);
};

export const devtoolsDemoClient = createQueryClient({
  name: 'devtools-demo',
  baseUrl: DEVTOOLS_DEMO_API_URL,
  features: [withMultiTabSync({ dedupePolling: false }), withEthleteApiErrors()],
});

const getQuery = createGetQuery(devtoolsDemoClient);
const postQuery = createPostQuery(devtoolsDemoClient);

export type GetServerTimeArgs = { response: ServerTimeView; queryParams?: { fail?: boolean } };
export type GetPostsArgs = {
  response: Paginated<PostView>;
  queryParams?: { page?: number; limit?: number; query?: string };
};
export type GetPostArgs = { response: PostView; pathParams: { postId: number } };

export type GetFlakyArgs = { response: FlakyView };
export type GetDownloadArgs = { response: DownloadView };

export const getServerTime = getQuery<GetServerTimeArgs>('/server-time');
export const getFlaky = getQuery<GetFlakyArgs>('/flaky');

/** The one demo query asking for progress events - without `reportProgress` there is no progress to show. */
export const getDownload = getQuery<GetDownloadArgs>('/download', { reportProgress: true });
export const getPosts = getQuery<GetPostsArgs>('/posts');
export const getPost = getQuery<GetPostArgs>((p) => `/post/${p.postId}`);

export type LoginArgs = {
  body: { username: string; password: string };
  response: { token: string; refresh_token: string };
};
export type RefreshArgs = { body: { refresh_token: string }; response: { token: string; refresh_token: string } };

const login = postQuery<LoginArgs>('/auth/login');
const refresh = postQuery<RefreshArgs>('/auth/refresh');

export const devtoolsDemoAuthProvider = createBearerAuthProvider({
  name: 'devtools-demo',
  queryClientRef: devtoolsDemoClient,
  queries: [
    withAuthenticationQuery('login', {
      queryCreator: login,
      extractTokens: (response) => ({ accessToken: response.token, refreshToken: response.refresh_token }),
    }),
    withRefreshQuery('tokenRefresh', {
      queryCreator: refresh,
      extractTokens: (response) => ({ accessToken: response.token, refreshToken: response.refresh_token }),
    }),
  ],
  features: [
    withPersistentAuth({
      autoLogin: {
        queryKey: 'tokenRefresh',
        buildArgs: (token) => ({ body: { refresh_token: token } }),
      },
    }),
    withTokenExpirationWarning({ warningThreshold: 60_000 }),
    withBearerAuthMultiTabSync(),
  ],
});

export type GetProfileArgs = { response: { id: string; name: string } };

/** A secure query, so the Insomnia export has something to chain to the provider's token refresh. */
export const getProfile = createSecureGetQuery(devtoolsDemoClient, devtoolsDemoAuthProvider)<GetProfileArgs>('/me');

export type CreateOrderArgs = { body: { item: string }; response: { id: string } };
export type CreatePaymentArgs = { body: { orderId: string }; response: { id: string } };
export type ConfirmOrderArgs = { body: { orderId: string; paymentId: string }; response: { confirmed: boolean } };

export type CreatePostArgs = { body: { title: string }; response: PostView };

/** A mutation whose whole point is the invalidation that follows it - the Events tab's fan-out row. */
export const createPost = postQuery<CreatePostArgs>('/posts');

export type ExoticArgs = {
  body: FormData;
  headers: HttpHeaders;
  queryParams: { since: Date; retries: Map<string, number>; flags: Set<string> };
  response: PostView;
};

/** Args made only of the built-ins `Object.entries` cannot read - what the value explorer is tested against. */
export const postExoticArgs = postQuery<ExoticArgs>('/posts');

export const createOrder = postQuery<CreateOrderArgs>('/orders');
export const createPayment = postQuery<CreatePaymentArgs>('/payments');
export const confirmOrder = postQuery<ConfirmOrderArgs>('/orders/confirm');

// GraphQL fixture - POST-transported, routed to /graphql so the mock can match it.
const gqlQuery = createGqlQueryViaPost(devtoolsDemoClient);
export const getGqlPosts = gqlQuery<{ response: { posts: PostView[] } }>(
  gql`
    query Posts {
      posts {
        id
        title
      }
    }
  `,
  { route: '/graphql' },
);

// WebSocket fixture - there is no server in Storybook, so it stays disconnected; the Sockets tab
// still shows the registered client and its joined room.
export const devtoolsDemoSocket = createWebSocketClient({
  name: 'devtools-demo',
  url: 'wss://query-devtools-demo.invalid',
  io,
});
