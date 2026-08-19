import { computed, signal } from '@angular/core';
import {
  generateQueryDevtoolsNumberPreset,
  generateQueryDevtoolsSampleNumber,
  generateQueryDevtoolsStringPreset,
} from './query-devtools-overrides';

/**
 * How an application hands its API description to the devtools, so a designed mock can start from the
 * real shape of a response instead of a guess. TypeScript types are erased at runtime, so a generated
 * `.d.ts` is not readable from here - the document the types were generated *from* is.
 *
 * OpenAPI 3.x, Swagger 2 and a bare JSON Schema document all work: named schemas are read from
 * `components.schemas`, `definitions` or `$defs`, and routes from `paths`.
 *
 * The loader is called at most once, and only when the panel first asks for it - so returning a dynamic
 * `import()` keeps the document out of the application bundle entirely.
 *
 * @example
 * ```ts
 * provideQueryDevtools({ schema: () => import('../openapi.json') })
 * provideQueryDevtools({ schema: () => fetch('/openapi.json').then((res) => res.json()) })
 * ```
 */
export type QueryDevtoolsSchemaLoader = () => Promise<unknown> | unknown;

/**
 * The description each query client is served by. One loader describes every client - which is what a
 * single-API application wants - and a record keyed by client name (the `name` a client was created
 * with) describes them one API at a time, so a mock designed against one client never offers another
 * one's routes.
 *
 * @example
 * ```ts
 * provideQueryDevtools({
 *   schema: {
 *     hubApiClient: () => import('../hub-openapi.json'),
 *     votingApiClient: () => fetch('/voting/openapi.json').then((res) => res.json()),
 *   },
 * })
 * ```
 */
export type QueryDevtoolsSchemaLoaders = QueryDevtoolsSchemaLoader | Record<string, QueryDevtoolsSchemaLoader>;

/**
 * Where the API description stands. `unavailable` means the application never handed one in, which is
 * what the panel shows the seeding controls on.
 */
export type QueryDevtoolsSchemaState =
  | { status: 'unavailable' }
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

/** One route the description declares, whether or not the application has ever called it. */
export type QueryDevtoolsSchemaRoute = {
  method: string;

  /** The route with its path params as `:name`, so it reads the way a mock's pattern does. */
  pattern: string;

  /** The operation's summary, its `operationId`, or empty - whatever the document offers as a label. */
  summary: string;
};

/**
 * A body generated from the description, plus everything that could not be read off it with certainty.
 * A seed is a starting point for the designer, never a claim about what the API returns.
 */
export type QueryDevtoolsSchemaSeed = {
  body: unknown;

  /** The named schema the body was generated from, when the document named one. */
  schemaName: string | null;

  /**
   * The declared type of each field, keyed by its path with array indices as `*` (`items.*.id`) - so one
   * entry annotates every element of an array, however many the designer goes on to add.
   */
  types: ReadonlyMap<string, string>;

  /** What had to be guessed, skipped or cut short, so a seeded body is never mistaken for the contract. */
  notes: readonly string[];
};

/**
 * How lifelike a seeded body is. `placeholder` names every field after itself, so a seed reads as
 * obviously unreal; `realistic` fills it with varied sample values, so a list is not three identical
 * rows; `stress` fills it with what a layout breaks on - long unbreakable words, unicode, huge numbers.
 */
export type QueryDevtoolsSeedStyle = 'placeholder' | 'realistic' | 'stress';

/** How deep a schema is expanded before a nested branch is given up on. */
const MAX_DEPTH = 12;

/** How many elements are generated for an array, whatever its `minItems` says. */
const MAX_ITEMS = 3;
const MAX_STRING_LENGTH = 10_000;

/**
 * How many array elements are generated on their own rather than copied from the first. Nested arrays
 * multiply, so without a ceiling a body of arrays-in-arrays costs `MAX_ITEMS ^ MAX_DEPTH` walks.
 */
const VARIED_ITEMS_BUDGET = 200;

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

