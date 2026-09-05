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

/**
 * What a body is sent as, which is what decides both the `--data-raw` and the `Content-Type`. `binary`
 * is a body `HttpClient` hands to the browser as it is (`FormData`, a `Blob`, an `ArrayBuffer`) - the
 * panel holds no bytes to write into a command, so it says so instead of writing `{}`.
 */
const bodyOf = (request: CurlRequestInput): { data: string | null; json: boolean; binary: string | null } => {
  if (request.gqlQuery) {
    const variables = (request.body as { variables?: unknown } | null)?.variables ?? {};

    return asJson(jsonBody({ query: request.gqlQuery, variables }));
  }

  const body = request.body;

  if (body === null || body === undefined) return { data: null, json: false, binary: null };

  // Angular sends a string as `text/plain` and lets the browser label the rest, so only the shapes
  // `HttpClient` itself serializes as JSON may be labelled that way here.
  if (typeof body === 'string') return { data: body, json: false, binary: null };

  const binary = binaryLabelOf(body);

  if (binary) return { data: null, json: false, binary };

  return asJson(jsonBody(body));
};

/** A body written as JSON, or - where it could not be written at all - one that is labelled as nothing. */
const asJson = (data: string | null) => ({ data, json: data !== null, binary: null });

const binaryLabelOf = (body: unknown) => {
  if (typeof FormData !== 'undefined' && body instanceof FormData) return 'FormData';
  if (typeof Blob !== 'undefined' && body instanceof Blob) return 'Blob';
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return 'binary';
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return 'URLSearchParams';

  return null;
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
    !body.json || hasContentType ? headers : [...headers, { name: 'Content-Type', value: 'application/json' }];

  const lines = body.binary
    ? [`# The panel cannot replay a ${body.binary} body - this command sends none.\ncurl ${shellQuote(request.url)}`]
    : [`curl ${shellQuote(request.url)}`];

  // GET is curl's default, so spelling it out only adds noise to the common case.
  if (request.method.toUpperCase() !== 'GET') lines.push(`-X ${request.method.toUpperCase()}`);

  for (const header of withContentType) lines.push(`-H ${shellQuote(`${header.name}: ${header.value}`)}`);

  // `--data-raw`, not `-d`: the latter strips newlines and would mangle a GraphQL document, and it also
  // rewrites the method to POST behind your back.
  if (body.data !== null) lines.push(`--data-raw ${shellQuote(body.data)}`);

  return lines.join(' \\\n  ');
};
