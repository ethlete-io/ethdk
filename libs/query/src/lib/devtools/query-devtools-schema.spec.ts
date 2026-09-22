import {
  collectQueryDevtoolsSchemaComponents,
  loadQueryDevtoolsSchema,
  queryDevtoolsSchemaNames,
  queryDevtoolsSchemaRoutes,
  queryDevtoolsSchemaState,
  seedQueryDevtoolsSchemaBody,
  seedQueryDevtoolsSchemaRoute,
  setQueryDevtoolsSchemaLoader,
} from './query-devtools-schema';

/** Which client is asking. A single loader answers for every one of them, so any name reads the same. */
const CLIENT = 'apiClient';

const DOC = {
  openapi: '3.1.0',
  paths: {
    '/api/matches/{matchId}': {
      get: {
        summary: 'One match',
        responses: {
          '404': { description: 'gone' },
          '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/MatchView' } } } },
        },
      },
    },
    '/matches': {
      get: {
        operationId: 'listMatches',
        responses: {
          '200': {
            content: {
              'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/MatchView' } } },
            },
          },
        },
      },
      post: { responses: { '201': { content: { 'application/json': { example: { ok: true } } } } } },
    },
    '/health': { get: { responses: { '204': { description: 'no body' } } } },
  },
  components: {
    schemas: {
      MatchId: { type: 'string', format: 'uuid' },
      Score: { type: 'integer', minimum: 3 },
      MatchView: {
        type: 'object',
        required: ['id', 'startsAt', 'score'],
        properties: {
          id: { $ref: '#/components/schemas/MatchId' },
          startsAt: { type: 'string', format: 'date-time' },
          title: { type: 'string' },
          score: { $ref: '#/components/schemas/Score' },
          isLive: { type: 'boolean' },
          state: { enum: ['live', 'done'] },
          tags: { type: 'array', items: { type: 'string' }, minItems: 2 },
          parent: { $ref: '#/components/schemas/MatchView' },
          owner: { oneOf: [{ type: 'string' }, { type: 'number' }] },
          note: { type: ['string', 'null'] },
        },
      },
    },
  },
};

const BOUNDED_DOC = {
  components: {
    schemas: {
      Limits: {
        type: 'object',
        properties: {
          ratio: { type: 'number', minimum: 0, maximum: 5 },
          code: { type: 'string', maxLength: 4 },
          slug: { type: 'string', minLength: 20 },
          tags: { type: 'array', items: { type: 'string' }, maxItems: 1 },
        },
      },
    },
  },
};