/** The key a single loader is filed under, so one description answers for every client. */
const ANY_CLIENT = '*';

const loaders = /* @__PURE__ */ signal<Record<string, QueryDevtoolsSchemaLoader>>({});
const states = /* @__PURE__ */ signal<Record<string, QueryDevtoolsSchemaState>>({});
const documents = /* @__PURE__ */ signal<Record<string, Record<string, unknown>>>({});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Which description answers for a client: its own, or the one that answers for all of them. */
const keyOf = (clientName: string) => {
  const declared = loaders();

  if (clientName in declared) return clientName;

  return ANY_CLIENT in declared ? ANY_CLIENT : clientName;
};

const documentOf = (clientName: string) => documents()[keyOf(clientName)] ?? null;

/**
 * Where the description of one query client's API stands, for the panel's seeding controls.
 *
 * Part of the devtools contract. **Not part of the general public contract.**
 */
export const queryDevtoolsSchemaState = (clientName: string): QueryDevtoolsSchemaState =>
  states()[keyOf(clientName)] ?? { status: 'unavailable' };

/**
 * Installs the application's schema loaders. Called by `provideQueryDevtools()`; nothing else may call it.
 * @internal
 */
export const setQueryDevtoolsSchemaLoader = (next: QueryDevtoolsSchemaLoaders | undefined) => {
  const declared = next === undefined ? {} : typeof next === 'function' ? { [ANY_CLIENT]: next } : { ...next };

  loaders.set(declared);
  states.set(Object.fromEntries(Object.keys(declared).map((key) => [key, { status: 'idle' } as const])));
  documents.set({});
};

