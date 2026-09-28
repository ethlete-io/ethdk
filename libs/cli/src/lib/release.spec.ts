import { describe, expect, it } from 'vitest';
import { releaseFlags } from './release';

describe('releaseFlags', () => {
  it('reads each flag and its alias', () => {
    expect(releaseFlags(['--force', '-sp'])).toEqual({ shouldForce: true, skipPush: true });
    expect(releaseFlags(['-f', '--skip-push'])).toEqual({ shouldForce: true, skipPush: true });
  });

  it('does not read a flag out of a longer argument', () => {
    expect(releaseFlags(['--no-fail-fast', '--spec'])).toEqual({ shouldForce: false, skipPush: false });
  });
});
