import { parseForgeAuthStatus } from '@ethlete/timetrack';
import { describe, expect, it } from 'vitest';
import { formatForgeLoginGap } from './format';

/** The shape `glab auth status` (1.114) prints, with the hosts and the account swapped for fixtures. */
const GLAB_REPORT = `gitlab.com
  x gitlab.com: API call failed: GET https://gitlab.com/api/v4/user: 401 {message: 401 Unauthorized}
  ! No token found (checked config file, keyring, and environment variables).
git.example.com
  ✓ Logged in to git.example.com as someone (keyring)
  ✓ REST API Endpoint: https://git.example.com/api/v4/
  ✓ Token found in operating system keyring: **************************
`;

const held = parseForgeAuthStatus(GLAB_REPORT).map((login) => login.host);

describe('formatForgeLoginGap', () => {
  it('never offers a login command for an email address typed into the instance field', () => {
    const detail = formatForgeLoginGap({ cli: 'glab', host: 'someone@example.com', held, hasInstanceField: true });

    expect(detail).toBe(
      'someone@example.com is not a hostname. `glab` holds a login for git.example.com. Correct the instance in Settings.',
    );
  });

  it('offers the login command for a mistyped host that is still a host', () => {
    const detail = formatForgeLoginGap({ cli: 'glab', host: 'gti.example.com', held, hasInstanceField: true });

    expect(detail).toContain('`glab auth login --hostname gti.example.com`');
  });
});
