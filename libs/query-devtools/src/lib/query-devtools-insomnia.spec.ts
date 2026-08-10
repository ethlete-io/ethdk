import { buildInsomniaExport, InsomniaRequestInput, InsomniaTokenRefreshInput } from './query-devtools-insomnia';

const NOW = 1_700_000_000_000;

const request = (overrides: Partial<InsomniaRequestInput> = {}): InsomniaRequestInput => ({
  name: 'GET /posts',
  method: 'GET',
  url: 'https://api.example.com/posts',
  headers: [],
  body: null,
  ...overrides,
});

const build = (requests: InsomniaRequestInput[]) => buildInsomniaExport({ name: 'test', requests, now: NOW });

const resourcesOfType = (type: string, requests: InsomniaRequestInput[]) =>
  build(requests).resources.filter((resource) => resource['_type'] === type);

describe('buildInsomniaExport', () => {
  it('should export a v4 collection with a workspace', () => {
    const result = build([request()]);

    expect(result._type).toBe('export');
    expect(result.__export_format).toBe(4);
    expect(result.__export_date).toBe(new Date(NOW).toISOString());
    expect(result.resources[0]).toMatchObject({ _type: 'workspace', name: 'test', scope: 'collection' });
  });

  it('should file requests without a group directly under the workspace', () => {
    const [exported] = resourcesOfType('request', [request()]);

    expect(exported).toMatchObject({ _type: 'request', method: 'GET', url: 'https://api.example.com/posts' });
    expect(exported?.['parentId']).toBe(build([request()]).resources[0]?.['_id']);
    expect(resourcesOfType('request_group', [request()])).toEqual([]);
  });

  it('should create one folder per group and file its requests into it', () => {
    const requests = [
      request({ group: 'api' }),
      request({ group: 'api', name: 'GET /users', url: 'https://api.example.com/users' }),
      request({ group: 'cms' }),
    ];

    const groups = resourcesOfType('request_group', requests);
    const exported = resourcesOfType('request', requests);

    expect(groups.map((group) => group['name'])).toEqual(['api', 'cms']);
    expect(exported.map((entry) => entry['parentId'])).toEqual([
      groups[0]?.['_id'],
      groups[0]?.['_id'],
      groups[1]?.['_id'],
    ]);
  });

  it('should export a JSON body with a content type header', () => {
    const [exported] = resourcesOfType('request', [request({ method: 'POST', body: { item: 'demo' } })]);

    expect(exported?.['body']).toEqual({ mimeType: 'application/json', text: '{\n  "item": "demo"\n}' });
    expect(exported?.['headers']).toEqual([{ name: 'Content-Type', value: 'application/json' }]);
  });

  it('should keep an explicit content type header instead of adding one', () => {
    const [exported] = resourcesOfType('request', [
      request({
        method: 'POST',
        body: { a: 1 },
        headers: [{ name: 'content-type', value: 'application/merge-patch+json' }],
      }),
    ]);

    expect(exported?.['headers']).toEqual([{ name: 'content-type', value: 'application/merge-patch+json' }]);
  });

  it('should not add a content type header to a request without a body', () => {
    const [exported] = resourcesOfType('request', [request()]);

    expect(exported?.['body']).toEqual({});
    expect(exported?.['headers']).toEqual([]);
  });

  it('should export a GraphQL request as a graphql body holding the document and its variables', () => {
    const [exported] = resourcesOfType('request', [
      request({
        method: 'POST',
        gqlQuery: 'query Posts { posts { id } }',
        body: { query: 'query Posts { posts { id } }', variables: { first: 10 } },
      }),
    ]);

    expect(exported?.['body']).toEqual({
      mimeType: 'graphql',
      text: JSON.stringify({ query: 'query Posts { posts { id } }', variables: { first: 10 } }, null, 2),
    });
  });

  it('should drop empty headers', () => {
    const [exported] = resourcesOfType('request', [
      request({
        headers: [
          { name: 'x-a', value: '' },
          { name: 'x-b', value: 'b' },
        ],
      }),
    ]);

    expect(exported?.['headers']).toEqual([{ name: 'x-b', value: 'b' }]);
  });

  it('should export an unserializable body as no body at all', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;

    const [exported] = resourcesOfType('request', [request({ method: 'POST', body: circular })]);

    expect(exported?.['body']).toEqual({});
  });

  describe('token refresh', () => {
    const tokenRefresh = (overrides: Partial<InsomniaTokenRefreshInput> = {}): InsomniaTokenRefreshInput => ({
      id: 'api-auth',
      name: 'POST /auth/refresh (token refresh)',
      method: 'POST',
      url: 'https://api.example.com/auth/refresh',
      headers: [],
      body: { token: 'refresh-token' },
      accessTokenPath: '$.accessToken',
      maxAgeSeconds: 600,
      ...overrides,
    });

    const buildWithRefresh = (requests: InsomniaRequestInput[], refreshes: InsomniaTokenRefreshInput[]) =>
      buildInsomniaExport({ name: 'test', requests, tokenRefreshes: refreshes, now: NOW });

    const requestsOf = (requests: InsomniaRequestInput[], refreshes: InsomniaTokenRefreshInput[]) =>
      buildWithRefresh(requests, refreshes).resources.filter((resource) => resource['_type'] === 'request');

    it('should export the refresh ahead of the requests that read from it', () => {
      const [refresh, other] = requestsOf([request()], [tokenRefresh({ group: 'api' })]);

      expect(refresh).toMatchObject({
        method: 'POST',
        url: 'https://api.example.com/auth/refresh',
        body: { mimeType: 'application/json', text: '{\n  "token": "refresh-token"\n}' },
      });
      expect(refresh?.['metaSortKey']).toBeLessThan(other?.['metaSortKey'] as number);
    });

    it('should read a secured request Authorization out of the refresh response', () => {
      const [, secured] = requestsOf([request({ secureBy: 'api-auth' })], [tokenRefresh()]);

      expect(secured?.['headers']).toEqual([
        {
          name: 'Authorization',
          value: "Bearer {% response 'body', 'req_refresh_0', '$.accessToken', 'when-expired', 600 %}",
        },
      ]);
    });

    it('should replace the resolved bearer token instead of sending both', () => {
      const [, secured] = requestsOf(
        [
          request({
            secureBy: 'api-auth',
            headers: [
              { name: 'Authorization', value: 'Bearer stale' },
              { name: 'x-tenant', value: 'demo' },
            ],
          }),
        ],
        [tokenRefresh()],
      );

      expect(secured?.['headers']).toEqual([
        {
          name: 'Authorization',
          value: "Bearer {% response 'body', 'req_refresh_0', '$.accessToken', 'when-expired', 600 %}",
        },
        { name: 'x-tenant', value: 'demo' },
      ]);
    });

    it('should chain each request to the refresh of its own auth provider', () => {
      const exported = requestsOf(
        [request({ secureBy: 'cms-auth' })],
        [tokenRefresh(), tokenRefresh({ id: 'cms-auth', accessTokenPath: '$.data.token' })],
      );

      expect(exported[2]?.['headers']).toEqual([
        {
          name: 'Authorization',
          value: "Bearer {% response 'body', 'req_refresh_1', '$.data.token', 'when-expired', 600 %}",
        },
      ]);
    });

    it('should leave a request naming an unknown refresh untouched', () => {
      const [secured] = requestsOf(
        [request({ secureBy: 'gone', headers: [{ name: 'Authorization', value: 'a' }] })],
        [],
      );

      expect(secured?.['headers']).toEqual([{ name: 'Authorization', value: 'a' }]);
    });
  });
});
