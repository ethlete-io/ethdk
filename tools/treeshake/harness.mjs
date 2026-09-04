/**
 * Shared plumbing for the tree-shaking measurement scripts in this folder.
 *
 * Everything here exists to reproduce, outside of an Angular application build, exactly what an
 * Angular application build does to a published `@ethlete/*` FESM before bundling it. See README.md
 * for why each step is load-bearing.
 *
 * Nothing in this folder may write inside the repo: caches and outputs default to
 * `<os.tmpdir()>/ethlete-treeshake/`, and `assertOutsideRepo()` hard-fails any path that would land
 * in the working tree.
 */
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import fs from 'node:fs';
import os from 'node:os';
import path, { basename, dirname, join, resolve } from 'node:path';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/** repo root, derived from this file's location (tools/treeshake/harness.mjs) */
export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Third-party deps are resolved through the repo's `node_modules` with a `require()` rooted there.
 * That keeps working even when a script is invoked from another cwd.
 */
export const repoRequire = createRequire(join(REPO, 'index.js'));

/** default home for linked-FESM caches, bundles and JSON reports — deliberately outside the repo */
export const OUT_ROOT = join(os.tmpdir(), 'ethlete-treeshake');

/** package specifier -> FESM path relative to `dist/libs` */
export const PACKAGES = {
  '@ethlete/bracket': 'bracket/fesm2022/ethlete-bracket.mjs',
  '@ethlete/cdk': 'cdk/fesm2022/ethlete-cdk.mjs',
  '@ethlete/components': 'components/fesm2022/ethlete-components.mjs',
  '@ethlete/contentful': 'contentful/fesm2022/ethlete-contentful.mjs',
  '@ethlete/core': 'core/fesm2022/ethlete-core.mjs',
  '@ethlete/query': 'query/fesm2022/ethlete-query.mjs',
  '@ethlete/query/testing': 'query/fesm2022/ethlete-query-testing.mjs',
  '@ethlete/query-devtools': 'query-devtools/fesm2022/ethlete-query-devtools.mjs',
  '@ethlete/query-devtools/lazy': 'query-devtools/fesm2022/ethlete-query-devtools-lazy.mjs',
  '@ethlete/query-devtools/toggle': 'query-devtools/fesm2022/ethlete-query-devtools-toggle.mjs',
  '@ethlete/types': 'types/fesm2022/ethlete-types.mjs',
};

/** tiny argv helpers, shared so every script takes the same flags */
export const makeArgs = (argv = process.argv.slice(2)) => ({
  argv,
  arg: (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? fallback : argv[i + 1];
  },
  flag: (name) => argv.includes(`--${name}`),
  positional: () => argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--'))),
});

/** refuse to write anywhere inside the repo working tree */
export const assertOutsideRepo = (p, what = 'output') => {
  const abs = resolve(p);
  if (abs === REPO || abs.startsWith(`${REPO}${path.sep}`)) {
    throw new Error(
      `refusing to write ${what} inside the repo: ${abs}\n` +
        `these scripts keep all generated files out of the working tree (default: ${OUT_ROOT})`,
    );
  }
  return abs;
};

/**
 * The babel passes an Angular application build applies to a `sideEffects: false`, non-`@angular`
 * package, in the same order and with the same options as
 * node_modules/@angular/build/src/tools/esbuild/javascript-transformer-worker.js.
 */
const babelPlugins = () => {
  const { createEs2015LinkerPlugin } = repoRequire('@angular/compiler-cli/linker/babel');
  const {
    adjustStaticMembers,
    adjustTypeScriptEnums,
    elideAngularMetadata,
    markTopLevelPure,
    // @angular/build's `exports` map blocks this deep subpath, so require it by absolute path.
  } = repoRequire(join(REPO, 'node_modules/@angular/build/src/tools/babel/plugins/index.js'));

  const linker = createEs2015LinkerPlugin({
    linkerJitMode: false,
    sourceMapping: false,
    logger: { level: 2, debug: () => undefined, info: () => undefined, warn: console.warn, error: console.error },
    fileSystem: {
      resolve: path.resolve,
      exists: fs.existsSync,
      dirname: path.dirname,
      relative: path.relative,
      readFile: fs.readFileSync,
    },
  });

  return [
    linker,
    [markTopLevelPure, { topLevelSafeMode: true }],
    elideAngularMetadata,
    adjustTypeScriptEnums,
    [adjustStaticMembers, { wrapDecorators: true }],
  ];
};

/** hash of the dist FESMs' size+mtime, so a rebuilt dist re-links and an unchanged one is instant */
export const distFingerprint = async (distLibs) => {
  const parts = [];
  for (const rel of Object.values(PACKAGES)) {
    const p = join(distLibs, rel);
    if (!existsSync(p)) continue;
    const s = await stat(p);
    parts.push(`${rel}:${s.size}:${Math.round(s.mtimeMs)}`);
  }
  if (!parts.length) {
    throw new Error(`no @ethlete FESM files found under ${distLibs} — run: npx nx build core query components`);
  }
  return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 12);
};

