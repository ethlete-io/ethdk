import { buildQueryString, decryptBearer } from './request-route';

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
});
