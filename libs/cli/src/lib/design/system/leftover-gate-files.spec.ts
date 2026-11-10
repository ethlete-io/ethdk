import { writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkDesign } from '../check';
import { DESIGN_DIR } from '../design-config';
import { acme, output } from './check-system.fixtures';

describe('design check and the files of the removed go and accept', () => {
  afterEach(() => vi.restoreAllMocks());

  it('warns once per product of a leftover go.json and accepted.json, naming each file to delete', async () => {
    const target = acme();
    const dir = join(target, DESIGN_DIR, 'acme');
    const warnings: string[] = [];

    output();
    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => void warnings.push(String(line)));

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' })).toBe(0);
    expect(warnings.filter((line) => line.includes('LEFTOVER-FILE'))).toEqual([]);

    writeFileSync(join(dir, 'go.json'), '{}\n');
    writeFileSync(join(dir, 'accepted.json'), '[]\n');
    warnings.length = 0;

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' })).toBe(0);
    expect(warnings.filter((line) => line.includes('LEFTOVER-FILE'))).toEqual([
      `WARNING LEFTOVER-FILE acme: go.json, accepted.json are no longer read - build-ready replaced go and accept; ` +
        `delete ${join(dir, 'go.json')}, ${join(dir, 'accepted.json')}`,
    ]);
  }, 120_000);
});