/** A `() => import('./openapi.json')` loader hands back the module rather than the document inside it. */
const unwrapModule = (value: unknown) => {
  if (!isRecord(value)) return value;
  if ('paths' in value || 'components' in value || 'definitions' in value || '$defs' in value) return value;

  return 'default' in value ? value['default'] : value;
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Loads the API description, once. Calling it while it is loading or after it has loaded does nothing;
 * calling it after a failure retries.
 *
 * Part of the devtools contract. **Not part of the general public contract.**
 */
export const loadQueryDevtoolsSchema = (clientName: string) => {
  const key = keyOf(clientName);
  const load = loaders()[key];
  const status = queryDevtoolsSchemaState(clientName).status;

  if (!load || status === 'loading' || status === 'ready') return;

  const setState = (next: QueryDevtoolsSchemaState) => states.update((current) => ({ ...current, [key]: next }));

  setState({ status: 'loading' });

  Promise.resolve()
    .then(() => load())
    .then((value) => {
      const parsed = unwrapModule(value);

      if (!isRecord(parsed)) throw new Error('The schema loader did not return an object.');

      documents.update((current) => ({ ...current, [key]: parsed }));
      setState({ status: 'ready' });
    })
    .catch((error: unknown) => {
      documents.update((current) => {
        const { [key]: _dropped, ...rest } = current;

        return rest;
      });
      setState({ status: 'error', message: messageOf(error) });
    });
};

const schemasOf = (doc: Record<string, unknown>): Record<string, unknown> => {
  const components = doc['components'];

  return {
    ...(isRecord(doc['$defs']) ? doc['$defs'] : null),
    ...(isRecord(doc['definitions']) ? doc['definitions'] : null),
    ...(isRecord(components) && isRecord(components['schemas']) ? components['schemas'] : null),
  };
};

const namedSchemasByKey = /* @__PURE__ */ computed(() =>
  Object.fromEntries(Object.entries(documents()).map(([key, doc]) => [key, schemasOf(doc)])),
);

const namedSchemas = (clientName: string) => namedSchemasByKey()[keyOf(clientName)] ?? {};

const schemaNamesByKey = /* @__PURE__ */ computed(() =>
  Object.fromEntries(Object.entries(namedSchemasByKey()).map(([key, schemas]) => [key, Object.keys(schemas).sort()])),
);

/**
 * Every schema one client's description names, sorted - the designer's "seed from a type" list.
 *
 * Part of the devtools contract. **Not part of the general public contract.**
 */
export const queryDevtoolsSchemaNames = (clientName: string): readonly string[] =>
  schemaNamesByKey()[keyOf(clientName)] ?? [];

const decodePointer = (step: string) => decodeURIComponent(step.replace(/~1/g, '/').replace(/~0/g, '~'));

/** The last segment of a `$ref` - `#/components/schemas/MatchId` is what a field's type is called. */
const refLabel = (ref: string) => decodePointer(ref.split('/').pop() ?? ref);

/** Resolves a local JSON pointer against one loaded document. A remote `$ref` cannot be followed. */
const resolveRef = (ref: string, doc: Record<string, unknown> | null): unknown => {
  if (!ref.startsWith('#/')) return undefined;

  let current: unknown = doc;

  for (const step of ref.slice(2).split('/')) {
    if (!isRecord(current)) return undefined;

    current = current[decodePointer(step)];
  }

  return current;
};

/** The type names currently being expanded, so a self-referencing schema is cut instead of recursed. */
type SeedContext = {
  types: Map<string, string>;
  notes: Set<string>;
  refs: string[];
  style: QueryDevtoolsSeedStyle;
  varied: number;
  doc: Record<string, unknown> | null;
};

type SeedNode = {
  schema: unknown;
  /** Dot-joined path from the body root, with array indices as `*`. */
  path: string;
  depth: number;
  /** The property key this node sits under, used as a placeholder for an unformatted string. */
  key: string | null;
};

const at = (path: string) => path || 'the root';

/** The declared `type`, tolerating the `['string', 'null']` form JSON Schema and OpenAPI 3.1 both allow. */
const typeOf = (schema: Record<string, unknown>) => {
  const type = schema['type'];

  if (typeof type === 'string') return type;
  if (Array.isArray(type))
    return type.find((entry) => typeof entry === 'string' && entry !== 'null') as string | undefined;

  return undefined;
};

const isNullable = (schema: Record<string, unknown>) => {
  const type = schema['type'];

  return schema['nullable'] === true || (Array.isArray(type) && type.includes('null'));
};

const branchesOf = (schema: Record<string, unknown>) => {
  for (const keyword of ['oneOf', 'anyOf'] as const) {
    const branches = schema[keyword];

    if (Array.isArray(branches) && branches.length) return { keyword, branches };
  }

  return null;
};

/**
 * A short label for what a field is declared as: the name of the type it `$ref`s (which is the point -
 * `MatchId` says more than `string`), a union of its branches, or its primitive type and format.
 */
const describeSchema = (schema: unknown, depth = 0): string => {
  if (!isRecord(schema) || depth > 4) return 'unknown';

  const ref = schema['$ref'];

  if (typeof ref === 'string') return refLabel(ref);

  const nullSuffix = isNullable(schema) ? ' | null' : '';
  const branches = branchesOf(schema);

  if (branches) {
    const labels = [...new Set(branches.branches.slice(0, 3).map((branch) => describeSchema(branch, depth + 1)))];

    return `${labels.join(' | ')}${branches.branches.length > 3 ? ' | …' : ''}${nullSuffix}`;
  }

  const allOf = schema['allOf'];

  if (Array.isArray(allOf) && allOf.length) {
    const named = allOf.find((entry) => isRecord(entry) && typeof entry['$ref'] === 'string');

    return `${describeSchema(named ?? allOf[0], depth + 1)}${nullSuffix}`;
  }

  const enumValues = schema['enum'];

  if (Array.isArray(enumValues) && enumValues.length) {
    const labels = enumValues.slice(0, 3).map((value) => JSON.stringify(value));

    return `${labels.join(' | ')}${enumValues.length > 3 ? ' | …' : ''}${nullSuffix}`;
  }

  const type = typeOf(schema);

  if (type === 'array') return `${describeSchema(schema['items'], depth + 1)}[]${nullSuffix}`;

  if (type === 'string') {
    const format = schema['format'];

    return `${typeof format === 'string' ? `string (${format})` : 'string'}${nullSuffix}`;
  }

  return `${type ?? 'unknown'}${nullSuffix}`;
};

const FORMAT_SAMPLES: Record<string, string> = {
  'date-time': '2026-01-01T00:00:00.000Z',
  date: '2026-01-01',
  time: '00:00:00',
  duration: 'P1D',
  uuid: '00000000-0000-4000-8000-000000000000',
  email: 'user@example.com',
  hostname: 'example.com',
  ipv4: '127.0.0.1',
  ipv6: '::1',
  uri: 'https://example.com',
  'uri-reference': '/example',
  url: 'https://example.com',
  password: '',
  byte: '',
  binary: '',
};

const STRESS_STRING_PRESETS = ['long', 'longWord', 'unicode'] as const;

const finiteNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const pickStressStringPreset = () =>
  STRESS_STRING_PRESETS[Math.floor(Math.random() * STRESS_STRING_PRESETS.length)] as 'long' | 'longWord' | 'unicode';

/** Keeps a generated string inside `minLength`/`maxLength`, since a seed is exported as a real body. */
const fitLength = (value: string, schema: Record<string, unknown>) => {
  const min = Math.min(finiteNumber(schema['minLength']) ?? 0, MAX_STRING_LENGTH);
  const max = Math.min(finiteNumber(schema['maxLength']) ?? MAX_STRING_LENGTH, MAX_STRING_LENGTH);

  let out = value;

  while (out.length < min) out += value || 'x';

  return out.slice(0, max);
};

/**
 * The value of a string field. A declared format wins in every style - a `date-time` full of lorem is
 * wrong data rather than a stress test - and an unformatted string is the field's own name, a short
 * sample or one of the three shapes that break a layout.
 */
const stringSample = (node: SeedNode, schema: Record<string, unknown>, ctx: SeedContext) => {
  const format = schema['format'];

  if (typeof format === 'string' && format in FORMAT_SAMPLES) return FORMAT_SAMPLES[format];

  if (ctx.style === 'realistic') return fitLength(generateQueryDevtoolsStringPreset('short'), schema);
  if (ctx.style === 'stress') return fitLength(generateQueryDevtoolsStringPreset(pickStressStringPreset()), schema);

  const title = schema['title'];

  if (typeof title === 'string' && title) return title;

  return node.key ?? 'string';
};

const boundsOf = (schema: Record<string, unknown>) => {
  const exclusiveMin = finiteNumber(schema['exclusiveMinimum']);
  const exclusiveMax = finiteNumber(schema['exclusiveMaximum']);

  return {
    min: finiteNumber(schema['minimum']) ?? (exclusiveMin === null ? null : exclusiveMin + 1),
    max: finiteNumber(schema['maximum']) ?? (exclusiveMax === null ? null : exclusiveMax - 1),
  };
};

const clampToBounds = (value: number, bounds: { min: number | null; max: number | null }) => {
  if (bounds.min !== null && value < bounds.min) return bounds.min;
  if (bounds.max !== null && value > bounds.max) return bounds.max;

  return value;
};

const numberSample = (schema: Record<string, unknown>, ctx: SeedContext) => {
  const bounds = boundsOf(schema);

  if (ctx.style === 'placeholder') return bounds.min ?? finiteNumber(schema['default']) ?? 0;

  if (ctx.style === 'realistic') {
    return generateQueryDevtoolsSampleNumber({ ...bounds, fractional: typeOf(schema) === 'number' });
  }

  const allowsNegative = bounds.min === null || bounds.min < 0;

  return clampToBounds(
    generateQueryDevtoolsNumberPreset(allowsNegative && Math.random() < 0.5 ? 'negative' : 'huge'),
    bounds,
  );
};

const booleanSample = (ctx: SeedContext) => ctx.style !== 'placeholder' && Math.random() < 0.5;

const childNode = (parent: SeedNode, child: { schema: unknown; key: string }): SeedNode => ({
  schema: child.schema,
  path: parent.path ? `${parent.path}.${child.key}` : child.key,
  depth: parent.depth + 1,
  key: child.key,
});

const requiredOf = (schema: Record<string, unknown>) => {
  const required = schema['required'];

  return new Set(Array.isArray(required) ? required.filter((entry): entry is string => typeof entry === 'string') : []);
};

const generateObject = (node: SeedNode, ctx: SeedContext): unknown => {
  const schema = node.schema as Record<string, unknown>;
  const properties = schema['properties'];

  if (!isRecord(properties)) {
    if (isRecord(schema['additionalProperties'])) {
      ctx.notes.add(`${at(node.path)} is a free-form map - generated as an empty object.`);
    }

    return {};
  }

  const required = requiredOf(schema);
  const result: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(properties)) {
    const target = childNode(node, { schema: child, key });

    ctx.types.set(target.path, `${describeSchema(child)}${required.has(key) ? '' : '?'}`);

    result[key] = generate(target, ctx);
  }

  return result;
};

