import {
  applyQueryDevtoolsTokenTtl,
  canOverrideQueryDevtoolsTokenTtl,
  clearQueryDevtoolsTokenTtl,
  QUERY_DEVTOOLS_TOKEN_TTL_LIMIT,
  queryDevtoolsTokenTtls,
  setQueryDevtoolsTokenTtl,
} from './query-devtools-token-ttl';

const IAT = 1_700_000_000;
const payload = (extra?: Record<string, unknown>) => ({ sub: 'user-1', iat: IAT, exp: IAT + 3600, ...extra });

describe('query devtools token TTL', () => {
  afterEach(() => clearQueryDevtoolsTokenTtl());

  describe('setQueryDevtoolsTokenTtl', () => {
    it('should arm a lifetime per provider name', () => {
      setQueryDevtoolsTokenTtl({ providerName: 'auth', seconds: 60 });

      expect(queryDevtoolsTokenTtls()).toEqual({ auth: 60 });
    });

    it('should leave a provider with nothing armed absent', () => {
      expect(queryDevtoolsTokenTtls()['auth']).toBeUndefined();
    });

    it('should clamp a negative lifetime to zero and truncate a fractional one', () => {
      setQueryDevtoolsTokenTtl({ providerName: 'auth', seconds: -10 });
      expect(queryDevtoolsTokenTtls()['auth']).toBe(0);

      setQueryDevtoolsTokenTtl({ providerName: 'auth', seconds: 90.7 });
      expect(queryDevtoolsTokenTtls()['auth']).toBe(90);
    });

    it('should clamp a lifetime past the limit', () => {
      setQueryDevtoolsTokenTtl({ providerName: 'auth', seconds: QUERY_DEVTOOLS_TOKEN_TTL_LIMIT + 1 });

      expect(queryDevtoolsTokenTtls()['auth']).toBe(QUERY_DEVTOOLS_TOKEN_TTL_LIMIT);
    });

    it('should not disturb another provider', () => {
      setQueryDevtoolsTokenTtl({ providerName: 'auth', seconds: 60 });
      setQueryDevtoolsTokenTtl({ providerName: 'admin', seconds: 30 });

      expect(queryDevtoolsTokenTtls()).toEqual({ auth: 60, admin: 30 });
    });
  });

  describe('clearQueryDevtoolsTokenTtl', () => {
    it('should disarm one provider', () => {
      setQueryDevtoolsTokenTtl({ providerName: 'auth', seconds: 60 });
      setQueryDevtoolsTokenTtl({ providerName: 'admin', seconds: 30 });
      clearQueryDevtoolsTokenTtl('auth');

      expect(queryDevtoolsTokenTtls()).toEqual({ admin: 30 });
    });

    it('should disarm every provider when given no name', () => {
      setQueryDevtoolsTokenTtl({ providerName: 'auth', seconds: 60 });
      setQueryDevtoolsTokenTtl({ providerName: 'admin', seconds: 30 });
      clearQueryDevtoolsTokenTtl();

      expect(queryDevtoolsTokenTtls()).toEqual({});
    });
  });

  describe('canOverrideQueryDevtoolsTokenTtl', () => {
    it('should accept a token carrying an expiry and an issued-at', () => {
      expect(canOverrideQueryDevtoolsTokenTtl({ payload: payload() })).toBe(true);
    });

    it('should accept `nbf` as the anchor when `iat` is missing', () => {
      expect(canOverrideQueryDevtoolsTokenTtl({ payload: { exp: IAT + 3600, nbf: IAT } })).toBe(true);
    });

    it('should refuse a token with no expiry claim to replace', () => {
      expect(canOverrideQueryDevtoolsTokenTtl({ payload: { iat: IAT } })).toBe(false);
    });

    it('should refuse a token with nothing to measure a lifetime from', () => {
      expect(canOverrideQueryDevtoolsTokenTtl({ payload: { exp: IAT + 3600 } })).toBe(false);
    });

    it('should refuse a null payload', () => {
      expect(canOverrideQueryDevtoolsTokenTtl({ payload: null })).toBe(false);
    });

    it('should look at the configured expiry claim', () => {
      const custom = { iat: IAT, expiresAt: IAT + 3600 };

      expect(canOverrideQueryDevtoolsTokenTtl({ payload: custom })).toBe(false);
      expect(canOverrideQueryDevtoolsTokenTtl({ payload: custom, expiresInPropertyName: 'expiresAt' })).toBe(true);
    });
  });

  describe('applyQueryDevtoolsTokenTtl', () => {
    it('should measure the armed lifetime from `iat`', () => {
      setQueryDevtoolsTokenTtl({ providerName: 'auth', seconds: 60 });

      expect(applyQueryDevtoolsTokenTtl({ payload: payload(), providerName: 'auth' })).toEqual({
        sub: 'user-1',
        iat: IAT,
        exp: IAT + 60,
      });
    });

    it('should present a zero lifetime as expired at the moment of issue', () => {
      setQueryDevtoolsTokenTtl({ providerName: 'auth', seconds: 0 });

      expect(applyQueryDevtoolsTokenTtl({ payload: payload(), providerName: 'auth' })['exp']).toBe(IAT);
    });

    it('should lengthen a lifetime just as readily as shorten it', () => {
      setQueryDevtoolsTokenTtl({ providerName: 'auth', seconds: 7200 });

      expect(applyQueryDevtoolsTokenTtl({ payload: payload(), providerName: 'auth' })['exp']).toBe(IAT + 7200);
    });

    it('should rewrite the configured expiry claim rather than `exp`', () => {
      setQueryDevtoolsTokenTtl({ providerName: 'auth', seconds: 60 });

      expect(
        applyQueryDevtoolsTokenTtl({
          payload: { iat: IAT, expiresAt: IAT + 3600 },
          providerName: 'auth',
          expiresInPropertyName: 'expiresAt',
        }),
      ).toEqual({ iat: IAT, expiresAt: IAT + 60 });
    });

    it('should never invent an expiry claim the token does not carry', () => {
      setQueryDevtoolsTokenTtl({ providerName: 'auth', seconds: 60 });

      expect(applyQueryDevtoolsTokenTtl({ payload: { iat: IAT }, providerName: 'auth' })).toEqual({ iat: IAT });
    });

    it('should return the payload untouched for a provider with nothing armed', () => {
      setQueryDevtoolsTokenTtl({ providerName: 'admin', seconds: 60 });
      const original = payload();

      expect(applyQueryDevtoolsTokenTtl({ payload: original, providerName: 'auth' })).toBe(original);
    });

    it('should not mutate the payload it was given', () => {
      setQueryDevtoolsTokenTtl({ providerName: 'auth', seconds: 60 });
      const original = payload();
      applyQueryDevtoolsTokenTtl({ payload: original, providerName: 'auth' });

      expect(original.exp).toBe(IAT + 3600);
    });

    it('should tolerate a non-object payload', () => {
      setQueryDevtoolsTokenTtl({ providerName: 'auth', seconds: 60 });

      expect(applyQueryDevtoolsTokenTtl({ payload: null, providerName: 'auth' })).toBeNull();
      expect(applyQueryDevtoolsTokenTtl({ payload: 'not-a-payload', providerName: 'auth' })).toBe('not-a-payload');
    });
  });
});
