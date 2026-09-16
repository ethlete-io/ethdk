import { describe, expect, it } from 'vitest';
import { carriesCredentialsSafely } from './secure-host';

describe('carriesCredentialsSafely', () => {
  it('accepts https', () => {
    expect(carriesCredentialsSafely('https://team.atlassian.net')).toBe(true);
    expect(carriesCredentialsSafely('https://git.example.com:8443/api/v4')).toBe(true);
  });

  it('refuses plain http to anything but loopback', () => {
    expect(carriesCredentialsSafely('http://team.atlassian.net')).toBe(false);
    expect(carriesCredentialsSafely('http://192.168.1.10')).toBe(false);
    expect(carriesCredentialsSafely('http://localhost.example.com')).toBe(false);
  });

  it('accepts plain http on loopback, which never leaves the machine', () => {
    expect(carriesCredentialsSafely('http://127.0.0.1:47713/')).toBe(true);
    expect(carriesCredentialsSafely('http://localhost:47713/')).toBe(true);
    expect(carriesCredentialsSafely('http://[::1]:47713/')).toBe(true);
  });

  it('refuses anything that is not a URL, and any other scheme', () => {
    expect(carriesCredentialsSafely('team.atlassian.net')).toBe(false);
    expect(carriesCredentialsSafely('')).toBe(false);
    expect(carriesCredentialsSafely('file:///etc/passwd')).toBe(false);
  });
});
