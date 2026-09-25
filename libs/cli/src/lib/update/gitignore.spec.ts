import { spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { uncommittedChanges } from '../api/git';
import { UPDATE_IGNORE_ENTRY, ignoreUpdateDir } from './gitignore';
import { UPDATE_DIR } from './tasks';

const makeRepo = () => {
  const root = mkdtempSync(join(tmpdir(), 'cli-gitignore-'));

  spawnSync('git', ['init', '--quiet'], { cwd: root });

  return root;
};

describe('ignoreUpdateDir', () => {
  it('keeps the task list out of the working tree status', () => {
    const root = makeRepo();

    expect(ignoreUpdateDir(root)).toBe(true);

    mkdirSync(join(root, UPDATE_DIR), { recursive: true });
    writeFileSync(join(root, UPDATE_DIR, 'tasks.md'), '# Tasks\n', 'utf8');

    expect(uncommittedChanges(root)).toEqual(['?? .gitignore']);
  });

  it('appends the entry once, on its own line', () => {
    const root = makeRepo();

    writeFileSync(join(root, '.gitignore'), 'node_modules', 'utf8');

    ignoreUpdateDir(root);

    expect(ignoreUpdateDir(root)).toBe(false);
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toBe(`node_modules\n${UPDATE_IGNORE_ENTRY}\n`);
  });

  it('leaves a .gitignore alone that already ignores the directory', () => {
    const root = makeRepo();

    writeFileSync(join(root, '.gitignore'), '.ethlete\n', 'utf8');

    expect(ignoreUpdateDir(root)).toBe(false);
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toBe('.ethlete\n');
  });

  it('does nothing outside a git checkout', () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-gitignore-'));

    expect(ignoreUpdateDir(root)).toBe(false);
  });
});