const generateArray = (node: SeedNode, ctx: SeedContext): unknown => {
  const schema = node.schema as Record<string, unknown>;
  const items = schema['items'];

  if (!isRecord(items)) return [];

  const minItems = finiteNumber(schema['minItems']) ?? (ctx.style === 'placeholder' ? 1 : MAX_ITEMS);
  const count = Math.min(Math.max(1, minItems), MAX_ITEMS, finiteNumber(schema['maxItems']) ?? MAX_ITEMS);
  const target = { schema: items, path: `${node.path ? `${node.path}.` : ''}*`, depth: node.depth + 1, key: node.key };

  ctx.types.set(target.path, describeSchema(items));

  const element = generate(target, ctx);

  return Array.from({ length: count }, (_, index) =>
    index && ctx.style !== 'placeholder' && ctx.varied++ < VARIED_ITEMS_BUDGET
      ? generate(target, ctx)
      : structuredCopy(element),
  );
};

/** Each generated element is its own value, so editing one in the designer does not edit the others. */
const structuredCopy = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(structuredCopy);
  if (isRecord(value))
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, structuredCopy(entry)]));

  return value;
};

/** Merges what every `allOf` member generates, so a composed schema seeds as one object. */
const generateAllOf = (node: SeedNode, ctx: SeedContext): unknown => {
  const members = (node.schema as Record<string, unknown>)['allOf'] as unknown[];
  const generated = members.map((member) => generate({ ...node, schema: member }, ctx));
  const objects = generated.filter(isRecord);

  if (objects.length !== generated.length) return generated.find((value) => !isRecord(value)) ?? null;

  return Object.assign({}, ...objects) as unknown;
};

