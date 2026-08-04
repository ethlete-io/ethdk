#!/usr/bin/env node
/**
 * Bundle-size measurement harness for the published `@ethlete/*` packages.
 *
 * Answers "what does this import cost a consumer, in gzipped bytes". Each entry in the entries JSON
 * is written to a file and bundled as if it were a consumer app; `@ethlete/*` resolves to the
 * linked+optimized FESMs (see harness.mjs / README.md for why that pre-processing is mandatory).
 *
 * Usage:
 *   node tools/treeshake/measure-bundle.mjs [--dist <dist/libs>] [--entries <file.json>] [--cache <dir>]
 *                                           [--label NAME] [--external | --third-party] [--json]
 *
 *   --dist      a `dist/libs` containing components/ core/ query/ types/ (default: <repo>/dist/libs)
 *   --entries   JSON `{ "<entry-name>": "<entry source code>" }` (default: entries.example.json)
 *   --cache     where the linked+optimized FESMs live (default:
 *               <tmp>/ethlete-treeshake/linked-<fingerprint>, keyed on the dist FESMs' size+mtime).
 *               The babel pass over ~4.6 MB of FESM takes ~5-60 s and is only paid once per build.
 *   --external  mark every non-@ethlete package external, so the number is "how much @ethlete code
 *               lands in the app" without the ~85 kB gz Angular runtime constant. Deltas between
 *               entries are identical in both modes; this mode is less noisy and much faster.
 *   --third-party  like --external, but keeps non-framework deps (`date-fns`, `socket.io-client`,
 *               `@contentful/rich-text-types`) in the bundle - the only mode in which a retained
 *               runtime import of one of them is visible. Ignored when --external is also passed.
 *   --json      machine-readable output on stdout.
 *
 * Example:
 *   npx nx build core query components
 *   node tools/treeshake/measure-bundle.mjs --external
 */
import { gzipSync } from 'node:zlib';
import { join, resolve } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  OUT_ROOT,
  assertOutsideRepo,
  defaultDistLibs,
  defaultEntriesFile,
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

const distLibs = resolve(arg('dist', defaultDistLibs()));
const entriesFile = resolve(arg('entries', defaultEntriesFile()));
const label = arg('label', distLibs);

const mode = flag('external') ? 'external' : flag('third-party') ? 'third-party' : 'full';
const modePlugins = { external: [externalizeNonEthlete], 'third-party': [externalizeFrameworkOnly], full: [] };
const modeLabel = {
  external: '(ethlete-only)',
  'third-party': '(ethlete + non-framework deps)',
  full: '(full bundle)',
};

const measure = async (name, code, aliases, workDir) => {
  const entry = join(workDir, `entry-${name}.mjs`);
  await writeFile(entry, code.endsWith('\n') ? code : `${code}\n`, 'utf8');
  const result = await esbuild.build({
    ...esbuildBase(),
    entryPoints: [entry],
    minify: true,
    alias: aliases,
    plugins: modePlugins[mode],
  });
  const out = Buffer.from(result.outputFiles[0].contents);
  return { raw: out.byteLength, gz: gzipSync(out, { level: 9 }).byteLength };
};

const main = async () => {
  const entries = JSON.parse(await readFile(entriesFile, 'utf8'));
  const cacheDir = assertOutsideRepo(
    resolve(arg('cache', join(OUT_ROOT, `linked-${await distFingerprint(distLibs)}`))),
    'linked-FESM cache',
  );
  await mkdir(cacheDir, { recursive: true });
  process.stderr.write(`dist:    ${distLibs}\ncache:   ${cacheDir}\nentries: ${entriesFile}\n`);
  const aliases = await processPackages(distLibs, cacheDir);
  const workDir = join(cacheDir, 'entries');
  await mkdir(workDir, { recursive: true });

  const rows = [];
  for (const [name, code] of Object.entries(entries)) {
    rows.push({ name, ...(await measure(name, code, aliases, workDir)) });
  }

  if (flag('json')) {
    console.log(JSON.stringify({ label, dist: distLibs, cache: cacheDir, mode, rows }, null, 2));
    return;
  }
  const w = Math.max(...rows.map((r) => r.name.length), 5);
  console.log(`\n${label}  ${modeLabel[mode]}`);
  console.log(`${'entry'.padEnd(w)}       min          gz`);
  for (const r of rows) {
    console.log(
      `${r.name.padEnd(w)}  ${(r.raw / 1024).toFixed(1).padStart(8)} kB  ${(r.gz / 1024).toFixed(1).padStart(8)} kB  (${r.gz} B)`,
    );
  }
};

await main();
