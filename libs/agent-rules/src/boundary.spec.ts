import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const CLI_PACKAGE = /@ethlete\/cli(?![\w-])/;

const sourceFiles = (root: string) =>
  (readdirSync(root, { recursive: true }) as string[])
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts') && !name.includes('fixtures'))
    .map((name) => join(root, name));

describe('the agent-rules to cli edge', () => {
  it('names @ethlete/cli in no source file', () => {
    const offenders = sourceFiles(__dirname).filter((file) => CLI_PACKAGE.test(readFileSync(file, 'utf8')));

    expect(offenders).toEqual([]);
  });

  it('declares no dependency on @ethlete/cli', () => {
    const manifest = readFileSync(join(__dirname, '..', 'package.json'), 'utf8');

    expect(manifest).not.toMatch(CLI_PACKAGE);
  });
});
