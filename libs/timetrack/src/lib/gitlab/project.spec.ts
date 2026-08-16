import { describe, expect, it } from 'vitest';
import { parseGitLabRemoteUrl } from './project';

describe('parseGitLabRemoteUrl', () => {
  it('reads the SSH spelling', () => {
    expect(parseGitLabRemoteUrl('git@gitlab.test:braune-digital/fut-frontend.git')).toEqual({
      host: 'gitlab.test',
      path: 'braune-digital/fut-frontend',
    });
  });

  it('reads the HTTPS spelling', () => {
    expect(parseGitLabRemoteUrl('https://gitlab.test/braune-digital/fut-frontend.git')).toEqual({
      host: 'gitlab.test',
      path: 'braune-digital/fut-frontend',
    });
  });

  it('keeps a nested group path whole', () => {
    expect(parseGitLabRemoteUrl('git@gitlab.test:group/team/repo.git')).toEqual({
      host: 'gitlab.test',
      path: 'group/team/repo',
    });
  });

  it('tolerates a missing .git suffix and a trailing slash', () => {
    expect(parseGitLabRemoteUrl('https://gitlab.test/group/repo/')).toEqual({
      host: 'gitlab.test',
      path: 'group/repo',
    });
  });

  it('drops a user and a port from the host', () => {
    expect(parseGitLabRemoteUrl('https://tom@gitlab.test:8443/group/repo.git')).toEqual({
      host: 'gitlab.test',
      path: 'group/repo',
    });
  });

  it('reads an ssh:// URL', () => {
    expect(parseGitLabRemoteUrl('ssh://git@gitlab.test/group/repo.git')).toEqual({
      host: 'gitlab.test',
      path: 'group/repo',
    });
  });

  it('refuses what is not a remote URL', () => {
    expect(parseGitLabRemoteUrl('')).toBeNull();
    expect(parseGitLabRemoteUrl('/srv/git/repo')).toBeNull();
  });
});
