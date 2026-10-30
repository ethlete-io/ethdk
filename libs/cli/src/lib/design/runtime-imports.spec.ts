import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '../..');

const sourcesOf = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) return entry.name === '__fixtures__' ? [] : sourcesOf(path);

    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });

describe('the frame runtime in libs/cli/design', () => {
  it('is never imported by a lib source, so tsc does not emit CommonJS next to it in dist', () => {
    const importers = sourcesOf(SRC).filter((path) => /from '(?:\.\.\/)+design\//.test(readFileSync(path, 'utf8')));

    expect(importers.map((path) => relative(SRC, path))).toEqual([]);
  });
});
