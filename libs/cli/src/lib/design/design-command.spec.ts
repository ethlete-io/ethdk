import { describe, expect, it, vi } from 'vitest';
import { designCommand } from './design-command';

describe('designCommand', () => {
  it('prints every subcommand for --help instead of reading it as a checkout', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(designCommand({ root: '/repo', argv: ['--help'], invocation: 'et design' })).resolves.toBe(0);

    const text = log.mock.calls.flat().join('\n');
    expect(text).toContain('et design [checkout]');
    expect(text).toContain('et design check');
    log.mockRestore();
  });
});
