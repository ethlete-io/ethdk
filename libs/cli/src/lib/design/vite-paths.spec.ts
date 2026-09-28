import { describe, expect, it } from 'vitest';
import { callSlugOf, fsUrl, isCallFile } from './vite-paths';

describe('design serve paths', () => {
  it('builds a /@fs/ url from a Windows path', () => {
    expect(fsUrl('C:\\repo\\.ethlete\\design\\calls\\app\\one\\call.ts')).toBe(
      '/@fs/C:/repo/.ethlete/design/calls/app/one/call.ts',
    );
  });

  it('builds a /@fs/ url from a POSIX path', () => {
    expect(fsUrl('/repo/calls/app/call.ts')).toBe('/@fs/repo/calls/app/call.ts');
  });

  it('slugs a call file globbed on Windows with forward slashes', () => {
    expect(callSlugOf('app\\one\\call.ts')).toBe('app/one');
  });

  it('recognises a Windows call file under the calls root', () => {
    expect(isCallFile({ callsRoot: 'C:\\repo\\calls', file: 'C:\\repo\\calls\\app\\call.ts' })).toBe(true);
    expect(isCallFile({ callsRoot: 'C:\\repo\\calls', file: 'C:\\repo\\calls\\app\\frame.ts' })).toBe(false);
  });
});
