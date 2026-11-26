import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from '../../content/mods/plugins/e2e-progress/hooks/progress';

const fixture = (name: string) => readFileSync(resolve(__dirname, 'fixtures/e2e-progress', name), 'utf8');

describe('e2e-progress parse', () => {
  it('counts the ok, x and dash markers of a list reporter without unicode symbols (w20 run)', () => {
    const p = parse('run.log', fixture('w20.log'), new Set(), 0, 0, null);

    expect(p.workers).toBe(20);
    expect(p.total).toBe(1719);
    expect(p.passed).toBe(8);
    expect(p.failed).toBe(1);
    expect(p.skipped).toBe(2);
    expect(p.failures).toHaveLength(1);
  });
});
