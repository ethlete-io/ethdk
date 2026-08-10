/**
 * How deep a designed body is walked before a nested value is inferred as an unconstrained schema. A
 * body nested deeper than this is not a shape anyone merges into a specification.
 */
const MAX_DEPTH = 10;

/** An ISO date-time, strictly enough that nothing else is mistaken for one. */
const DATE_TIME = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** One designed mock, as the export reads it. */
export type QueryDevtoolsOpenApiMock = {
  /** Which query client serves it - the operation's tag, since a document has no other place for it. */
  clientName: string;

  method: string;

  /** The route with its path params as `:name`; the document writes them as `{name}`. */
  pattern: string;

  /** Query parameters the mock declares, as a query string (`page=2&limit=10`). */
  query: string;

  status: number;

  body: unknown;

  /**
   * The named schema the body was seeded from. When the export carries that schema, the response
   * references it instead of an anonymous shape inferred from the body.
   */
  schemaName?: string | null;

  /** Set when the body came from a real response rather than being written by hand. */
  capturedAt?: number | null;
};

export type BuildQueryDevtoolsOpenApiOptions = {
  mocks: readonly QueryDevtoolsOpenApiMock[];

  /**
   * Named schemas lifted out of the application's own API description, keyed as `components.schemas`
   * wants them - `collectQueryDevtoolsSchemaComponents` in `@ethlete/query` produces them.
   */
  schemas?: Record<string, unknown>;

  /** Wall-clock time of the export - passed in so the builder stays pure. */
  now: number;

  title?: string;
};

/** An OpenAPI 3.1 document, as far as this export writes one. */
export type QueryDevtoolsOpenApiDocument = {
  openapi: '3.1.0';
  info: { title: string; version: string; description: string };
  paths: Record<string, Record<string, unknown>>;
  components?: { schemas: Record<string, unknown> };
};

