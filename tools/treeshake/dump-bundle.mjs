#!/usr/bin/env node
/**
 * Diagnostic companion to measure-bundle.mjs: writes an UNMINIFIED, externalized bundle for one
 * entry so you can grep it for retained identifiers ("is the swiss builder really gone?"), and so
 * retention.mjs has something to analyse.
 *
 * Usage:
 *   node tools/treeshake/dump-bundle.mjs --cache <dir> --out <file.js> --entry "<source code>"
 *   node tools/treeshake/dump-bundle.mjs --cache <dir> --out <file.js> --entries <f.json> --name <entry>
 *
 *   --cache  a linked-FESM cache dir (the one measure-bundle.mjs printed), or a variant produced by
 *            make-pure-variant.mjs / split-tuples.mjs / wrap-literals.mjs.
 *   --out    where to write the bundle. Relative paths resolve against <tmp>/ethlete-treeshake.
 *
 * Example:
 *   node tools/treeshake/dump-bundle.mjs --cache /tmp/ethlete-treeshake/linked-3b8c1f6ac1b1 \
 *     --out floor-unmin.js --entry "import { paginate } from '@ethlete/components'; console.log(paginate);"
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  OUT_ROOT,
  assertOutsideRepo,
  cacheAliases,
  esbuildBase,
  externalizeNonEthlete,
  makeArgs,
  repoRequire,
} from './harness.mjs';

const esbuild = repoRequire('esbuild');
const { arg } = makeArgs();

const cacheDir = arg('cache');
if (!cacheDir) throw new Error('--cache <linked-FESM cache dir> is required');
const outFile = assertOutsideRepo(resolve(OUT_ROOT, arg('out', 'dump.js')), 'bundle dump');

const entriesFile = arg('entries');
const code = entriesFile ? JSON.parse(readFileSync(resolve(entriesFile), 'utf8'))[arg('name')] : arg('entry');
if (!code) throw new Error('pass --entry "<code>", or --entries <file.json> --name <entry-name>');

const tmpEntry = join(assertOutsideRepo(cacheDir, 'entry scratch file'), 'dump-entry.mjs');
writeFileSync(tmpEntry, `${code}\n`, 'utf8');

const result = await esbuild.build({
  ...esbuildBase(),
  entryPoints: [tmpEntry],
  minify: false,
  alias: cacheAliases(resolve(cacheDir)),
  plugins: [externalizeNonEthlete],
  logLevel: 'warning',
});
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, Buffer.from(result.outputFiles[0].contents));
console.log(`wrote ${outFile} (${result.outputFiles[0].contents.length} B unminified)`);
