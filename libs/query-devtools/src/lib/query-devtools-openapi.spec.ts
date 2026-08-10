import {
  buildQueryDevtoolsOpenApiDocument,
  buildQueryDevtoolsOpenApiPathItem,
  inferQueryDevtoolsOpenApiSchema,
  QueryDevtoolsOpenApiMock,
} from './query-devtools-openapi';

const NOW = Date.parse('2026-08-10T09:00:00.000Z');

const mock = (patch: Partial<QueryDevtoolsOpenApiMock> = {}): QueryDevtoolsOpenApiMock => ({
  clientName: 'main',
  method: 'GET',
  pattern: '/matches/:matchId',
  query: '',
  status: 200,
  body: { id: 'a', count: 2 },
  ...patch,
});

const operationOf = (document: { paths: Record<string, Record<string, unknown>> }, path: string, method: string) =>
  document.paths[path]?.[method] as Record<string, unknown>;

const jsonOf = (operation: Record<string, unknown>, status = '200') => {
  const responses = operation['responses'] as Record<string, { content: Record<string, unknown> }>;

  return responses[status]?.content['application/json'] as Record<string, unknown>;
};

describe('inferQueryDevtoolsOpenApiSchema', () => {
  it('should infer every property the example held as required', () => {
    expect(inferQueryDevtoolsOpenApiSchema({ id: 'a', size: 2 })).toEqual({
      type: 'object',
      properties: { id: { type: 'string' }, size: { type: 'integer' } },
      required: ['id', 'size'],
    });
  });

  it('should tell an integer from a fractional number', () => {
    expect(inferQueryDevtoolsOpenApiSchema(3)).toEqual({ type: 'integer' });
    expect(inferQueryDevtoolsOpenApiSchema(3.5)).toEqual({ type: 'number' });
  });

  it('should read the formats a value can only have on purpose', () => {
    expect(inferQueryDevtoolsOpenApiSchema('2026-01-01T00:00:00.000Z')).toEqual({
      type: 'string',
      format: 'date-time',
    });
    expect(inferQueryDevtoolsOpenApiSchema('00000000-0000-4000-8000-000000000000')).toEqual({
      type: 'string',
      format: 'uuid',
    });
    expect(inferQueryDevtoolsOpenApiSchema('2026-01-01')).toEqual({ type: 'string' });
  });

  it('should constrain nothing where the example held null', () => {
    expect(inferQueryDevtoolsOpenApiSchema({ note: null })).toEqual({
      type: 'object',
      properties: { note: {} },
      required: ['note'],
    });
  });

  it('should collapse array members that agree', () => {
    expect(inferQueryDevtoolsOpenApiSchema([1, 2, 3])).toEqual({ type: 'array', items: { type: 'integer' } });
  });

  it('should offer a oneOf for array members that do not agree', () => {
    expect(inferQueryDevtoolsOpenApiSchema(['a', 1])).toEqual({
      type: 'array',
      items: { oneOf: [{ type: 'string' }, { type: 'integer' }] },
    });
  });

  it('should constrain nothing about the elements of an empty array', () => {
    expect(inferQueryDevtoolsOpenApiSchema([])).toEqual({ type: 'array', items: {} });
  });

  it('should keep an empty object an object, without claiming it has no properties', () => {
    expect(inferQueryDevtoolsOpenApiSchema({})).toEqual({ type: 'object' });
  });

  it('should give up past its depth cap rather than walk forever', () => {
    let deep: unknown = 'bottom';

    for (let level = 0; level < 20; level++) deep = { deep };

    expect(() => inferQueryDevtoolsOpenApiSchema(deep)).not.toThrow();
  });
});

