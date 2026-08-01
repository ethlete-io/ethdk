/* eslint-disable @typescript-eslint/naming-convention -- mock API mirrors an external snake_case token contract */
import { HttpErrorResponse, HttpHeaders, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import {
  createBearerAuthProvider,
  createGetQuery,
  createGqlQueryViaPost,
  createPostQuery,
  createQueryClient,
  createWebSocketClient,
  gql,
  withAuthenticationQuery,
  withPersistentAuth,
  withRefreshQuery,
} from '@ethlete/query';
import { Paginated } from '@ethlete/types';
import { delay, mergeMap, of, throwError } from 'rxjs';

export const DEVTOOLS_DEMO_API_URL = 'https://query-devtools-demo.ethlete.local';

const LATENCY_MS = 600;

export type PostView = {
  id: number;
  title: string;
};

export type ServerTimeView = {
  requestNumber: number;
  serverTime: string;
};

let requestNumber = 0;

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

  if (path === '/server-time') {
    const body: ServerTimeView = { requestNumber: ++requestNumber, serverTime: new Date().toLocaleTimeString() };

    return respond(body);
  }

  if (path === '/posts') {
    const currentPage = Number(url.searchParams.get('page') ?? 1);
    const itemsPerPage = Number(url.searchParams.get('limit') ?? 5);
    const totalHits = 40;
    const totalPageCount = Math.ceil(totalHits / itemsPerPage);
    const body: Paginated<PostView> = {
      items: Array.from({ length: itemsPerPage }, (_, i) => {
        const id = (currentPage - 1) * itemsPerPage + i + 1;
        return { id, title: `Post #${id}` };
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

    return respond({ id, title: `Post #${id}` } satisfies PostView);
  }

  if (path === '/auth/login' || path === '/auth/refresh') {
    return respond({ token: fakeJwt(), refresh_token: 'demo-refresh-token' });
  }

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
});

const getQuery = createGetQuery(devtoolsDemoClient);
const postQuery = createPostQuery(devtoolsDemoClient);

export type GetServerTimeArgs = { response: ServerTimeView; queryParams?: { fail?: boolean } };
export type GetPostsArgs = { response: Paginated<PostView>; queryParams?: { page?: number; limit?: number } };
export type GetPostArgs = { response: PostView; pathParams: { postId: number } };

export const getServerTime = getQuery<GetServerTimeArgs>('/server-time');
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
  ],
});

export type CreateOrderArgs = { body: { item: string }; response: { id: string } };
export type CreatePaymentArgs = { body: { orderId: string }; response: { id: string } };
export type ConfirmOrderArgs = { body: { orderId: string; paymentId: string }; response: { confirmed: boolean } };

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
});
