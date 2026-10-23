import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { basename, join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { designStatus, statusPath } from './status';

const withCall = (slug: string) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-status-'));

  mkdirSync(join(target, '.ethlete/design/calls', slug), { recursive: true });

  return target;
};

const statusOf = (target: string, slug: string) =>
  JSON.parse(readFileSync(statusPath({ checkout: target, slug }), 'utf8')) as Record<string, unknown>;

describe('designStatus', () => {
  afterEach(() => vi.restoreAllMocks());

  it('names the file the way Studio flattens a checkout and a call', () => {
    expect(basename(statusPath({ checkout: '/home/tom/dev/sdk', slug: 'app/01-one' }))).toBe(
      '-home-tom-dev-sdk-app-01-one.status.json',
    );
    expect(statusPath({ checkout: '/x', slug: 'app/one' })).toContain(join(tmpdir(), 'ethlete-studio-checks'));
  });

  it('records the state of a call with the time it changed', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const target = withCall('app/one');

    expect(designStatus({ target, argv: ['app/one', 'drawing'], invocation: 'et design' })).toBe(0);

    const status = statusOf(target, 'app/one');
    expect(status['state']).toBe('drawing');
    expect(Number.isNaN(Date.parse(String(status['updatedAt'])))).toBe(false);
  });

  it('refuses a state it does not know, and a call that is not there', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const target = withCall('app/one');

    expect(designStatus({ target, argv: ['app/one', 'done'], invocation: 'et design' })).toBe(2);
    expect(designStatus({ target, argv: ['app/two', 'ready'], invocation: 'et design' })).toBe(1);
    expect(error.mock.calls.flat().join('')).toContain('NO CALL');
    expect(existsSync(statusPath({ checkout: target, slug: 'app/one' }))).toBe(false);
  });
});
