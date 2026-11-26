import * as fs from 'fs';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildStampOf } from './stamp';

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();

  return {
    ...actual,
    readdirSync: vi.fn((...args: Parameters<typeof actual.readdirSync>) => {
      const names = actual.readdirSync(...args);
      const dir = String(args[0]);

      for (const name of names as unknown as string[]) {
        if (name.startsWith('vanishing-')) actual.rmSync(join(dir, name), { force: true });
      }

      return names;
    }),
  };
});

describe('buildStampOf', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('skips a file that a rebuild removes while the stamp hashes the assets', () => {
    const assets = mkdtempSync(join(tmpdir(), 'stamp-vanished-'));

    dirs.push(assets);
    writeFileSync(join(assets, 'kept.txt'), 'kept', 'utf8');
    writeFileSync(join(assets, 'vanishing-probe.txt'), 'gone', 'utf8');

    const stamp = buildStampOf(assets);

    expect(fs.existsSync(join(assets, 'vanishing-probe.txt'))).toBe(false);
    expect(stamp.build).toBe(buildStampOf(assets).build);
  });
});
