import { buildQueryString, buildRoute, decryptBearer } from './request-route';

describe('request route utilities', () => {
  afterEach(() => vi.restoreAllMocks());

  it('advances indexes for arrays of objects', () => {
    expect(buildQueryString({ foo: [{ a: 1 }, { a: 2 }] }, { writeArrayIndexes: true })).toBe(
      'foo%5B0%5D%5Ba%5D=1&foo%5B1%5D%5Ba%5D=2',
    );
  });

  it('does not log an invalid bearer token', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(decryptBearer('secret.invalid-payload.signature')).toBeNull();
    expect(error).toHaveBeenCalledWith('Invalid bearer token', expect.anything());
    expect(JSON.stringify(error.mock.calls)).not.toContain('secret.invalid-payload.signature');
  });

  it('writes arrays with empty brackets and skips their null, undefined, NaN and blank entries', () => {
    expect(buildQueryString({ ids: [1, null, undefined, Number.NaN, ' ', 2] })).toBe('ids%5B%5D=1&ids%5B%5D=2');
  });

  it('keeps indexes contiguous when array entries are skipped', () => {
    expect(buildQueryString({ ids: [null, 'a', null, 'b'] }, { writeArrayIndexes: true })).toBe(
      'ids%5B0%5D=a&ids%5B1%5D=b',
    );
  });

  it('keeps false and zero, which are values, not gaps', () => {
    expect(buildQueryString({ a: false, b: 0 })).toBe('a=false&b=0');
  });

  it('writes a Date as its ISO string and drops an invalid one, nested or not', () => {
    const date = new Date(Date.UTC(2026, 0, 2, 3, 4, 5));

    expect(buildQueryString({ from: date, range: { to: date }, bad: new Date('nope') })).toBe(
      'from=2026-01-02T03%3A04%3A05.000Z&range%5Bto%5D=2026-01-02T03%3A04%3A05.000Z',
    );
  });

  it('encodes reserved characters in keys and values', () => {
    expect(buildQueryString({ 'a&b': 'c=d&e', q: 'ä ?#+/' })).toBe('a%26b=c%3Dd%26e&q=%C3%A4%20%3F%23%2B%2F');
  });

  it('writes nested objects in dot notation', () => {
    expect(buildQueryString({ filter: { user: { id: 1 } } }, { objectNotation: 'dot' })).toBe('filter.user.id=1');
  });

  it('stringifies objects and arrays whole in json-stringify notation and drops null', () => {
    expect(
      buildQueryString({ filter: { a: [1, 2] }, ids: [1], gone: null }, { objectNotation: 'json-stringify' }),
    ).toBe(`filter=${encodeURIComponent('{"a":[1,2]}')}&ids=${encodeURIComponent('[1]')}`);
  });

  it('returns null when every value is ignored', () => {
    expect(buildQueryString({ a: null, b: [], c: {}, d: [null] })).toBeNull();
  });

  it('appends query params to a route that already carries a query string', () => {
    expect(buildRoute({ base: 'https://api.test', route: '/search?type=user', queryParams: { q: 'x' } })).toBe(
      'https://api.test/search?type=user&q=x',
    );
  });

  it('leaves the route alone when every query param is ignored', () => {
    expect(buildRoute({ base: 'https://api.test', route: '/items', queryParams: { q: null } })).toBe(
      'https://api.test/items',
    );
  });

  it('builds a route function from its path params', () => {
    expect(
      buildRoute({
        base: 'https://api.test',
        route: (p) => `/users/${p['id']}`,
        pathParams: { id: 7 },
        queryParams: { tags: ['a', 'b'] },
      }),
    ).toBe('https://api.test/users/7?tags%5B%5D=a&tags%5B%5D=b');
  });
});
