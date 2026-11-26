import { existsSync, readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';

const libsRoot = join(__dirname, '../../../..');

type ManifestEntry = { name: string; kind: string; generator?: string; requires?: string[] };

const readJson = <T>(path: string) => JSON.parse(readFileSync(path, 'utf8')) as T;

const sourcesIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) return sourcesIn(path);

    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });

const importsTsMorph = (dir: string) =>
  sourcesIn(dir).some((path) => /from 'ts-morph'/.test(readFileSync(path, 'utf8')));

const autoMigrations = readdirSync(libsRoot).flatMap((lib) => {
  const manifestPath = join(libsRoot, lib, 'migrations.json');
  const generatorsPath = join(libsRoot, lib, 'generators', 'generators.json');

  if (!existsSync(manifestPath) || !existsSync(generatorsPath)) return [];

  const generators = readJson<{ generators: Record<string, { implementation: string }> }>(generatorsPath).generators;

  return readJson<{ migrations: ManifestEntry[] }>(manifestPath)
    .migrations.filter((entry) => entry.kind === 'auto')
    .map((entry) => {
      const implementation = generators[entry.generator?.split(':')[1] ?? '']?.implementation ?? '';

      return { lib, entry, dir: dirname(join(libsRoot, lib, 'generators', implementation)) };
    });
});

describe('the requirements of the shipped auto migrations', () => {
  it('finds auto migrations to check', () => {
    expect(autoMigrations.length).toBeGreaterThan(0);
  });

  it.each(autoMigrations.map((migration) => [`${migration.lib} ${migration.entry.name}`, migration] as const))(
    '%s declares ts-morph when its generator imports it',
    (_, { entry, dir }) => {
      expect(entry.requires?.includes('ts-morph') ?? false).toBe(importsTsMorph(dir));
    },
  );
});
