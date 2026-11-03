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

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

const declarationsOf = (source: string) => {
  const starts = [...source.matchAll(/^(?:export\s+)?(?:const|function)\s+([\w$]+)/gmu)];

  return starts.map((match, index) => ({
    name: match[1] as string,
    text: source.slice(match.index, starts[index + 1]?.index ?? source.length),
  }));
};

const writerStateOf = (writer: string, sources: string[]) => {
  const code = sources.map((source) => source.replace(/^import\s[^;]*;/gmu, ''));
  const mention = new RegExp(`(?<![\\w$])${escaped(writer)}(?![\\w$])`, 'u');
  const declaration = code.flatMap((source) => declarationsOf(source)).find(({ name }) => name === writer);

  if (!declaration) return 'missing' as const;

  return code.some((source) => mention.test(source.split(declaration.text).join(''))) ? 'called' : 'uncalled';
};

const isCalledIn = (path: string, sources: string[]) => {
  const tail = path.slice(SERVED_PREFIX.length);
  const direct = new RegExp(`/__design/${tail}(?![\\w-])|\\bpath\\s*:\\s*['"\`]${tail}['"\`]`, 'u');
  const viaHelper = new RegExp(`Url\\([^()]*,\\s*['"\`]${tail}['"\`]`, 'u');

  if (sources.some((source) => direct.test(source))) return true;

  const code = sources.map((source) => source.replace(/^import\s[^;]*;/gmu, ''));

  return code.some((source) =>
    declarationsOf(source)
      .filter(({ text }) => viaHelper.test(text))
      .some(({ name, text }) => {
        const mention = new RegExp(`(?<![\\w$])${escaped(name)}(?![\\w$])`, 'u');

        return code.some((other) => mention.test(other.split(text).join('')));
      }),
  );
};

/** Every `/__design/…` path the CLI serves that no source file of `appDir` writes, as a path, as a `path:` property or as the name argument of a `…Url(…)` helper inside a function the app calls. */
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

/** Splits the orphans of an app into errors (unlisted) and warnings (listed as never written). A known entry whose state no longer holds is an error: a never-written path that has a caller, or a written-by path whose writer is gone, uncalled or not writing it. */
export const orphanEndpointVerdictOf = (options: {
  served: string[];
  appDir: string;
  checkout: string;
  known: KnownOrphan[];
}): { errors: Problem[]; warnings: Problem[] } => {
  const orphans = orphanEndpointsOf(options);
  const dir = relative(options.checkout, options.appDir);
  const backlogOf = new Map(options.known.map(({ path, backlog }) => [path, backlog]));
  const neverWritten = new Map(
    options.known.flatMap(({ path, backlog, state }) =>
      state.kind === 'never-written' ? [[path, backlog] as const] : [],
    ),
  );
  const orphanPaths = new Set(orphans.map((problem) => pathOf(problem)));
  const checked = sourcesCallDesign(options.appDir);

  const errors = orphans.filter((problem) => !backlogOf.has(pathOf(problem)));
  const warnings = orphans.flatMap((problem) => {
    const path = pathOf(problem);
    const backlog = neverWritten.get(path);

    return backlog ? [{ ...problem, message: `${path}: orphan endpoint, known and tracked in ${backlog}` }] : [];
  });
  const sources = checked ? sourcesOf(options.appDir) : [];
  const drifted = checked
    ? options.known.flatMap(({ path, state }) => {
        if (state.kind !== 'written-by') return [];

        const writerState = writerStateOf(state.writer, sources);
        const problem = (message: string) => [{ rule: 'ORPHAN-ENDPOINT', file: dir, message: `${path}: ${message}` }];

        if (writerState === 'missing')
          return problem(
            `listed as written by ${state.writer}, which no longer exists in ${dir} - fix the entry or call the endpoint again`,
          );
        if (writerState === 'uncalled')
          return problem(
            `listed as written by ${state.writer}, which no app file calls any more - fix the entry or call the writer again`,
          );
        if (orphanPaths.has(path))
          return problem(
            `listed as written by ${state.writer}, but ${dir} does not write it - fix the entry or the writer`,
          );

        return [];
      })
    : [];
  const stale = checked
    ? options.known
        .filter(({ path, state }) => state.kind === 'never-written' && !orphanPaths.has(path))
        .map(({ path, backlog }) => ({
          rule: 'ORPHAN-ENDPOINT',
          file: dir,
          message: `${path}: listed as never written (${backlog}) but it has a caller again - remove it from KNOWN_ORPHAN_ENDPOINTS`,
        }))
    : [];

  return { errors: [...errors, ...drifted, ...stale], warnings };
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

/** A served path the app its parts implement never calls and the known list does not carry, or a known entry whose expected state no longer holds (`ORPHAN-ENDPOINT`); nothing for a product without such an app. */
export const orphanEndpointProblemsOf = (product: ResolvedProduct): Problem[] =>
  verdictsOf(product).flatMap((verdict) => verdict.errors);

/** One warning per known orphan endpoint. */
export const orphanEndpointWarningsOf = (product: ResolvedProduct): Problem[] =>
  verdictsOf(product).flatMap((verdict) => verdict.warnings);
