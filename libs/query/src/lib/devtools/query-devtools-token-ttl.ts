import { Signal, signal } from '@angular/core';

/**
 * The longest lifetime an armed override may claim, in seconds (7 days). Anything beyond it is never
 * refreshed at all, which is what arming nothing already does.
 */
export const QUERY_DEVTOOLS_TOKEN_TTL_LIMIT = 604800;

/** The claims an overridden lifetime is measured from, in the order they are tried. */
const ANCHOR_CLAIMS = ['iat', 'nbf'] as const;

const ttls = /* @__PURE__ */ signal<Record<string, number>>({});

/**
 * The access-token lifetime armed per auth provider name, in seconds, consumed by the
 * `<et-query-devtools>` panel. A provider on its token's real lifetime is absent rather than present
 * with it.
 */
export const queryDevtoolsTokenTtls: Signal<Record<string, number>> = /* @__PURE__ */ ttls.asReadonly();

const tokenTtlAnchor = (options: {
  payload: Record<string, unknown> | null;
  expiresInPropertyName: string;
}): number | null => {
  const { payload, expiresInPropertyName } = options;

  if (!payload || typeof payload[expiresInPropertyName] !== 'number') return null;

  for (const claim of ANCHOR_CLAIMS) {
    const value = payload[claim];

    if (typeof value === 'number') return value;
  }

  return null;
};

/**
 * Whether an overridden lifetime can be applied to a decoded access token at all. It needs the claim
 * carrying the expiry - so a lifetime is never invented for a token that declares none - plus `iat` or
 * `nbf` to measure the new lifetime from.
 */
export const canOverrideQueryDevtoolsTokenTtl = (options: {
  payload: Record<string, unknown> | null;
  expiresInPropertyName?: string;
}) =>
  tokenTtlAnchor({ payload: options.payload, expiresInPropertyName: options.expiresInPropertyName ?? 'exp' }) !== null;

/**
 * Presents one auth provider's access token as living `seconds` from the moment it was issued, rather
 * than as long as it says it does. Everything that reads the expiry sees the shortened lifetime - the
 * proactive refresh schedule, `withBearerAuthTokenExpirationWarning`, and the panel's own countdown -
 * so arming 60 seconds makes a real refresh happen a minute after each token is issued, and keeps
 * happening for every token that refresh brings back.
 *
 * It is a lifetime, not a remaining time: `0` presents the current token as long expired, which is what
 * makes a refresh happen at once. Nothing is persisted, so a reload leaves every provider on its real
 * lifetime.
 *
 * Part of the devtools contract consumed by `<et-query-devtools>`; a token's lifetime is not something
 * an application should override on itself.
 */
export const setQueryDevtoolsTokenTtl = (options: { providerName: string; seconds: number }) => {
  const { providerName, seconds } = options;
  const clamped = Math.min(Math.max(Math.trunc(seconds) || 0, 0), QUERY_DEVTOOLS_TOKEN_TTL_LIMIT);

  ttls.update((current) => ({ ...current, [providerName]: clamped }));
};

/**
 * Puts one provider back on its token's real lifetime, or every provider when no name is given.
 *
 * @see setQueryDevtoolsTokenTtl
 */
export const clearQueryDevtoolsTokenTtl = (providerName?: string) => {
  ttls.update((current) => {
    if (providerName === undefined) return {};

    const { [providerName]: _removed, ...rest } = current;

    return rest;
  });
};

/**
 * The decoded access token as the devtools want it seen: the claim carrying the expiry rewritten to the
 * armed lifetime, measured from `iat`. Returns `payload` untouched when nothing is armed for the
 * provider, or when the token cannot carry the override - see {@link canOverrideQueryDevtoolsTokenTtl}.
 *
 * Installed as the token payload patcher by `provideQueryDevtools()`, and called directly by the panel
 * for its own countdown.
 */
export const applyQueryDevtoolsTokenTtl = <T>(options: {
  payload: T;
  providerName: string;
  expiresInPropertyName?: string;
}): T => {
  const { payload, providerName, expiresInPropertyName = 'exp' } = options;
  const seconds = ttls()[providerName];

  if (seconds === undefined || !payload || typeof payload !== 'object') return payload;

  const record = payload as Record<string, unknown>;
  const anchor = tokenTtlAnchor({ payload: record, expiresInPropertyName });

  if (anchor === null) return payload;

  return { ...record, [expiresInPropertyName]: anchor + seconds } as T;
};