export type QueryDevtoolsOpenApiExport<TDocument> = {
  document: TDocument;

  /** What had to be guessed or dropped, so the document is never taken for the contract. */
  notes: readonly string[];
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** `/matches/:id` is how a mock writes a route; a document writes it `/matches/{id}`. */
const toBracePattern = (pattern: string) => pattern.replace(/:([^/]+)/g, '{$1}');

const pathParamsOf = (pattern: string) =>
  pattern
    .split('/')
    .filter((segment) => segment.startsWith(':'))
    .map((segment) => segment.slice(1));

/**
 * The schema of one sample value. **Inferred from a single example**, so every property the example held
 * is listed as required, nothing is nullable, and a `null` carries no type at all - what the example
 * proves and not one claim more. The document's own description says so.
 */
export const inferQueryDevtoolsOpenApiSchema = (value: unknown, depth = 0): Record<string, unknown> => {
  if (depth >= MAX_DEPTH) return {};

  // One example cannot say what a null-valued property is when it holds something, so it says nothing.
  if (value === null || value === undefined) return {};

  switch (typeof value) {
    case 'string':
      if (DATE_TIME.test(value)) return { type: 'string', format: 'date-time' };
      if (UUID.test(value)) return { type: 'string', format: 'uuid' };

      return { type: 'string' };
    case 'number':
      if (!Number.isFinite(value)) return { type: 'number' };

      return { type: Number.isInteger(value) ? 'integer' : 'number' };
    case 'boolean':
      return { type: 'boolean' };
    default:
      break;
  }

  if (Array.isArray(value)) return { type: 'array', items: itemsOf(value, depth) };

  if (isPlainObject(value)) {
    const entries = Object.entries(value);

    if (!entries.length) return { type: 'object' };

    return {
      type: 'object',
      properties: Object.fromEntries(
        entries.map(([key, entry]) => [key, inferQueryDevtoolsOpenApiSchema(entry, depth + 1)]),
      ),
      required: entries.map(([key]) => key),
    };
  }

  return {};
};

/**
 * The element schema of an array: the one its members agree on, or a `oneOf` of the shapes they do not.
 * An empty array says nothing about its elements, so it constrains nothing.
 */
const itemsOf = (value: readonly unknown[], depth: number): Record<string, unknown> => {
  const members = new Map<string, Record<string, unknown>>();

  for (const entry of value) {
    const schema = inferQueryDevtoolsOpenApiSchema(entry, depth + 1);

    members.set(JSON.stringify(schema), schema);
  }

  const distinct = [...members.values()];

  if (!distinct.length) return {};
  if (distinct.length === 1) return distinct[0] as Record<string, unknown>;

  return { oneOf: distinct };
};

/** `page=2` is an integer and `draft=true` a boolean, the same reading the TypeScript snippet takes. */
const queryParamSchema = (value: string): Record<string, unknown> => {
  if (value === 'true' || value === 'false') return { type: 'boolean' };
  if (value !== '' && Number.isFinite(Number(value))) {
    return { type: Number.isInteger(Number(value)) ? 'integer' : 'number' };
  }

  return { type: 'string' };
};

/** `GET /posts/:id/comments` becomes `getPostsComments` - the verb, then every literal segment. */
const operationIdOf = (mock: Pick<QueryDevtoolsOpenApiMock, 'method' | 'pattern'>) => {
  const words = mock.pattern
    .split('/')
    .filter((segment) => segment && !segment.startsWith(':'))
    .flatMap((segment) => segment.split(/[^A-Za-z0-9]+/))
    .filter(Boolean);

  const name = [mock.method.toLowerCase(), ...words.map((word) => word[0]?.toUpperCase() + word.slice(1))].join('');

  return /^[A-Za-z_$]/.test(name) ? name : `operation${name}`;
};

const parametersOf = (mocks: readonly QueryDevtoolsOpenApiMock[]) => {
  const first = mocks[0] as QueryDevtoolsOpenApiMock;
  const parameters: Record<string, unknown>[] = pathParamsOf(first.pattern).map((name) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }));

  const seen = new Set<string>();

  for (const mock of mocks) {
    for (const [name, value] of new URLSearchParams(mock.query)) {
      if (seen.has(name)) continue;

      seen.add(name);
      // A mock declares what a request must carry for *it* to answer, which says nothing about whether
      // the endpoint requires it - so an exported query parameter is never marked required.
      parameters.push({ name, in: 'query', required: false, schema: queryParamSchema(value), example: value });
    }
  }

  return parameters;
};

/** A `?page=2` mock and a plain one are two examples of one response; the query string names them apart. */
const exampleNameOf = (mock: QueryDevtoolsOpenApiMock, taken: Set<string>) => {
  const base = mock.query || mock.clientName || 'designed';
  let name = base;

  for (let attempt = 2; taken.has(name); attempt++) name = `${base} (${attempt})`;

  taken.add(name);

  return name;
};

const responseDescription = (mocks: readonly QueryDevtoolsOpenApiMock[], status: number) => {
  const clients = [...new Set(mocks.map((mock) => mock.clientName).filter(Boolean))];
  const served = clients.length ? ` served for ${clients.join(', ')}` : '';
  const captured = mocks.some((mock) => mock.capturedAt) ? ' Captured from a real response.' : '';

  return `${status >= 400 ? 'A designed failure' : 'The designed response'}${served}.${captured}`;
};

type ResponseContext = {
  /** Named schemas the export carries, so a seeded response can reference one rather than infer it. */
  schemas: Record<string, unknown>;
  notes: Set<string>;
};

const responseSchema = (mock: QueryDevtoolsOpenApiMock, ctx: ResponseContext): Record<string, unknown> => {
  const name = mock.schemaName;

  if (name && name in ctx.schemas) return { $ref: `#/components/schemas/${name}` };

  if (name) {
    ctx.notes.add(
      `${mock.method} ${mock.pattern} was seeded from ${name}, which is not in this export - its schema was inferred from the body instead.`,
    );
  }

  return inferQueryDevtoolsOpenApiSchema(mock.body);
};

