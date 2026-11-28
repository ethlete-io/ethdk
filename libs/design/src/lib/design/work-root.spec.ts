import { mkdirSync, mkdtempSync, realpathSync, symlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';
import { workRootOf } from './work-root';

const tempDir = () => realpathSync(mkdtempSync(join(tmpdir(), 'cli-design-work-root-')));

describe('workRootOf', () => {
  it('stays under node_modules when that folder is the checkout own', () => {
    const target = tempDir();

    mkdirSync(join(target, 'node_modules'));

    expect(workRootOf(target)).toBe(join(target, 'node_modules/.design-explore'));
  });

  it('stays under node_modules when the checkout has none yet', () => {
    const target = tempDir();

    expect(workRootOf(target)).toBe(join(target, 'node_modules/.design-explore'));
  });

  it('lands inside the project when node_modules is a symlink to another tree', () => {
    const target = tempDir();
    const elsewhere = tempDir();

    mkdirSync(join(elsewhere, 'node_modules'));
    symlinkSync(join(elsewhere, 'node_modules'), join(target, 'node_modules'));

    const root = workRootOf(target);

    expect(relative(target, root).startsWith('..')).toBe(false);
    expect(root).toBe(join(target, '.ethlete/cache/design-explore'));
  });
});
