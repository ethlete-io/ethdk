import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { classFactsOf } from './tailwind-classes';

const tailwind = vi.hoisted(() => ({ runs: 0, during: null as (() => void) | null }));

vi.mock('child_process', async (original) => {
  const actual = await original<typeof import('child_process')>();

  return {
    ...actual,
    execFileSync: (...args: Parameters<typeof actual.execFileSync>) => {
      const output = actual.execFileSync(...args);

      tailwind.runs++;
      tailwind.during?.();

      return output;
    },
  };
});

const write = (root: string, path: string, content: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};

const projectOf = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-tailwind-merge-'));

  write(target, 'styles.css', `@import ${JSON.stringify(require.resolve('tailwindcss/index.css'))};\n`);

  return target;
};

const factsIn = (target: string, candidates: string[]) =>
  classFactsOf({
    product: {
      name: 'acme',
      dir: target,
      config: { styles: ['styles.css'] },
      configFile: join(target, 'a/b/config.json'),
    },
    classes: {
      target,
      stylesheets: [join(target, 'styles.css')],
      files: [{ file: join(target, 'part.ts'), source: '', candidates, classes: [] }],
    },
  });

const storedKnownOf = (target: string) => {
  const dir = join(target, 'node_modules/.cache/ethlete-design/class-facts');
  const [name] = readdirSync(dir).filter((file) => file.endsWith('.json'));

  return { file: join(dir, name ?? ''), stored: JSON.parse(readFileSync(join(dir, name ?? ''), 'utf8')) };
};

describe('classFactsOf', { timeout: 120_000 }, () => {
  it('keeps the facts another process stored while its own Tailwind run ran', () => {
    const target = projectOf();

    factsIn(target, ['flex']);

    tailwind.during = () => {
      const { file, stored } = storedKnownOf(target);

      writeFileSync(
        file,
        JSON.stringify({
          ...stored,
          known: [...stored.known, ['p-other', { canonical: 'p-other', emitsNothing: false }]],
        }),
      );
    };

    try {
      factsIn(target, ['grid']);
    } finally {
      tailwind.during = null;
    }

    const known = new Map(storedKnownOf(target).stored.known as [string, unknown][]);

    expect([...known.keys()].sort()).toEqual(['flex', 'grid', 'p-other']);

    const runs = tailwind.runs;

    expect(factsIn(target, ['flex', 'grid', 'p-other']).get('p-other')).toEqual({
      canonical: 'p-other',
      emitsNothing: false,
    });
    expect(tailwind.runs).toBe(runs);
  });
});