const responsesOf = (mocks: readonly QueryDevtoolsOpenApiMock[], ctx: ResponseContext) => {
  const byStatus = new Map<number, QueryDevtoolsOpenApiMock[]>();

  for (const mock of mocks) {
    const list = byStatus.get(mock.status);

    if (list) list.push(mock);
    else byStatus.set(mock.status, [mock]);
  }

  const responses: Record<string, unknown> = {};

  for (const [status, list] of [...byStatus.entries()].sort(([a], [b]) => a - b)) {
    const first = list[0] as QueryDevtoolsOpenApiMock;
    const schema = responseSchema(first, ctx);

    if (list.length > 1) {
      ctx.notes.add(
        `${first.method} ${first.pattern} has ${list.length} designed ${status} responses - the first one's schema was exported, and all of them as examples.`,
      );
    }

    const taken = new Set<string>();
    const examples =
      list.length === 1
        ? { example: first.body }
        : {
            examples: Object.fromEntries(
              list.map((mock) => [exampleNameOf(mock, taken), { value: mock.body }] as const),
            ),
          };

    responses[String(status)] = {
      description: responseDescription(list, status),
      content: { 'application/json': { schema, ...examples } },
    };
  }

  return responses;
};

/** The methods a designed request body would belong to, so the export says it does not have one. */
const SENDS_BODY: ReadonlySet<string> = /* @__PURE__ */ new Set(['POST', 'PUT', 'PATCH']);

const operationDescription = (mocks: readonly QueryDevtoolsOpenApiMock[], ctx: ResponseContext) => {
  const first = mocks[0] as QueryDevtoolsOpenApiMock;
  const named = mocks.map((mock) => mock.schemaName).find((name) => !!name && name in ctx.schemas);
  const lines = [
    named
      ? `The response is this description's own ${named}, which the mock was seeded from.`
      : "The response schema was inferred from the designed body - see this document's description.",
  ];

  if (SENDS_BODY.has(first.method.toUpperCase())) {
    lines.push('The devtools design a response only, so no request body is declared here.');
  }

  return lines.join(' ');
};

const operationOf = (mocks: readonly QueryDevtoolsOpenApiMock[], ctx: ResponseContext) => {
  const first = mocks[0] as QueryDevtoolsOpenApiMock;
  const path = toBracePattern(first.pattern);
  const tags = [...new Set(mocks.map((mock) => mock.clientName).filter(Boolean))];
  const parameters = parametersOf(mocks);

  return {
    ...(tags.length ? { tags } : {}),
    summary: `Designed response for ${first.method.toUpperCase()} ${path}`,
    description: operationDescription(mocks, ctx),
    operationId: operationIdOf(first),
    ...(parameters.length ? { parameters } : {}),
    responses: responsesOf(mocks, ctx),
  };
};

/**
 * Groups mocks into `paths` entries - one path item per route, one operation per method, one response
 * per status. Operation ids are made unique inside the document, since two clients can serve one route.
 */
const pathsOf = (mocks: readonly QueryDevtoolsOpenApiMock[], ctx: ResponseContext) => {
  const groups = new Map<string, QueryDevtoolsOpenApiMock[]>();

  for (const mock of mocks) {
    const key = `${toBracePattern(mock.pattern)}|${mock.method.toLowerCase()}`;
    const group = groups.get(key);

    if (group) group.push(mock);
    else groups.set(key, [mock]);
  }

  const paths: Record<string, Record<string, unknown>> = {};
  const ids = new Set<string>();

  for (const group of groups.values()) {
    const first = group[0] as QueryDevtoolsOpenApiMock;
    const path = toBracePattern(first.pattern);
    const operation = operationOf(group, ctx);

    let id = operation.operationId;

    for (let attempt = 2; ids.has(id); attempt++) id = `${operation.operationId}${attempt}`;

    ids.add(id);
    paths[path] = { ...paths[path], [first.method.toLowerCase()]: { ...operation, operationId: id } };
  }

  return paths;
};

