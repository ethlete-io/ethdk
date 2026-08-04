#!/usr/bin/env node
/**
 * Size goldens for the published `@ethlete/*` packages — the regression guard for the tree-shaking
 * work recorded in `plans/tree-shaking-opportunities.md`.
 *
 * Every entry in `goldens.json` is bundled the way a consumer app would bundle it (see harness.mjs)
 * and its gzipped size compared against the checked-in number. Growth past the tolerance fails, so
 * re-introducing an unshakeable module-scope statement is caught here rather than at the next audit.
 * `--update` rewrites the file: a golden change is then a deliberate, reviewable commit.
 *
 * An entry with `"thirdParty": true` externalizes only the framework, so non-framework dependencies
 * (`date-fns`, `@contentful/rich-text-types`, `socket.io-client`) count towards its size. Those are
 * the only entries that can catch a newly value-imported third-party module.
 *
 * Usage:
 *   npx nx build core query components
 *   node tools/treeshake/check-goldens.mjs [--update] [--dist <dist/libs>] [--cache <dir>] [--json]
 */
import { gzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  OUT_ROOT,
  assertOutsideRepo,
  defaultDistLibs,
  distFingerprint,
  esbuildBase,
  externalizeFrameworkOnly,
  externalizeNonEthlete,
  makeArgs,
  processPackages,
  repoRequire,
} from './harness.mjs';

const esbuild = repoRequire('esbuild');
const { arg, flag } = makeArgs();

const GOLDENS_FILE = join(dirname(fileURLToPath(import.meta.url)), 'goldens.json');
const distLibs = resolve(arg('dist', defaultDistLibs()));

const measure = async (name, code, aliases, workDir, withThirdParty) => {
  const entry = join(workDir, `golden-${name}.mjs`);
  await writeFile(entry, code.endsWith('\n') ? code : `${code}\n`, 'utf8');

  const result = await esbuild.build({
    ...esbuildBase(),
    entryPoints: [entry],
    minify: true,
    alias: aliases,
    plugins: [withThirdParty ? externalizeFrameworkOnly : externalizeNonEthlete],
  });

  return gzipSync(Buffer.from(result.outputFiles[0].contents), { level: 9 }).byteLength;
};

/** Deterministic linking still moves a few bytes on a dependency bump, hence a floor as well as a %. */
const allowance = (expected, tolerance) =>
  Math.max(tolerance.bytes ?? 0, Math.round((expected * (tolerance.percent ?? 0)) / 100));

const main = async () => {
  const goldens = JSON.parse(await readFile(GOLDENS_FILE, 'utf8'));
  const cacheDir = assertOutsideRepo(
    resolve(arg('cache', join(OUT_ROOT, `linked-${await distFingerprint(distLibs)}`))),
    'linked-FESM cache',
  );

  await mkdir(cacheDir, { recursive: true });
  process.stderr.write(`dist:  ${distLibs}\ncache: ${cacheDir}\n`);

  const aliases = await processPackages(distLibs, cacheDir);
  const workDir = join(cacheDir, 'goldens');
  await mkdir(workDir, { recursive: true });

  const rows = [];

  for (const [name, golden] of Object.entries(goldens.entries)) {
    const actual = await measure(name, golden.entry, aliases, workDir, golden.thirdParty === true);
    const expected = golden.gzip;
    const limit = allowance(expected, goldens.tolerance);
    // A brand-new golden (`0`) is recorded, never failed — that is how an entry is added.
    const status = expected === 0 ? 'new' : Math.abs(actual - expected) <= limit ? 'ok' : 'fail';

    rows.push({
      name,
      expected,
      actual,
      delta: actual - expected,
      limit,
      status,
      thirdParty: golden.thirdParty === true,
    });

    if (flag('update')) golden.gzip = actual;
  }

  if (flag('update')) {
    await writeFile(GOLDENS_FILE, `${JSON.stringify(goldens, null, 2)}\n`, 'utf8');
  }

  if (flag('json')) {
    console.log(JSON.stringify({ dist: distLibs, updated: flag('update'), rows }, null, 2));
  } else {
    const label = (row) => (row.thirdParty ? `${row.name} +3p` : row.name);
    const width = Math.max(...rows.map((row) => label(row).length), 5);
    console.log(
      `\nsize goldens  (ethlete-only, gzip; "+3p" also counts non-framework deps)\n${'entry'.padEnd(width)}   expected     actual      delta`,
    );

    for (const row of rows) {
      const mark = row.status === 'ok' ? '✔' : row.status === 'new' ? '+' : '✖';
      const delta = `${row.delta >= 0 ? '+' : ''}${row.delta} B`;
      console.log(
        `${mark} ${label(row).padEnd(width)} ${String(row.expected).padStart(8)} B ${String(row.actual).padStart(8)} B ${delta.padStart(10)}`,
      );
    }
  }

  const failed = rows.filter((row) => row.status === 'fail');

  if (failed.length > 0 && !flag('update')) {
    console.error(
      `\n${failed.length} entr${failed.length === 1 ? 'y' : 'ies'} outside tolerance (${goldens.tolerance.percent}% or ${goldens.tolerance.bytes} B).` +
        '\nA growth here means something became unshakeable — usually an unannotated module-scope call, or a' +
        '\nprovider/component newly named from one. Diagnose with tools/treeshake/decompose.mjs, or accept the' +
        '\nnew size deliberately with `nx run treeshake:bundle-goldens:update` and explain it in the commit.',
    );
    process.exitCode = 1;
  }

  if (flag('update')) console.log('\ngoldens.json updated — commit the diff.');
};

await main();
