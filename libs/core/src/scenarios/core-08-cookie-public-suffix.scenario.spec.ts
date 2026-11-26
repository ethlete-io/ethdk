// @vitest-environment-options { "url": "https://app.example.co.uk/" }
import { deleteCookie, getCookie, setCookie } from '../index';
import { useScenario } from './harness';

const NAME = 'scenarioSession';

describe('cookies on a public-suffix host scenarios', () => {
  const scenario = useScenario();

  afterEach(() => {
    document.cookie = `${NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT`;
  });

  it('stores, reads and deletes a cookie with the default domain', () => {
    scenario();

    setCookie(NAME, 'eyJhbGciOiJIUzI1NiJ9.e30=');

    expect(getCookie(NAME)).toBe('eyJhbGciOiJIUzI1NiJ9.e30=');

    deleteCookie(NAME);

    expect(getCookie(NAME)).toBeNull();
  });
});
