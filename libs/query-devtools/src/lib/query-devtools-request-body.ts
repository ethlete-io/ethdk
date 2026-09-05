/** The body fields of a request, as both exports resolve them. */
export type QueryDevtoolsBodyInput = {
  /** The request body, or `null` for a request that sends none. */
  body: unknown;

  /** The GraphQL document, for a GraphQL query - sent as `{ query, variables }` the way the client does. */
  gqlQuery?: string | null;
};

/**
 * What a body is written out as, which is what decides both what an export sends and the
 * `Content-Type` it may claim.
 */
export type QueryDevtoolsRequestBody = {
  /** The text to send, or `null` for a request that sends nothing an export can write. */
  data: string | null;

  /** Whether {@link data} was serialized as JSON, i.e. whether `application/json` describes it. */
  json: boolean;

  /** The kind of body the panel holds no bytes for (`FormData`, `Blob`, …), or `null`. */
  binary: string | null;

  /** Whether a body was there but could not be serialized - a cycle, or a throwing `toJSON`. */
  unserializable: boolean;
};

const binaryLabelOf = (body: unknown) => {
  if (typeof FormData !== 'undefined' && body instanceof FormData) return 'FormData';
  if (typeof Blob !== 'undefined' && body instanceof Blob) return 'Blob';
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return 'binary';
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return 'URLSearchParams';

  return null;
};

const asJson = (body: unknown, indent: number): QueryDevtoolsRequestBody => {
  try {
    const data = JSON.stringify(body, null, indent);

    return { data, json: true, binary: null, unserializable: false };
  } catch {
    return { data: null, json: false, binary: null, unserializable: true };
  }
};

/**
 * How a request's body reaches an export. `indent` is passed to `JSON.stringify`, so a command can
 * stay on one line while a collection stays readable.
 *
 * Angular sends a string body as `text/plain` and lets the browser label a `FormData`, a `Blob` or an
 * `ArrayBuffer` itself, so only the shapes `HttpClient` serializes as JSON are reported as `json` -
 * an export that claims `application/json` for the rest replays a different request than the app sent.
 */
export const queryDevtoolsRequestBody = (request: QueryDevtoolsBodyInput, indent = 0): QueryDevtoolsRequestBody => {
  if (request.gqlQuery) {
    const variables = (request.body as { variables?: unknown } | null)?.variables ?? {};

    return asJson({ query: request.gqlQuery, variables }, indent);
  }

  const body = request.body;

  if (body === null || body === undefined) return { data: null, json: false, binary: null, unserializable: false };
  if (typeof body === 'string') return { data: body, json: false, binary: null, unserializable: false };

  const binary = binaryLabelOf(body);

  if (binary) return { data: null, json: false, binary, unserializable: false };

  return asJson(body, indent);
};