const generate = (node: SeedNode, ctx: SeedContext): unknown => {
  if (node.depth > MAX_DEPTH) {
    ctx.notes.add(`${at(node.path)} is nested deeper than ${MAX_DEPTH} levels - generated as null.`);

    return null;
  }

  if (!isRecord(node.schema)) return null;

  const schema = node.schema;
  const ref = schema['$ref'];

  if (typeof ref === 'string') {
    const name = refLabel(ref);

    if (ctx.refs.includes(name)) {
      ctx.notes.add(`${name} contains itself - the recursion was cut at ${at(node.path)} with null.`);

      return null;
    }

    const resolved = resolveRef(ref, ctx.doc);

    if (resolved === undefined) {
      ctx.notes.add(`${ref} could not be resolved - generated as null at ${at(node.path)}.`);

      return null;
    }

    ctx.refs.push(name);

    const value = generate({ ...node, schema: resolved }, ctx);

    ctx.refs.pop();

    return value;
  }

  for (const keyword of ['example', 'default', 'const'] as const) {
    if (keyword in schema) return schema[keyword];
  }

  const examples = schema['examples'];

  if (Array.isArray(examples) && examples.length) return examples[0];

  const enumValues = schema['enum'];

  if (Array.isArray(enumValues) && enumValues.length) return enumValues[0];

  const branches = branchesOf(schema);

  if (branches) {
    if (branches.branches.length > 1) {
      ctx.notes.add(`${at(node.path)} is a ${branches.keyword} - the first branch was taken.`);
    }

    return generate({ ...node, schema: branches.branches[0] }, ctx);
  }

  if (Array.isArray(schema['allOf']) && schema['allOf'].length) return generateAllOf(node, ctx);

  switch (typeOf(schema)) {
    case 'object':
      return generateObject(node, ctx);
    case 'array':
      return generateArray(node, ctx);
    case 'string':
      return stringSample(node, schema, ctx);
    case 'integer':
    case 'number':
      return numberSample(schema, ctx);
    case 'boolean':
      return booleanSample(ctx);
    case 'null':
      return null;
    default:
      break;
  }

  if (isRecord(schema['properties'])) return generateObject(node, ctx);

  ctx.notes.add(`${at(node.path)} declares no type - generated as null.`);

  return null;
};

