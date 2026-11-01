import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { basename, join, relative, resolve } from 'path';
import { DesignConfig } from '../paths';
import { DEFAULT_RENDER_MODULES, mapPackage, renderPackagesOf } from '../render-packages';

const SKIPPED_DIRS = new Set(['node_modules', 'scenarios', 'stories', '__fixtures__']);
const SKIPPED_FILE = /\.(spec|stories)\.ts$/;

const newestMtimeOf = (dir: string): number =>
  readdirSync(dir, { withFileTypes: true }).reduce((newest, entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? newest : Math.max(newest, newestMtimeOf(path));

    return entry.isFile() && !SKIPPED_FILE.test(entry.name) ? Math.max(newest, statSync(path).mtimeMs) : newest;
  }, 0);

const ethleteDependenciesOf = (dir: string): string[] => {
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Record<string, unknown>;

  return ['dependencies', 'peerDependencies'].flatMap((field) =>
    Object.keys((manifest[field] as Record<string, string> | undefined) ?? {}).filter((name) =>
      name.startsWith('@ethlete/'),
    ),
  );
};

/**
 * One warning line per checkout lib the drawings load from a build folder (the render modules and their `@ethlete/*`
 * dependencies) whose `libs/<name>/src` changed after that build, naming the command that rebuilds it.
 */
export const staleDistWarningsOf = (options: { target: string; config: DesignConfig | null }): string[] => {
  const { target, config } = options;
  const packages = renderPackagesOf({ target, config });
  const queue = [...(config?.render?.modules ?? DEFAULT_RENDER_MODULES)];
  const seen = new Set<string>();
  const lines: string[] = [];

  while (queue.length > 0) {
    const specifier = queue.shift() as string;

    if (seen.has(specifier)) continue;

    seen.add(specifier);

    const mapped = mapPackage({ specifier, packages, target });

    if (!mapped || mapped.dir.split(/[\\/]/).includes('node_modules') || !existsSync(join(mapped.dir, 'package.json')))
      continue;

    queue.push(...ethleteDependenciesOf(mapped.dir));

    const name = basename(mapped.dir);
    const source = resolve(target, 'libs', name, 'src');

    if (!existsSync(source) || newestMtimeOf(source) <= newestMtimeOf(mapped.dir)) continue;

    lines.push(
      `WARNING STALE BUILD ${specifier} - ${relative(target, source)} changed after ${relative(target, mapped.dir)} was built; the drawings use the old build - run npx nx build ${name}`,
    );
  }

  return lines;
};
