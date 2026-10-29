import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
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

  it('errors on an unknown command and prints the usage', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(designCommand({ root: '/repo', argv: ['nope'], invocation: 'et design' })).resolves.toBe(2);
    expect(error.mock.calls.flat().join('\n')).toContain('unknown command or checkout "nope"');
    log.mockRestore();
    error.mockRestore();
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

  it('finds the design config in a parent folder, as git finds its repository', async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'design-root-')));
    const sub = join(root, 'a', 'b');
    mkdirSync(sub, { recursive: true });
    mkdirSync(join(root, '.ethlete/design'), { recursive: true });
    writeFileSync(join(root, '.ethlete/design/config.json'), '{}');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await designCommand({ root: sub, argv: ['sketch', 'list'], invocation: 'et design' });

    const text = error.mock.calls.flat().join('\n');
    error.mockRestore();
    log.mockRestore();
    rmSync(root, { recursive: true, force: true });
    expect(text).not.toContain('no config at');
  });
});
