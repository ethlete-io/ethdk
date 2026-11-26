import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { entryOf } from './render-packages';

const running = vi.hoisted(() => ({ calls: 0, finish: () => undefined as void }));

vi.mock('./system/build-running', () => ({
  isBuildRunning: () => {
    running.calls++;
    running.finish();

    return running.calls < 3;
  },
}));

describe('entryOf', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });

    running.calls = 0;
    running.finish = () => undefined;
  });

  const packageIn = () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-entry-of-'));
    const dir = join(root, 'dist/libs/components');

    roots.push(root);

    return {
      dir,
      write: () => (
        mkdirSync(dir, { recursive: true }),
        writeFileSync(join(dir, 'package.json'), '{"module":"./index.js"}')
      ),
    };
  };

  it('waits while a build of the package runs and reads the manifest once the build wrote it', () => {
    const { dir, write } = packageIn();

    running.finish = () => (running.calls === 2 ? write() : undefined);

    expect(entryOf({ dir, subpath: '.' })).toContain('index.js');
    expect(running.calls).toBe(2);
  });

  it('refuses a missing package when no build runs', () => {
    running.calls = 5;

    expect(() => entryOf({ dir: join(tmpdir(), 'cli-entry-of-none', 'components'), subpath: '.' })).toThrow(
      'components missing, run `nx build components`',
    );
  });
});
