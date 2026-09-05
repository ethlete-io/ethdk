/* eslint-disable @typescript-eslint/naming-convention -- the `__export_*` keys are Insomnia's file format */
import {
  QueryDevtoolsBodyInput,
  QueryDevtoolsRequestBody,
  queryDevtoolsRequestBody,
} from './query-devtools-request-body';
import { isSecretKey } from './query-devtools-session';

/**
 * One request to export. Values are what the query actually sent (or would send), already resolved -
 * no `:param` placeholders unless the query has no args yet, in which case Insomnia picks them up as
 * its own path params.
 */
export type InsomniaRequestInput = QueryDevtoolsBodyInput & {
  name: string;
  method: string;
  url: string;
  headers: { name: string; value: string }[];

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
export type InsomniaTokenRefreshInput = QueryDevtoolsBodyInput & {
  /** What a request's {@link InsomniaRequestInput.secureBy} points at, usually the provider's name. */
  id: string;

  name: string;
  method: string;
  url: string;
  headers: { name: string; value: string }[];

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

const bodyOf = (request: QueryDevtoolsBodyInput, body: QueryDevtoolsRequestBody) => {
  if (body.data === null) return {};
  // Insomnia's GraphQL body editor stores `{ query, variables }` as its text, so a GraphQL request
  // carries the document and its variables rather than the serialized POST body.
  if (request.gqlQuery) return { mimeType: 'graphql', text: body.data };

  return body.json ? { mimeType: 'application/json', text: body.data } : { text: body.data };
};

/**
 * Angular's `HttpClient` labels an object body `application/json` on its own, so a replay outside the
 * app needs the header spelled out to reach the same endpoint the same way. Only a body that was
 * serialized as JSON gets it: Angular sends a string as `text/plain` and lets the browser label the
 * rest.
 */
const headersOf = (input: { headers: { name: string; value: string }[] }, isJson: boolean) => {
  const headers = input.headers.filter((header) => header.value !== '');
  const hasContentType = headers.some((header) => header.name.toLowerCase() === 'content-type');

  if (!isJson || hasContentType) return headers;

  return [...headers, { name: 'Content-Type', value: 'application/json' }];
};

/** What a request says about itself when what it sends is not what the app sent. */
const notesOf = (body: QueryDevtoolsRequestBody, droppedAuth: boolean) => {
  const notes: string[] = [];

  if (body.binary) notes.push(`The panel cannot replay a ${body.binary} body - this request sends none.`);
  if (body.unserializable) notes.push('The panel could not serialize this body - this request sends none.');
  if (droppedAuth) {
    notes.push(
      'The Authorization this request was sent with is left out: no token refresh could be exported for its ' +
        'auth provider, and a token frozen at export time is stale within the hour.',
    );
  }

  return notes.join(' ');
};

const AUTH_HEADER = 'Authorization';

/**
 * Insomnia's template tag for reading a value out of another request's response. `when-expired` plus a
 * max age is what makes the chain maintain itself: once the stored refresh response is older than
 * `maxAgeSeconds`, sending a request that reads from it re-sends the refresh first.
 */
const responseTag = (requestId: string, refresh: InsomniaTokenRefreshInput) =>
  `{% response 'body', '${requestId}', '${escapeTag(refresh.accessTokenPath)}', 'when-expired', ${refresh.maxAgeSeconds} %}`;

/** A value going inside single quotes - a template tag argument or a bracket-quoted JSONPath key. */
const escapeTag = (value: string) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

/** Replaces whatever `Authorization` the export resolved with the token the refresh chain yields. */
const withChainedAuth = (headers: { name: string; value: string }[], value: string) => [
  { name: AUTH_HEADER, value },
  ...headers.filter((header) => header.name.toLowerCase() !== AUTH_HEADER.toLowerCase()),
];

const IDENTIFIER_KEY = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const valuePath = (value: string, node: { value: unknown; path: string; depth: number }): string | null => {
  if (node.value === value) return node.path;
  if (node.depth > 5 || !node.value || typeof node.value !== 'object') return null;

  for (const [key, entry] of Object.entries(node.value)) {
    const path = Array.isArray(node.value)
      ? `${node.path}[${key}]`
      : IDENTIFIER_KEY.test(key)
        ? `${node.path}.${key}`
        : `${node.path}['${escapeTag(key)}']`;
    const found = valuePath(value, { value: entry, path, depth: node.depth + 1 });

    if (found) return found;
  }

  return null;
};

/**
 * The JSONPath of a string value inside a response, or `null`. Used to locate the access token in an
 * auth response whose shape only the provider's `extractTokens` knows. A key JSONPath cannot name
 * after a dot is bracket-quoted, since `$.access-token` resolves as a subtraction rather than a member.
 */
export const findInsomniaValuePath = (value: string, response: unknown) =>
  valuePath(value, { value: response, path: '$', depth: 0 });

/**
 * Builds an Insomnia v4 collection from a set of requests, ready to be imported via Insomnia's
 * `Import > From File / Clipboard`. Requests are filed into a folder per query client, and a request
 * naming a token refresh gets its bearer token from that refresh's response rather than from a
 * literal token frozen at export time. A secure request whose refresh is not in the collection is
 * exported without its credentials, and says so in its description.
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
    const resolved = queryDevtoolsRequestBody(refresh, 2);

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
      body: bodyOf(refresh, resolved),
      headers: headersOf(refresh, resolved.json),
      // Insomnia sorts ascending and the exported requests start at 0, so the refresh stays on top.
      metaSortKey: index - (options.tokenRefreshes?.length ?? 0),
    });
  });

  options.requests.forEach((request, index) => {
    const resolved = queryDevtoolsRequestBody(request, 2);
    const auth = request.secureBy ? chainedAuth.get(request.secureBy) : undefined;
    // A secure request the collection cannot mint a token for keeps none of the credentials the panel
    // resolved for it: a live bearer token in a file bound for a ticket is the leak the chaining exists
    // to avoid, and it is stale within the hour anyway.
    const dropCredentials = !!request.secureBy && !auth;
    const headers = headersOf(request, resolved.json).filter((header) => !dropCredentials || !isSecretKey(header.name));

    requestResource({
      _id: `req_${index}`,
      parentId: groupIdFor(request.group),
      name: request.name,
      description: notesOf(resolved, dropCredentials),
      method: request.method,
      url: request.url,
      body: bodyOf(request, resolved),
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
