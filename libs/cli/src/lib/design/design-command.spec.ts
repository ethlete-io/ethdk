import { describe, expect, it, vi } from 'vitest';
import { designCommand } from './design-command';
import * as stamp from './stamp';

describe('designCommand', () => {
  it('prints every subcommand for --help instead of reading it as a checkout', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(designCommand({ root: '/repo', argv: ['--help'], invocation: 'et design' })).resolves.toBe(0);

    const text = log.mock.calls.flat().join('\n');
    expect(text).toContain('et design [checkout]');
    expect(text).toContain('et design check');
    expect(text).toContain('et design status <slug> <scaffolded|drawing|checking|ready|failed>');
    log.mockRestore();
  });

  it('prints the usage of the one subcommand --help follows, and skips its checks', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const helpOf = async (...argv: string[]) => {
      log.mockClear();
      await expect(designCommand({ root: '/repo', argv, invocation: 'et design' })).resolves.toBe(0);

      return log.mock.calls.flat().join('\n');
    };

    const sketchNew = await helpOf('sketch', 'new', 'elements/shell', '--help');
    expect(sketchNew).toContain('usage: et design sketch new <layer>/<name>');
    expect(sketchNew).not.toContain('sketch variant');

    const sketchVariant = await helpOf('sketch', 'variant', '-h');
    expect(sketchVariant).toContain('usage: et design sketch variant <layer>/<name> <variant> --from');
    expect(sketchVariant).not.toContain('sketch new');

    const inboxDone = await helpOf('inbox', 'done', '--help');
    expect(inboxDone).toContain('inbox done <id>');
    expect(inboxDone).not.toContain('et design comment');

    const commentReply = await helpOf('comment', 'reply', '--help');
    expect(commentReply).toContain('comment reply <id>');
    expect(commentReply).not.toContain('--preset');

    expect(error).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('prints the stamp of this cli as one line of JSON', async () => {
    vi.spyOn(stamp, 'buildStampOf').mockReturnValue({ version: '1.2.3', build: 'abc' });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(designCommand({ root: '/repo', argv: ['stamp'], invocation: 'et design' })).resolves.toBe(0);

    expect(log).toHaveBeenCalledWith('{"version":"1.2.3","build":"abc"}');
    vi.restoreAllMocks();
  });
});
