import { mintTestToken, MintTestTokenOptions } from '@ethlete/query/testing';

const fromBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');

  return decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join(''),
  );
};

export type MintTokenOptions = MintTestTokenOptions;

export const mintToken = mintTestToken;

export const decodeToken = (jwt: string): Record<string, unknown> | null => {
  try {
    const payload = jwt.split('.')[1];

    if (!payload) return null;

    return JSON.parse(fromBase64Url(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
};
