import { beforeEach, describe, expect, it } from 'vitest';
import { isQueryDevtoolsEnabled, provideQueryDevtools, queryDevtoolsAuthAccountsFor } from '../index';
import { useScenario } from './harness';

const PROVIDER_NAME = 'devtools-auth-vault-2026-10-03';
const VAULT_KEY = 'ethlete:query:devtools:auth:v1';

describe('devtools auth vault 2026-10-03: a stored account that is not one', () => {
  beforeEach(() => {
    localStorage.setItem(
      VAULT_KEY,
      JSON.stringify({
        sessions: [],
        credentials: {},
        accounts: [
          null,
          { id: 'half', provider: PROVIDER_NAME },
          { id: 'coach', provider: PROVIDER_NAME, label: 'Coach', loginQuery: 'login', scope: 'default' },
        ],
      }),
    );
  });

  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 }, providers: () => [provideQueryDevtools()] });

  it('is skipped, so the auth provider registers and the valid account stays on offer', () => {
    const s = scenario();
    expect(isQueryDevtoolsEnabled()).toBe(true);

    s.auth({ name: PROVIDER_NAME });

    expect(queryDevtoolsAuthAccountsFor(PROVIDER_NAME).map((account) => account.id)).toEqual(['local:coach']);

    localStorage.removeItem(VAULT_KEY);
  });
});
