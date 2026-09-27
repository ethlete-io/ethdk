import { TestRequest } from '@angular/common/http/testing';
import { setupAuthTest } from './auth-test-utils';
import { setupQueryTest } from './query-test-setup';

describe('setupAuthTest', () => {
  const refreshBodyOf = (options: { buildRefreshArgs?: (token: string) => { body: Record<string, unknown> } }) => {
    const querySetup = setupQueryTest({ name: 'auth-test-utils' });
    const expectOne = vi.spyOn(querySetup.httpTesting, 'expectOne');
    const { refresh } = setupAuthTest({ querySetup, ...options });

    refresh('refresh-123', { accessToken: 'access', refreshToken: 'next' });

    return (expectOne.mock.results.at(-1)?.value as TestRequest).request.body;
  };

  it('sends the refresh token as { body: { token } } by default', () => {
    expect(refreshBodyOf({})).toEqual({ token: 'refresh-123' });
  });

  it('builds the refresh request with buildRefreshArgs, like the real provider', () => {
    expect(refreshBodyOf({ buildRefreshArgs: (token) => ({ body: { refresh_token: token } }) })).toEqual({
      refresh_token: 'refresh-123',
    });
  });
});
