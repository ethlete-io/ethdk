import {
  loadQueryDevtoolsSchema,
  queryDevtoolsSchemaNames,
  queryDevtoolsSchemaRoutes,
  queryDevtoolsSchemaState,
  seedQueryDevtoolsSchemaBody,
  seedQueryDevtoolsSchemaRoute,
  setQueryDevtoolsSchemaLoader,
} from './query-devtools-schema';

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

/** The loader is a promise, so every test has to let the microtask that stores the document run. */
const install = async (loader: () => unknown) => {
  setQueryDevtoolsSchemaLoader(loader);
  loadQueryDevtoolsSchema();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('query devtools schema', () => {
  afterEach(() => setQueryDevtoolsSchemaLoader(undefined));

  describe('loading', () => {
    it('should be unavailable until an application hands a loader in', () => {
      setQueryDevtoolsSchemaLoader(undefined);

      expect(queryDevtoolsSchemaState()).toEqual({ status: 'unavailable' });

      setQueryDevtoolsSchemaLoader(() => DOC);

      expect(queryDevtoolsSchemaState()).toEqual({ status: 'idle' });
    });

    it('should load the document once', async () => {
      const loader = vi.fn(() => DOC);

      await install(loader);
      loadQueryDevtoolsSchema();

      expect(queryDevtoolsSchemaState()).toEqual({ status: 'ready' });
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('should unwrap the module a dynamic import hands back', async () => {
      await install(() => ({ default: DOC }));

      expect(queryDevtoolsSchemaNames()).toContain('MatchView');
    });

    it('should report a failing loader and retry after it', async () => {
      let attempt = 0;

      await install(() => {
        attempt++;

        if (attempt === 1) throw new Error('404');

        return DOC;
      });

      expect(queryDevtoolsSchemaState()).toEqual({ status: 'error', message: '404' });

      loadQueryDevtoolsSchema();
      await Promise.resolve();
      await Promise.resolve();

      expect(queryDevtoolsSchemaState()).toEqual({ status: 'ready' });
    });

    it('should report a loader that does not return a document', async () => {
      await install(() => 'not a document');

      expect(queryDevtoolsSchemaState().status).toBe('error');
    });

    it('should list the named schemas, sorted', async () => {
      await install(() => DOC);

      expect(queryDevtoolsSchemaNames()).toEqual(['MatchId', 'MatchView', 'Score']);
    });

    it('should read named schemas out of a Swagger 2 document', async () => {
      await install(() => ({ swagger: '2.0', definitions: { Legacy: { type: 'object' } } }));

      expect(queryDevtoolsSchemaNames()).toEqual(['Legacy']);
    });
  });

  describe('seedQueryDevtoolsSchemaBody', () => {
    beforeEach(() => install(() => DOC));

    it('should generate a body from a named schema', () => {
      const seed = seedQueryDevtoolsSchemaBody('MatchView');

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
      const types = seedQueryDevtoolsSchemaBody('MatchView')?.types;

      expect(types?.get('id')).toBe('MatchId');
      expect(types?.get('score')).toBe('Score');
      expect(types?.get('startsAt')).toBe('string (date-time)');
      expect(types?.get('note')).toBe('string | null?');
      expect(types?.get('state')).toBe('"live" | "done"?');
      expect(types?.get('owner')).toBe('string | number?');
    });

    it('should mark a field the schema does not require', () => {
      const types = seedQueryDevtoolsSchemaBody('MatchView')?.types;

      expect(types?.get('title')).toBe('string?');
      expect(types?.get('tags')).toBe('string[]?');
    });

    it('should key an array element on `*`, so one entry annotates every element', () => {
      const types = seedQueryDevtoolsSchemaBody('MatchView')?.types;

      expect(types?.get('tags.*')).toBe('string');
    });

    it('should cut a schema that contains itself, and say so', () => {
      const seed = seedQueryDevtoolsSchemaBody('MatchView');

      expect(seed?.body).toMatchObject({ parent: null });
      expect(seed?.notes).toContain('MatchView contains itself - the recursion was cut at parent with null.');
    });

    it('should say which branch of a union it took', () => {
      expect(seedQueryDevtoolsSchemaBody('MatchView')?.notes).toContain(
        'owner is a oneOf - the first branch was taken.',
      );
    });

    it('should honour minItems up to a cap, with independent elements', () => {
      const seed = seedQueryDevtoolsSchemaBody('MatchView');
      const tags = (seed?.body as { tags: string[] }).tags;

      expect(tags).toHaveLength(2);
    });

    it('should return null for a schema the document does not name', () => {
      expect(seedQueryDevtoolsSchemaBody('Nope')).toBeNull();
    });
  });

  describe('seedQueryDevtoolsSchemaRoute', () => {
    beforeEach(() => install(() => DOC));

    it('should seed from the route own success response', () => {
      const seed = seedQueryDevtoolsSchemaRoute({ method: 'GET', pattern: '/api/matches/:id' });

      expect(seed?.schemaName).toBe('MatchView');
      expect(seed?.body).toMatchObject({ id: '00000000-0000-4000-8000-000000000000' });
      expect(seed?.notes).toContain('Generated from /api/matches/{matchId} GET 200.');
    });

    it('should match a route whose params are named differently', () => {
      expect(seedQueryDevtoolsSchemaRoute({ method: 'GET', pattern: '/api/matches/:whatever' })).not.toBeNull();
    });

    it('should ignore a base path the document does not have, and say so', () => {
      const seed = seedQueryDevtoolsSchemaRoute({ method: 'GET', pattern: '/v3/matches' });

      expect(Array.isArray(seed?.body)).toBe(true);
      expect(seed?.notes).toContain('The document has no /v3 prefix - it was ignored when matching.');
    });

    it('should use an example the document ships as-is', () => {
      const seed = seedQueryDevtoolsSchemaRoute({ method: 'POST', pattern: '/matches' });

      expect(seed?.body).toEqual({ ok: true });
      expect(seed?.notes).toContain('The document ships an example for this route - it was used as-is.');
    });

    it('should return null for a route the document does not declare', () => {
      expect(seedQueryDevtoolsSchemaRoute({ method: 'GET', pattern: '/nope' })).toBeNull();
      expect(seedQueryDevtoolsSchemaRoute({ method: 'DELETE', pattern: '/matches' })).toBeNull();
    });

    it('should return null for a route that declares no JSON response', () => {
      expect(seedQueryDevtoolsSchemaRoute({ method: 'GET', pattern: '/health' })).toBeNull();
    });
  });

  describe('queryDevtoolsSchemaRoutes', () => {
    it('should list every declared route with its path params as :name', async () => {
      await install(() => DOC);

      expect(queryDevtoolsSchemaRoutes()).toEqual([
        { method: 'GET', pattern: '/api/matches/:matchId', summary: 'One match' },
        { method: 'GET', pattern: '/matches', summary: 'listMatches' },
        { method: 'POST', pattern: '/matches', summary: '' },
        { method: 'GET', pattern: '/health', summary: '' },
      ]);
    });
  });
});
