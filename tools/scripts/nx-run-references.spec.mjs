import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..');

const filesUnder = (dir, suffix) =>
  existsSync(join(repoRoot, dir))
    ? readdirSync(join(repoRoot, dir), { recursive: true })
        .filter((name) => name.endsWith(suffix))
        .map((name) => join(dir, name))
    : [];

const projects = () => {
  const byName = new Map();
  for (const parent of ['apps', 'libs', 'tools']) {
    for (const entry of readdirSync(join(repoRoot, parent))) {
      const path = join(repoRoot, parent, entry, 'project.json');
      if (!existsSync(path)) continue;
      const project = JSON.parse(readFileSync(path, 'utf8'));
      byName.set(project.name ?? entry, project.targets ?? {});
    }
  }
  return byName;
};

const inferredTargetNames = () => {
  const nx = JSON.parse(readFileSync(join(repoRoot, 'nx.json'), 'utf8'));
  return new Set(
    (nx.plugins ?? [])
      .flatMap((plugin) => Object.entries(typeof plugin === 'object' ? (plugin.options ?? {}) : {}))
      .filter(([key, value]) => /targetname$/i.test(key) && typeof value === 'string')
      .map(([, value]) => value),
  );
};

test('every `nx run <project>:<target>` in workflows, skills and package.json names an existing target', () => {
  const known = projects();
  const inferred = inferredTargetNames();
  const sources = [...filesUnder('.github/workflows', '.yml'), ...filesUnder('.agents/skills', '.md'), 'package.json'];
  const stale = [];
  for (const file of sources) {
    const text = readFileSync(join(repoRoot, file), 'utf8');
    for (const [, project, target, configuration] of text.matchAll(/nx run ([\w-]+):([\w-]+)(?::([\w-]+))?/g)) {
      const targets = known.get(project);
      const definition = targets?.[target];
      const ok =
        targets !== undefined &&
        (definition
          ? !configuration || definition.configurations?.[configuration] !== undefined
          : inferred.has(target));
      if (!ok) stale.push(`${file}: ${project}:${target}${configuration ? `:${configuration}` : ''}`);
    }
  }
  assert.deepEqual(stale, []);
});

test('every `yarn <group>:<name>` script in workflows and pre-push checks exists in package.json', () => {
  const scripts = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).scripts;
  const references = [
    ...filesUnder('.github/workflows', '.yml').flatMap((file) =>
      [...readFileSync(join(repoRoot, file), 'utf8').matchAll(/\byarn ([a-z][\w-]*:[\w:-]+)/g)].map(([, name]) => [
        file,
        name,
      ]),
    ),
    ...[...readFileSync(join(repoRoot, 'tools/scripts/pre-push-checks.mjs'), 'utf8').matchAll(/'(lint:[\w:-]+)'/g)].map(
      ([, name]) => ['tools/scripts/pre-push-checks.mjs', name],
    ),
  ];
  assert.deepEqual(
    references.filter(([, name]) => !(name in scripts)).map(([file, name]) => `${file}: ${name}`),
    [],
  );
});
