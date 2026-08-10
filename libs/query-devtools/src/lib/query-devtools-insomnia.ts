/* eslint-disable @typescript-eslint/naming-convention -- the `__export_*` keys are Insomnia's file format */

/**
 * One request to export. Values are what the query actually sent (or would send), already resolved -
 * no `:param` placeholders unless the query has no args yet, in which case Insomnia picks them up as
 * its own path params.
 */
export type InsomniaRequestInput = {
  name: string;
  method: string;
  url: string;
  headers: { name: string; value: string }[];

  /** The request body, or `null` for a request that sends none. */
  body: unknown;

  /** The GraphQL document, for a GraphQL query - switches Insomnia's body editor to GraphQL. */
  gqlQuery?: string | null;

  /** Name of the folder to file the request under, usually the query client's. */
  group?: string | null;

  /**
   * The {@link InsomniaTokenRefreshInput.id} of the token refresh this request authenticates with.
   * Its `Authorization` header then reads the access token out of the refresh response instead of
   * carrying the one the app happened to hold at export time.
   */
  secureBy?: string | null;
};

/**
 * The token refresh of a bearer auth provider, exported as a request of its own so the collection can
 * mint its own access tokens instead of shipping one that expires within the hour.
 */
export type InsomniaTokenRefreshInput = {
  /** What a request's {@link InsomniaRequestInput.secureBy} points at, usually the provider's name. */
  id: string;

  name: string;
  method: string;
  url: string;
  headers: { name: string; value: string }[];

  /** The body that carries the refresh token, e.g. `{ token: '…' }`. */
  body: unknown;

  group?: string | null;

  /** JSONPath of the access token in the refresh response, e.g. `$.accessToken`. */
  accessTokenPath: string;

  /**
   * How long Insomnia may reuse a stored refresh response before sending the request again. Set from
   * the access token's own lifetime, so the chain refreshes about as often as the app does.
   */
  maxAgeSeconds: number;
};

export type BuildInsomniaExportOptions = {
  /** Name of the exported collection, shown in Insomnia's sidebar. */
  name: string;
  requests: InsomniaRequestInput[];

  /** The token refreshes the exported requests authenticate with, at most one per auth provider. */
  tokenRefreshes?: InsomniaTokenRefreshInput[];

  /** Wall-clock time of the export - passed in so the builder stays pure. */
  now: number;
};

type InsomniaResource = Record<string, unknown>;

/** Insomnia's own export envelope. Version 4 is what Insomnia 8/9/10 read and write. */
export type InsomniaExport = {
  _type: 'export';
  __export_format: 4;
  __export_date: string;
  __export_source: string;
  resources: InsomniaResource[];
};

const WORKSPACE_ID = 'wrk_ethlete_query_devtools';

const jsonBody = (body: unknown) => {
  try {
    return JSON.stringify(body, null, 2);
  } catch {
    // A body holding a circular reference or a throwing `toJSON` cannot be exported.
    return null;
  }
};

/**
 * Insomnia's GraphQL body editor stores `{ query, variables }` as its text, so a GraphQL request is
 * exported with the document and its variables rather than the serialized POST body.
 */
const graphqlBody = (gqlQuery: string, body: unknown) => {
  const variables = (body as { variables?: unknown } | null)?.variables ?? {};

  return jsonBody({ query: gqlQuery, variables });
};

const bodyOf = (request: Pick<InsomniaRequestInput, 'body' | 'gqlQuery'>) => {
  if (request.gqlQuery) {
    const text = graphqlBody(request.gqlQuery, request.body);

    return text === null ? {} : { mimeType: 'graphql', text };
  }

  if (request.body === null || request.body === undefined) return {};

  const text = jsonBody(request.body);

  return text === null ? {} : { mimeType: 'application/json', text };
};

/**
 * Angular's `HttpClient` labels an object body `application/json` on its own, so a replay outside the
 * app needs the header spelled out to reach the same endpoint the same way.
 */
const headersOf = (input: { headers: { name: string; value: string }[] }, hasBody: boolean) => {
  const headers = input.headers.filter((header) => header.value !== '');
  const hasContentType = headers.some((header) => header.name.toLowerCase() === 'content-type');

  if (!hasBody || hasContentType) return headers;

  return [...headers, { name: 'Content-Type', value: 'application/json' }];
};

const AUTH_HEADER = 'Authorization';

