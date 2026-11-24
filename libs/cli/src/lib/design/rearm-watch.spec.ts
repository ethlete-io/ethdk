import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { watchRecreatedDirs } from './rearm-watch';

const roots: string[] = [];
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

const until = async (done: () => boolean) => {
  for (let waited = 0; waited < 3000 && !done(); waited += 50) await sleep(50);
};

const checkout = () => {
  const root = mkdtempSync(join(tmpdir(), 'cli-rearm-'));
  const design = join(root, '.ethlete/design');
  const comments = join(design, 'studio/comments');

  roots.push(root);
  mkdirSync(comments, { recursive: true });
  writeFileSync(join(comments, 'first.json'), '{}');

  return { root, design, studio: join(design, 'studio'), comments };
};

const restore = (studio: string) => {
  const saved = mkdtempSync(join(tmpdir(), 'cli-rearm-saved-'));

  roots.push(saved);
  cpSync(studio, saved, { recursive: true });
  rmSync(studio, { recursive: true, force: true });
  cpSync(saved, studio, { recursive: true });
};

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('a Studio data dir that is deleted and recreated, like the restore of an edit sketch or a git checkout', () => {
  it.each(['comments', 'studio'])('still reports a file added after the %s dir is recreated', async (recreated) => {
    const { design, studio, comments } = checkout();
    const files: string[] = [];
    const watching = watchRecreatedDirs({ root: design, dirs: [comments], onFile: (file) => files.push(file) });

    await sleep(300);

    if (recreated === 'studio') restore(studio);
    else {
      rmSync(comments, { recursive: true, force: true });
      mkdirSync(comments);
    }

    await sleep(300);
    files.length = 0;
    writeFileSync(join(comments, 'later.json'), '{}');
    await until(() => files.includes(join(comments, 'later.json')));
    watching.close();

    expect(files).toContain(join(comments, 'later.json'));
  });

  it('reports the files of a recreated dir at once', async () => {
    const { design, studio, comments } = checkout();
    const files: string[] = [];
    const watching = watchRecreatedDirs({ root: design, dirs: [comments], onFile: (file) => files.push(file) });

    await sleep(300);
    restore(studio);
    await until(() => files.includes(join(comments, 'first.json')));
    watching.close();

    expect(files).toContain(join(comments, 'first.json'));
  });
});

describe('the watcher Vite hands the design server', () => {
  it('misses a file added after the comments dir is recreated, which is why the dirs are watched directly', async () => {
    const { createServer } = await import('vite');
    const { root, design, comments } = checkout();
    const server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      server: { hmr: false, middlewareMode: true, ws: false },
    });
    const added: string[] = [];

    server.watcher.add([design]);
    await sleep(1500);
    server.watcher.on('add', (file) => added.push(file));
    rmSync(comments, { recursive: true, force: true });
    mkdirSync(comments);
    await sleep(500);
    writeFileSync(join(comments, 'later.json'), '{}');
    await sleep(1500);
    await server.close();

    expect(added).not.toContain(join(comments, 'later.json'));
  }, 20000);
});
