import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { oldRenderIssuesOf } from './base-issues';
import { RenderIssue } from './render-check';
import { gitExec } from '../../git-test-env.fixtures';

const git = (root: string, ...args: string[]) =>
  gitExec(['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: root, stdio: 'pipe' });

const roots: string[] = [];

const repoWith = (files: Record<string, string>) => {
  const root = mkdtempSync(join(tmpdir(), 'cli-design-base-issues-'));

  roots.push(root);
  git(root, 'init', '-q');
  write(root, files);
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'base');

  return root;
};

const write = (root: string, files: Record<string, string>) => {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
};

const clipped = (state: string, detail = 'the text is cut 1.0px at the bottom'): RenderIssue => ({
  rule: 'CLIPPED',
  product: 'studio',
  part: 'elements/canvas-frames',
  state,
  size: '1440',
  path: 'div.flex > button.et-surface-interactive',
  detail,
  sketch: null,
});

const runOf = (root: string, issues: RenderIssue[]) =>
  oldRenderIssuesOf({
    root,
    file: join(root, 'node_modules', '.cache', 'base-issues.json'),
    parts: [{ part: 'elements/canvas-frames', inputs: ['design/canvas-frames/', 'libs/'] }],
    issues,
  });

describe('oldRenderIssuesOf', () => {
  afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

  it('marks every issue old on a working tree that leaves the part alone', () => {
    const root = repoWith({
      'design/canvas-frames/part.ts': 'a',
      'design/other/part.ts': 'a',
      '.gitignore': 'node_modules\n',
    });
    const issues = [clipped('rounds'), clipped('round-folded')];

    write(root, { 'design/other/part.ts': 'b' });

    expect([...runOf(root, issues)]).toEqual(issues);
  });

  it('marks only the issues the stored base shows once the working tree changes the part', () => {
    const root = repoWith({ 'design/canvas-frames/part.ts': 'a', '.gitignore': 'node_modules\n' });
    const shown = clipped('rounds');

    runOf(root, [shown]);
    write(root, { 'design/canvas-frames/part.ts': 'b' });

    const again = clipped('round-folded');
    const added = clipped('rounds', 'the text is cut 2.0px at the bottom');

    expect([...runOf(root, [again, added])]).toEqual([again]);
  });

  it('drops the stored base once a commit changes the part', () => {
    const root = repoWith({ 'design/canvas-frames/part.ts': 'a', '.gitignore': 'node_modules\n' });

    runOf(root, [clipped('rounds')]);
    write(root, { 'libs/components/button.css': 'b' });
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', 'sdk');
    write(root, { 'design/canvas-frames/part.ts': 'b' });

    expect(runOf(root, [clipped('rounds')]).size).toBe(0);
  });
});