describe('buildQueryDevtoolsOpenApiDocument', () => {
  it('should write a 3.1 document with the route as a brace pattern', () => {
    const { document } = buildQueryDevtoolsOpenApiDocument({ mocks: [mock()], now: NOW });

    expect(document.openapi).toBe('3.1.0');
    expect(document.info.version).toBe('2026-08-10');
    expect(Object.keys(document.paths)).toEqual(['/matches/{matchId}']);
  });

  it('should say in the document that the schemas were inferred from one example', () => {
    const { document } = buildQueryDevtoolsOpenApiDocument({ mocks: [mock()], now: NOW });

    expect(document.info.description).toContain('inferred from one example');
    expect(document.info.description).toContain('listed as required');
  });

  it('should carry the designed body as the response example', () => {
    const { document } = buildQueryDevtoolsOpenApiDocument({ mocks: [mock()], now: NOW });
    const json = jsonOf(operationOf(document, '/matches/{matchId}', 'get'));

    expect(json['example']).toEqual({ id: 'a', count: 2 });
    expect(json['schema']).toEqual({
      type: 'object',
      properties: { id: { type: 'string' }, count: { type: 'integer' } },
      required: ['id', 'count'],
    });
  });

  it('should declare the path params and tag the operation with its client', () => {
    const { document } = buildQueryDevtoolsOpenApiDocument({ mocks: [mock()], now: NOW });
    const operation = operationOf(document, '/matches/{matchId}', 'get');

    expect(operation['tags']).toEqual(['main']);
    expect(operation['operationId']).toBe('getMatches');
    expect(operation['parameters']).toEqual([
      { name: 'matchId', in: 'path', required: true, schema: { type: 'string' } },
    ]);
  });

  it('should never mark a declared query parameter required', () => {
    const { document } = buildQueryDevtoolsOpenApiDocument({ mocks: [mock({ query: 'page=2&draft=true' })], now: NOW });
    const operation = operationOf(document, '/matches/{matchId}', 'get');

    expect(operation['parameters']).toEqual([
      { name: 'matchId', in: 'path', required: true, schema: { type: 'string' } },
      { name: 'page', in: 'query', required: false, schema: { type: 'integer' }, example: '2' },
      { name: 'draft', in: 'query', required: false, schema: { type: 'boolean' }, example: 'true' },
    ]);
  });

  it('should put two methods of one route in one path item', () => {
    const { document } = buildQueryDevtoolsOpenApiDocument({
      mocks: [mock({ pattern: '/matches' }), mock({ pattern: '/matches', method: 'POST', status: 201 })],
      now: NOW,
    });

    expect(Object.keys(document.paths['/matches'] as object).sort()).toEqual(['get', 'post']);
  });

  it('should key several statuses of one route as separate responses', () => {
    const { document } = buildQueryDevtoolsOpenApiDocument({
      mocks: [mock(), mock({ status: 404, body: { error: 'gone' } })],
      now: NOW,
    });
    const responses = operationOf(document, '/matches/{matchId}', 'get')['responses'] as Record<string, unknown>;

    expect(Object.keys(responses)).toEqual(['200', '404']);
    expect((responses['404'] as { description: string }).description).toContain('A designed failure');
  });

  it('should merge two mocks sharing a status into named examples, and say which schema was taken', () => {
    const { document, notes } = buildQueryDevtoolsOpenApiDocument({
      mocks: [mock({ query: 'page=1' }), mock({ query: 'page=2', body: { id: 'b', count: 9 } })],
      now: NOW,
    });
    const json = jsonOf(operationOf(document, '/matches/{matchId}', 'get'));

    expect(json['example']).toBeUndefined();
    expect(json['examples']).toEqual({
      'page=1': { value: { id: 'a', count: 2 } },
      'page=2': { value: { id: 'b', count: 9 } },
    });
    expect(notes).toContain(
      "GET /matches/:matchId has 2 designed 200 responses - the first one's schema was exported, and all of them as examples.",
    );
  });

  it('should keep operation ids unique when two clients serve one route', () => {
    const { document } = buildQueryDevtoolsOpenApiDocument({
      mocks: [mock({ pattern: '/matches' }), mock({ pattern: '/v2/matches', clientName: 'cms' })],
      now: NOW,
    });

    expect(operationOf(document, '/matches', 'get')['operationId']).toBe('getMatches');
    expect(operationOf(document, '/v2/matches', 'get')['operationId']).toBe('getV2Matches');
  });

  it('should say a designed POST declares no request body', () => {
    const { document } = buildQueryDevtoolsOpenApiDocument({
      mocks: [mock({ method: 'POST', status: 201 })],
      now: NOW,
    });
    const operation = operationOf(document, '/matches/{matchId}', 'post');

    expect(operation['requestBody']).toBeUndefined();
    expect(operation['description']).toContain('no request body is declared');
  });

  it('should say a response was captured rather than written', () => {
    const { document } = buildQueryDevtoolsOpenApiDocument({ mocks: [mock({ capturedAt: NOW })], now: NOW });
    const responses = operationOf(document, '/matches/{matchId}', 'get')['responses'] as Record<
      string,
      { description: string }
    >;

    expect(responses['200']?.description).toContain('Captured from a real response.');
  });

  describe('a mock seeded from a named schema', () => {
    const SCHEMAS = { MatchView: { type: 'object', properties: { id: { $ref: '#/components/schemas/MatchId' } } } };

    it('should reference the declared schema instead of inferring one', () => {
      const { document } = buildQueryDevtoolsOpenApiDocument({
        mocks: [mock({ schemaName: 'MatchView' })],
        schemas: { ...SCHEMAS, MatchId: { type: 'string' } },
        now: NOW,
      });
      const json = jsonOf(operationOf(document, '/matches/{matchId}', 'get'));

      expect(json['schema']).toEqual({ $ref: '#/components/schemas/MatchView' });
      expect(json['example']).toEqual({ id: 'a', count: 2 });
    });

    it('should carry only the schemas the document references, transitively', () => {
      const { document } = buildQueryDevtoolsOpenApiDocument({
        mocks: [mock({ schemaName: 'MatchView' })],
        schemas: { ...SCHEMAS, MatchId: { type: 'string' }, Unused: { type: 'number' } },
        now: NOW,
      });

      expect(Object.keys(document.components?.schemas ?? {}).sort()).toEqual(['MatchId', 'MatchView']);
    });

    it('should infer from the body and say so when the schema is not in the export', () => {
      const { document, notes } = buildQueryDevtoolsOpenApiDocument({
        mocks: [mock({ schemaName: 'Renamed' })],
        schemas: SCHEMAS,
        now: NOW,
      });

      expect(jsonOf(operationOf(document, '/matches/{matchId}', 'get'))['schema']).toMatchObject({ type: 'object' });
      expect(notes).toContain(
        'GET /matches/:matchId was seeded from Renamed, which is not in this export - its schema was inferred from the body instead.',
      );
      expect(document.components).toBeUndefined();
    });
  });
});

describe('buildQueryDevtoolsOpenApiPathItem', () => {
  it('should write one keyed paths entry, ready to paste under an existing paths', () => {
    const { document } = buildQueryDevtoolsOpenApiPathItem({ mocks: [mock()] });

    expect(Object.keys(document)).toEqual(['/matches/{matchId}']);
    expect(Object.keys(document['/matches/{matchId}'] as object)).toEqual(['get']);
  });

  it('should keep a $ref and say the fragment has to be merged where it resolves', () => {
    const { document, notes } = buildQueryDevtoolsOpenApiPathItem({
      mocks: [mock({ schemaName: 'MatchView' })],
      schemas: { MatchView: { type: 'object' } },
    });
    const operation = (document['/matches/{matchId}'] as Record<string, Record<string, unknown>>)['get'] as Record<
      string,
      unknown
    >;

    expect(jsonOf(operation)['schema']).toEqual({ $ref: '#/components/schemas/MatchView' });
    expect(notes).toContain('This fragment references MatchView - paste it into the description that declares it.');
  });
});
