import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import {
  changedFiles,
  copyConsumer,
  installedVersions,
  judgeSmokeBuild,
  parseBuildErrors,
  pendingSmokeMigrations,
  snapshotFiles,
} from './migrations.mjs';

const sdkRoot = resolve(import.meta.dirname, '../..');
const built = existsSync(join(sdkRoot, 'dist/libs/cli/src/lib/update/plan.js'));

const entry = (name, version, level) => ({
  name,
  version,
  kind: 'auto',
  level,
  description: name,
  generator: `@ethlete/core:${name}`,
});

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'smoke-migrations-spec-'));
  const core = join(root, 'node_modules/@ethlete/core');
  mkdirSync(core, { recursive: true });
  writeFileSync(
    join(core, 'package.json'),
    JSON.stringify({ name: '@ethlete/core', version: '1.0.0-next.5', ethlete: { migrations: './migrations.json' } }),
  );
  writeFileSync(
    join(core, 'migrations.json'),
    JSON.stringify({
      migrations: [
        entry('below-range', '1.0.0-next.2', 'required'),
        entry('in-range', '1.0.0-next.7', 'required'),
        entry('in-range-optional', '1.0.0-next.7', 'optional'),
        entry('above-range', '1.0.0-next.12', 'required'),
      ],
    }),
  );
  return root;
};

test(
  'picks the required migrations an update from the installed to the smoked version crosses',
  { skip: !built },
  () => {
    const root = fixture();
    try {
      const pending = pendingSmokeMigrations({
        sdkRoot,
        root,
        from: { '@ethlete/core': '1.0.0-next.5' },
        to: { '@ethlete/core': '1.0.0-next.10' },
      });
      assert.deepEqual(
        pending.map((entry) => entry.migration.name),
        ['in-range'],
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

test('reads the installed versions of the configured libs', () => {
  const root = fixture();
  try {
    assert.deepEqual(installedVersions(join(root, 'node_modules/@ethlete'), ['core', 'missing']), {
      '@ethlete/core': '1.0.0-next.5',
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('copies tracked and unignored files, never node_modules, and links node_modules back', () => {
  const root = fixture();
  let copy;
  try {
    spawnSync('git', ['init', '-q'], { cwd: root });
    writeFileSync(join(root, '.gitignore'), 'node_modules\nignored.txt\n');
    writeFileSync(join(root, 'kept.ts'), 'kept');
    writeFileSync(join(root, 'ignored.txt'), 'ignored');
    copy = copyConsumer(root);
    assert.equal(existsSync(join(copy, 'kept.ts')), true);
    assert.equal(existsSync(join(copy, 'ignored.txt')), false);
    assert.equal(lstatSync(join(copy, 'node_modules')).isSymbolicLink(), true);
    writeFileSync(join(copy, 'kept.ts'), 'changed');
    assert.equal(spawnSync('cat', [join(root, 'kept.ts')]).stdout.toString(), 'kept');
  } finally {
    rmSync(root, { recursive: true, force: true });
    if (copy) rmSync(copy, { recursive: true, force: true });
  }
});

const fixtureText = (name) => readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8');

test('parses the errors of a captured tsc run in plain and pretty format', () => {
  for (const name of ['tsc-plain.txt', 'tsc-pretty.txt']) {
    const [error, ...rest] = parseBuildErrors(fixtureText(name));
    assert.equal(rest.length, 0);
    assert.deepEqual([error.file, error.line, error.column, error.code], ['src/a.ts', 1, 31, 'TS2353']);
  }
});

test('finds the files a migration rewrote', () => {
  const root = mkdtempSync(join(tmpdir(), 'smoke-snapshot-spec-'));
  try {
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src/a.ts'), 'a');
    writeFileSync(join(root, 'src/b.ts'), 'b');
    const before = snapshotFiles(root);
    writeFileSync(join(root, 'src/a.ts'), 'changed');
    assert.deepEqual([...changedFiles(before, snapshotFiles(root))], ['src/a.ts']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const judge = (overrides) =>
  judgeSmokeBuild({
    migrationLines: ['@ethlete/core:x applied'],
    buildCode: 1,
    buildOutput: fixtureText('tsc-plain.txt'),
    rewritten: new Set(),
    root: '/consumer',
    ...overrides,
  });

test('FAIL: a migration threw or failed', () => {
  const verdict = judge({ migrationLines: ['migration runner threw (boom) failed'], buildCode: 0 });
  assert.equal(verdict.failures.length, 1);
  assert.deepEqual(verdict.warnings, []);
});

test('FAIL: the build error is in a file a pending migration rewrote', () => {
  const verdict = judge({ rewritten: new Set(['src/a.ts']) });
  assert.equal(verdict.warnings.length, 0);
  assert.match(verdict.failures.join('\n'), /a migration rewrote: src\/a\.ts:1:31 TS2353/);
});

test('WARN: the build error is in a file no pending migration touched', () => {
  const verdict = judge({ rewritten: new Set(['src/other.ts']) });
  assert.deepEqual(verdict.failures, []);
  assert.match(verdict.warnings.join('\n'), /^WARN .*src\/a\.ts:1:31 TS2353/);
});

test('FAIL: a red build with no parseable error never downgrades to a warning', () => {
  assert.equal(judge({ buildOutput: 'killed' }).failures.length, 1);
});

test('PASS: a green build has neither failures nor warnings', () => {
  assert.deepEqual(judge({ buildCode: 0 }), { failures: [], warnings: [] });
});
