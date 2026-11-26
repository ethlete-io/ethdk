import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const packageRoots = [join(__dirname), join(__dirname, '../../contentful/generators')];

const migrationFactories = packageRoots.flatMap((root) => {
  const { generators } = JSON.parse(readFileSync(join(root, 'generators.json'), 'utf8')) as {
    generators: Record<string, { factory: string }>;
  };
  return Object.entries(generators)
    .filter(([name]) => name.startsWith('migrate-'))
    .map(([name, { factory }]) => ({ name, path: join(root, `${factory}.ts`) }));
});

describe('the migration generators', () => {
  it.each(migrationFactories)('$name returns nothing or a callback, as nx calls the result', async ({ path }) => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { default: generator } = (await import(path)) as {
      default: (tree: unknown, schema: { skipFormat: boolean }) => Promise<unknown>;
    };

    const result = await generator(createTreeWithEmptyWorkspace(), { skipFormat: true });

    expect(result === undefined || typeof result === 'function').toBe(true);
  });
});