const INFO_DESCRIPTION = /* @__PURE__ */ [
  'Responses designed in the @ethlete/query devtools and served to the application in place of real requests.',
  '',
  'Every schema here was inferred from one example, so it says what that example held and nothing more:',
  'each property the example carried is listed as required, no property is marked nullable, and one whose',
  'example was null carries no type at all. A route seeded from a named schema references that schema',
  'instead, and the schema is copied in unchanged.',
].join('\n');

/**
 * Builds an OpenAPI 3.1 document from a set of designed mocks - the response side of what the Insomnia
 * and cURL exports do for the request side, and the artefact an API team can merge.
 */
export const buildQueryDevtoolsOpenApiDocument = (
  options: BuildQueryDevtoolsOpenApiOptions,
): QueryDevtoolsOpenApiExport<QueryDevtoolsOpenApiDocument> => {
  const ctx: ResponseContext = { schemas: options.schemas ?? {}, notes: new Set() };
  const paths = pathsOf(options.mocks, ctx);
  const used = referencedSchemas(paths, ctx.schemas);

  return {
    document: {
      openapi: '3.1.0',
      info: {
        title: options.title ?? 'Designed mocks',
        version: new Date(options.now).toISOString().slice(0, 10),
        description: INFO_DESCRIPTION,
      },
      paths,
      ...(Object.keys(used).length ? { components: { schemas: used } } : {}),
    },
    notes: [...ctx.notes],
  };
};

/**
 * Builds the `paths` entry for one mock, so a single route can be pasted under an existing document's
 * `paths`. A response seeded from a named schema keeps its `$ref`: the fragment is merged into the
 * description that declares it, so carrying a copy of the schema along would only conflict with it.
 */
export const buildQueryDevtoolsOpenApiPathItem = (
  options: Pick<BuildQueryDevtoolsOpenApiOptions, 'mocks' | 'schemas'>,
): QueryDevtoolsOpenApiExport<Record<string, Record<string, unknown>>> => {
  const ctx: ResponseContext = { schemas: options.schemas ?? {}, notes: new Set() };
  const paths = pathsOf(options.mocks, ctx);
  // Only what the fragment itself points at: whatever declares those already resolves the rest.
  const referenced = [...collectRefNames(paths)].filter((name) => name in ctx.schemas);

  if (referenced.length) {
    ctx.notes.add(
      `This fragment references ${referenced.join(', ')} - paste it into the description that declares ${referenced.length > 1 ? 'them' : 'it'}.`,
    );
  }

  return { document: paths, notes: [...ctx.notes] };
};

/** Only the named schemas the exported paths actually reference, plus what those reference in turn. */
const referencedSchemas = (paths: unknown, schemas: Record<string, unknown>) => {
  const used: Record<string, unknown> = {};
  const pending = [...collectRefNames(paths)];

  while (pending.length) {
    const name = pending.shift() as string;

    if (name in used || !(name in schemas)) continue;

    used[name] = schemas[name];
    pending.push(...collectRefNames(schemas[name]));
  }

  return used;
};

const REF_PREFIX = '#/components/schemas/';

const collectRefNames = (value: unknown, into = new Set<string>()) => {
  if (Array.isArray(value)) {
    for (const entry of value) collectRefNames(entry, into);

    return into;
  }

  if (!isPlainObject(value)) return into;

  for (const [key, entry] of Object.entries(value)) {
    if (key === '$ref' && typeof entry === 'string' && entry.startsWith(REF_PREFIX)) {
      into.add(entry.slice(REF_PREFIX.length));

      continue;
    }

    collectRefNames(entry, into);
  }

  return into;
};
