import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { removeOldShotFolders } from './old-shot-folders';

const roots: string[] = [];

const rootWith = (names: string[]) => {
  const root = mkdtempSync(join(tmpdir(), 'old-shots-'));

  roots.push(root);

  for (const name of names) {
    mkdirSync(join(root, name, 'inner'), { recursive: true });
    writeFileSync(join(root, name, 'inner', 'a.json'), '{}');
  }

  return root;
};

afterEach(() => {
  vi.restoreAllMocks();

  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('removing the old path-keyed shot folders', () => {
  it('removes shots-<10 hex> folders and keeps everything else', async () => {
    const keep = ['part-shots', 'shots-foo', 'shots-00a13cc604x', 'shots-11A13CC604', 'vite-00a13cc604'];
    const root = rootWith(['shots-00a13cc604', 'shots-ffffffffff', ...keep]);

    writeFileSync(join(root, 'shots-0123456789'), 'a file');
    await removeOldShotFolders(root);

    expect(existsSync(join(root, 'shots-00a13cc604'))).toBe(false);
    expect(existsSync(join(root, 'shots-ffffffffff'))).toBe(false);
    expect(keep.map((name) => existsSync(join(root, name)))).toEqual(keep.map(() => true));
    expect(existsSync(join(root, 'shots-0123456789'))).toBe(true);
  });

  it('does nothing when the work root does not exist', async () => {
    await expect(removeOldShotFolders(join(tmpdir(), 'no-such-work-root-xyz'))).resolves.toBeUndefined();
  });

  it('logs one line and goes on when a folder cannot be removed', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const root = rootWith(['shots-aaaaaaaaaa', 'shots-bbbbbbbbbb']);

    chmodSync(join(root, 'shots-aaaaaaaaaa'), 0o500);
    await expect(removeOldShotFolders(root)).resolves.toBeUndefined();
    chmodSync(join(root, 'shots-aaaaaaaaaa'), 0o700);

    expect(existsSync(join(root, 'shots-bbbbbbbbbb'))).toBe(false);
    expect(error).toHaveBeenCalledTimes(1);
  });
});
