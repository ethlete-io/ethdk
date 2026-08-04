/**
 * One request to render as a `curl` command. The same shape the Insomnia export takes its requests in,
 * so both exports describe a request the one way the panel resolves it.
 */
export type CurlRequestInput = {
  method: string;
  url: string;
  headers: { name: string; value: string }[];

  /** The request body, or `null` for a request that sends none. */
  body: unknown;

  /** The GraphQL document, for a GraphQL query - sent as `{ query, variables }` the way the client does. */
  gqlQuery?: string | null;
};

const jsonBody = (body: unknown) => {
  try {
    return JSON.stringify(body);
  } catch {
    // A body holding a circular reference or a throwing `toJSON` cannot be written out.
    return null;
  }
};

/**
 * Wraps a value in single quotes for a POSIX shell, which is the one quoting that leaves everything
 * inside untouched - `$`, backticks and backslashes included. A single quote cannot be escaped inside
 * such a string, so each one ends the quoting, emits an escaped quote and opens it again.
 */
const shellQuote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

const bodyOf = (request: CurlRequestInput) => {
  if (request.gqlQuery) {
    const variables = (request.body as { variables?: unknown } | null)?.variables ?? {};

    return jsonBody({ query: request.gqlQuery, variables });
  }

  if (request.body === null || request.body === undefined) return null;
  if (typeof request.body === 'string') return request.body;

  return jsonBody(request.body);
};

/**
 * Renders a request as a copy-pasteable `curl` command, one option per line so a long one stays
 * readable in a terminal, a ticket or a chat message.
 *
 * Angular's `HttpClient` labels an object body `application/json` on its own, so the header is spelled
 * out here for a body that has one - without it the request reaches the endpoint differently than the
 * app sent it. Headers whose value the panel could not resolve (a secure query's `Authorization`
 * without an access token) are left out, so what is emitted is only what was known.
 */
export const buildCurlCommand = (request: CurlRequestInput) => {
  const body = bodyOf(request);
  const headers = request.headers.filter((header) => header.value !== '');
  const hasContentType = headers.some((header) => header.name.toLowerCase() === 'content-type');
  const withContentType =
    body === null || hasContentType ? headers : [...headers, { name: 'Content-Type', value: 'application/json' }];

  const lines = [`curl ${shellQuote(request.url)}`];

  // GET is curl's default, so spelling it out only adds noise to the common case.
  if (request.method.toUpperCase() !== 'GET') lines.push(`-X ${request.method.toUpperCase()}`);

  for (const header of withContentType) lines.push(`-H ${shellQuote(`${header.name}: ${header.value}`)}`);

  // `--data-raw`, not `-d`: the latter strips newlines and would mangle a GraphQL document, and it also
  // rewrites the method to POST behind your back.
  if (body !== null) lines.push(`--data-raw ${shellQuote(body)}`);

  return lines.join(' \\\n  ');
};
