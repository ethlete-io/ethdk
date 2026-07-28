// Query and type definitions for the playground app. They live here rather than in
// app.component.ts because an interpolated template literal above an inline `template:`
// desynchronises the Angular VS Code extension's editor-side scanner, which then stops
// forwarding template completions to the language service — see the
// `ethlete/no-template-literal-before-inline-template` lint rule.

import {} from '@angular/core';
import {} from '@ethlete/core';
import {
  createBearerAuthProvider,
  createGetQuery,
  createGqlQueryViaPost,
  createLegacyQueryCreator,
  createPostQuery,
  createQueryClient,
  createSecureGetQuery,
  gql,
  withAuthenticationQuery,
  withPersistentAuth,
  withRefreshQuery,
  withTokenRevocation,
  withTracking,
} from '@ethlete/query';
import { NormalizedPagination } from '@ethlete/types';

export const placeholderClientConfig = createQueryClient({
  name: 'jsonplaceholder',
  baseUrl: 'https://jsonplaceholder.typicode.com',
});

export const createGetQueryFn = createGetQuery(placeholderClientConfig);

export const getPosts = createGetQueryFn<GetPostsQueryArgs>(`/posts`);
export const getPost = createGetQueryFn<GetPostQueryArgs>((p) => `/posts/${p.postId}`);

export const getPostTransformed = createGetQueryFn<GetPostQueryRawArgs>((p) => `/posts/${p.postId}`, {
  transformResponse: (r) => r.id,
});

export const testNoRawResponse = createGetQueryFn<GetPostQueryArgs>((p) => `/posts/${p.postId}`);

export type GetPostSameTypeArgs = {
  rawResponse: Post;
  response: Post;
  pathParams: { postId: number };
};
export const testSameType = createGetQueryFn<GetPostSameTypeArgs>((p) => `/posts/${p.postId}`);

// const testDifferentTypeMissing = createGetQueryFn<GetPostQueryRawArgs>((p) => `/posts/${p.postId}`);

export const testDifferentTypeProvided = createGetQueryFn<GetPostQueryRawArgs>((p) => `/posts/${p.postId}`, {
  transformResponse: (r) => r.id,
});

export const legacyGetPost = createLegacyQueryCreator({ creator: getPost });

export const getUser = createGetQueryFn<GetUserQueryArgs>((p) => `/users/${p.playerId}`);

export const gqlPlaceholderClientConfig = createQueryClient({
  name: 'gqpplaceholder',
  baseUrl: 'https://graphqlplaceholder.vercel.app/graphql',
});

export const createGqlQuery = createGqlQueryViaPost(gqlPlaceholderClientConfig);

export const queryGqlPosts = createGqlQuery<{ response: Post[] }>(gql`
  query {
    posts {
      id
      title
      body
    }
  }
`);

export type GetGqlPostsQueryArgs = {
  response: { posts: Post[] };
  variables: {
    userId: number;
  };
};

export const queryGqlPost = createGqlQuery<GetGqlPostsQueryArgs>(gql`
  query ($userId: Int!) {
    posts(userId: $userId) {
      id
      title
      body
    }
  }
`);

/**
 * DEMO BELOW
 */

export const clientConfig = createQueryClient({
  name: 'localhost',
  baseUrl: 'http://localhost:8000',
});

export const getQuery = createGetQuery(clientConfig);
export const postQuery = createPostQuery(clientConfig);

export const login = postQuery<{
  body: { username: string; password: string };
  response: { token: string; refresh_token: string };
}>('/auth/login');

export const tokenRefresh = postQuery<{
  body: { refresh_token: string };
  response: { token: string; refresh_token: string };
}>('/auth/refresh-token');

export const authProvider = createBearerAuthProvider({
  name: 'localhost',
  queryClientRef: clientConfig,
  queries: [
    withAuthenticationQuery('login', {
      queryCreator: login,
      extractTokens: (response) => ({ accessToken: response.token, refreshToken: response.refresh_token }),
    }),
    withRefreshQuery('tokenRefresh', {
      queryCreator: tokenRefresh,
      extractTokens: (response) => ({ accessToken: response.token, refreshToken: response.refresh_token }),
      expiresInPropertyName: 'exp',
    }),
  ],
  features: [
    withPersistentAuth({
      autoLogin: {
        queryKey: 'tokenRefresh',
        buildArgs: (token) => ({ body: { refresh_token: token } }),
      },
    }),
    withTokenRevocation({
      queryKey: 'login',
      buildArgs: (tokens) => ({
        body: { username: tokens.accessToken as string, password: tokens.refreshToken as string },
      }),
    }),
    withTracking({
      on: {
        loginSuccess: ({ snapshot }) => {
          console.log('Login succeeded!', snapshot.response());
        },
        loginFailure: ({ error }) => {
          console.error('Login failed!', error);
        },
        logout: () => {
          console.log('User logged out');
        },
      },
    }),
  ],
});

export const [, injectAuthProvider] = authProvider;

// const foo = injectAuthProvider().features.tokenRevocation.revoke();

// // You can still register handlers dynamically if needed
// const unsub = injectAuthProvider().features.tracking.on('loginExecute', (data) => {
//   console.log('Login executing with args:', data.args);
// });

export const secureGetQuery = createSecureGetQuery(clientConfig, authProvider);

export type Post = {
  id: number;
  userId: number;
  title: string;
  body: string;
};

export type GetPostQueryArgs = {
  response: Post;
  pathParams: {
    postId: number;
  };
};

export type GetPostQueryRawArgs = {
  rawResponse: Post;
  response: number;
  pathParams: {
    postId: number;
  };
};

export type GetPostsQueryArgs = {
  response: Post[];
};

export type User = {
  id: string;
  name: string;
  username: string;
};

export type GetUserQueryArgs = {
  response: User;
  pathParams: {
    playerId: string;
  };
};

export type Paginated<T> = {
  totalHits: number;
  currentPage: number;
  totalPages: number;
  limit: number;
  items: T[];
};

export type RoundView = {
  id: string;
  title: string;
  number: number;
  matchesCount: number;
  roundStatus: string | null;
};

export type GetPublicTournamentRoundsArgs = {
  response: Paginated<RoundView>;
  pathParams: {
    id: string;
  };
  queryParams: {
    page?: number;
    limit?: number;
  };
};

export const getPublicTournamentRounds = createGetQueryFn<GetPublicTournamentRoundsArgs>(
  (p) => `/public/tournament/${p.id}/rounds`,
);

export const dfbLikePaginationAdapter = <T>(response: Paginated<T>) => {
  const pagination: NormalizedPagination<T> = {
    items: response.items,
    totalPages: response.totalPages,
    currentPage: response.currentPage,
    itemsPerPage: response.limit,
    totalHits: response.totalHits,
  };

  return pagination;
};

// type GetPostsQueryArgs = {
//   response: Post[];
// };

// const getUsers = secureGetQuery<GetPostsQueryArgs>({ route: '/users' });