const seedFrom = (
  schema: unknown,
  name: string | null,
  style: QueryDevtoolsSeedStyle,
  doc: Record<string, unknown> | null,
): QueryDevtoolsSchemaSeed => {
  const ctx: SeedContext = { types: new Map(), notes: new Set(), refs: name ? [name] : [], style, varied: 0, doc };
  const body = generate({ schema, path: '', depth: 0, key: null }, ctx);

  return { body, schemaName: name, types: ctx.types, notes: [...ctx.notes] };
};

/**
 * Generates a body from one schema the client's description names (`MatchView`), or `null` when it names
 * no such thing. The style decides how lifelike its values are; the shape is the same either way.
 *
 * Part of the devtools contract. **Not part of the general public contract.**
 */
export const seedQueryDevtoolsSchemaBody = (
  clientName: string,
  name: string,
  style: QueryDevtoolsSeedStyle = 'placeholder',
): QueryDevtoolsSchemaSeed | null => {
  const schema = namedSchemas(clientName)[name];

  if (schema === undefined) return null;

  return seedFrom(schema, name, style, documentOf(clientName));
};

/** Everything a set of named schemas needs to resolve on its own, lifted out of the description. */
export type QueryDevtoolsSchemaComponents = {
  /**
   * The named schemas plus everything they transitively `$ref`, keyed as `components.schemas` wants
   * them. A name the description does not declare is simply absent, which is what a caller checks.
   */
  schemas: Record<string, unknown>;

  /** Refs that could not be brought along, so an exported document says why it does not resolve. */
  notes: readonly string[];
};

/** Where a schema was collected from, so the same name arriving from two pointers is caught. */
const originOf = (label: string, pointer: string | null) => pointer ?? `named:${label}`;

type RefRequest = { label: string; pointer: string | null };

/**
 * Copies a schema, pointing every local `$ref` at `#/components/schemas/<name>` and queueing that name -
 * so a document assembled from these resolves against its own `components`, whether the description kept
 * its schemas under `components.schemas`, `definitions` or `$defs`.
 */
const rewriteRefs = (value: unknown, queue: (request: RefRequest) => void): unknown => {
  if (Array.isArray(value)) return value.map((entry) => rewriteRefs(entry, queue));
  if (!isRecord(value)) return value;

  const result: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (key === '$ref' && typeof entry === 'string') {
      if (!entry.startsWith('#/')) {
        result[key] = entry;

        continue;
      }

      const label = refLabel(entry);

      queue({ label, pointer: entry });
      result[key] = `#/components/schemas/${label}`;

      continue;
    }

    result[key] = rewriteRefs(entry, queue);
  }

  return result;
};

/**
 * Collects the named schemas a set of routes was designed against, ready to be handed back as the
 * `components.schemas` of an exported document - so a route seeded from `MatchView` can reference
 * `MatchView` instead of an anonymous shape inferred from one body.
 *
 * Part of the devtools contract. **Not part of the general public contract.**
 */