/**
 * Link + optimize every FESM found under `distLibs` into `cacheDir`, and return the
 * `{ '@ethlete/x': <path> }` alias map esbuild needs. Already-processed files are reused.
 *
 * `sourceMaps: true` chains the dist FESM's own map through babel and writes a `.map` next to each
 * output, which is what decompose.mjs needs to attribute bundle bytes back to original sources.
 */
export const processPackages = async (distLibs, cacheDir, { sourceMaps = false, log = process.stderr } = {}) => {
  assertOutsideRepo(cacheDir, 'linked-FESM cache');
  const aliases = {};
  let plugins;
  for (const [pkg, rel] of Object.entries(PACKAGES)) {
    const src = join(distLibs, rel);
    if (!existsSync(src)) continue;
    const dest = join(cacheDir, rel);
    aliases[pkg] = dest;
    if (existsSync(dest) && (!sourceMaps || existsSync(`${dest}.map`))) continue;
    plugins ??= babelPlugins();
    log.write(`  link+optimize${sourceMaps ? '(+map)' : ''} ${pkg} ...`);
    const t0 = Date.now();
    const inMap = `${src}.map`;
    const { transformAsync } = repoRequire('@babel/core');
    const res = await transformAsync(await readFile(src, 'utf8'), {
      filename: src,
      babelrc: false,
      configFile: false,
      browserslistConfigFile: false,
      compact: false,
      sourceMaps,
      inputSourceMap: sourceMaps && existsSync(inMap) ? JSON.parse(await readFile(inMap, 'utf8')) : undefined,
      plugins,
    });
    await mkdir(dirname(dest), { recursive: true });
    const code = res.code.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, '');
    if (sourceMaps) {
      await writeFile(dest, `${code}\n//# sourceMappingURL=${basename(dest)}.map\n`, 'utf8');
      await writeFile(`${dest}.map`, JSON.stringify(res.map), 'utf8');
    } else {
      await writeFile(dest, code, 'utf8');
    }
    // CRUCIAL: esbuild only drops unused top-level statements of a module whose nearest
    // package.json says `sideEffects: false`. Without this shim every entry measures the whole
    // library (the components floor jumps from ~90 kB to ~293 kB gz).
    await writeFile(
      join(cacheDir, rel.split('/')[0], 'package.json'),
      JSON.stringify({ name: pkg, type: 'module', sideEffects: false }),
      'utf8',
    );
    log.write(` ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
  }
  return aliases;
};

/** build the alias map for an already-populated cache dir, without touching babel */
export const cacheAliases = (cacheDir) => {
  const aliases = {};
  for (const [pkg, rel] of Object.entries(PACKAGES)) {
    const p = join(cacheDir, rel);
    if (existsSync(p)) aliases[pkg] = p;
  }
  return aliases;
};

/** mark every non-`@ethlete` import external, so the number is "how much @ethlete code lands" */
export const externalizeNonEthlete = {
  name: 'externalize-non-ethlete',
  setup(build) {
    build.onResolve({ filter: /^[^./]/ }, (args) =>
      args.path.startsWith('@ethlete/') ? undefined : { path: args.path, external: true },
    );
  },
};

/** the framework an app pays for no matter what it imports from us — external in both modes */
const FRAMEWORK = /^(@angular\/|rxjs(\/|$)|tslib$|zone\.js)/;

/**
 * Externalize only the framework, so third-party deps (`date-fns`, `@contentful/rich-text-types`,
 * `socket.io-client`, …) land in the bundle and a retained runtime import of one shows up in the
 * number. `externalizeNonEthlete` hides that surface completely.
 */
export const externalizeFrameworkOnly = {
  name: 'externalize-framework-only',
  setup(build) {
    build.onResolve({ filter: /^[^./]/ }, (args) =>
      FRAMEWORK.test(args.path) ? { path: args.path, external: true } : undefined,
    );
  },
};

/** the esbuild options every script shares — an application production build, minus the app */
export const esbuildBase = () => ({
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  treeShaking: true,
  legalComments: 'none',
  define: {
    ngDevMode: 'false',
    ngJitMode: 'false',
    ngI18nClosureMode: 'false',
    'process.env.NODE_ENV': '"production"',
  },
  absWorkingDir: REPO,
  nodePaths: [join(REPO, 'node_modules')],
  logLevel: 'silent',
});

export const defaultDistLibs = () => join(REPO, 'dist/libs');
export const defaultEntriesFile = () => join(REPO, 'tools/treeshake/entries.example.json');
