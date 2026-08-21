import { describe, expect, it } from 'vitest';
import { gitHostFromInput, gitUrlHost, gitUrlProjectPath } from './auth-hint';

describe('gitUrlProjectPath', () => {
  it('reads the path out of an ssh url with a port', () => {
    expect(gitUrlProjectPath('ssh://git@git.example.com:2224/group/sub/api.git')).toBe('group/sub/api');
  });

  it('reads the path out of an scp-like url', () => {
    expect(gitUrlProjectPath('git@git.example.com:group/api.git')).toBe('group/api');
  });

  it('reads the path out of an https url', () => {
    expect(gitUrlProjectPath('https://git.example.com/group/api.git')).toBe('group/api');
  });

  it('is undefined when the url has no path', () => {
    expect(gitUrlProjectPath('https://git.example.com')).toBeUndefined();
    expect(gitUrlProjectPath('not a url')).toBeUndefined();
  });
});

describe('gitUrlHost', () => {
  it('reads the host out of both url forms', () => {
    expect(gitUrlHost('ssh://git@git.example.com:2224/group/api.git')).toBe('git.example.com');
    expect(gitUrlHost('git@git.example.com:group/api.git')).toBe('git.example.com');
  });
});

describe('gitHostFromInput', () => {
  it('takes a bare host', () => {
    expect(gitHostFromInput('gitlab.example.com')).toBe('gitlab.example.com');
    expect(gitHostFromInput('  gitlab.example.com  ')).toBe('gitlab.example.com');
  });

  it('takes a host pasted as a url', () => {
    expect(gitHostFromInput('https://gitlab.example.com/')).toBe('gitlab.example.com');
    expect(gitHostFromInput('http://gitlab.example.com/group/api')).toBe('gitlab.example.com');
    expect(gitHostFromInput('git@gitlab.example.com:group/api.git')).toBe('gitlab.example.com');
  });

  it('drops a port, because a token is held per host', () => {
    expect(gitHostFromInput('gitlab.example.com:2224')).toBe('gitlab.example.com');
  });

  it('is undefined when there is no host name in it', () => {
    expect(gitHostFromInput('')).toBeUndefined();
    expect(gitHostFromInput('/group/api')).toBeUndefined();
  });
});