export const collectQueryDevtoolsSchemaComponents = (
  clientName: string,
  names: readonly string[],
): QueryDevtoolsSchemaComponents => {
  const declared = namedSchemas(clientName);
  const doc = documentOf(clientName);
  const schemas: Record<string, unknown> = {};
  const notes = new Set<string>();
  const origins = new Map<string, string>();
  const pending: RefRequest[] = names.map((label) => ({ label, pointer: null }));

  while (pending.length) {
    const request = pending.shift() as RefRequest;
    const origin = originOf(request.label, request.pointer);
    const seen = origins.get(request.label);

    if (seen !== undefined) {
      if (seen !== origin) {
        notes.add(`Two different schemas are both called ${request.label} - only the one from ${seen} was kept.`);
      }

      continue;
    }

    const schema = request.pointer === null ? declared[request.label] : resolveRef(request.pointer, doc);

    if (schema === undefined) {
      if (request.pointer !== null) {
        notes.add(`${request.pointer} could not be resolved, so ${request.label} is missing from the export.`);
      }

      continue;
    }

    origins.set(request.label, origin);
    schemas[request.label] = rewriteRefs(schema, (next) => pending.push(next));
  }

  for (const schema of Object.values(schemas)) {
    collectRemoteRefs(schema, notes);
  }

  return { schemas, notes: [...notes] };
};

/** A `$ref` to another file is left as it was written, so a document says where it stops resolving. */
const collectRemoteRefs = (value: unknown, notes: Set<string>) => {
  if (Array.isArray(value)) {
    for (const entry of value) collectRemoteRefs(entry, notes);

    return;
  }

  if (!isRecord(value)) return;

  for (const [key, entry] of Object.entries(value)) {
    if (key === '$ref' && typeof entry === 'string' && !entry.startsWith('#/')) {
      notes.add(`${entry} points outside the description - it was exported unchanged and will not resolve.`);

      continue;
    }

    collectRemoteRefs(entry, notes);
  }
};

const segmentsOf = (pattern: string) => pattern.split('/').filter(Boolean);

/** `/matches/{id}` and `/matches/:id` describe the same route; a mock's pattern is written the second way. */
const toColonPattern = (path: string) => path.replace(/\{([^}]+)\}/g, ':$1');

const isParam = (segment: string) => segment.startsWith(':');

/** Whether two patterns describe the same route, allowing their path params to be named differently. */
const patternsMatch = (a: string, b: string) => {
  const left = segmentsOf(a);
  const right = segmentsOf(b);

  if (left.length !== right.length) return false;

  return left.every((segment, index) => {
    const other = right[index] as string;

    return isParam(segment) || isParam(other) ? isParam(segment) && isParam(other) : segment === other;
  });
};

const routesOf = (doc: Record<string, unknown>): readonly QueryDevtoolsSchemaRoute[] => {
  const paths = doc['paths'];

  if (!isRecord(paths)) return [];

  const routes: QueryDevtoolsSchemaRoute[] = [];

  for (const [path, item] of Object.entries(paths)) {
    if (!isRecord(item)) continue;

    for (const method of HTTP_METHODS) {
      const operation = item[method];

      if (!isRecord(operation)) continue;

      const summary = operation['summary'] ?? operation['operationId'];

      routes.push({
        method: method.toUpperCase(),
        pattern: toColonPattern(path),
        summary: typeof summary === 'string' ? summary : '',
      });
    }
  }

  return routes;
};

const routesByKey = /* @__PURE__ */ computed(() =>
  Object.fromEntries(Object.entries(documents()).map(([key, doc]) => [key, routesOf(doc)])),
);

/**
 * Every route one client's description declares, as the designer offers them - including the ones no
 * query has ever called, which is the case a mock exists for.
 *
 * Part of the devtools contract. **Not part of the general public contract.**
 */
export const queryDevtoolsSchemaRoutes = (clientName: string): readonly QueryDevtoolsSchemaRoute[] =>
  routesByKey()[keyOf(clientName)] ?? [];

