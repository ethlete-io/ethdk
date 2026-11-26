import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { swapIntoPlace } from './compile.mjs';

const tree = (root: string, files: Record<string, string>) => {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
};

describe('swapIntoPlace', () => {
  it('replaces the old build without keeping files of removed sources', () => {
    const root = mkdtempSync(join(tmpdir(), 'compile-'));
    const target = join(root, 'cli-build');
    const run = join(root, 'cli-build-run-1');
    tree(target, { 'src/index.js': 'old', 'src/lib/removed.js': 'old' });
    tree(run, { 'src/index.js': 'new' });

    swapIntoPlace(run, target);

    expect(readFileSync(join(target, 'src/index.js'), 'utf8')).toBe('new');
    expect(existsSync(join(target, 'src/lib/removed.js'))).toBe(false);
    expect(readdirSync(root)).toEqual(['cli-build']);
  });

  it('creates the target when the old build was deleted mid-compile', () => {
    const root = mkdtempSync(join(tmpdir(), 'compile-'));
    const target = join(root, 'tmp/cli-build');
    const run = join(root, 'tmp/cli-build-run-1');
    tree(run, { 'src/index.js': 'new' });

    swapIntoPlace(run, target);

    expect(readFileSync(join(target, 'src/index.js'), 'utf8')).toBe('new');
  });
});
