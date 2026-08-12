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
      expect(body['title'].length).toBeLessThanOrEqual(10);
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
});