type OperationMatch = {
  operation: Record<string, unknown>;
  /** The document's own path, so a note can say which one answered. */
  path: string;
  /** Leading segments of the requested pattern the document does not have, e.g. a client's base path. */
  droppedPrefix: string;
};

const findOperation = (
  target: { method: string; pattern: string },
  doc: Record<string, unknown> | null,
): OperationMatch | null => {
  const paths = doc?.['paths'];

  if (!isRecord(paths)) return null;

  const method = target.method.toLowerCase();
  const segments = segmentsOf(target.pattern);

  // A client's base path (`/api/v2`) is part of the request but not of the document, so a pattern that
  // does not match is retried without its leading segments before giving up.
  for (let skip = 0; skip < segments.length; skip++) {
    const candidate = `/${segments.slice(skip).join('/')}`;

    for (const [path, item] of Object.entries(paths)) {
      if (!isRecord(item) || !isRecord(item[method])) continue;
      if (!patternsMatch(toColonPattern(path), candidate)) continue;

      return {
        operation: item[method] as Record<string, unknown>,
        path,
        droppedPrefix: skip ? `/${segments.slice(0, skip).join('/')}` : '',
      };
    }
  }

  return null;
};

/** The success response of an operation: the lowest 2xx the document declares, else its `default`. */
const successResponse = (operation: Record<string, unknown>) => {
  const responses = operation['responses'];

  if (!isRecord(responses)) return null;

  const status = Object.keys(responses)
    .filter((key) => /^2\d\d$/.test(key))
    .sort()[0];

  const key = status ?? (('default' in responses && 'default') || null);

  if (!key) return null;

  const response = responses[key];

  return isRecord(response) ? { response, status: key } : null;
};

/** The JSON media type of a response, tolerating `application/vnd.x+json` and Swagger 2's flat `schema`. */
const jsonSchemaOf = (response: Record<string, unknown>) => {
  const content = response['content'];

  if (!isRecord(content))
    return isRecord(response['schema']) ? { schema: response['schema'], example: undefined } : null;

  const key = Object.keys(content).find((type) => type.includes('json')) ?? Object.keys(content)[0];

  if (!key) return null;

  const media = content[key];

  if (!isRecord(media)) return null;

  return { schema: media['schema'], example: media['example'] };
};

/**
 * Generates a body for one route from the description's own success response - the seed that makes a
 * designed mock a real view model rather than a guess. `null` when the document does not declare the
 * route, or declares no JSON response for it.
 *
 * Part of the devtools contract. **Not part of the general public contract.**
 */
export const seedQueryDevtoolsSchemaRoute = (
  target: { clientName: string; method: string; pattern: string },
  style: QueryDevtoolsSeedStyle = 'placeholder',
): QueryDevtoolsSchemaSeed | null => {
  const doc = documentOf(target.clientName);
  const match = findOperation(target, doc);

  if (!match) return null;

  const success = successResponse(match.operation);

  if (!success) return null;

  const json = jsonSchemaOf(success.response);

  if (!json) return null;

  // A top-level `$ref` is resolved here rather than by the walk, so `seedFrom` always receives the
  // schema its `name` stands for - otherwise the walk reads the name as one it is already expanding and
  // cuts the whole body as a cycle.
  const ref = isRecord(json.schema) ? json.schema['$ref'] : null;
  const named = typeof ref === 'string' ? { schema: resolveRef(ref, doc), name: refLabel(ref) } : null;

  if (named && named.schema === undefined) return null;

  const seed =
    json.example === undefined
      ? seedFrom(named ? named.schema : json.schema, named ? named.name : null, style, doc)
      : {
          body: json.example,
          schemaName: null,
          types: new Map<string, string>(),
          notes: ['The document ships an example for this route - it was used as-is.'],
        };

  const notes = [...seed.notes, `Generated from ${match.path} ${target.method.toUpperCase()} ${success.status}.`];

  if (match.droppedPrefix)
    notes.push(`The document has no ${match.droppedPrefix} prefix - it was ignored when matching.`);

  return { ...seed, notes };
};
