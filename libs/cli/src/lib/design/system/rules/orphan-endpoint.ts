import { readdirSync, readFileSync } from 'fs';
import { join, relative, resolve } from 'path';
import * as studioApi from '../../studio-api';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { partLinkOf } from '../sketch/part-definition';

const SERVED_PREFIX = '/__design/';

const sourcesOf = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourcesOf(path);

    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [readFileSync(path, 'utf8')] : [];
  });

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

/** A served path the app its parts implement never calls (`ORPHAN-ENDPOINT`); nothing for a product without such an app. */
export const orphanEndpointProblemsOf = (product: ResolvedProduct): Problem[] => {
  const checkout = resolve(product.configFile, '../../..');

  return [...appDirsOf(product)].flatMap((app) =>
    orphanEndpointsOf({ served: servedPathsOf(), appDir: resolve(checkout, app), checkout }),
  );
};
