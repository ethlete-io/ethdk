import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { createRequire } from 'module';
import { tmpdir } from 'os';
import { basename, dirname, join, relative, resolve } from 'path';
import { spawnPlain } from '../../../plain-output';
import { DESIGN_DIR } from '../../design-config';
import { ResolvedProduct } from '../resolve-product';
import { contentsBelow } from './clean-copy';
import { MergeRefusal } from './merge';
import { Sketch, sketchReportPath, staleReadyRefusalOf } from './sketch';

type AssetMapping = { input: string; output: string };

type AppBuild = { name: string; root: string; styles: string[]; assets: AssetMapping[]; external: string[] };

/** Runs the given files' related specs in `cwd`; answers the failing spec paths, or why the run could not report. */
export type AppSpecRunner = (options: { cwd: string; files: string[] }) => string[] | string;

const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'tmp', 'coverage']);
const CSS_IMPORT = /@import\s+(?:url\(\s*)?(['"])([^'"]+)\1/gu;
const CSS_URL = /url\(\s*(['"]?)([^'")]*?)\1\s*\)/gu;
const CSS_COMMENT = /\/\*[\s\S]*?\*\//gu;

const isDir = (path: string) => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

const projectFilesBelow = (root: string, dir = ''): string[] =>
  readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = dir === '' ? entry.name : `${dir}/${entry.name}`;

    if (entry.name === 'project.json' && dir !== '') return [rel];
    if (entry.name.startsWith('.') || SKIPPED_DIRS.has(entry.name) || rel.split('/').length > 3) return [];

    return isDir(resolve(root, rel)) ? projectFilesBelow(root, rel) : [];
  });

const inputOf = (entry: unknown) =>
  typeof entry === 'string' ? entry : ((entry as { input?: unknown } | null)?.input ?? null);

const assetOf = (root: string, entry: unknown): AssetMapping | null => {
  if (typeof entry === 'string') return { input: resolve(root, entry), output: basename(entry) };

  const { input, output } = (entry ?? {}) as { input?: unknown; output?: unknown };

  if (typeof input !== 'string') return null;

  return { input: resolve(root, input), output: typeof output === 'string' ? output.replace(/^\/+|\/+$/gu, '') : '' };
};

/** The app builds of the workspace at `root`: each `project.json` target whose options list `styles`. */
export const appBuildsOf = (root: string): AppBuild[] =>
  projectFilesBelow(root).flatMap((file) => {
    let project: { name?: string; targets?: Record<string, { options?: Record<string, unknown> }> };

    try {
      project = JSON.parse(readFileSync(resolve(root, file), 'utf8'));
    } catch {
      return [];
    }

    return Object.values(project.targets ?? {}).flatMap(({ options }) => {
      if (!Array.isArray(options?.['styles'])) return [];

      const styles = (options['styles'] as unknown[]).flatMap((entry) => {
        const input = inputOf(entry);

        return typeof input === 'string' ? [resolve(root, input)] : [];
      });

      return [
        {
          name: project.name ?? dirname(file),
          root: resolve(root, dirname(file)),
          styles,
          assets: ((options['assets'] as unknown[] | undefined) ?? []).flatMap((entry) => assetOf(root, entry) ?? []),
          external: ((options['externalDependencies'] as unknown[] | undefined) ?? []).filter(
            (dep): dep is string => typeof dep === 'string',
          ),
        },
      ];
    });
  });

const cssOf = (file: string) => readFileSync(file, 'utf8').replace(CSS_COMMENT, '');

/** Every stylesheet an app build bundles through the relative `@import`s of its style entries. */
export const styleChainOf = (build: AppBuild) => {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file) || !existsSync(file)) return;

    seen.add(file);

    for (const [, , specifier = ''] of cssOf(file).matchAll(CSS_IMPORT))
      if (specifier.startsWith('.')) visit(resolve(dirname(file), specifier));
  };

  build.styles.forEach(visit);

  return seen;
};

const urlResolves = (options: { build: AppBuild; file: string; url: string }) => {
  const { build, file, url } = options;
  const path = url.split(/[?#]/u)[0] ?? '';

  if (path === '' || /^(?:[a-z][a-z\d+.-]*:|\/)/iu.test(url)) return true;

  if (build.external.some((dep) => path === dep || path.startsWith(`${dep}/`)))
    return build.assets.some(({ input, output }) => {
      const prefix = output === '' ? '' : `${output}/`;

      return path.startsWith(prefix) && existsSync(resolve(input, path.slice(prefix.length)));
    });

  if (existsSync(resolve(dirname(file), path))) return true;
  if (path.startsWith('.')) return false;

  try {
    createRequire(file).resolve(path);
    return true;
  } catch {
    return false;
  }
};

/**
 * The `url()`s of the merged stylesheets that an app build bundles and cannot resolve, as `<file>: url(<url>) ...`
 * lines - resolved the way the build does: relative to the stylesheet, or through an `externalDependencies` prefix
 * into the build's `assets` output.
 */
export const unresolvedAppUrlsOf = (options: { root: string; files: string[] }) => {
  const merged = new Set(options.files.filter((file) => file.endsWith('.css')));

  return appBuildsOf(options.root).flatMap((build) =>
    [...styleChainOf(build)]
      .filter((file) => merged.has(file))
      .flatMap((file) =>
        [...cssOf(file).matchAll(CSS_URL)]
          .map(([, , url = '']) => url.trim())
          .filter((url) => !urlResolves({ build, file, url }))
          .map((url) => `${relative(options.root, file)}: url(${url}) does not resolve in the ${build.name} build`),
      ),
  );
};

const specFilesBelow = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.') || SKIPPED_DIRS.has(entry.name)) return [];

    const path = join(dir, entry.name);

    if (entry.isDirectory()) return specFilesBelow(path);

    return /\.spec\.[cm]?[jt]sx?$/u.test(entry.name) ? [path] : [];
  });

const VITEST_CONFIG = /^vite(?:st)?\.config\.[cm]?[jt]s$/u;

/** Runs `vitest related` from the app folder with the workspace's own vitest. */
export const vitestRelatedRunner =
  (root: string): AppSpecRunner =>
  ({ cwd, files }) => {
    const bin = resolve(root, 'node_modules/vitest/vitest.mjs');

    if (!existsSync(bin) || !readdirSync(cwd).some((name) => VITEST_CONFIG.test(name))) return [];

    const dir = mkdtempSync(join(tmpdir(), 'ethlete-merge-specs-'));
    const report = join(dir, 'report.json');

    try {
      const ran = spawnPlain(
        [process.execPath, bin, 'related', '--run', '--reporter=json', `--outputFile=${report}`, ...files],
        { cwd },
      );

      if (!existsSync(report))
        return ran.status === 0
          ? []
          : `vitest related did not report: ${(ran.stderr || ran.error?.message || '').trim().slice(-400)}`;

      const { testResults = [] } = JSON.parse(readFileSync(report, 'utf8')) as {
        testResults?: { name: string; status: string }[];
      };

      return testResults.filter(({ status }) => status !== 'passed').map(({ name }) => name);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

/**
 * Runs, in each app build whose stylesheets reach a file below `dirs`, `vitest related` on the merged files plus the
 * app's specs that name one of its bundled stylesheets (the module graph does not see a spec that reads a stylesheet).
 * Answers the failing specs relative to `root`, or why a run could not report.
 */
export const failingAppSpecsOf = (options: {
  root: string;
  dirs: string[];
  files: string[];
  runSpecs?: AppSpecRunner;
}): string[] | string => {
  const { root, dirs, files } = options;
  const runSpecs = options.runSpecs ?? vitestRelatedRunner(root);
  const failing: string[] = [];

  for (const build of appBuildsOf(root)) {
    const chain = [...styleChainOf(build)];

    if (!chain.some((file) => dirs.some((dir) => file.startsWith(`${dir}/`)))) continue;

    const names = chain.filter((file) => file.startsWith(`${build.root}/`)).map((file) => basename(file));
    const specs = existsSync(build.root)
      ? specFilesBelow(build.root).filter((spec) => {
          const source = readFileSync(spec, 'utf8');

          return names.some((name) => source.includes(name));
        })
      : [];
    const ran = runSpecs({ cwd: build.root, files: [...files, ...specs] });

    if (typeof ran === 'string') return ran;

    failing.push(...ran.map((spec) => relative(root, resolve(build.root, spec))));
  }

  return [...new Set(failing)];
};

const putBack = (options: { root: string; before: Map<string, Buffer>; after: Map<string, Buffer> }) => {
  const { root, before, after } = options;

  for (const [file, content] of before) {
    if (after.get(file)?.equals(content)) continue;

    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }

  for (const file of after.keys()) {
    if (before.has(file)) continue;

    rmSync(file, { force: true });

    for (
      let dir = dirname(file);
      dir.startsWith(`${root}/`) && existsSync(dir) && readdirSync(dir).length === 0;
      dir = dirname(dir)
    )
      rmdirSync(dir);
  }
};

const appGateRefusalOf = (options: {
  target: string;
  dirs: string[];
  files: string[];
  merging: string;
  runAppSpecs?: AppSpecRunner;
}): MergeRefusal | null => {
  const { target, dirs, files, merging } = options;
  const unresolved = unresolvedAppUrlsOf({ root: target, files });

  if (unresolved.length > 0)
    return {
      reason: `${unresolved.join('\n')}\nthe merge of ${merging} would break the app build - the product's old files are back, the sketch stays`,
      findings: unresolved,
    };

  const red = failingAppSpecsOf({ root: target, dirs, files, runSpecs: options.runAppSpecs });

  if (red.length === 0) return null;

  const findings = typeof red === 'string' ? [red] : red;

  return {
    reason: `${findings.join('\n')}\nthe app specs fail after the merge of ${merging} - the product's old files are back, the sketch stays`,
    findings,
  };
};

/**
 * Refuses a picked variant whose files changed since `sketch ready` judged them. Runs `merge` and holds its result against the app builds that bundle the product: a merged stylesheet `url()` an app
 * build cannot resolve, or a failing app spec related to the merged files, puts every design file back as it was and
 * answers the refusal instead.
 */
export const appGatedMergeOf = (options: {
  target: string;
  product: ResolvedProduct;
  sketch: Sketch;
  merge: () => string[] | MergeRefusal;
  runAppSpecs?: AppSpecRunner;
}): string[] | MergeRefusal => {
  const { target, product, sketch } = options;
  const stale = staleReadyRefusalOf(sketch);

  if (stale !== null) return { reason: stale };

  const dirs = [product.dir, ...(product.base ? [product.base.dir] : [])];
  const roots = [resolve(target, DESIGN_DIR), ...dirs, sketchReportPath({ checkout: target, sketch })];
  const before = contentsBelow(roots);
  const merged = options.merge();

  if (!Array.isArray(merged)) return merged;

  const after = contentsBelow(roots);
  const files = [...after].flatMap(([file, content]) => (before.get(file)?.equals(content) ? [] : [file]));
  const variant = sketch.decision?.kind === 'pick' ? sketch.decision.variant : '';
  const refusal = appGateRefusalOf({
    target,
    dirs,
    files,
    merging: `${sketch.target} variant "${variant}"`,
    runAppSpecs: options.runAppSpecs,
  });

  if (refusal === null) return merged;

  putBack({ root: target, before, after });

  return refusal;
};
