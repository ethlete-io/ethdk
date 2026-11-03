import { readdirSync, readFileSync } from 'fs';
import { join, relative, resolve } from 'path';
import * as studioApi from '../../studio-api';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { partLinkOf } from '../sketch/part-definition';
import { KNOWN_ORPHAN_ENDPOINTS, KnownOrphan } from './orphan-endpoint-known';

const SERVED_PREFIX = '/__design/';

const sourcesOf = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourcesOf(path);

    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [readFileSync(path, 'utf8')] : [];
  });

const sourcesCallDesign = (dir: string) => sourcesOf(dir).some((source) => source.includes('__design'));

const isCalledIn = (path: string, sources: string[]) => {
  const tail = path.slice(SERVED_PREFIX.length);
  const written = new RegExp(
    `/__design/${tail}(?![\\w-])|\\bpath\\s*:\\s*['"\`]${tail}['"\`]|Url\\([^()]*,\\s*['"\`]${tail}['"\`]`,
    'u',
  );

  return sources.some((source) => written.test(source));
};

/** Every `/__design/…` path the CLI serves that no source file of `appDir` writes, as a path, as a `path:` property or as the name argument of a `…Url(…)` helper. */
export const orphanEndpointsOf = (options: { served: string[]; appDir: string; checkout: string }): Problem[] => {
  const sources = sourcesOf(options.appDir);

  if (!sources.some((source) => source.includes('__design'))) return [];

  const dir = relative(options.checkout, options.appDir);

  return options.served
    .filter((path) => !isCalledIn(path, sources))
    .map((path) => ({
      rule: 'ORPHAN-ENDPOINT',
      file: dir,
      message: `${path}: served by the design CLI, called nowhere in ${dir}`,
    }));
};

const appDirsOf = (product: ResolvedProduct) =>
  new Set(
    product.parts.flatMap((part) => {
      const link = partLinkOf(part.source);
      const component = link.kind === 'component' ? link.path : link.kind === 'route' ? link.component : null;
      const root = component?.match(/^(.*?\/src)\//u)?.[1];

      return root ? [root] : [];
    }),
  );

const servedPathsOf = (): string[] => {
  return Object.entries(studioApi as Record<string, unknown>).flatMap(([name, value]) =>
    name.endsWith('_PATH') && typeof value === 'string' && value.startsWith(SERVED_PREFIX) ? [value] : [],
  );
};

const pathOf = (problem: Problem) => problem.message.slice(0, problem.message.indexOf(':'));

/** Splits the orphans of an app into the unlisted ones and the listed ones (errors), and into warnings for the listed ones; a listed path that is no longer an orphan is an error. */
export const orphanEndpointVerdictOf = (options: {
  served: string[];
  appDir: string;
  checkout: string;
  known: KnownOrphan[];
}): { errors: Problem[]; warnings: Problem[] } => {
  const orphans = orphanEndpointsOf(options);
  const dir = relative(options.checkout, options.appDir);
  const backlogOf = new Map(options.known.map(({ path, backlog }) => [path, backlog]));
  const orphanPaths = new Set(orphans.map((problem) => pathOf(problem)));
  const checked = sourcesCallDesign(options.appDir);

  const errors = orphans.filter((problem) => !backlogOf.has(pathOf(problem)));
  const warnings = orphans.flatMap((problem) => {
    const path = pathOf(problem);
    const backlog = backlogOf.get(path);

    return backlog ? [{ ...problem, message: `${path}: orphan endpoint, known and tracked in ${backlog}` }] : [];
  });
  const stale = checked
    ? options.known
        .filter(({ path }) => !orphanPaths.has(path))
        .map(({ path, backlog }) => ({
          rule: 'ORPHAN-ENDPOINT',
          file: dir,
          message: `${path}: listed as a known orphan (${backlog}) but it has a caller again - remove it from KNOWN_ORPHAN_ENDPOINTS`,
        }))
    : [];

  return { errors: [...errors, ...stale], warnings };
};

const verdictsOf = (product: ResolvedProduct) => {
  const checkout = resolve(product.configFile, '../../..');

  return [...appDirsOf(product)].map((app) =>
    orphanEndpointVerdictOf({
      served: servedPathsOf(),
      appDir: resolve(checkout, app),
      checkout,
      known: KNOWN_ORPHAN_ENDPOINTS,
    }),
  );
};

/** A served path the app its parts implement never calls and the known list does not carry, or a listed path that has a caller again (`ORPHAN-ENDPOINT`); nothing for a product without such an app. */
export const orphanEndpointProblemsOf = (product: ResolvedProduct): Problem[] =>
  verdictsOf(product).flatMap((verdict) => verdict.errors);

/** One warning per known orphan endpoint. */
export const orphanEndpointWarningsOf = (product: ResolvedProduct): Problem[] =>
  verdictsOf(product).flatMap((verdict) => verdict.warnings);
