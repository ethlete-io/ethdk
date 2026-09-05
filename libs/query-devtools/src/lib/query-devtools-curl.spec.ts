import { buildCurlCommand, CurlRequestInput } from './query-devtools-curl';

const request = (overrides: Partial<CurlRequestInput> = {}): CurlRequestInput => ({
  method: 'GET',
  url: 'https://api.example.com/posts',
  headers: [],
  body: null,
  ...overrides,
});

describe('buildCurlCommand', () => {
  it('should render a bare GET without a method flag', () => {
    expect(buildCurlCommand(request())).toBe(`curl 'https://api.example.com/posts'`);
  });

  it('should spell out any other method', () => {
    const command = buildCurlCommand(request({ method: 'delete', url: 'https://api.example.com/posts/1' }));

    expect(command).toBe(`curl 'https://api.example.com/posts/1' \\\n  -X DELETE`);
  });

  it('should emit one -H per header and drop the ones with no value', () => {
    const command = buildCurlCommand(
      request({
        headers: [
          { name: 'Authorization', value: 'Bearer abc' },
          { name: 'X-Empty', value: '' },
        ],
      }),
    );

    expect(command).toContain(`-H 'Authorization: Bearer abc'`);
    expect(command).not.toContain('X-Empty');
  });

  it('should send an object body as JSON and label it', () => {
    const command = buildCurlCommand(request({ method: 'POST', body: { title: 'hi' } }));

    expect(command).toContain(`-H 'Content-Type: application/json'`);
    expect(command).toContain(`--data-raw '{"title":"hi"}'`);
  });

  it('should keep a content type the request already resolved', () => {
    const command = buildCurlCommand(
      request({
        method: 'POST',
        body: 'a=1',
        headers: [{ name: 'content-type', value: 'application/x-www-form-urlencoded' }],
      }),
    );

    expect(command).toContain(`-H 'content-type: application/x-www-form-urlencoded'`);
    expect(command).not.toContain('application/json');
    expect(command).toContain(`--data-raw 'a=1'`);
  });

  it('should send a GraphQL query as its document and variables', () => {
    const command = buildCurlCommand(
      request({ method: 'POST', gqlQuery: 'query Posts {\n  posts\n}', body: { variables: { page: 2 } } }),
    );

    expect(command).toContain(`--data-raw '{"query":"query Posts {\\n  posts\\n}","variables":{"page":2}}'`);
  });

  it('should default a GraphQL request with no variables to an empty object', () => {
    const command = buildCurlCommand(request({ method: 'POST', gqlQuery: '{ posts }', body: null }));

    expect(command).toContain(`--data-raw '{"query":"{ posts }","variables":{}}'`);
  });

  it('should escape single quotes so the command stays one shell word', () => {
    const command = buildCurlCommand(request({ method: 'POST', body: { title: `it's` } }));

    expect(command).toContain(`--data-raw '{"title":"it'\\''s"}'`);
  });

  it('should not claim application/json for a string body', () => {
    const command = buildCurlCommand(request({ method: 'POST', body: 'plain text' }));

    expect(command).not.toContain('Content-Type');
    expect(command).toContain(`--data-raw 'plain text'`);
  });

  it('should not export a FormData body as an empty JSON object', () => {
    const command = buildCurlCommand(request({ method: 'POST', body: new FormData() }));

    expect(command).not.toContain('--data-raw');
    expect(command).not.toContain('application/json');
    expect(command).toContain('FormData');
  });

  it('should skip a body it cannot serialize', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;

    const command = buildCurlCommand(request({ method: 'POST', body: circular }));

    expect(command).toBe(`curl 'https://api.example.com/posts' \\\n  -X POST`);
  });
});
