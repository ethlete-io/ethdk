import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

export const generatorsWithoutEntry = (generatorsJson, migrationsJson) => {
  const listed = new Set(
    (migrationsJson?.migrations ?? [])
      .flatMap((migration) => [migration.generator, migration.scan])
      .filter(Boolean)
      .map((reference) => reference.slice(reference.indexOf(':') + 1)),
  );

  return Object.entries(generatorsJson.generators ?? {})
    .filter(([name, generator]) => !generator.scaffold && !listed.has(name))
    .map(([name]) => name);
};

export const checkMigrationEntries = (root) => {
  const errors = [];
  const libsDir = join(root, 'libs');

  for (const lib of readdirSync(libsDir)) {
    const generatorsPath = join(libsDir, lib, 'generators', 'generators.json');
    if (!existsSync(generatorsPath)) continue;

    const migrationsPath = join(libsDir, lib, 'migrations.json');
    const migrations = existsSync(migrationsPath) ? readJson(migrationsPath) : null;

    for (const name of generatorsWithoutEntry(readJson(generatorsPath), migrations)) {
      errors.push(
        `libs/${lib}: the generator "${name}" is not in migrations.json, so "et migrations" does not list it. ` +
          `Add an entry with "generator": "@ethlete/${lib}:${name}", or add "scaffold": true to the generator in generators/generators.json if it only creates new code.`,
      );
    }
  }

  return errors;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const errors = checkMigrationEntries(root);

  for (const error of errors) console.error(error);
  process.exit(errors.length ? 1 : 0);
}
