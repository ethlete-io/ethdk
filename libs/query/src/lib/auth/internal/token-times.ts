import { patchQueryDevtoolsTokenPayload } from '../../devtools/query-devtools-hook';
import { decryptBearer } from '../../http/internal/request-route';
import { TokenRefreshQueryConfig } from '../bearer-auth-query-builders';

export type AccessTokenTimes = {
  expiresAtMs: number;
  issuedAtMs: number | null;
};

const readClaim = (payload: unknown, claim: string) => {
  const value = (payload as Record<string, unknown> | null | undefined)?.[claim];

  return typeof value === 'number' ? value : null;
};

/**
 * The expiry and issue time of an access token. `decoded` (what `bearerDecryptFn` returned) is tried
 * first and the raw JWT payload second, so a `bearerDecryptFn` that maps the claims to an app user does
 * not hide the expiry.
 */
export const readAccessTokenTimes = (options: {
  token: string;
  decoded: unknown;
  claim: string;
  providerName: string;
}): AccessTokenTimes | null => {
  const { token, claim, providerName } = options;
  const patch = (payload: unknown) =>
    patchQueryDevtoolsTokenPayload({ payload, providerName, expiresInPropertyName: claim });

  const candidates = [() => patch(options.decoded), () => patch(decryptBearer(token))];

  for (const candidate of candidates) {
    let payload: unknown;

    try {
      payload = candidate();
    } catch {
      continue;
    }

    const exp = readClaim(payload, claim);

    if (exp === null) continue;

    const iat = readClaim(payload, 'iat');

    return { expiresAtMs: exp * 1000, issuedAtMs: iat === null ? null : iat * 1000 };
  }

  return null;
};

export const refreshBufferMs = (
  strategy: TokenRefreshQueryConfig<never>['refreshStrategy'],
  tokenLifetimeMs: number,
) => {
  if (typeof strategy === 'number') {
    return strategy >= 0 && strategy <= 1 ? tokenLifetimeMs * (1 - strategy) : Math.max(strategy, 0);
  }

  const percentage = strategy?.percentage ?? 0.75;
  const minBufferMs = strategy?.minBufferMs ?? 60_000;
  const maxBufferMs = strategy?.maxBufferMs ?? 600_000;

  return Math.max(minBufferMs, Math.min(maxBufferMs, tokenLifetimeMs * (1 - percentage)));
};
