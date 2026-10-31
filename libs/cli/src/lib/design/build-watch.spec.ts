import { createHash } from 'crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RELOAD_EXIT_CODE, superviseReloads, watchBuild } from './build-watch';

const roots: string[] = [];
const closers: (() => void)[] = [];

const makeBuild = () => {
  const root = mkdtempSync(join(tmpdir(), 'build-watch-'));

  roots.push(root);
  mkdirSync(join(root, 'design/web'), { recursive: true });
  writeFileSync(join(root, 'design/web/frame.ts'), 'old frame');
  writeFileSync(join(root, 'package.json'), '{}');

  return root;
};

const stampOf = (root: string) => () => {
  const hash = createHash('sha256');

  for (const file of (readdirSync(root, { recursive: true }) as string[]).sort()) {
    if (file.endsWith('.ts')) hash.update(file).update(readFileSync(join(root, file)));
  }

  return hash.digest('hex');
};

const watching = (root: string, onRebuild: () => void) => {
  const stamp = stampOf(root);
  const watcher = watchBuild({ root, served: stamp(), stampOf: stamp, onRebuild, settleMs: 200 });

  closers.push(watcher.close);
};

const renameInto = (root: string, file: string, content: string) => {
  const staged = join(root, `${file}.staged`);

  writeFileSync(staged, content);
  renameSync(staged, join(root, file));
};

afterEach(() => {
  for (const close of closers.splice(0)) close();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('watchBuild', () => {
  it('reports a rebuild once the build has stopped writing', async () => {
    const root = makeBuild();
    const onRebuild = vi.fn();

    watching(root, onRebuild);
    renameInto(root, 'design/web/frame.ts', 'new frame');
    await new Promise((settled) => setTimeout(settled, 50));
    renameInto(root, 'design/web/frame-surfaces.ts', 'new surfaces');

    await vi.waitFor(() => expect(onRebuild).toHaveBeenCalledTimes(1), { timeout: 2000 });

    renameInto(root, 'design/web/frame.ts', 'newer frame');
    await new Promise((settled) => setTimeout(settled, 600));

    expect(onRebuild).toHaveBeenCalledTimes(1);
  });

  it('waits until the build has stopped writing', async () => {
    const root = makeBuild();
    const onRebuild = vi.fn();

    watching(root, onRebuild);

    for (let step = 0; step < 4; step++) {
      renameInto(root, 'design/web/frame.ts', `frame ${step}`);
      await new Promise((settled) => setTimeout(settled, 50));
    }

    expect(onRebuild).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(onRebuild).toHaveBeenCalledTimes(1), { timeout: 2000 });
  });

  it('reports a build that deleted the package folder before writing it again', async () => {
    const root = makeBuild();
    const onRebuild = vi.fn();

    watching(root, onRebuild);
    rmSync(root, { recursive: true });
    await new Promise((settled) => setTimeout(settled, 300));
    mkdirSync(join(root, 'design/web/nested'), { recursive: true });
    writeFileSync(join(root, 'design/web/nested/frame.ts'), 'new frame');

    await vi.waitFor(() => expect(onRebuild).toHaveBeenCalledTimes(1), { timeout: 2000 });
  });

  it('ignores a build that rewrites the same code', async () => {
    const root = makeBuild();
    const onRebuild = vi.fn();

    watching(root, onRebuild);
    renameInto(root, 'design/web/frame.ts', 'old frame');
    renameInto(root, 'package.json', '{"changed":true}');
    await new Promise((settled) => setTimeout(settled, 600));

    expect(onRebuild).not.toHaveBeenCalled();
  });
});

describe('superviseReloads', () => {
  it('starts the server again until it ends for another reason than a reload', async () => {
    const codes = [RELOAD_EXIT_CODE, RELOAD_EXIT_CODE, 3];
    const launch = vi.fn(async () => codes.shift() ?? 0);

    expect(await superviseReloads(launch)).toBe(3);
    expect(launch).toHaveBeenCalledTimes(3);
  });
});
