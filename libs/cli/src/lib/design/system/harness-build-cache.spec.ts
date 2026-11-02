import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { harnessBuildKeyOf } from './harness-build-cache';

const roots: string[] = [];

const checkout = () => {
  const root = mkdtempSync(join(tmpdir(), 'cli-harness-build-key-'));

  roots.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });

  return {
    root,
    write: (path: string, source: string) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), source);
    },
    key: () => harnessBuildKeyOf({ target: root, command: ['build'] }),
  };
};

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('harnessBuildKeyOf', () => {
  it('changes with a source file the build reads', () => {
    const { write, key } = checkout();

    write('apps/app/src/main.ts', 'a');
    const before = key();

    write('apps/app/src/main.ts', 'b');

    expect(key()).not.toBe(before);
  });

  it('changes with a design token stylesheet the build imports', () => {
    const { write, key } = checkout();

    write('.ethlete/design/studio/foundations/colors/colors.css', 'a');
    const before = key();

    write('.ethlete/design/studio/foundations/colors/colors.css', 'b');

    expect(key()).not.toBe(before);
  });

  it.each([
    '.ethlete/design/config.json',
    '.ethlete/design/tsconfig.json',
    '.ethlete/design/sdk/go.json',
    '.ethlete/design/sdk/pictures.json',
  ])('changes the key when %s changes', (path) => {
    const { write, key } = checkout();

    write(path, 'a');
    const before = key();

    write(path, 'b');

    expect(key()).not.toBe(before);
  });

  it.each([
    'plans/note.md',
    '.changeset/change.md',
    '.ethlete/design/studio-lab/sketches/card/sketch.json',
    '.ethlete/design/sdk/comments/note.json',
  ])('keeps the key when %s changes', (path) => {
    const { write, key } = checkout();

    write('apps/app/src/main.ts', 'a');
    write(path, 'a');
    const before = key();

    write(path, 'b');
    write('plans/new.md', 'new');

    expect(key()).toBe(before);
  });
});
