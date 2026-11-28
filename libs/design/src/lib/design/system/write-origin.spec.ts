import { describe, expect, it } from 'vitest';
import { portableCmdOf } from './write-origin';

describe('portableCmdOf', () => {
  it('writes the checkout and paths under it relative to the working directory', () => {
    expect(portableCmdOf(['design', '__resident', '--checkout', '/home/someone/repo'], '/home/someone/repo')).toBe(
      'design __resident --checkout .',
    );
    expect(portableCmdOf(['design', 'check', '/home/someone/repo/.ethlete'], '/home/someone/repo')).toBe(
      'design check .ethlete',
    );
  });

  it('keeps plain arguments as they are', () => {
    expect(portableCmdOf(['design', 'ready', 'components/button', '--by', 'builder'], '/tmp')).toBe(
      'design ready components/button --by builder',
    );
  });
});
