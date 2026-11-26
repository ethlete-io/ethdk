import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkGitCloneAccess, describeGitlabToken } from './gitlab-token';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('gitlab token requests', () => {
  it('refuses to follow a redirect, so the token never reaches another host', async () => {
    const fetch = vi.fn(async () => new Response('{}', { status: 200 }));

    vi.stubGlobal('fetch', fetch);

    await describeGitlabToken({ host: 'git.example.com', token: 'glpat-x' });
    await checkGitCloneAccess({ host: 'git.example.com', projectPath: 'group/project', token: 'glpat-x' });

    expect(fetch).toHaveBeenCalledTimes(2);

    for (const [, init] of fetch.mock.calls as unknown as [string, RequestInit][]) {
      expect(init.redirect).toBe('error');
    }
  });
});
