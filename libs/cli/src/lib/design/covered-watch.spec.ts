import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { skipCoveredAdds } from './covered-watch';

type ViteDevServer = import('vite', { with: { 'resolution-mode': 'import' } }).ViteDevServer;

const opened: { server: ViteDevServer; dir: string }[] = [];

const watchedComments = async (covered: boolean) => {
  const { createServer } = await import('vite');
  const dir = mkdtempSync(join(tmpdir(), 'covered-watch-'));
  const comments = join(dir, 'design/studio/comments');

  mkdirSync(comments, { recursive: true });
  writeFileSync(join(comments, 'old.json'), '{}');

  const server = await createServer({
    configFile: false,
    root: join(dir, 'app'),
    logLevel: 'silent',
    server: { middlewareMode: true, ws: false },
  });

  opened.push({ server, dir });
  server.watcher.add(join(dir, 'design'));
  if (covered) skipCoveredAdds(server.watcher, [join(dir, 'design')]);
  await vi.waitFor(() => expect(server.watcher.getWatched()[comments]).toContain('old.json'));

  const added: string[] = [];

  server.watcher.on('add', (file: string) => added.push(file));

  return { server, comments, added };
};

describe('skipCoveredAdds', () => {
  afterEach(async () => {
    for (const { server, dir } of opened.splice(0)) {
      await server.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps the add event of a file that a stylesheet transform reports as its dependency right after it is written', async () => {
    const { server, comments, added } = await watchedComments(true);
    const file = join(comments, 'new.json');

    writeFileSync(file, '{}');
    server.watcher.add(file);

    await vi.waitFor(() => expect(added).toEqual([file]), { timeout: 3000 });
  });

  it('still adds a path outside the covered dirs', async () => {
    const { server } = await watchedComments(true);
    const outside = join(server.config.root, '..', 'outside.css');

    writeFileSync(outside, '');
    server.watcher.add(outside);

    await vi.waitFor(() => expect(Object.keys(server.watcher.getWatched())).toContain(join(outside, '..')));
  });
});