/**
 * Insomnia's template tag for reading a value out of another request's response. `when-expired` plus a
 * max age is what makes the chain maintain itself: once the stored refresh response is older than
 * `maxAgeSeconds`, sending a request that reads from it re-sends the refresh first.
 */
const responseTag = (requestId: string, refresh: InsomniaTokenRefreshInput) =>
  `{% response 'body', '${requestId}', '${refresh.accessTokenPath}', 'when-expired', ${refresh.maxAgeSeconds} %}`;

/** Replaces whatever `Authorization` the export resolved with the token the refresh chain yields. */
const withChainedAuth = (headers: { name: string; value: string }[], value: string) => [
  { name: AUTH_HEADER, value },
  ...headers.filter((header) => header.name.toLowerCase() !== AUTH_HEADER.toLowerCase()),
];

/**
 * Builds an Insomnia v4 collection from a set of requests, ready to be imported via Insomnia's
 * `Import > From File / Clipboard`. Requests are filed into a folder per query client, and a request
 * naming a token refresh gets its bearer token from that refresh's response rather than from a
 * literal token frozen at export time.
 */
export const buildInsomniaExport = (options: BuildInsomniaExportOptions): InsomniaExport => {
  const groups = new Map<string, string>();
  const resources: InsomniaResource[] = [
    {
      _id: WORKSPACE_ID,
      _type: 'workspace',
      parentId: null,
      name: options.name,
      description: 'Exported from the @ethlete/query devtools.',
      scope: 'collection',
      created: options.now,
      modified: options.now,
    },
  ];

  const groupIdFor = (name: string | null | undefined) => {
    if (!name) return WORKSPACE_ID;

    const existing = groups.get(name);
    if (existing) return existing;

    const id = `fld_${groups.size}`;
    groups.set(name, id);

    resources.push({
      _id: id,
      _type: 'request_group',
      parentId: WORKSPACE_ID,
      name,
      environment: {},
      // Insomnia sorts ascending, so the counter keeps folders in the order they were added.
      metaSortKey: groups.size,
      created: options.now,
      modified: options.now,
    });

    return id;
  };

  const requestResource = (resource: InsomniaResource) => {
    resources.push({
      _type: 'request',
      description: '',
      parameters: [],
      authentication: {},
      isPrivate: false,
      settingStoreCookies: true,
      settingSendCookies: true,
      settingEncodeUrl: true,
      settingRebuildPath: true,
      settingFollowRedirects: 'global',
      created: options.now,
      modified: options.now,
      ...resource,
    });
  };

  /** The `Authorization` value a request chained to a given token refresh gets, keyed by refresh id. */
  const chainedAuth = new Map<string, string>();

  // Emitted first so every chained `Authorization` below already has a request id to point at.
  options.tokenRefreshes?.forEach((refresh, index) => {
    const id = `req_refresh_${index}`;
    const body = bodyOf(refresh);

    chainedAuth.set(refresh.id, `Bearer ${responseTag(id, refresh)}`);

    requestResource({
      _id: id,
      parentId: groupIdFor(refresh.group),
      name: refresh.name,
      description:
        'Mints the access token every secure request in this collection reads. Insomnia re-sends it on ' +
        `its own once the stored response is older than ${refresh.maxAgeSeconds}s. The refresh token in ` +
        'the body is the one the app held at export time - re-export once it is spent.',
      method: refresh.method,
      url: refresh.url,
      body,
      headers: headersOf(refresh, 'text' in body),
      // Insomnia sorts ascending and the exported requests start at 0, so the refresh stays on top.
      metaSortKey: index - (options.tokenRefreshes?.length ?? 0),
    });
  });

  options.requests.forEach((request, index) => {
    const body = bodyOf(request);
    const headers = headersOf(request, 'text' in body);
    const auth = request.secureBy ? chainedAuth.get(request.secureBy) : undefined;

    requestResource({
      _id: `req_${index}`,
      parentId: groupIdFor(request.group),
      name: request.name,
      method: request.method,
      url: request.url,
      body,
      headers: auth ? withChainedAuth(headers, auth) : headers,
      metaSortKey: index,
    });
  });

  return {
    _type: 'export',
    __export_format: 4,
    __export_date: new Date(options.now).toISOString(),
    __export_source: 'ethlete.query:devtools',
    resources,
  };
};
