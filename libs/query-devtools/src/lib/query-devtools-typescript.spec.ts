import { buildQueryDefinitionSnippet, inferTypeScriptType } from './query-devtools-typescript';

describe('inferTypeScriptType', () => {
  it('should infer the primitives a JSON body can hold', () => {
    expect(inferTypeScriptType('a')).toBe('string');
    expect(inferTypeScriptType(1)).toBe('number');
    expect(inferTypeScriptType(true)).toBe('boolean');
    expect(inferTypeScriptType(null)).toBe('null');
  });

  it('should unify an array into one member type, and union a mixed one', () => {
    expect(inferTypeScriptType([1, 2])).toBe('number[]');
    expect(inferTypeScriptType([1, 'a'])).toBe('(number | string)[]');
    expect(inferTypeScriptType([])).toBe('unknown[]');
  });

  it('should write an object as a type literal, quoting keys that need it', () => {
    expect(inferTypeScriptType({ id: 1, 'content-type': 'json' })).toBe(
      ['{', '  id: number;', '  "content-type": string;', '}'].join('\n'),
    );
  });

  it('should describe an object with no keys rather than emitting an empty literal', () => {
    expect(inferTypeScriptType({})).toBe('Record<string, unknown>');
  });

  it('should give up past the depth a pasted type is worth', () => {
    let nested: unknown = 'deep';
    for (let i = 0; i < 12; i++) nested = { nested };

    expect(inferTypeScriptType(nested)).toContain('unknown');
  });
});

describe('buildQueryDefinitionSnippet', () => {
  it('should build a definition for a static route', () => {
    const snippet = buildQueryDefinitionSnippet({
      method: 'GET',
      pattern: '/posts',
      query: '',
      body: [{ id: 1, title: 'a' }],
    });

    expect(snippet).toContain('type GetPostsResponse = {');
    expect(snippet).toContain('  id: number;');
    expect(snippet).toContain('}[];');
    expect(snippet).toContain('type GetPostsQueryArgs = {');
    expect(snippet).toContain('  response: GetPostsResponse;');
    expect(snippet).toContain("export const getPosts = getQuery<GetPostsQueryArgs>('/posts');");
  });

  it('should turn path params into a function route and a pathParams contract', () => {
    const snippet = buildQueryDefinitionSnippet({
      method: 'GET',
      pattern: '/posts/:id/comments',
      query: '',
      body: { items: [] },
    });

    expect(snippet).toContain('  pathParams: { id: string };');
    expect(snippet).toContain('export const getPostsComments = getQuery<GetPostsCommentsQueryArgs>');
    expect(snippet).toContain('(p) => `/posts/${p.id}/comments`');
  });

  it('should type declared query parameters by what the example holds', () => {
    const snippet = buildQueryDefinitionSnippet({
      method: 'GET',
      pattern: '/posts',
      query: 'page=2&search=cup&draft=true',
      body: {},
    });

    expect(snippet).toContain('  queryParams: { page: number; search: string; draft: boolean };');
  });

  it('should quote and dedupe query-param keys', () => {
    const snippet = buildQueryDefinitionSnippet({
      method: 'GET',
      pattern: '/posts',
      query: 'tag=a&tag=b&filter[status]=x&order-by=name',
      body: {},
    });

    expect(snippet).toContain("  queryParams: { tag: string; 'filter[status]': string; 'order-by': string };");
  });

  it('should quote a path param a type literal cannot spell bare', () => {
    const snippet = buildQueryDefinitionSnippet({
      method: 'GET',
      pattern: '/posts/:post-id',
      query: '',
      body: {},
    });

    expect(snippet).toContain("  pathParams: { 'post-id': string };");
  });

  it('should name the factory of the method it is for', () => {
    const snippet = buildQueryDefinitionSnippet({ method: 'POST', pattern: '/posts', query: '', body: { id: 1 } });

    expect(snippet).toContain('`postQuery` is `createPostQuery(client)`');
    expect(snippet).toContain('export const postPosts = postQuery<PostPostsQueryArgs>');
  });

  it('should say the types came from one example', () => {
    const snippet = buildQueryDefinitionSnippet({ method: 'GET', pattern: '/posts', query: '', body: {} });

    expect(snippet).toContain('required and non-nullable');
  });
});
