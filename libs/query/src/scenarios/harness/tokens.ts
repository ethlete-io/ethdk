const toBase64Url = (json: string) => {
  const encoded = btoa(
    encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))),
  );

  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');

  return decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join(''),
  );
};

export type MintTokenOptions = {
  /** @default 900000 (15 minutes) */
  expiresInMs?: number;
  claims?: Record<string, unknown>;
};

let mintCount = 0;

/**
 * `jti` keeps every minted token distinct: `iat`/`exp` have second granularity, so under the frozen
 * fake clock a login and its refresh would otherwise return the same string.
 */
export const mintToken = (options: MintTokenOptions = {}) => {
  const { expiresInMs = 15 * 60 * 1000, claims = {} } = options;
  const iat = Math.floor(Date.now() / 1000);
  const exp = Math.floor((Date.now() + expiresInMs) / 1000);

  const header = toBase64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = toBase64Url(JSON.stringify({ iat, exp, jti: ++mintCount, ...claims }));

  return `${header}.${payload}.`;
};

export const decodeToken = (jwt: string): Record<string, unknown> | null => {
  try {
    const payload = jwt.split('.')[1];

    if (!payload) return null;

    return JSON.parse(fromBase64Url(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
};
