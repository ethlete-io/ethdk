import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { designSketch } from './sketch-command';

const dirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();

  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('sketch check on a variant left as the stub sketch new wrote', () => {
  it('refuses it and tells the agent to fix the cause and draw every variant', async () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-design-sketch-stub-'));
    const lines: string[] = [];
    const push = (line: unknown) => void lines.push(String(line));

    dirs.push(target);
    cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });
    writeFileSync(join(target, '.prettierignore'), '*\n');
    vi.spyOn(console, 'log').mockImplementation(push);
    vi.spyOn(console, 'error').mockImplementation(push);
    vi.spyOn(console, 'warn').mockImplementation(push);

    const base = { target, invocation: 'et design' };
    const created = await designSketch({
      ...base,
      argv: [
        'new',
        'components/stubbed',
        '--variants',
        'a,b',
        '--round',
        'R',
        '--note',
        'n',
        '--product',
        'acme',
        '--by',
        'claude-opus-5-5',
      ],
    });

    expect(created).toBe(0);
    lines.length = 0;

    const checked = await designSketch({ ...base, argv: ['check', 'components/stubbed', '--product', 'acme'] });
    const output = lines.join('\n');

    expect(checked).not.toBe(0);
    expect(output).toContain('STATE-SENTENCE');
    expect(output).toContain('draw every variant');
    expect(output).toContain('not done');
  });
});