/** The loader is a promise, so every test has to let the microtask that stores the document run. */
const install = async (loader: () => unknown) => {
  setQueryDevtoolsSchemaLoader(loader);
  loadQueryDevtoolsSchema(CLIENT);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('query devtools schema', () => {
  afterEach(() => setQueryDevtoolsSchemaLoader(undefined));

  describe('loading', () => {
    it('should be unavailable until an application hands a loader in', () => {
      setQueryDevtoolsSchemaLoader(undefined);

      expect(queryDevtoolsSchemaState(CLIENT)).toEqual({ status: 'unavailable' });

      setQueryDevtoolsSchemaLoader(() => DOC);

      expect(queryDevtoolsSchemaState(CLIENT)).toEqual({ status: 'idle' });
    });

    it('should load the document once', async () => {
      const loader = vi.fn(() => DOC);

      await install(loader);
      loadQueryDevtoolsSchema(CLIENT);

      expect(queryDevtoolsSchemaState(CLIENT)).toEqual({ status: 'ready' });
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('should unwrap the module a dynamic import hands back', async () => {
      await install(() => ({ default: DOC }));

      expect(queryDevtoolsSchemaNames(CLIENT)).toContain('MatchView');
    });

    it('should report a failing loader and retry after it', async () => {
      let attempt = 0;

      await install(() => {
        attempt++;

        if (attempt === 1) throw new Error('404');

        return DOC;
      });

      expect(queryDevtoolsSchemaState(CLIENT)).toEqual({ status: 'error', message: '404' });

      loadQueryDevtoolsSchema(CLIENT);
      await Promise.resolve();
      await Promise.resolve();

      expect(queryDevtoolsSchemaState(CLIENT)).toEqual({ status: 'ready' });
    });

    it('should report a loader that does not return a document', async () => {
      await install(() => 'not a document');

      expect(queryDevtoolsSchemaState(CLIENT).status).toBe('error');
    });

    it('should list the named schemas, sorted', async () => {
      await install(() => DOC);

      expect(queryDevtoolsSchemaNames(CLIENT)).toEqual(['MatchId', 'MatchView', 'Score']);
    });

    it('should read named schemas out of a Swagger 2 document', async () => {
      await install(() => ({ swagger: '2.0', definitions: { Legacy: { type: 'object' } } }));

      expect(queryDevtoolsSchemaNames(CLIENT)).toEqual(['Legacy']);
    });
  });

  describe('one description per client', () => {
    const OTHER_DOC = { components: { schemas: { Ticket: { type: 'object' } } } };

    const installBoth = async () => {
      setQueryDevtoolsSchemaLoader({ hubClient: () => DOC, shopClient: () => OTHER_DOC });
      loadQueryDevtoolsSchema('hubClient');
      loadQueryDevtoolsSchema('shopClient');
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    };

    it('should answer each client from its own document', async () => {
      await installBoth();

      expect(queryDevtoolsSchemaNames('hubClient')).toEqual(['MatchId', 'MatchView', 'Score']);
      expect(queryDevtoolsSchemaNames('shopClient')).toEqual(['Ticket']);
      expect(seedQueryDevtoolsSchemaBody('shopClient', 'MatchView')).toBeNull();
    });

    it('should offer a client no routes but its own', async () => {
      await installBoth();

      expect(queryDevtoolsSchemaRoutes('hubClient').length).toBeGreaterThan(0);
      expect(queryDevtoolsSchemaRoutes('shopClient')).toEqual([]);
      expect(seedQueryDevtoolsSchemaRoute({ clientName: 'shopClient', method: 'GET', pattern: '/matches' })).toBeNull();
    });

    it('should leave a client the application declared nothing for unavailable', async () => {
      await installBoth();

      expect(queryDevtoolsSchemaState('otherClient')).toEqual({ status: 'unavailable' });
      expect(queryDevtoolsSchemaNames('otherClient')).toEqual([]);
    });

    it('should load one client description without loading the other', async () => {
      const hub = vi.fn(() => DOC);
      const shop = vi.fn(() => OTHER_DOC);

      setQueryDevtoolsSchemaLoader({ hubClient: hub, shopClient: shop });
      loadQueryDevtoolsSchema('hubClient');
      await Promise.resolve();
      await Promise.resolve();

      expect(hub).toHaveBeenCalledTimes(1);
      expect(shop).not.toHaveBeenCalled();
      expect(queryDevtoolsSchemaState('shopClient')).toEqual({ status: 'idle' });
    });

    it('should let one loader answer for every client', async () => {
      await install(() => DOC);

      expect(queryDevtoolsSchemaNames('anyClient')).toContain('MatchView');
      expect(queryDevtoolsSchemaNames('someOtherClient')).toContain('MatchView');
    });
  });

  describe('seedQueryDevtoolsSchemaBody', () => {
    beforeEach(() => install(() => DOC));

    it('should generate a body from a named schema', () => {
      const seed = seedQueryDevtoolsSchemaBody(CLIENT, 'MatchView');

      expect(seed?.body).toEqual({
        id: '00000000-0000-4000-8000-000000000000',
        startsAt: '2026-01-01T00:00:00.000Z',
        title: 'title',
        score: 3,
        isLive: false,
        state: 'live',
        tags: ['tags', 'tags'],
        parent: null,
        owner: 'owner',
        note: 'note',
      });
      expect(seed?.schemaName).toBe('MatchView');
    });

    it('should annotate every field with the type it is declared as', () => {
      const types = seedQueryDevtoolsSchemaBody(CLIENT, 'MatchView')?.types;

      expect(types?.get('id')).toBe('MatchId');
      expect(types?.get('score')).toBe('Score');
      expect(types?.get('startsAt')).toBe('string (date-time)');
      expect(types?.get('note')).toBe('string | null?');
      expect(types?.get('state')).toBe('"live" | "done"?');
      expect(types?.get('owner')).toBe('string | number?');
    });

    it('should mark a field the schema does not require', () => {
      const types = seedQueryDevtoolsSchemaBody(CLIENT, 'MatchView')?.types;

      expect(types?.get('title')).toBe('string?');
      expect(types?.get('tags')).toBe('string[]?');
    });

    it('should key an array element on `*`, so one entry annotates every element', () => {
      const types = seedQueryDevtoolsSchemaBody(CLIENT, 'MatchView')?.types;

      expect(types?.get('tags.*')).toBe('string');
    });

    it('should cut a schema that contains itself, and say so', () => {
      const seed = seedQueryDevtoolsSchemaBody(CLIENT, 'MatchView');

      expect(seed?.body).toMatchObject({ parent: null });
      expect(seed?.notes).toContain('MatchView contains itself - the recursion was cut at parent with null.');
    });

    it('should say which branch of a union it took', () => {
      expect(seedQueryDevtoolsSchemaBody(CLIENT, 'MatchView')?.notes).toContain(
        'owner is a oneOf - the first branch was taken.',
      );
    });

    it('should honour minItems up to a cap, with independent elements', () => {
      const seed = seedQueryDevtoolsSchemaBody(CLIENT, 'MatchView');
      const tags = (seed?.body as { tags: string[] }).tags;

      expect(tags).toHaveLength(2);
    });

    it('should return null for a schema the document does not name', () => {
      expect(seedQueryDevtoolsSchemaBody(CLIENT, 'Nope')).toBeNull();
    });
  });

  describe('seed styles', () => {
    beforeEach(() => install(() => DOC));
    afterEach(() => vi.restoreAllMocks());

    it('should fill an unformatted string with a sample value, and leave a declared format alone', () => {
      const body = seedQueryDevtoolsSchemaBody(CLIENT, 'MatchView', 'realistic')?.body as Record<string, string>;

      expect(body['title']).not.toBe('title');
      expect(body['title']!.length).toBeLessThanOrEqual(10);
      expect(body['id']).toBe('00000000-0000-4000-8000-000000000000');
      expect(body['startsAt']).toBe('2026-01-01T00:00:00.000Z');
    });

    it('should stress a body with the values a layout breaks on', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);

      const body = seedQueryDevtoolsSchemaBody(CLIENT, 'MatchView', 'stress')?.body as { title: string; score: number };

      expect(body.title).toHaveLength(80);
      expect(body.score).toBe(1_000_000_000);
    });

    it('should generate each array element on its own', () => {
      const samples = [0.1, 0.9, 0.2, 0.8, 0.3, 0.7];
      let call = 0;

      vi.spyOn(Math, 'random').mockImplementation(() => samples[call++ % samples.length] as number);

      const tags = (seedQueryDevtoolsSchemaBody(CLIENT, 'MatchView', 'realistic')?.body as { tags: string[] }).tags;

      expect(tags).toHaveLength(2);
      expect(tags[0]).not.toBe(tags[1]);
    });

    it('should fill an array the description does not size with more than one element', () => {
      expect(
        seedQueryDevtoolsSchemaRoute({ clientName: CLIENT, method: 'GET', pattern: '/matches' }, 'realistic')?.body,
      ).toHaveLength(3);
    });

    it('should seed the same shape whatever the style is', () => {
      const placeholder = seedQueryDevtoolsSchemaBody(CLIENT, 'MatchView')?.body as Record<string, unknown>;
      const stressed = seedQueryDevtoolsSchemaBody(CLIENT, 'MatchView', 'stress')?.body as Record<string, unknown>;

      expect(Object.keys(stressed)).toEqual(Object.keys(placeholder));
    });
  });

  describe('seed styles against declared bounds', () => {
    beforeEach(() => install(() => BOUNDED_DOC));

    it('should keep a generated value inside the bounds the description declares', () => {
      const body = seedQueryDevtoolsSchemaBody(CLIENT, 'Limits', 'stress')?.body as {
        ratio: number;
        code: string;
        tags: string[];
      };

      expect(body.ratio).toBeGreaterThanOrEqual(0);
      expect(body.ratio).toBeLessThanOrEqual(5);
      expect(body.code.length).toBeLessThanOrEqual(4);
      expect(body.tags).toHaveLength(1);
    });

    it('should reach the length a string has to have', () => {
      const body = seedQueryDevtoolsSchemaBody(CLIENT, 'Limits', 'realistic')?.body as { slug: string };

      expect(body.slug.length).toBeGreaterThanOrEqual(20);
    });
  });

  describe('seedQueryDevtoolsSchemaRoute', () => {
    beforeEach(() => install(() => DOC));

    it('should seed from the route own success response', () => {
      const seed = seedQueryDevtoolsSchemaRoute({ clientName: CLIENT, method: 'GET', pattern: '/api/matches/:id' });

      expect(seed?.schemaName).toBe('MatchView');
      expect(seed?.body).toMatchObject({ id: '00000000-0000-4000-8000-000000000000' });
      expect(seed?.notes).toContain('Generated from /api/matches/{matchId} GET 200.');
    });

    it('should match a route whose params are named differently', () => {
      expect(
        seedQueryDevtoolsSchemaRoute({ clientName: CLIENT, method: 'GET', pattern: '/api/matches/:whatever' }),
      ).not.toBeNull();
    });

    it('should ignore a base path the document does not have, and say so', () => {
      const seed = seedQueryDevtoolsSchemaRoute({ clientName: CLIENT, method: 'GET', pattern: '/v3/matches' });

      expect(Array.isArray(seed?.body)).toBe(true);
      expect(seed?.notes).toContain('The document has no /v3 prefix - it was ignored when matching.');
    });

    it('should use an example the document ships as-is', () => {
      const seed = seedQueryDevtoolsSchemaRoute({ clientName: CLIENT, method: 'POST', pattern: '/matches' });

      expect(seed?.body).toEqual({ ok: true });
      expect(seed?.notes).toContain('The document ships an example for this route - it was used as-is.');
    });

    it('should return null for a route the document does not declare', () => {
      expect(seedQueryDevtoolsSchemaRoute({ clientName: CLIENT, method: 'GET', pattern: '/nope' })).toBeNull();
      expect(seedQueryDevtoolsSchemaRoute({ clientName: CLIENT, method: 'DELETE', pattern: '/matches' })).toBeNull();
    });

    it('should return null for a route that declares no JSON response', () => {
      expect(seedQueryDevtoolsSchemaRoute({ clientName: CLIENT, method: 'GET', pattern: '/health' })).toBeNull();
    });
  });

  describe('collectQueryDevtoolsSchemaComponents', () => {
    beforeEach(() => install(() => DOC));

    it('should bring along everything a named schema transitively refs', () => {
      const { schemas } = collectQueryDevtoolsSchemaComponents(CLIENT, ['MatchView']);

      expect(Object.keys(schemas).sort()).toEqual(['MatchId', 'MatchView', 'Score']);
      expect(schemas['MatchId']).toEqual({ type: 'string', format: 'uuid' });
    });

    it('should leave a schema that refs itself resolvable', () => {
      const { schemas } = collectQueryDevtoolsSchemaComponents(CLIENT, ['MatchView']);

      expect((schemas['MatchView'] as { properties: { parent: unknown } }).properties.parent).toEqual({
        $ref: '#/components/schemas/MatchView',
      });
    });

    it('should skip a name the description does not declare', () => {
      const { schemas, notes } = collectQueryDevtoolsSchemaComponents(CLIENT, ['Nope']);

      expect(schemas).toEqual({});
      expect(notes).toEqual([]);
    });

    it('should point a Swagger 2 definition ref at components.schemas', async () => {
      await install(() => ({
        swagger: '2.0',
        definitions: {
          Wrapper: { type: 'object', properties: { inner: { $ref: '#/definitions/Inner' } } },
          Inner: { type: 'string' },
        },
      }));

      const { schemas } = collectQueryDevtoolsSchemaComponents(CLIENT, ['Wrapper']);

      expect(schemas['Wrapper']).toEqual({
        type: 'object',
        properties: { inner: { $ref: '#/components/schemas/Inner' } },
      });
      expect(schemas['Inner']).toEqual({ type: 'string' });
    });

    it('should report a ref it cannot resolve', async () => {
      await install(() => ({ components: { schemas: { Broken: { $ref: '#/components/schemas/Gone' } } } }));

      const { schemas, notes } = collectQueryDevtoolsSchemaComponents(CLIENT, ['Broken']);

      expect(schemas['Gone']).toBeUndefined();
      expect(notes).toEqual(['#/components/schemas/Gone could not be resolved, so Gone is missing from the export.']);
    });

    it('should export a remote ref unchanged and say it will not resolve', async () => {
      await install(() => ({
        components: { schemas: { Remote: { $ref: 'https://example.com/common.json#/Thing' } } },
      }));

      const { schemas, notes } = collectQueryDevtoolsSchemaComponents(CLIENT, ['Remote']);

      expect(schemas['Remote']).toEqual({ $ref: 'https://example.com/common.json#/Thing' });
      expect(notes).toEqual([
        'https://example.com/common.json#/Thing points outside the description - it was exported unchanged and will not resolve.',
      ]);
    });

    it('should keep the first of two schemas that share a name, and say so', async () => {
      await install(() => ({
        components: { schemas: { Holder: { $ref: '#/definitions/Thing' }, Thing: { type: 'string' } } },
        definitions: { Thing: { type: 'number' } },
      }));

      const { schemas, notes } = collectQueryDevtoolsSchemaComponents(CLIENT, ['Thing', 'Holder']);

      expect(schemas['Thing']).toEqual({ type: 'string' });
      expect(notes).toEqual(['Two different schemas are both called Thing - only the one from named:Thing was kept.']);
    });
  });

  describe('queryDevtoolsSchemaRoutes', () => {
    it('should list every declared route with its path params as :name', async () => {
      await install(() => DOC);

      expect(queryDevtoolsSchemaRoutes(CLIENT)).toEqual([
        { method: 'GET', pattern: '/api/matches/:matchId', summary: 'One match' },
        { method: 'GET', pattern: '/matches', summary: 'listMatches' },
        { method: 'POST', pattern: '/matches', summary: '' },
        { method: 'GET', pattern: '/health', summary: '' },
      ]);
    });
  });

  describe('before the description has loaded', () => {
    it('should seed, name and route nothing', () => {
      setQueryDevtoolsSchemaLoader(() => DOC);

      expect(seedQueryDevtoolsSchemaBody(CLIENT, 'MatchView')).toBeNull();
      expect(seedQueryDevtoolsSchemaRoute({ clientName: CLIENT, method: 'GET', pattern: '/matches' })).toBeNull();
      expect(queryDevtoolsSchemaNames(CLIENT)).toEqual([]);
      expect(queryDevtoolsSchemaRoutes(CLIENT)).toEqual([]);
    });

    it('should report a loader that rejects with something other than an Error', async () => {
      await install(() => Promise.reject('offline'));
      await Promise.resolve();
      await Promise.resolve();

      expect(queryDevtoolsSchemaState(CLIENT)).toEqual({ status: 'error', message: 'offline' });
    });

    it('should keep an object without a default export as the document itself', async () => {
      await install(() => ({ title: 'A bare JSON Schema' }));

      expect(queryDevtoolsSchemaState(CLIENT)).toEqual({ status: 'ready' });
      expect(queryDevtoolsSchemaNames(CLIENT)).toEqual([]);
    });

    it('should read named schemas out of $defs', async () => {
      await install(() => ({ $defs: { Thing: { type: 'string' } } }));

      expect(queryDevtoolsSchemaNames(CLIENT)).toEqual(['Thing']);
    });
  });

  describe('seeding every kind of schema', () => {
    const nestArrays = (levels: number): unknown =>
      levels ? { type: 'array', items: nestArrays(levels - 1) } : { type: 'string' };

    const SHAPES_DOC = {
      openapi: '3.1.0',
      components: {
        schemas: {
          Base: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
          Shapes: {
            type: 'object',
            properties: {
              count: { type: 'integer' },
              label: { type: 'string', title: 'Display label' },
              fixed: { const: 'v1' },
              sample: { type: 'string', example: 'ex' },
              fallback: { type: 'integer', default: 7 },
              listed: { type: 'string', examples: ['first', 'second'] },
              nothing: { type: 'null' },
              flag: { type: 'boolean' },
              loose: { properties: { a: { type: 'string' } } },
              untyped: {},
              unknownType: { type: 'file' },
              map: { type: 'object', additionalProperties: { type: 'string' } },
              bare: { type: 'object' },
              itemless: { type: 'array' },
              composed: {
                allOf: [
                  { $ref: '#/components/schemas/Base' },
                  { type: 'object', properties: { extra: { type: 'string' } } },
                ],
              },
              mixed: { allOf: [{ type: 'string' }, { type: 'object', properties: {} }] },
              remote: { $ref: 'https://example.com/common.json#/Thing' },
              dangling: { $ref: '#/openapi/version' },
              anything: true,
            },
          },
          Labels: {
            type: 'object',
            properties: {
              pick: { oneOf: [{ type: 'string' }, { type: 'integer' }, { type: 'boolean' }, { type: 'null' }] },
              level: { enum: ['a', 'b', 'c', 'd'] },
              composedNamed: { allOf: [{ type: 'object' }, { $ref: '#/components/schemas/Base' }] },
              composedAnon: { allOf: [{ type: 'string', format: 'email' }] },
              nullableCount: { type: 'integer', nullable: true },
              untyped: {},
              deep: nestArrays(6),
            },
          },
          Deep: nestArrays(14),
          RootUntyped: {},
          RootString: { type: 'string' },
          Bounds: {
            type: 'object',
            properties: {
              above: { type: 'integer', exclusiveMinimum: 0 },
              below: { type: 'integer', exclusiveMaximum: 10 },
              signed: { type: 'integer', minimum: -5 },
            },
          },
        },
      },
    };

    beforeEach(() => install(() => SHAPES_DOC));
    afterEach(() => vi.restoreAllMocks());

    it('should take what the schema declares before generating anything', () => {
      expect(seedQueryDevtoolsSchemaBody(CLIENT, 'Shapes')?.body).toMatchObject({
        count: 0,
        label: 'Display label',
        fixed: 'v1',
        sample: 'ex',
        fallback: 7,
        listed: 'first',
        nothing: null,
        flag: false,
      });
    });

    it('should generate an object for properties without a declared type', () => {
      expect(seedQueryDevtoolsSchemaBody(CLIENT, 'Shapes')?.body).toMatchObject({ loose: { a: 'a' } });
    });

    it('should merge the members of an allOf into one object', () => {
      expect(seedQueryDevtoolsSchemaBody(CLIENT, 'Shapes')?.body).toMatchObject({
        composed: { id: 'id', extra: 'extra' },
      });
    });

    it('should take the first non-object member of an allOf that does not compose to an object', () => {
      expect(seedQueryDevtoolsSchemaBody(CLIENT, 'Shapes')?.body).toMatchObject({ mixed: 'mixed' });
    });

    it('should generate empty containers for a map and an array without items, and note the map', () => {
      const seed = seedQueryDevtoolsSchemaBody(CLIENT, 'Shapes');

      expect(seed?.body).toMatchObject({ map: {}, bare: {}, itemless: [] });
      expect(seed?.notes).toContain('map is a free-form map - generated as an empty object.');
      expect(seed?.notes.some((note) => note.startsWith('bare '))).toBe(false);
    });

    it('should generate null for what it cannot type or resolve, and say why', () => {
      const seed = seedQueryDevtoolsSchemaBody(CLIENT, 'Shapes');

      expect(seed?.body).toMatchObject({
        untyped: null,
        unknownType: null,
        remote: null,
        dangling: null,
        anything: null,
      });
      expect(seed?.notes).toEqual(
        expect.arrayContaining([
          'untyped declares no type - generated as null.',
          'unknownType declares no type - generated as null.',
          'https://example.com/common.json#/Thing could not be resolved - generated as null at remote.',
          '#/openapi/version could not be resolved - generated as null at dangling.',
        ]),
      );
      expect(seed?.types.get('anything')).toBe('unknown?');
    });

    it('should name the root in a note about the root', () => {
      const seed = seedQueryDevtoolsSchemaBody(CLIENT, 'RootUntyped');

      expect(seed?.body).toBeNull();
      expect(seed?.notes).toEqual(['the root declares no type - generated as null.']);
    });

    it('should fall back to a generic placeholder for a string with no key or title', () => {
      expect(seedQueryDevtoolsSchemaBody(CLIENT, 'RootString')?.body).toBe('string');
    });

    it('should cut a schema nested past the depth limit', () => {
      const seed = seedQueryDevtoolsSchemaBody(CLIENT, 'Deep');

      expect(seed?.notes.some((note) => note.endsWith('is nested deeper than 12 levels - generated as null.'))).toBe(
        true,
      );
    });

    it('should label unions, enums, compositions and nullables in the field types', () => {
      const types = seedQueryDevtoolsSchemaBody(CLIENT, 'Labels')?.types;

      expect(types?.get('pick')).toBe('string | integer | boolean | …?');
      expect(types?.get('level')).toBe('"a" | "b" | "c" | …?');
      expect(types?.get('composedNamed')).toBe('Base?');
      expect(types?.get('composedAnon')).toBe('string (email)?');
      expect(types?.get('nullableCount')).toBe('integer | null?');
      expect(types?.get('untyped')).toBe('unknown?');
      expect(types?.get('deep')).toBe('unknown[][][][][]?');
    });

    it('should start a placeholder at an exclusive minimum', () => {
      expect(seedQueryDevtoolsSchemaBody(CLIENT, 'Bounds')?.body).toMatchObject({ above: 1, below: 0, signed: -5 });
    });

    it('should clamp a stressed number to an exclusive maximum', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);

      expect(seedQueryDevtoolsSchemaBody(CLIENT, 'Bounds', 'stress')?.body).toMatchObject({ below: 9 });
    });

    it('should stress a signed number with a negative value inside its minimum', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.4);

      const body = seedQueryDevtoolsSchemaBody(CLIENT, 'Bounds', 'stress')?.body as { below: number; signed: number };

      expect(body.signed).toBe(-5);
      expect(body.below).toBeLessThan(0);
    });
  });

  describe('seeding a route from an unusual response', () => {
    const ROUTES_DOC = {
      paths: {
        '/broken': 'not an operation map',
        '/no-responses': { get: {} },
        '/fallback': {
          get: { responses: { default: { content: { 'application/json': { schema: { type: 'string' } } } } } },
        },
        '/only-errors': { get: { responses: { '404': { description: 'gone' } } } },
        '/not-a-response': { get: { responses: { '200': 'ok' } } },
        '/swagger': { get: { responses: { '200': { schema: { type: 'integer' } } } } },
        '/any-media': { get: { responses: { '200': { content: { '*/*': { schema: { type: 'boolean' } } } } } } },
        '/empty-content': { get: { responses: { '200': { content: {} } } } },
        '/bad-media': { get: { responses: { '200': { content: { 'application/json': 'nope' } } } } },
        '/dangling': {
          get: {
            responses: {
              '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Gone' } } } },
            },
          },
        },
      },
    };

    const seedGet = (pattern: string) => seedQueryDevtoolsSchemaRoute({ clientName: CLIENT, method: 'GET', pattern });

    beforeEach(() => install(() => ROUTES_DOC));

    it('should skip a path that declares no operations', () => {
      expect(queryDevtoolsSchemaRoutes(CLIENT).map((route) => route.pattern)).not.toContain('/broken');
      expect(seedGet('/broken')).toBeNull();
    });

    it('should seed from the default response when no 2xx is declared', () => {
      const seed = seedGet('/fallback');

      expect(seed?.body).toBe('string');
      expect(seed?.notes).toContain('Generated from /fallback GET default.');
    });

    it('should read the flat schema of a Swagger 2 response', () => {
      expect(seedGet('/swagger')?.body).toBe(0);
    });

    it('should fall back to the only media type a response declares', () => {
      expect(seedGet('/any-media')?.body).toBe(false);
    });

    it('should return null for a route without a usable success response', () => {
      for (const pattern of ['/no-responses', '/only-errors', '/not-a-response', '/empty-content', '/bad-media']) {
        expect(seedGet(pattern)).toBeNull();
      }
    });

    it('should return null for a route whose response refs a schema the document lacks', () => {
      expect(seedGet('/dangling')).toBeNull();
    });
  });
});
