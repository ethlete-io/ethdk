import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ProcessResult, TimetrackProcessRunner } from '../transport/ports';
import { ForgeAuth, forgeLoginFor, parseForgeAuthStatus, probeForgeAuth$ } from './auth';

/** `glab auth status` on this machine on 2026-09-10, copied as it was printed. */
const GLAB_REPORT = `gitlab.com
  x gitlab.com: API call failed: GET https://gitlab.com/api/v4/user: 401 {message: 401 Unauthorized}
  ✓ Git operations for gitlab.com configured to use ssh protocol.
  ✓ API calls for gitlab.com are made over https protocol.
  ! No token found (checked config file, keyring, and environment variables).
gitlab.braune-digital.com
  ✓ Logged in to gitlab.braune-digital.com as bornholdt (keyring)
  ✓ Git operations for gitlab.braune-digital.com configured to use ssh protocol.
  ✓ Token found in operating system keyring: **************************
`;

/** `gh auth status` on the same machine and the same day. */
const GH_REPORT = `github.com
  ✓ Logged in to github.com account TomTomB (keyring)
  - Active account: true
  - Token scopes: 'admin:public_key', 'gist', 'read:org', 'repo'
`;

const probe = (result: ProcessResult) => {
  const runner: TimetrackProcessRunner = { run$: vi.fn(() => of(result)) };
  const seen = vi.fn();

  probeForgeAuth$({ runner, cli: 'glab' }).subscribe(seen);

  return seen.mock.calls[0]?.[0] as ForgeAuth;
};

describe('parseForgeAuthStatus', () => {
  it('reads the host and the account off `glab`’s line', () => {
    expect(parseForgeAuthStatus(GLAB_REPORT)).toEqual([{ host: 'gitlab.braune-digital.com', login: 'bornholdt' }]);
  });

  it('reads `gh`’s line too, which words the same fact differently', () => {
    expect(parseForgeAuthStatus(GH_REPORT)).toEqual([{ host: 'github.com', login: 'TomTomB' }]);
  });

  it('leaves out a configured host that holds no token', () => {
    expect(parseForgeAuthStatus(GLAB_REPORT).map((login) => login.host)).not.toContain('gitlab.com');
  });
});

describe('probeForgeAuth$', () => {
  it('reads the per-host lines and not the exit code, which one dead host is enough to fail', () => {
    const auth = probe({ code: 1, stdout: '', stderr: GLAB_REPORT });

    expect(auth.state).toBe('logged-in');
    expect(auth.logins).toHaveLength(1);
  });

  it('reads stdout as well, because `gh` writes its report there and `glab` writes it to stderr', () => {
    expect(probe({ code: 0, stdout: GH_REPORT, stderr: '' }).state).toBe('logged-in');
  });

  it('says not logged in when the CLI ran and named nobody', () => {
    expect(probe({ code: 1, stdout: '', stderr: 'gitlab.com\n  ! No token found.\n' }).state).toBe('not-logged-in');
  });

  it('says not installed when the binary is absent, which is a different repair', () => {
    const runner: TimetrackProcessRunner = { run$: () => throwError(() => new Error('not installed: glab')) };
    const seen = vi.fn();

    probeForgeAuth$({ runner, cli: 'glab' }).subscribe(seen);

    expect((seen.mock.calls[0]?.[0] as ForgeAuth).state).toBe('not-installed');
  });
});

describe('forgeLoginFor', () => {
  it('finds the host whatever case it was written in, and answers null for one with no login', () => {
    const auth = probe({ code: 1, stdout: '', stderr: GLAB_REPORT });

    expect(forgeLoginFor(auth, 'GitLab.Braune-Digital.com')?.login).toBe('bornholdt');
    expect(forgeLoginFor(auth, 'gitlab.com')).toBeNull();
  });
});
