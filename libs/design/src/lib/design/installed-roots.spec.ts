import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { installedRootsOf } from './serve';

const dirs: string[] = [];

const tempDir = () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'design-roots-')));
  dirs.push(dir);
  return dir;
};

describe('installedRootsOf', () => {
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('allows the real directory a symlinked node_modules points into', () => {
    const store = tempDir();
    const checkout = tempDir();
    mkdirSync(join(store, 'node_modules'));
    symlinkSync(join(store, 'node_modules'), join(checkout, 'node_modules'));

    expect(installedRootsOf(checkout)).toContain(join(store, 'node_modules'));
  });

  it('allows the parent of every symlinked package, but not dot entries', () => {
    const store = tempDir();
    const checkout = tempDir();
    mkdirSync(join(store, 'pkgs', 'a'), { recursive: true });
    mkdirSync(join(store, 'hidden', 'b'), { recursive: true });
    mkdirSync(join(checkout, 'node_modules'));
    symlinkSync(join(store, 'pkgs', 'a'), join(checkout, 'node_modules', 'a'));
    symlinkSync(join(store, 'hidden', 'b'), join(checkout, 'node_modules', '.b'));

    const roots = installedRootsOf(checkout);

    expect(roots).toContain(dirname(join(store, 'pkgs', 'a')));
    expect(roots).not.toContain(join(store, 'hidden'));
  });

  it('returns nothing for a checkout without node_modules', () => {
    expect(installedRootsOf(tempDir())).toEqual([]);
  });
});
