const toBase64Url = (json: string) => {
  const encoded = btoa(
    encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))),
  );

  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export type MintTestTokenOptions = {
  /** @default 900000 (15 minutes) */
  expiresInMs?: number;

  /** Extra payload claims, e.g. the user id or roles `bearerData()` and the auth guards read. */
  claims?: Record<string, unknown>;
};

let mintCount = 0;

/**
 * Mints an unsigned JWT the bearer auth provider can decode, with `iat`, `exp` and a unique `jti`.
 * Hand it to `setTokens()` to put the app's own provider into a session.
 *
 * @example
 * ```ts
 * TestBed.runInInjectionContext(() => authProviderRef.inject().setTokens(mintTestToken({ claims: { sub: '1' } }), 'refresh'));
 * ```
 */
export const mintTestToken = (options: MintTestTokenOptions = {}) => {
  const { expiresInMs = 15 * 60 * 1000, claims = {} } = options;
  const iat = Math.floor(Date.now() / 1000);
  const exp = Math.floor((Date.now() + expiresInMs) / 1000);

  const header = toBase64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = toBase64Url(JSON.stringify({ iat, exp, jti: ++mintCount, ...claims }));

  return `${header}.${payload}.`;
};
