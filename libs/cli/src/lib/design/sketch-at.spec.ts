import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractSketchAt } from './sketch-at';

describe('extractSketchAt', () => {
  let repo = '';
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'sketch-at-'));
    git('init', '-q');
    git('config', 'user.email', 'a@b.c');
    git('config', 'user.name', 'a');
    git('config', 'commit.gpgsign', 'false');
  });

  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  const productDir = () => join(repo, '.ethlete/design/app');

  it('reads a deleted sketch folder from its commit and leaves the working tree alone', () => {
    const folder = join(productDir(), 'sketches/pages-home');

    mkdirSync(join(folder, 'a/pages/home'), { recursive: true });
    writeFileSync(join(folder, 'sketch.json'), '{}');
    writeFileSync(join(folder, 'a/pages/home/home.ts'), 'export default 1;');
    git('add', '-A');
    git('commit', '-qm', 'sketch');
    const withSketch = git('rev-parse', 'HEAD');

    rmSync(folder, { recursive: true });
    git('add', '-A');
    git('commit', '-qm', 'merge');

    const dest = join(repo, 'out');
    const result = extractSketchAt({
      target: repo,
      productDir: productDir(),
      sketch: { layer: 'pages', name: 'home' },
      commit: withSketch,
      dest,
    });

    expect(result).toEqual({ root: dest });
    expect(readFileSync(join(dest, 'sketches/pages-home/a/pages/home/home.ts'), 'utf8')).toBe('export default 1;');
    expect(existsSync(folder)).toBe(false);
    expect(git('status', '--porcelain', '--', '.ethlete')).toBe('');
  });

  it('says why a commit holds no such sketch', () => {
    writeFileSync(join(repo, 'x'), '1');
    git('add', '-A');
    git('commit', '-qm', 'x');

    const result = extractSketchAt({
      target: repo,
      productDir: productDir(),
      sketch: { layer: 'pages', name: 'home' },
      commit: 'HEAD',
      dest: join(repo, 'out'),
    });

    expect(result).toMatchObject({ problem: expect.stringContaining('no sketch pages/home in commit HEAD') });
  });
});
