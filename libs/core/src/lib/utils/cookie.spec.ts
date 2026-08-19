import { setCookie } from './cookie';

describe('setCookie', () => {
  afterEach(() => vi.restoreAllMocks());

  it('omits the domain attribute for a host-only cookie', () => {
    const cookieSetter = vi.spyOn(document, 'cookie', 'set');

    setCookie('session', 'token', null, null);

    expect(cookieSetter).toHaveBeenCalledWith('session=token; path=/; SameSite=LAX;');
  });

  it('marks SameSite=None cookies as secure', () => {
    const cookieSetter = vi.spyOn(document, 'cookie', 'set');

    setCookie('session', 'token', null, null, '/', 'none');

    expect(cookieSetter).toHaveBeenCalledWith('session=token; path=/; SameSite=NONE; Secure;');
  });
});
